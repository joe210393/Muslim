import {
  ErrorCodes,
  NotificationType,
  UserRole,
  sha256Hex,
  type ChangePasswordRequest,
  type ForgotPasswordRequest,
  type LoginRequest,
  type RegisterRequest,
  type ResetPasswordRequest,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import type { Response } from "express";
import type { Env } from "../../config/env";
import { ApiError } from "../../lib/errors";
import { rateLimit, type SessionActor } from "../../middleware/auth";
import { deliverNotification } from "../notifications/mailer";

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(env: Env) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.APP_ENV === "production",
    path: "/",
    maxAge: SESSION_MS,
  };
}

export function setCsrfCookie(res: Response, env: Env): string {
  const csrfToken = randomBytes(24).toString("base64url");
  res.cookie("mf_csrf", csrfToken, { ...cookieOptions(env), httpOnly: false });
  return csrfToken;
}

export function publicUser(user: SessionActor) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive,
  };
}

async function startSession(res: Response, env: Env, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = await sha256Hex(token);
  await prisma.session.create({
    data: { tokenHash, userId, expiresAt: new Date(Date.now() + SESSION_MS) },
  });
  res.cookie("mf_session", token, cookieOptions(env));
  return setCsrfCookie(res, env);
}

export async function register(env: Env, res: Response, input: RegisterRequest, ip: string) {
  rateLimit(`register:${ip}`, env.NODE_ENV === "test" ? 100 : 10);
  const email = input.email.trim().toLowerCase();
  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此 Email 已註冊", [{ path: "email", message: "此 Email 已註冊" }]);
  const existingTax = await prisma.organization.findUnique({ where: { taxId: input.taxId } });
  if (existingTax) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此統一編號已有業者帳號，請聯繫管理員處理，系統不會自動加入既有企業", [
      { path: "taxId", message: "此統一編號已有業者帳號，請聯繫管理員處理" },
    ]);
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        organizationName: input.organizationName,
        taxId: input.taxId,
        contactName: input.displayName,
        contactEmail: email,
      },
    });
    return tx.user.create({
      data: {
        email,
        passwordHash,
        displayName: input.displayName,
        role: UserRole.APPLICANT,
        organizationId: organization.id,
      },
    });
  });
  const csrfToken = await startSession(res, env, user.id);
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "REGISTER", entityType: "User", entityId: user.id, requestId: randomBytes(8).toString("hex"), safeChanges: { role: user.role } },
  });
  return { user: publicUser(user), csrfToken };
}

export async function login(env: Env, res: Response, input: LoginRequest, ip: string) {
  const email = input.email.trim().toLowerCase();
  rateLimit(`login:${ip}:${email}`, env.NODE_ENV === "test" ? 100 : 10);
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(input.password, user.passwordHash) : false;
  if (!user || !valid) {
    await prisma.auditLog.create({
      data: { action: "LOGIN_FAILED", entityType: "User", requestId: randomBytes(8).toString("hex"), safeChanges: { email } },
    });
    throw new ApiError(401, ErrorCodes.UNAUTHENTICATED, "帳號或密碼不正確");
  }
  if (!user.isActive) throw new ApiError(403, ErrorCodes.FORBIDDEN, "帳號已停用");
  const csrfToken = await startSession(res, env, user.id);
  await prisma.auditLog.create({
    data: { actorId: user.id, action: "LOGIN_SUCCESS", entityType: "User", entityId: user.id, requestId: randomBytes(8).toString("hex"), safeChanges: { result: "success" } },
  });
  return { user: publicUser(user), csrfToken };
}

export async function logout(res: Response, token: string | undefined) {
  if (token) {
    const tokenHash = await sha256Hex(token);
    await prisma.session.deleteMany({ where: { tokenHash } });
  }
  res.clearCookie("mf_session", { path: "/" });
  res.clearCookie("mf_csrf", { path: "/" });
}

export async function forgotPassword(env: Env, input: ForgotPasswordRequest, ip: string) {
  rateLimit(`forgot:${ip}`, env.NODE_ENV === "test" ? 100 : 8);
  const email = input.email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  const message = "若帳號存在，系統已建立密碼重設工作。此回應不表示信件已送達。";
  if (!user || !user.isActive) return { message };
  const token = randomBytes(32).toString("base64url");
  const tokenHash = await sha256Hex(token);
  await prisma.passwordResetToken.create({
    data: { tokenHash, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  });
  const job = await prisma.notificationJob.create({
    data: {
      dedupeKey: `reset:${user.id}:${tokenHash.slice(0, 12)}`,
      type: NotificationType.PASSWORD_RESET,
      recipientUserId: user.id,
      recipientEmail: user.email,
      status: "PENDING",
    },
  });
  const resetUrl = `${env.APP_BASE_URL}/reset-password?token=${token}`;
  await deliverNotification(env, job.id, env.MAIL_DRIVER === "console" ? resetUrl : "請使用信中的連結重設密碼。連結 30 分鐘內有效。");
  return { message };
}

export async function resetPassword(input: ResetPasswordRequest) {
  const tokenHash = await sha256Hex(input.token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "重設連結無效或已過期");
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  return { message: "密碼已更新，請重新登入" };
}

export async function changePassword(actor: SessionActor, input: ChangePasswordRequest) {
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "目前密碼不正確", [{ path: "currentPassword", message: "目前密碼不正確" }]);
  }
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: await bcrypt.hash(input.password, 10) } });
  return { message: "密碼已更新" };
}

import { ErrorCodes, UserRole, type UserRole as UserRoleValue } from "@mf/contracts";
import { sha256Hex } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/errors";

export type SessionActor = {
  id: string;
  email: string;
  displayName: string;
  role: UserRoleValue;
  organizationId: string | null;
  isActive: boolean;
};

const hits = new Map<string, { count: number; reset: number }>();

export function rateLimit(key: string, limit: number) {
  const now = Date.now();
  const current = hits.get(key);
  if (!current || current.reset < now) {
    hits.set(key, { count: 1, reset: now + 15 * 60 * 1000 });
    return;
  }
  current.count += 1;
  if (current.count > limit) {
    throw new ApiError(429, ErrorCodes.VALIDATION_ERROR, "嘗試次數過多，請稍後再試");
  }
}

export async function loadActor(req: Request): Promise<SessionActor | null> {
  const token = req.cookies?.mf_session as string | undefined;
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() < Date.now() || !session.user.isActive) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
    organizationId: session.user.organizationId,
    isActive: session.user.isActive,
  };
}

export async function requireActor(req: Request): Promise<SessionActor> {
  const actor = await loadActor(req);
  if (!actor) throw new ApiError(401, ErrorCodes.UNAUTHENTICATED, "請先登入");
  return actor;
}

export function requireRoles(actor: SessionActor, roles: UserRoleValue[]) {
  if (!roles.includes(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
}

export function assertCsrf(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const cookie = req.cookies?.mf_csrf as string | undefined;
  const header = req.header("x-csrf-token");
  if (!cookie || !header || cookie !== header) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, "CSRF 驗證失敗");
  }
}

export function csrfGuard(req: Request, _res: Response, next: NextFunction) {
  try {
    assertCsrf(req);
    next();
  } catch (error) {
    next(error);
  }
}

export function isStaff(role: UserRoleValue): boolean {
  return role === UserRole.ADMIN || role === UserRole.CASE_OFFICER;
}

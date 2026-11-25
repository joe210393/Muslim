import { ErrorCodes, systemConnectionWriteSchema } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { ApiError } from "../../lib/errors";
import type { Env } from "../../config/env";
import type { SessionActor } from "../../middleware/auth";
import { assertFeature } from "./access";

const DEFAULT_ID = "default";

export async function connectionRow() {
  const found = await prisma.systemConnection.findUnique({ where: { id: DEFAULT_ID } });
  if (found) return found;
  return prisma.systemConnection.create({ data: { id: DEFAULT_ID } });
}

export async function resolveMail(env: Env) {
  const row = await connectionRow();
  const password = row.smtpPassword || env.SMTP_PASSWORD;
  if (row.smtpHost) {
    return {
      host: row.smtpHost,
      port: row.smtpPort ?? 587,
      user: row.smtpUser,
      from: row.smtpFrom || env.MAIL_FROM,
      password,
      enabled: true,
      local: row.smtpHost === "127.0.0.1" || row.smtpHost === "localhost",
    };
  }
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    from: env.MAIL_FROM,
    password,
    enabled: env.MAIL_DRIVER === "smtp" && Boolean(env.SMTP_HOST),
    local: env.SMTP_HOST === "127.0.0.1" || env.SMTP_HOST === "localhost",
  };
}

export async function resolvePayment(env: Env) {
  const row = await connectionRow();
  const configured = row.ecpayEnv === "stage" || row.ecpayEnv === "production" ? row.ecpayEnv : env.ECPAY_ENV;
  return {
    stage: configured !== "production",
    merchantId: row.ecpayMerchantId || env.ECPAY_MERCHANT_ID,
    hashKey: row.ecpayHashKey || env.ECPAY_HASH_KEY,
    hashIv: row.ecpayHashIv || env.ECPAY_HASH_IV,
  };
}

function present(row: Awaited<ReturnType<typeof connectionRow>>, env: Env) {
  const ecpayEnv = row.ecpayEnv === "production" || row.ecpayEnv === "stage"
    ? row.ecpayEnv
    : env.ECPAY_ENV === "production" ? "production" : "stage";
  return {
    supportEnabled: row.supportEnabled,
    supportLabel: row.supportLabel,
    supportUrl: row.supportUrl,
    smtpHost: row.smtpHost || env.SMTP_HOST,
    smtpPort: row.smtpPort ?? env.SMTP_PORT,
    smtpUser: row.smtpUser || env.SMTP_USER,
    smtpFrom: row.smtpFrom || env.MAIL_FROM,
    smtpPasswordSet: Boolean(row.smtpPassword || env.SMTP_PASSWORD),
    ecpayEnv,
    ecpayMerchantId: row.ecpayMerchantId || env.ECPAY_MERCHANT_ID,
    ecpayHashKeySet: Boolean(row.ecpayHashKey || env.ECPAY_HASH_KEY),
    ecpayHashIvSet: Boolean(row.ecpayHashIv || env.ECPAY_HASH_IV),
    version: row.version,
  };
}

export async function getSystemConnection(actor: SessionActor, env: Env) {
  await assertFeature(actor, "users.manage");
  return present(await connectionRow(), env);
}

function secret(value: string | undefined) {
  const cleaned = value?.replace(/\s+/g, "") ?? "";
  return cleaned ? cleaned : undefined;
}

export async function saveSystemConnection(actor: SessionActor, env: Env, raw: unknown) {
  await assertFeature(actor, "users.manage");
  const input = systemConnectionWriteSchema.parse(raw);
  const current = await connectionRow();
  if (current.version !== input.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "設定已被更新，請重新載入");
  const smtpPassword = secret(input.smtpPassword);
  const ecpayHashKey = secret(input.ecpayHashKey);
  const ecpayHashIv = secret(input.ecpayHashIv);
  const saved = await prisma.systemConnection.update({
    where: { id: DEFAULT_ID },
    data: {
      ...(input.supportEnabled !== undefined ? { supportEnabled: input.supportEnabled } : {}),
      ...(input.supportLabel !== undefined ? { supportLabel: input.supportLabel } : {}),
      ...(input.supportUrl !== undefined ? { supportUrl: input.supportUrl } : {}),
      ...(input.smtpHost !== undefined ? { smtpHost: input.smtpHost } : {}),
      ...(input.smtpPort !== undefined ? { smtpPort: input.smtpPort } : {}),
      ...(input.smtpUser !== undefined ? { smtpUser: input.smtpUser } : {}),
      ...(input.smtpFrom !== undefined ? { smtpFrom: input.smtpFrom } : {}),
      ...(smtpPassword ? { smtpPassword } : {}),
      ...(input.ecpayEnv !== undefined ? { ecpayEnv: input.ecpayEnv } : {}),
      ...(input.ecpayMerchantId !== undefined ? { ecpayMerchantId: input.ecpayMerchantId } : {}),
      ...(ecpayHashKey ? { ecpayHashKey } : {}),
      ...(ecpayHashIv ? { ecpayHashIv } : {}),
      version: { increment: 1 },
    },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "SYSTEM_CONNECTION_UPDATE",
      entityType: "SystemConnection",
      entityId: null,
      requestId: crypto.randomUUID(),
      safeChanges: {
        supportEnabled: saved.supportEnabled,
        supportLabel: saved.supportLabel,
        supportUrl: saved.supportUrl,
        smtpHost: saved.smtpHost,
        smtpPort: saved.smtpPort,
        smtpUser: saved.smtpUser,
        smtpFrom: saved.smtpFrom,
        smtpPasswordChanged: Boolean(smtpPassword),
        ecpayEnv: saved.ecpayEnv,
        ecpayMerchantId: saved.ecpayMerchantId,
        ecpayHashKeyChanged: Boolean(ecpayHashKey),
        ecpayHashIvChanged: Boolean(ecpayHashIv),
      },
    },
  });
  return present(saved, env);
}

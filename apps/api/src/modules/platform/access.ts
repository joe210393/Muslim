import {
  ErrorCodes,
  INTEGRATION_DEFAULTS,
  PLATFORM_FEATURES,
  STAFF_FEATURES,
  UserRole,
  defaultFeatureEnabled,
  roleForAccountFeatures,
  type FeatureToggle,
  type IntegrationWrite,
  type PlatformFeatureKey,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";

let pending: Promise<void> | null = null;

export function ensurePlatform(): Promise<void> {
  pending ??= writeDefaults().catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}

async function writeDefaults() {
  for (const item of INTEGRATION_DEFAULTS) {
    await prisma.integrationSetting.upsert({
      where: { key: item.key },
      create: { ...item },
      update: {},
    });
  }
  const users = await prisma.user.findMany({ select: { id: true, role: true } });
  for (const user of users) await ensureUserFeatures(user.id, user.role);
}

export async function ensureUserFeatures(userId: string, role: UserRole) {
  const count = await prisma.userFeature.count({ where: { userId } });
  if (count > 0) return;
  await prisma.userFeature.createMany({
    data: PLATFORM_FEATURES.map((feature) => ({
      userId,
      featureKey: feature.key,
      enabled: defaultFeatureEnabled(role, feature.key),
    })),
  });
}

export async function enabledFeatureKeys(userId: string, role: UserRole): Promise<PlatformFeatureKey[]> {
  await ensureUserFeatures(userId, role);
  const rows = await prisma.userFeature.findMany({ where: { userId, enabled: true } });
  return rows.map((row) => row.featureKey as PlatformFeatureKey);
}

export async function assertFeature(actor: SessionActor, featureKey: PlatformFeatureKey) {
  await ensurePlatform();
  const keys = await enabledFeatureKeys(actor.id, actor.role);
  if (!keys.includes(featureKey)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "這個帳號目前沒有此功能");
}

export async function assertIntegration(key: "email" | "payment" | "media" | "signature") {
  await ensurePlatform();
  const row = await prisma.integrationSetting.findUnique({ where: { key } });
  if (row && !row.enabled) throw new ApiError(403, ErrorCodes.FORBIDDEN, `${row.label}尚未啟用`);
}

export async function listAccess() {
  await ensurePlatform();
  const [users, features, integrations] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.userFeature.findMany(),
    prisma.integrationSetting.findMany(),
  ]);
  const labels = new Map(STAFF_FEATURES.map((item) => [item.key, item.label]));
  return {
    accounts: users.filter((user) => user.role !== UserRole.APPLICANT).map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      features: STAFF_FEATURES.map((feature) => ({
        featureKey: feature.key,
        label: labels.get(feature.key) ?? feature.key,
        enabled: features.find((item) => item.userId === user.id && item.featureKey === feature.key)?.enabled ?? false,
      })),
    })),
    integrations: integrations
      .map((item) => ({ key: item.key, label: item.label, provider: item.provider, enabled: item.enabled, note: item.note }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant")),
  };
}

export async function updateFeature(actor: SessionActor, input: FeatureToggle) {
  await assertFeature(actor, "users.manage");
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.role === UserRole.APPLICANT) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到員工帳號。業者功能是固定的，不能在這裡調整");
  if (input.featureKey === "users.manage" && !input.enabled) {
    const others = await prisma.userFeature.count({
      where: { featureKey: "users.manage", enabled: true, userId: { not: user.id }, user: { isActive: true } },
    });
    if (others === 0) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "不能關閉最後一個帳號的帳號管理，否則無法再改權限");
  }
  await ensureUserFeatures(user.id, user.role);
  const saved = await prisma.userFeature.update({
    where: { userId_featureKey: { userId: user.id, featureKey: input.featureKey } },
    data: { enabled: input.enabled },
  });
  const enabled = await prisma.userFeature.findMany({ where: { userId: user.id, enabled: true } });
  const nextRole = roleForAccountFeatures(user.role, enabled.map((item) => item.featureKey));
  if (nextRole !== user.role) await prisma.user.update({ where: { id: user.id }, data: { role: nextRole } });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "FEATURE_UPDATE",
      entityType: "UserFeature",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { userId: user.id, featureKey: input.featureKey, enabled: input.enabled },
    },
  });
  return { userId: saved.userId, featureKey: saved.featureKey, enabled: saved.enabled };
}

export async function updateIntegration(actor: SessionActor, input: IntegrationWrite) {
  await assertFeature(actor, "integrations.edit");
  const saved = await prisma.integrationSetting.update({
    where: { key: input.key },
    data: { provider: input.provider, enabled: input.enabled, note: input.note },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "INTEGRATION_UPDATE",
      entityType: "IntegrationSetting",
      requestId: crypto.randomUUID(),
      safeChanges: { key: input.key, provider: input.provider, enabled: input.enabled },
    },
  });
  return { key: saved.key, label: saved.label, provider: saved.provider, enabled: saved.enabled, note: saved.note };
}

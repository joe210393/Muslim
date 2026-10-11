import {
  ErrorCodes,
  INTEGRATION_DEFAULTS,
  PLATFORM_FEATURES,
  UserRole,
  defaultFeatureEnabled,
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
  for (const role of [UserRole.APPLICANT, UserRole.CASE_OFFICER, UserRole.ADMIN]) {
    for (const feature of PLATFORM_FEATURES) {
      await prisma.roleFeature.upsert({
        where: { role_featureKey: { role, featureKey: feature.key } },
        create: { role, featureKey: feature.key, enabled: defaultFeatureEnabled(role, feature.key) },
        update: {},
      });
    }
  }
  for (const item of INTEGRATION_DEFAULTS) {
    await prisma.integrationSetting.upsert({
      where: { key: item.key },
      create: { ...item },
      update: {},
    });
  }
}

export async function assertFeature(actor: SessionActor, featureKey: PlatformFeatureKey) {
  await ensurePlatform();
  const row = await prisma.roleFeature.findUnique({ where: { role_featureKey: { role: actor.role, featureKey } } });
  if (!row?.enabled) throw new ApiError(403, ErrorCodes.FORBIDDEN, "這個角色目前沒有此功能");
}

export async function assertIntegration(key: "email" | "payment" | "media" | "signature") {
  await ensurePlatform();
  const row = await prisma.integrationSetting.findUnique({ where: { key } });
  if (row && !row.enabled) throw new ApiError(403, ErrorCodes.FORBIDDEN, `${row.label}尚未啟用`);
}

export async function listAccess() {
  await ensurePlatform();
  const [features, integrations] = await Promise.all([prisma.roleFeature.findMany(), prisma.integrationSetting.findMany()]);
  const labels = new Map(PLATFORM_FEATURES.map((item) => [item.key, item.label]));
  return {
    features: features
      .map((item) => ({
        role: item.role,
        featureKey: item.featureKey,
        label: labels.get(item.featureKey as PlatformFeatureKey) ?? item.featureKey,
        enabled: item.enabled,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant") || a.role.localeCompare(b.role)),
    integrations: integrations
      .map((item) => ({ key: item.key, label: item.label, provider: item.provider, enabled: item.enabled, note: item.note }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-Hant")),
  };
}

export async function updateFeature(actor: SessionActor, input: FeatureToggle) {
  await assertFeature(actor, "users.manage");
  if (input.role === UserRole.ADMIN && input.featureKey === "users.manage" && !input.enabled) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "不能關閉管理員的帳號管理，否則無法再改權限");
  }
  const saved = await prisma.roleFeature.update({
    where: { role_featureKey: { role: input.role, featureKey: input.featureKey } },
    data: { enabled: input.enabled },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "FEATURE_UPDATE",
      entityType: "RoleFeature",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { role: input.role, featureKey: input.featureKey, enabled: input.enabled },
    },
  });
  return { role: saved.role, featureKey: saved.featureKey, enabled: saved.enabled };
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

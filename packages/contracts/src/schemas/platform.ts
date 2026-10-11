import { ContentSlot, ContractStatus, UserRole } from "@mf/db/enums";
import { z } from "zod";
import { isSafeHref, PLATFORM_FEATURES, type PlatformFeatureKey } from "../domain/platform-defaults";

const featureKeys = PLATFORM_FEATURES.map((item) => item.key) as [PlatformFeatureKey, ...PlatformFeatureKey[]];

const hrefSchema = z.string().max(200).refine(isSafeHref, "連結只能使用站內路徑");

export const siteContentWriteSchema = z.object({
  eyebrow: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(200),
  subtitle: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(4000),
  ctaLabel: z.string().trim().max(40),
  ctaHref: hrefSchema,
  secondaryCtaLabel: z.string().trim().max(40),
  secondaryCtaHref: hrefSchema,
  isPublished: z.boolean(),
  expectedVersion: z.number().int().positive(),
});

export const contractTemplateWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(12000),
  expectedVersion: z.number().int().positive(),
});

export const issueContractSchema = z.object({
  organizationId: z.string().uuid(),
});

export const contractBodyWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(12000),
  expectedVersion: z.number().int().positive(),
});

export const voidContractSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

export const signContractFieldsSchema = z.object({
  signerName: z.string().trim().min(1).max(100),
  signerTitle: z.string().trim().min(1).max(100),
  expectedVersion: z.coerce.number().int().positive(),
  consent: z.literal("true"),
});

export const featureToggleSchema = z.object({
  role: z.nativeEnum(UserRole),
  featureKey: z.enum(featureKeys),
  enabled: z.boolean(),
});

export const integrationWriteSchema = z.object({
  key: z.enum(["email", "payment", "media", "signature"]),
  provider: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  note: z.string().trim().min(1).max(500),
});

export const contentSlotSchema = z.nativeEnum(ContentSlot);
export const contractStatusSchema = z.nativeEnum(ContractStatus);

export type SiteContentWrite = z.infer<typeof siteContentWriteSchema>;
export type ContractTemplateWrite = z.infer<typeof contractTemplateWriteSchema>;
export type ContractBodyWrite = z.infer<typeof contractBodyWriteSchema>;
export type FeatureToggle = z.infer<typeof featureToggleSchema>;
export type IntegrationWrite = z.infer<typeof integrationWriteSchema>;

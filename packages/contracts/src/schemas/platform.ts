import { ContentSlot, ContractStatus, EditorialKind } from "@mf/db/enums";
import { z } from "zod";
import { isSafeHref, isSupportUrl, PLATFORM_FEATURES, STAFF_FEATURES, youtubeVideoId, type PlatformFeatureKey } from "../domain/platform-defaults";

const featureKeys = PLATFORM_FEATURES.map((item) => item.key) as [PlatformFeatureKey, ...PlatformFeatureKey[]];
const staffFeatureKeys = STAFF_FEATURES.map((item) => item.key) as [Exclude<PlatformFeatureKey, "applications.create" | "contracts.sign">, ...Array<Exclude<PlatformFeatureKey, "applications.create" | "contracts.sign">>];

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
  youtubeUrl: z.string().trim().max(200).refine((value) => value === "" || youtubeVideoId(value) !== null, "請貼 YouTube 影片連結"),
  isPublished: z.boolean(),
  expectedVersion: z.number().int().positive(),
});

export const contractTemplateCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(100000),
});

export const certificateTemplateWriteSchema = z.object({
  body: z.string().trim().min(20).max(100000),
  titleZh: z.string().trim().min(1).max(200).optional(),
  titleEn: z.string().trim().min(1).max(200).optional(),
  expectedVersion: z.number().int().positive(),
});

export const contractTemplateWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(100000),
  expectedVersion: z.number().int().positive(),
});

/** 立約方甲方欄位內大小章位置（百分比 0–100）。 */
export const contractSealPositionsSchema = z.object({
  companySealX: z.number().min(0).max(100),
  companySealY: z.number().min(0).max(100),
  personSealX: z.number().min(0).max(100),
  personSealY: z.number().min(0).max(100),
});

export const issueContractSchema = z.object({
  organizationId: z.string().uuid(),
  templateId: z.string().uuid(),
  /** 對應業者尚未完成合約的申請；有多筆時必選 */
  applicationId: z.string().uuid().optional().nullable(),
  /** 黃底欄位：管理員發出前填寫 */
  siteName: z.string().trim().min(1, "請填驗證場域名稱").max(200),
  feeAmount: z.string().trim().min(1, "請填費用總金額").max(40),
  checkHalalKitchen: z.boolean().default(false),
  checkHalalRestaurant: z.boolean().default(false),
  checkMuslimFriendlyRestaurant: z.boolean().default(false),
  checkMealService: z.boolean().default(false),
  checkDrinksSnacks: z.boolean().default(false),
  checkFullHalalKitchen: z.boolean().default(false),
  checkPartialKitchen: z.boolean().default(false),
  checkRestaurantRestroom: z.boolean().default(false),
  lodgingWithBreakfast: z.boolean().default(false),
  lodgingWithoutBreakfast: z.boolean().default(false),
  itemBreakfast: z.boolean().default(false),
  itemGuestRoom: z.boolean().default(false),
  checkExperience: z.boolean().default(false),
  checkExperienceWithFood: z.boolean().default(false),
  checkExperienceWithoutFood: z.boolean().default(false),
  checkEnvironment: z.boolean().default(false),
  checkShop: z.boolean().default(false),
  partyBName: z.string().trim().max(200).optional(),
  partyBAddress: z.string().trim().max(300).optional(),
  partyBOwner: z.string().trim().max(100).optional(),
  partyBTaxId: z.string().trim().max(20).optional(),
  signYear: z.string().trim().max(4).optional(),
  signMonth: z.string().trim().max(2).optional(),
  signDay: z.string().trim().max(2).optional(),
});

export const contractBodyWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(20).max(100000),
  expectedVersion: z.number().int().positive(),
});

export const voidContractSchema = z.object({
  expectedVersion: z.number().int().positive(),
});

/** 收回已發給廠商的合約。 */
export const recallContractSchema = voidContractSchema;

/** 待上傳合約改範本或黃底欄位。不改業者、申請與合約編號。 */
export const reviseContractSchema = issueContractSchema.omit({ organizationId: true, applicationId: true }).extend({
  expectedVersion: z.number().int().positive(),
});

export const contractFillSnapshotSchema = issueContractSchema.omit({ organizationId: true, templateId: true, applicationId: true }).extend({
  issuedOn: z.string().trim().min(8).max(10),
});

export const contractRenewalSchema = z.object({
  decision: z.enum(["RENEWED", "NOT_RENEWED"]),
  expectedVersion: z.number().int().positive(),
});

export const signContractFieldsSchema = z.object({
  signerName: z.string().trim().min(1).max(100),
  signerTitle: z.string().trim().min(1).max(100),
  expectedVersion: z.coerce.number().int().positive(),
  consent: z.literal("true"),
});

export const platformFeatureKeySchema = z.enum(featureKeys);
export const staffFeatureKeySchema = z.enum(staffFeatureKeys);

export const featureToggleSchema = z.object({
  userId: z.string().uuid(),
  featureKey: staffFeatureKeySchema,
  enabled: z.boolean(),
});

export const operationSettingSchema = z.object({
  renewalReminderDays: z.number().int().min(1).max(365),
  certificateTermMonths: z.number().int().min(1).max(36),
  attachmentMaxBytes: z.number().int().min(1024 * 1024).max(200 * 1024 * 1024),
  attachmentMaxMb: z.number().int().min(1).max(200),
  paymentDueDays: z.number().int().min(1).max(90),
  remitBankName: z.string(),
  remitAccountNo: z.string(),
  remitAccountName: z.string(),
  version: z.number().int().positive(),
});

export const operationSettingWriteSchema = z.object({
  renewalReminderDays: z.number().int().min(1, "續約提醒請填 1 到 365 天").max(365, "續約提醒請填 1 到 365 天").optional(),
  certificateTermMonths: z.number().int().min(1, "證書效期請填 1 到 36 個月").max(36, "證書效期請填 1 到 36 個月").optional(),
  attachmentMaxMb: z.number().int().min(1, "附件大小請填 1 到 200 MB").max(200, "附件大小請填 1 到 200 MB").optional(),
  paymentDueDays: z.number().int().min(1, "繳費期限請填 1 到 90 天").max(90, "繳費期限請填 1 到 90 天").optional(),
  remitBankName: z.string().trim().max(120, "銀行名稱最多 120 字").optional(),
  remitAccountNo: z.string().trim().max(40, "帳號最多 40 字").regex(/^[0-9-]*$/, "帳號只能填數字與 -").optional(),
  remitAccountName: z.string().trim().max(120, "戶名最多 120 字").optional(),
  expectedVersion: z.number().int().positive(),
}).refine((value) => [
  value.renewalReminderDays,
  value.certificateTermMonths,
  value.attachmentMaxMb,
  value.paymentDueDays,
  value.remitBankName,
  value.remitAccountNo,
  value.remitAccountName,
].some((item) => item !== undefined), { message: "請填要修改的項目" });

export const systemConnectionSchema = z.object({
  supportEnabled: z.boolean(),
  supportLabel: z.string(),
  supportUrl: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number().int(),
  smtpUser: z.string(),
  smtpFrom: z.string(),
  smtpPasswordSet: z.boolean(),
  ecpayEnv: z.enum(["stage", "production"]),
  ecpayMerchantId: z.string(),
  ecpayHashKeySet: z.boolean(),
  ecpayHashIvSet: z.boolean(),
  version: z.number().int().positive(),
});

export const systemConnectionWriteSchema = z.object({
  supportEnabled: z.boolean().optional(),
  supportLabel: z.string().trim().min(1, "請填客服按鈕文字").max(40, "客服按鈕文字最多 40 字").optional(),
  supportUrl: z.string().trim().max(500).refine(isSupportUrl, "客服連結請填站內路徑，或 https 開頭的網址").optional(),
  smtpHost: z.string().trim().max(200).optional(),
  smtpPort: z.number().int().min(1, "SMTP 埠請填 1 到 65535").max(65535, "SMTP 埠請填 1 到 65535").optional(),
  smtpUser: z.string().trim().max(320).optional(),
  smtpFrom: z.string().trim().max(320).optional(),
  smtpPassword: z.string().max(200).optional(),
  ecpayEnv: z.enum(["stage", "production"]).optional(),
  ecpayMerchantId: z.string().trim().max(20).optional(),
  ecpayHashKey: z.string().max(64).optional(),
  ecpayHashIv: z.string().max(64).optional(),
  expectedVersion: z.number().int().positive(),
}).refine((value) => Object.entries(value).some(([key, item]) => key !== "expectedVersion" && item !== undefined), { message: "請填要修改的項目" });

export const integrationWriteSchema = z.object({
  key: z.enum(["email", "payment", "media", "signature"]),
  provider: z.string().trim().min(1).max(80),
  enabled: z.boolean(),
  note: z.string().trim().min(1).max(500),
});

const editorialSlugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "代碼只能使用小寫英文、數字與連字號").max(80);
const editorialDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式為 YYYY-MM-DD").nullable();

const editorialBodySchema = z.object({
  groupLabel: z.string().trim().max(40).default(""),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(500).default(""),
  body: z.string().trim().min(1).max(4000),
  note: z.string().trim().max(200).default(""),
  youtubeUrl: z.string().trim().max(200).default("").refine((value) => value === "" || youtubeVideoId(value) !== null, "請貼 YouTube 影片連結"),
  publishedOn: editorialDateSchema,
  sortOrder: z.number().int().min(0).max(9999),
  isPublished: z.boolean(),
});

type EditorialBody = z.infer<typeof editorialBodySchema>;

function checkEditorial(kind: EditorialKind, value: EditorialBody, ctx: z.RefinementCtx) {
  if (kind === EditorialKind.NEWS) {
    if (!value.publishedOn) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["publishedOn"], message: "請填發布日期" });
    if (!value.summary) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["summary"], message: "請填摘要" });
  }
  if (kind === EditorialKind.FAQ && !value.groupLabel) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["groupLabel"], message: "請填分類" });
  if (kind === EditorialKind.FEE && !value.summary) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["summary"], message: "請填計費方式" });
  if (kind === EditorialKind.EMAIL_DRAFT && !value.summary) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["summary"], message: "請填寄送時機" });
}

export const editorialCreateSchema = editorialBodySchema.extend({
  kind: z.nativeEnum(EditorialKind),
  slug: editorialSlugSchema,
}).superRefine((value, ctx) => checkEditorial(value.kind, value, ctx));

export function editorialUpdateSchemaFor(kind: EditorialKind) {
  return editorialBodySchema.extend({ expectedVersion: z.number().int().positive() }).superRefine((value, ctx) => checkEditorial(kind, value, ctx));
}

export const contentSlotSchema = z.nativeEnum(ContentSlot);
export const editorialKindSchema = z.nativeEnum(EditorialKind);
export const contractStatusSchema = z.nativeEnum(ContractStatus);

export type SiteContentWrite = z.infer<typeof siteContentWriteSchema>;
export type EditorialCreate = z.infer<typeof editorialCreateSchema>;
export type EditorialUpdate = z.infer<ReturnType<typeof editorialUpdateSchemaFor>>;
export type ContractTemplateCreate = z.infer<typeof contractTemplateCreateSchema>;
export type ContractTemplateWrite = z.infer<typeof contractTemplateWriteSchema>;
export type ContractSealPositions = z.infer<typeof contractSealPositionsSchema>;
export type ContractBodyWrite = z.infer<typeof contractBodyWriteSchema>;
export type IssueContractInput = z.infer<typeof issueContractSchema>;
export type ReviseContractInput = z.infer<typeof reviseContractSchema>;
export type ContractFillSnapshot = z.infer<typeof contractFillSnapshotSchema>;
export type ContractRenewal = z.infer<typeof contractRenewalSchema>;
export type FeatureToggle = z.infer<typeof featureToggleSchema>;
export type IntegrationWrite = z.infer<typeof integrationWriteSchema>;
export type SystemConnection = z.infer<typeof systemConnectionSchema>;
export type SystemConnectionWrite = z.infer<typeof systemConnectionWriteSchema>;
export type OperationSetting = z.infer<typeof operationSettingSchema>;
export type OperationSettingWrite = z.infer<typeof operationSettingWriteSchema>;

import {
  CONTRACT_TEMPLATE_CODE,
  ContentSlot,
  ContractStatus,
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_TITLE,
  DEFAULT_EDITORIAL,
  DEFAULT_SITE_CONTENT,
  EditorialKind,
  INTEGRATION_DEFAULTS,
  PLATFORM_FEATURES,
  STAFF_FEATURES,
  UserRole,
  editorialCreateSchema,
  editorialUpdateSchemaFor,
  CONTRACT_PAGE_HEIGHT,
  CONTRACT_PAGE_WIDTH,
  defaultFeatureEnabled,
  isInTaipeiMonth,
  isServiceUnlocked,
  OFFICIAL_SERVICE_PLANS_2026,
  paymentActionSchema,
  paymentRecordWriteSchema,
  planIsVisibleToUser,
  roleForAccountFeatures,
  selectPlanSchema,
  servicePlanUpdateSchema,
  servicePlanWriteSchema,
  taipeiMonthTitle,
  paintContract,
  paintCertificate,
  pngPagesToPdf,
  detectFileSignature,
  formatContractNo,
  ensureContractHtml,
  ensureCertificateHtml,
  applyCertificateSignature,
  DEFAULT_AUDITOR_SIGNATURE_PATH,
  buildDefaultCertificateTemplates,
  applicationNeedsContract,
  isOpenApplicationForContract,
  issuableApplicationLabel,
  contractSealPositionsSchema,
  normalizeSealLayout,
  renderContractBody,
  sha256Hex,
  taipeiDateLabel,
  taipeiYear,
  type CertificateTemplateKey,
  type CertificateTemplateRow,
  type DemoDataset,
} from "@mf/contracts";
// CertificateTemplateRow used by ensure/list/save helpers
import { ZodError } from "zod";
import { ClientError, type AccessSettings, type AdminEditorialEntry, type AdminSiteSlot, type ContractItem, type SiteSlotInput } from "../services/types";

export type PlatformState = {
  contents: Array<AdminSiteSlot & { imageFileId: string | null }>;
  entries: Array<AdminEditorialEntry & { imageFileId: string | null }>;
  template: { id: string; code: string; title: string; body: string; revision?: number; version: number; updatedAt: string };
  templates?: Array<{ id: string; code: string; title: string; body: string; revision: number; version: number; updatedAt: string }>;
  contracts: Array<Omit<ContractItem, "hasSignature" | "hasFace" | "hasPdf"> & { body: string; templateId: string; applicationId?: string | null; faceFileId: string | null; signatureFileId: string | null; pdfFileId: string | null }>;
  features: Array<{ userId: string; featureKey: string; label: string; enabled: boolean }>;
  integrations: AccessSettings["integrations"];
  contractSequence: number;
  reports: Array<{ id: string; name: string; selections: Array<{ source: "APPLICATION" | "ORGANIZATION" | "ENROLLMENT" | "CONTRACT"; fieldKeys: string[] }>; chartKind: "table" | "bar" | "pie"; chartField: string; version: number; updatedAt: string; createdById: string }>;
  plans: Array<{
    id: string;
    name: string;
    amount: number;
    description: string;
    paymentUrl: string;
    isActive: boolean;
    version: number;
    updatedAt: string;
    images: Array<{ id: string; fileId: string; caption: string; sortOrder: number; imageUrl: string | null }>;
    visibleUserIds: string[];
  }>;
  payments: Array<{
    id: string;
    organizationId: string;
    organizationName: string;
    planId: string;
    planName: string;
    amount: number;
    paidAt: string | null;
    quoteConfirmedAt?: string | null;
    accountingConfirmedAt?: string | null;
    createdAt?: string;
    note: string;
    status?: "QUOTED" | "PENDING" | "PAID_PENDING" | "PAID";
    paymentMethod?: string;
  }>;
  seals: {
    companySealFileId: string | null;
    companySealX?: number;
    companySealY?: number;
    personSealX?: number;
    personSealY?: number;
    personSealFileId: string | null;
    updatedAt: string;
  };
  certificateTemplates?: CertificateTemplateRow[];
};

type Actor = DemoDataset["users"][number];

export function createInitialPlatform(data: DemoDataset): PlatformState {
  const now = new Date().toISOString();
  const org = data.organizations[0];
  const admin = data.users.find((user) => user.role === UserRole.ADMIN);
  const contractNo = formatContractNo(taipeiYear(), 1);
  const template = {
    id: crypto.randomUUID(),
    code: CONTRACT_TEMPLATE_CODE,
    title: DEFAULT_CONTRACT_TITLE,
    body: DEFAULT_CONTRACT_BODY,
    revision: 1,
    version: 1,
    updatedAt: now,
  };
  const contracts: PlatformState["contracts"] = [];
  if (org && admin) {
    contracts.push({
      id: crypto.randomUUID(),
      contractNo,
      organizationId: org.id,
      organizationName: org.organizationName,
      title: template.title,
      status: ContractStatus.ISSUED,
      signerName: null,
      signerTitle: null,
      signedAt: null,
      version: 1,
      createdAt: now,
      body: renderContractBody(template.body, {
        organizationName: org.organizationName,
        taxId: org.taxId,
        contractNo,
        issuedOn: taipeiDateLabel(),
      }),
      templateId: template.id,
      faceFileId: null,
      signatureFileId: null,
      pdfFileId: null,
    });
  }
  const plans = OFFICIAL_SERVICE_PLANS_2026.map((item) => ({
    id: crypto.randomUUID(),
    name: item.name,
    amount: item.amount,
    description: item.description,
    paymentUrl: "",
    isActive: true,
    version: 1,
    updatedAt: now,
    images: [] as PlatformState["plans"][number]["images"],
    visibleUserIds: [] as string[],
  }));
  return {
    contents: Object.values(ContentSlot).map((slot) => ({
      slot,
      ...DEFAULT_SITE_CONTENT[slot],
      imageUrl: null,
      imageFileId: null,
      isPublished: true,
      version: 1,
      updatedAt: now,
    })),
    entries: DEFAULT_EDITORIAL.map((item) => ({
      id: crypto.randomUUID(),
      ...item,
      youtubeUrl: "",
      imageFileId: null,
      imageUrl: null,
      isPublished: true,
      version: 1,
      updatedAt: now,
    })),
    template,
    templates: [template],
    contracts,
    features: data.users.flatMap((user) =>
      PLATFORM_FEATURES.map((feature) => ({
        userId: user.id,
        featureKey: feature.key,
        label: feature.label,
        enabled: defaultFeatureEnabled(user.role, feature.key),
      })),
    ),
    integrations: INTEGRATION_DEFAULTS.map((item) => ({ ...item })),
    contractSequence: 2,
    reports: [],
    plans,
    /** 業者須自行：選方案 → 付款 → 核帳後才開通，示範資料不預先開通。 */
    payments: [],
    seals: {
      companySealFileId: null,
      personSealFileId: null,
      companySealX: 8,
      companySealY: 4,
      personSealX: 42,
      personSealY: 14,
      updatedAt: now,
    },
    certificateTemplates: buildDefaultCertificateTemplates(now),
  };
}

export function ensureCertificateTemplates(platform: PlatformState) {
  const defaults = buildDefaultCertificateTemplates();
  if (!platform.certificateTemplates?.length) {
    platform.certificateTemplates = defaults;
    return platform.certificateTemplates;
  }
  const byKey = new Map(platform.certificateTemplates.map((item) => [item.key, item]));
  for (const item of defaults) {
    const existing = byKey.get(item.key);
    if (!existing) {
      platform.certificateTemplates.push(item);
      continue;
    }
    existing.logoFileId ??= item.logoFileId;
    // 未自行上傳時，跟隨預設類別 Logo（public/cert-logos）
    if (!existing.logoFileId) existing.logoUrl = item.logoUrl;
    else existing.logoUrl ??= item.logoUrl;
    existing.signatureFileId ??= null;
    if (!existing.signatureFileId) existing.signatureUrl = item.signatureUrl;
    const needsBodyRefresh =
      !existing.body.includes("data-certificate-logo")
      || /單位名稱 Licensee Name[\s\S]{0,240}certificate-center/.test(existing.body);
    if (needsBodyRefresh) existing.body = item.body;
    else if (!existing.body.includes("data-certificate-signature")) {
      existing.body = applyCertificateSignature(existing.body, DEFAULT_AUDITOR_SIGNATURE_PATH);
    }
  }
  return platform.certificateTemplates;
}

function presentCertificateTemplate(item: CertificateTemplateRow) {
  return {
    key: item.key,
    titleZh: item.titleZh,
    titleEn: item.titleEn,
    categoryCode: item.categoryCode,
    matchNote: item.matchNote,
    body: item.body,
    logoUrl: item.logoUrl,
    logoFileId: item.logoFileId,
    signatureUrl: item.signatureUrl,
    signatureFileId: item.signatureFileId,
    version: item.version,
    updatedAt: item.updatedAt,
  };
}

export function listCertificateTemplates(platform: PlatformState, actor: Actor) {
  if (!hasFeature(platform, actor.id, "applications.decide") && !hasFeature(platform, actor.id, "applications.review")) {
    throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
  }
  return ensureCertificateTemplates(platform).map(presentCertificateTemplate);
}

export function saveCertificateTemplate(
  platform: PlatformState,
  actor: Actor,
  key: CertificateTemplateKey,
  input: { body: string; titleZh?: string; titleEn?: string; expectedVersion: number },
) {
  if (!hasFeature(platform, actor.id, "applications.decide")) {
    throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
  }
  const rows = ensureCertificateTemplates(platform);
  const row = rows.find((item) => item.key === key);
  if (!row) throw new ClientError("找不到證書範本");
  if (row.version !== input.expectedVersion) throw new ClientError("範本已被其他人更新，請重新載入", { code: "CONFLICT", status: 409 });
  row.body = ensureCertificateHtml(input.body);
  if (input.titleZh?.trim()) row.titleZh = input.titleZh.trim();
  if (input.titleEn?.trim()) row.titleEn = input.titleEn.trim();
  row.version += 1;
  row.updatedAt = new Date().toISOString();
  return presentCertificateTemplate(row);
}

export async function uploadCertificateLogo(
  platform: PlatformState,
  actor: Actor,
  data: DemoDataset,
  key: CertificateTemplateKey,
  file: File,
) {
  if (!hasFeature(platform, actor.id, "applications.decide")) {
    throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
  }
  const rows = ensureCertificateTemplates(platform);
  const row = rows.find((item) => item.key === key);
  if (!row) throw new ClientError("找不到證書範本");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectFileSignature(bytes);
  if (!mime || (mime !== "image/png" && mime !== "image/jpeg")) {
    throw new ClientError("Logo 只接受 JPEG 或 PNG");
  }
  const stored = await rememberFile(data, actor.id, file.name || `${key}-logo`, mime, bytes);
  row.logoFileId = stored.id;
  row.logoUrl = `data:${mime};base64,${stored.contentBase64}`;
  row.version += 1;
  row.updatedAt = new Date().toISOString();
  return presentCertificateTemplate(row);
}

export async function uploadCertificateSignature(
  platform: PlatformState,
  actor: Actor,
  data: DemoDataset,
  key: CertificateTemplateKey,
  file: File,
) {
  if (!hasFeature(platform, actor.id, "applications.decide")) {
    throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
  }
  const rows = ensureCertificateTemplates(platform);
  const row = rows.find((item) => item.key === key);
  if (!row) throw new ClientError("找不到證書範本");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectFileSignature(bytes);
  if (!mime || (mime !== "image/png" && mime !== "image/jpeg")) {
    throw new ClientError("簽名檔只接受 PNG（建議透明背景）或 JPEG");
  }
  const stored = await rememberFile(data, actor.id, file.name || `${key}-signature`, mime, bytes);
  row.signatureFileId = stored.id;
  row.signatureUrl = `data:${mime};base64,${stored.contentBase64}`;
  row.version += 1;
  row.updatedAt = new Date().toISOString();
  return presentCertificateTemplate(row);
}

export async function renderCertificateBrowserPdf(input: { title: string; certificateNo: string; body: string; logoUrl?: string | null; signatureUrl?: string | null }) {
  if (input.signatureUrl) input = { ...input, body: applyCertificateSignature(input.body, input.signatureUrl) };
  else if (!/data-certificate-signature/i.test(input.body)) input = { ...input, body: applyCertificateSignature(input.body) };
  const embeddedLogo = input.body.match(/<img[^>]+class="[^"]*certificate-logo[^"]*"[^>]+src="([^"]+)"/i)?.[1]
    ?? input.body.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*certificate-logo/i)?.[1]
    ?? null;
  const embeddedSig = input.body.match(/<img[^>]+class="[^"]*certificate-signature[^"]*"[^>]+src="([^"]+)"/i)?.[1]
    ?? input.body.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*certificate-signature/i)?.[1]
    ?? DEFAULT_AUDITOR_SIGNATURE_PATH;
  const [logo, signature] = await Promise.all([
    loadBrowserImage(input.logoUrl || embeddedLogo),
    loadBrowserImage(embeddedSig),
  ]);
  const font = new FontFace("NotoSansTC", "url(/fonts/NotoSansTC-Subset.otf)");
  await font.load();
  document.fonts.add(font);
  const canvas = document.createElement("canvas");
  canvas.width = CONTRACT_PAGE_WIDTH;
  canvas.height = CONTRACT_PAGE_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new ClientError("無法產生證書 PDF");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
  context.fillStyle = "#1a1916";

  paintCertificate(
    {
      fillText(text, x, y, size) {
        context.font = `${size}px NotoSansTC`;
        context.fillStyle = "#1a1916";
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillText(text, x, y);
      },
      measureText(text, size) {
        context.font = `${size}px NotoSansTC`;
        return context.measureText(text).width;
      },
      drawLogo(centerX, topY, maxW, maxH) {
        if (!logo) return 0;
        const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
        const w = logo.width * scale;
        const h = logo.height * scale;
        context.drawImage(logo, centerX - w / 2, topY, w, h);
        return h;
      },
      drawAuditorSignature(x, topY, maxW, maxH) {
        if (!signature) return 0;
        const scale = Math.min(maxW / signature.width, maxH / signature.height, 1);
        const w = signature.width * scale;
        const h = signature.height * scale;
        context.drawImage(signature, x, topY, w, h);
        return h;
      },
      drawSignatureLine(x, y, width) {
        context.save();
        context.strokeStyle = "#1a1916";
        context.lineWidth = 1.5;
        context.setLineDash([3, 5]);
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + width, y);
        context.stroke();
        context.restore();
      },
    },
    { body: ensureCertificateHtml(input.body) },
  );

  const url = canvas.toDataURL("image/png");
  const page = Uint8Array.from(atob(url.split(",")[1] ?? ""), (char) => char.charCodeAt(0));
  return pngPagesToPdf([page]);
}

export function assertMockServiceUnlocked(platform: PlatformState, actor: Actor, message = "請先完成方案付款與核帳後，才能使用此功能") {
  if (actor.role !== UserRole.APPLICANT || !actor.organizationId) return;
  const statuses = platform.payments
    .filter((item) => item.organizationId === actor.organizationId)
    .map((item) => item.status ?? "PENDING");
  if (!isServiceUnlocked(statuses)) throw new ClientError(message, { status: 403, code: "FORBIDDEN" });
}

export function hasFeature(platform: PlatformState, userId: string, featureKey: string) {
  return platform.features.some((item) => item.userId === userId && item.featureKey === featureKey && item.enabled);
}

export function ensureAccountFeatures(platform: PlatformState, users: Array<{ id: string; role: UserRole }>) {
  const storedOnAccount = platform.features.some((item) => item.userId);
  if (!storedOnAccount) platform.features = [];
  for (const user of users) {
    for (const feature of PLATFORM_FEATURES) {
      if (platform.features.some((item) => item.userId === user.id && item.featureKey === feature.key)) continue;
      platform.features.push({
        userId: user.id,
        featureKey: feature.key,
        label: feature.label,
        enabled: defaultFeatureEnabled(user.role, feature.key),
      });
    }
  }
}

function assertFeature(platform: PlatformState, actor: Actor, featureKey: string) {
  if (!hasFeature(platform, actor.id, featureKey)) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
}

function assertIntegration(platform: PlatformState, key: string) {
  const row = platform.integrations.find((item) => item.key === key);
  if (row && !row.enabled) throw new ClientError(`${row.label}尚未啟用`, { status: 403, code: "FORBIDDEN" });
}

function present(content: PlatformState["contents"][number], files: DemoDataset["files"]): AdminSiteSlot {
  const file = content.imageFileId ? files.find((item) => item.id === content.imageFileId) : undefined;
  return {
    ...content,
    imageUrl: file ? `data:${file.mimeType};base64,${file.contentBase64}` : null,
  };
}

function publishedSlot(platform: PlatformState, files: DemoDataset["files"], slot: ContentSlot) {
  const row = platform.contents.find((item) => item.slot === slot);
  return row?.isPublished ? present(row, files) : null;
}

function imageUrlFor(fileId: string | null | undefined, files: DemoDataset["files"]) {
  const file = fileId ? files.find((item) => item.id === fileId) : undefined;
  return file ? `data:${file.mimeType};base64,${file.contentBase64}` : null;
}

function publicEntry(entry: PlatformState["entries"][number], files: DemoDataset["files"]) {
  return {
    id: entry.id,
    kind: entry.kind,
    slug: entry.slug,
    groupLabel: entry.groupLabel,
    title: entry.title,
    summary: entry.summary,
    body: entry.body,
    note: entry.note,
    youtubeUrl: entry.youtubeUrl ?? "",
    imageUrl: imageUrlFor(entry.imageFileId, files),
    publishedOn: entry.publishedOn,
    sortOrder: entry.sortOrder,
  };
}

const halalTypo = /HALA(?!L)/g;

export function fixHalalSpelling(platform: PlatformState) {
  const fix = (text: string) => text.replace(halalTypo, "HALAL");
  for (const item of platform.contents) {
    item.eyebrow = fix(item.eyebrow);
    item.title = fix(item.title);
    item.subtitle = fix(item.subtitle);
    item.body = fix(item.body);
  }
  for (const entry of platform.entries ?? []) {
    entry.title = fix(entry.title);
    entry.summary = fix(entry.summary);
    entry.body = fix(entry.body);
  }
  for (const template of [platform.template, ...(platform.templates ?? [])]) {
    if (template.code === "HALA_SERVICE_V1") template.code = CONTRACT_TEMPLATE_CODE;
    template.title = fix(template.title);
    template.body = fix(template.body);
  }
}

export function ensureEditorial(platform: PlatformState) {
  const now = new Date().toISOString();
  platform.entries ??= [];
  for (const item of platform.contents) {
    if (!item.youtubeUrl) item.youtubeUrl = "";
  }
  for (const entry of platform.entries) {
    if (!entry.youtubeUrl) entry.youtubeUrl = "";
    if (entry.imageFileId == null) entry.imageFileId = null;
    if (entry.imageUrl == null) entry.imageUrl = null;
  }
  for (const slot of Object.values(ContentSlot)) {
    if (platform.contents.some((item) => item.slot === slot)) continue;
    platform.contents.push({
      slot,
      ...DEFAULT_SITE_CONTENT[slot],
      imageUrl: null,
      imageFileId: null,
      isPublished: true,
      version: 1,
      updatedAt: now,
    });
  }
  for (const kind of Object.values(EditorialKind)) {
    if (platform.entries.some((item) => item.kind === kind)) continue;
    platform.entries.push(
      ...DEFAULT_EDITORIAL.filter((item) => item.kind === kind).map((item) => ({
        id: crypto.randomUUID(),
        ...item,
        youtubeUrl: "",
        imageFileId: null,
        imageUrl: null,
        isPublished: true,
        version: 1,
        updatedAt: now,
      })),
    );
  }
}

export function publicSite(platform: PlatformState, files: DemoDataset["files"]) {
  return {
    hero: publishedSlot(platform, files, ContentSlot.HOME_HERO),
    banner: publishedSlot(platform, files, ContentSlot.HOME_BANNER),
    about: publishedSlot(platform, files, ContentSlot.ABOUT),
    newsIntro: publishedSlot(platform, files, ContentSlot.NEWS_INTRO),
    verification: publishedSlot(platform, files, ContentSlot.VERIFICATION),
    faq: publishedSlot(platform, files, ContentSlot.FAQ),
    entries: platform.entries.filter((item) => item.isPublished).map((item) => publicEntry(item, files)),
  };
}

export function adminSite(platform: PlatformState, actor: Actor, files: DemoDataset["files"]) {
  assertFeature(platform, actor, "cms.edit");
  return platform.contents.map((item) => present(item, files));
}

function parseEditorial(error: unknown): never {
  if (error instanceof ZodError) throw new ClientError(error.issues[0]?.message ?? "內容不正確", { status: 400, code: "VALIDATION_ERROR" });
  throw error;
}

export function adminEntries(platform: PlatformState, actor: Actor, files: DemoDataset["files"]) {
  assertFeature(platform, actor, "cms.edit");
  return platform.entries.map((entry) => ({ ...entry, youtubeUrl: entry.youtubeUrl ?? "", imageUrl: imageUrlFor(entry.imageFileId, files) }));
}

export function createEntry(platform: PlatformState, actor: Actor, raw: unknown) {
  assertFeature(platform, actor, "cms.edit");
  let input;
  try {
    input = editorialCreateSchema.parse(raw);
  } catch (error) {
    parseEditorial(error);
  }
  if (platform.entries.some((item) => item.kind === input.kind && item.slug === input.slug)) throw new ClientError("這個代碼已經用過", { status: 400, code: "VALIDATION_ERROR" });
  const created: PlatformState["entries"][number] = { id: crypto.randomUUID(), ...input, imageFileId: null, imageUrl: null, version: 1, updatedAt: new Date().toISOString() };
  platform.entries.push(created);
  return created;
}

export function updateEntry(platform: PlatformState, actor: Actor, id: string, raw: unknown) {
  assertFeature(platform, actor, "cms.edit");
  const current = platform.entries.find((item) => item.id === id);
  if (!current) throw new ClientError("找不到這則內容", { status: 404, code: "NOT_FOUND" });
  let input;
  try {
    input = editorialUpdateSchemaFor(current.kind).parse(raw);
  } catch (error) {
    parseEditorial(error);
  }
  if (current.version !== input.expectedVersion) throw new ClientError("內容已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
  current.groupLabel = input.groupLabel;
  current.title = input.title;
  current.summary = input.summary;
  current.body = input.body;
  current.note = input.note;
  current.youtubeUrl = input.youtubeUrl;
  current.publishedOn = input.publishedOn;
  current.sortOrder = input.sortOrder;
  current.isPublished = input.isPublished;
  current.version += 1;
  current.updatedAt = new Date().toISOString();
  return current;
}

export function deleteEntry(platform: PlatformState, actor: Actor, id: string) {
  assertFeature(platform, actor, "cms.edit");
  const index = platform.entries.findIndex((item) => item.id === id);
  if (index < 0) throw new ClientError("找不到這則內容", { status: 404, code: "NOT_FOUND" });
  platform.entries.splice(index, 1);
}

export function saveSite(platform: PlatformState, actor: Actor, files: DemoDataset["files"], slot: ContentSlot, input: SiteSlotInput) {
  assertFeature(platform, actor, "cms.edit");
  const current = platform.contents.find((item) => item.slot === slot);
  if (!current || current.version !== input.expectedVersion) throw new ClientError("內容已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
  current.eyebrow = input.eyebrow;
  current.title = input.title;
  current.subtitle = input.subtitle;
  current.body = input.body;
  current.ctaLabel = input.ctaLabel;
  current.ctaHref = input.ctaHref;
  current.secondaryCtaLabel = input.secondaryCtaLabel;
  current.secondaryCtaHref = input.secondaryCtaHref;
  current.youtubeUrl = input.youtubeUrl;
  current.isPublished = input.isPublished;
  current.version += 1;
  current.updatedAt = new Date().toISOString();
  return present(current, files);
}

export async function uploadSiteImage(platform: PlatformState, actor: Actor, data: DemoDataset, slot: ContentSlot, file: File) {
  assertFeature(platform, actor, "cms.edit");
  assertIntegration(platform, "media");
  const current = platform.contents.find((item) => item.slot === slot);
  if (!current) throw new ClientError("找不到版位", { status: 404 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf") throw new ClientError("圖片只接受 JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
  const stored = await rememberFile(data, actor.id, file.name || "image", mime, bytes);
  current.imageFileId = stored.id;
  current.version += 1;
  current.updatedAt = new Date().toISOString();
  return present(current, data.files);
}

export async function uploadEntryImage(platform: PlatformState, actor: Actor, data: DemoDataset, id: string, file: File) {
  assertFeature(platform, actor, "cms.edit");
  assertIntegration(platform, "media");
  const current = platform.entries.find((item) => item.id === id);
  if (!current) throw new ClientError("找不到這則內容", { status: 404 });
  if (current.kind !== EditorialKind.NEWS && current.kind !== EditorialKind.HOME_GALLERY) throw new ClientError("只有最新消息與首頁圖庫可以上傳圖片", { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf") throw new ClientError("圖片只接受 JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
  const stored = await rememberFile(data, actor.id, file.name || "image", mime, bytes);
  current.imageFileId = stored.id;
  current.imageUrl = `data:${stored.mimeType};base64,${stored.contentBase64}`;
  current.version += 1;
  current.updatedAt = new Date().toISOString();
  return current;
}

export function myContracts(platform: PlatformState, actor: Actor) {
  assertFeature(platform, actor, "contracts.sign");
  return platform.contracts.filter((item) => item.organizationId === actor.organizationId).map(strip);
}

export function contractOf(platform: PlatformState, actor: Actor, id: string) {
  const row = platform.contracts.find((item) => item.id === id);
  if (!row) throw new ClientError("找不到合約", { status: 404, code: "NOT_FOUND" });
  if (actor.role === UserRole.APPLICANT) {
    if (row.organizationId !== actor.organizationId) throw new ClientError("找不到合約", { status: 404, code: "NOT_FOUND" });
    assertFeature(platform, actor, "contracts.sign");
  } else {
    assertFeature(platform, actor, "contracts.issue");
  }
  return row;
}

type TemplateRow = NonNullable<PlatformState["templates"]>[number];

export function templateRows(platform: PlatformState): TemplateRow[] {
  if (!platform.templates?.length) {
    platform.templates = [{ ...platform.template, revision: platform.template.revision ?? 1 }];
  }
  return platform.templates;
}

function rememberTemplate(platform: PlatformState, row: TemplateRow) {
  const rows = templateRows(platform);
  const index = rows.findIndex((item) => item.id === row.id);
  if (index >= 0) rows[index] = row;
  else rows.unshift(row);
  if (platform.template.id === row.id) platform.template = row;
  return row;
}

export function listTemplates(platform: PlatformState, actor: Actor) {
  assertFeature(platform, actor, "contracts.issue");
  return [...templateRows(platform)].sort((a, b) => a.title.localeCompare(b.title, "zh-Hant") || b.revision - a.revision);
}

export function createTemplate(platform: PlatformState, actor: Actor, input: { title: string; body: string }) {
  assertFeature(platform, actor, "contracts.issue");
  const row: TemplateRow = { id: crypto.randomUUID(), code: `TPL_${crypto.randomUUID().slice(0, 8).toUpperCase()}`, revision: 1, title: input.title, body: ensureContractHtml(input.body), version: 1, updatedAt: new Date().toISOString() };
  templateRows(platform).unshift(row);
  return row;
}

export function createTemplateVersion(platform: PlatformState, actor: Actor, id: string, input: { title: string; body: string }) {
  assertFeature(platform, actor, "contracts.issue");
  const current = templateRows(platform).find((item) => item.id === id);
  if (!current) throw new ClientError("找不到合約範本", { status: 404 });
  const revision = Math.max(...templateRows(platform).filter((item) => item.code === current.code).map((item) => item.revision)) + 1;
  const row: TemplateRow = { id: crypto.randomUUID(), code: current.code, revision, title: input.title, body: ensureContractHtml(input.body), version: 1, updatedAt: new Date().toISOString() };
  templateRows(platform).unshift(row);
  return row;
}

export function saveTemplate(platform: PlatformState, actor: Actor, id: string, input: { title: string; body: string; expectedVersion: number }) {
  assertFeature(platform, actor, "contracts.issue");
  const current = templateRows(platform).find((item) => item.id === id);
  if (!current) throw new ClientError("找不到合約範本", { status: 404 });
  if (current.version !== input.expectedVersion) throw new ClientError("範本已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
  return rememberTemplate(platform, { ...current, title: input.title, body: ensureContractHtml(input.body), version: current.version + 1, updatedAt: new Date().toISOString() });
}

export function adminContracts(platform: PlatformState, actor: Actor) {
  assertFeature(platform, actor, "contracts.issue");
  return platform.contracts.map(strip);
}

export function issueContract(
  platform: PlatformState,
  actor: Actor,
  data: DemoDataset,
  input: {
    organizationId: string;
    templateId: string;
    applicationId?: string | null;
    siteName: string;
    feeAmount: string;
    checkHalalKitchen?: boolean;
    checkHalalRestaurant?: boolean;
    checkMuslimFriendlyRestaurant?: boolean;
    checkMealService?: boolean;
    checkDrinksSnacks?: boolean;
    checkFullHalalKitchen?: boolean;
    checkPartialKitchen?: boolean;
    checkRestaurantRestroom?: boolean;
    lodgingWithBreakfast?: boolean;
    lodgingWithoutBreakfast?: boolean;
    itemBreakfast?: boolean;
    itemGuestRoom?: boolean;
    checkExperience?: boolean;
    checkExperienceWithFood?: boolean;
    checkExperienceWithoutFood?: boolean;
    checkEnvironment?: boolean;
    checkShop?: boolean;
    partyBName?: string;
    partyBAddress?: string;
    partyBOwner?: string;
    partyBTaxId?: string;
    signYear?: string;
    signMonth?: string;
    signDay?: string;
  },
) {
  assertFeature(platform, actor, "contracts.issue");
  const organization = data.organizations.find((item) => item.id === input.organizationId);
  const template = templateRows(platform).find((item) => item.id === input.templateId);
  if (!organization || !template) throw new ClientError("找不到業者或合約範本", { status: 404 });
  const unlocked = platform.payments.some((item) => item.organizationId === organization.id && item.status === "PAID");
  if (!unlocked) throw new ClientError("此業者尚未核帳完成，不能發出合約", { status: 400, code: "VALIDATION_ERROR" });
  const applicationId = input.applicationId ?? null;
  if (applicationId) {
    const application = data.applications.find((item) => item.id === applicationId && item.organizationId === organization.id);
    if (!application) throw new ClientError("找不到此業者的申請", { status: 400, code: "VALIDATION_ERROR" });
    const linked = platform.contracts.some((item) => item.applicationId === applicationId && item.status !== ContractStatus.VOID);
    if (linked) throw new ClientError("這筆申請已有合約，請選其他尚未完成的申請", { status: 400, code: "VALIDATION_ERROR" });
  }
  const contractNo = formatContractNo(taipeiYear(), platform.contractSequence);
  platform.contractSequence += 1;
  const issuedOn = taipeiDateLabel();
  const created: PlatformState["contracts"][number] = {
    id: crypto.randomUUID(),
    contractNo,
    organizationId: organization.id,
    organizationName: organization.organizationName,
    title: template.title,
    status: ContractStatus.ISSUED,
    signerName: null,
    signerTitle: null,
    signedAt: null,
    version: 1,
    createdAt: new Date().toISOString(),
    body: renderContractBody(template.body, {
      organizationName: organization.organizationName,
      taxId: organization.taxId,
      contractNo,
      issuedOn,
      siteName: input.siteName,
      feeAmount: input.feeAmount,
      checkHalalKitchen: input.checkHalalKitchen,
      checkHalalRestaurant: input.checkHalalRestaurant,
      checkMuslimFriendlyRestaurant: input.checkMuslimFriendlyRestaurant,
      checkMealService: input.checkMealService,
      checkDrinksSnacks: input.checkDrinksSnacks,
      checkFullHalalKitchen: input.checkFullHalalKitchen,
      checkPartialKitchen: input.checkPartialKitchen,
      checkRestaurantRestroom: input.checkRestaurantRestroom,
      lodgingWithBreakfast: input.lodgingWithBreakfast,
      lodgingWithoutBreakfast: input.lodgingWithoutBreakfast,
      itemBreakfast: input.itemBreakfast,
      itemGuestRoom: input.itemGuestRoom,
      checkExperience: input.checkExperience,
      checkExperienceWithFood: input.checkExperienceWithFood,
      checkExperienceWithoutFood: input.checkExperienceWithoutFood,
      checkEnvironment: input.checkEnvironment,
      checkShop: input.checkShop,
      partyBName: input.partyBName || organization.organizationName,
      partyBAddress: input.partyBAddress || organization.address || "",
      partyBOwner: input.partyBOwner || organization.contactName || "",
      partyBTaxId: input.partyBTaxId || organization.taxId || "",
      signYear: input.signYear,
      signMonth: input.signMonth,
      signDay: input.signDay,
    }),
    templateId: template.id,
    applicationId,
    faceFileId: null,
    signatureFileId: null,
    pdfFileId: null,
  };
  platform.contracts.unshift(created);
  return strip(created);
}

export function listIssuableOrganizations(platform: PlatformState, actor: Actor, data: DemoDataset) {
  assertFeature(platform, actor, "contracts.issue");
  const paidIds = new Set(platform.payments.filter((item) => item.status === "PAID").map((item) => item.organizationId));
  return data.organizations
    .filter((org) => paidIds.has(org.id))
    .sort((left, right) => left.organizationName.localeCompare(right.organizationName, "zh-Hant"))
    .map((org) => {
      const pendingApplications = data.applications
        .filter((app) => {
          if (app.organizationId !== org.id || app.status === "REJECTED") return false;
          if (!isOpenApplicationForContract(app.status)) return false;
          return applicationNeedsContract(app.id, platform.contracts);
        })
        .map((app) => {
          const category = data.categories.find((item) => item.id === app.categoryId);
          const categoryName = category?.name ?? "驗證申請";
          const categoryCode = category?.code ?? "";
          return {
            id: app.id,
            applicationNo: app.applicationNo,
            categoryCode,
            categoryName,
            siteName: app.siteName,
            status: app.status,
            label: issuableApplicationLabel(categoryName, app.siteName),
            formData: app.formData as Record<string, unknown>,
          };
        });
      return {
        id: org.id,
        organizationName: org.organizationName,
        taxId: org.taxId ?? null,
        address: org.address ?? null,
        contactName: org.contactName ?? null,
        pendingApplications,
      };
    });
}

export function recordRenewal(platform: PlatformState, actor: Actor, id: string, input: { decision: "RENEWED" | "NOT_RENEWED"; expectedVersion: number }) {
  assertFeature(platform, actor, "contracts.sign");
  const row = contractOf(platform, actor, id);
  if (actor.role !== UserRole.APPLICANT || actor.organizationId !== row.organizationId) throw new ClientError("找不到合約", { status: 404 });
  if (row.status !== ContractStatus.SIGNED || row.version !== input.expectedVersion) throw new ClientError("只有已簽署的合約可以登記續約", { status: 409, code: "VERSION_CONFLICT" });
  row.status = input.decision === "RENEWED" ? ContractStatus.RENEWED : ContractStatus.NOT_RENEWED;
  row.version += 1;
  return detail(row);
}

export async function uploadSignedContractPdf(
  platform: PlatformState,
  actor: Actor,
  data: DemoDataset,
  id: string,
  input: { expectedVersion: number; pdf: Blob },
) {
  assertFeature(platform, actor, "contracts.sign");
  const row = contractOf(platform, actor, id);
  if (row.status !== ContractStatus.ISSUED || row.version !== input.expectedVersion) {
    throw new ClientError("合約已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
  }
  const bytes = new Uint8Array(await input.pdf.arrayBuffer());
  if (detectFileSignature(bytes) !== "application/pdf") throw new ClientError("請上傳 PDF 檔", { code: "UNSUPPORTED_FILE_TYPE" });
  if (bytes.byteLength < 100) throw new ClientError("PDF 檔案太小，請重新上傳");
  const pdfFile = await rememberFile(data, actor.id, `${row.contractNo}-signed.pdf`, "application/pdf", bytes);
  row.pdfFileId = pdfFile.id;
  row.signerName = actor.displayName;
  row.signerTitle = "蓋章上傳";
  row.signedAt = new Date().toISOString();
  row.status = ContractStatus.SIGNED;
  row.version += 1;
  return detail(row);
}

export async function contractDocument(platform: PlatformState, actor: Actor, data: DemoDataset, id: string) {
  const row = contractOf(platform, actor, id);
  if (row.pdfFileId) return contractFile(platform, actor, data, id, "pdf");
  if (row.status !== ContractStatus.ISSUED) throw new ClientError("這份合約還沒有 PDF", { status: 404 });
  const body = ensureContractHtml(row.body);
  if (body !== row.body) row.body = body;
  const pdf = await renderIssuedBrowserPdf(
    { title: row.title, contractNo: row.contractNo, body },
    {
      company: sealImageUrl(platform, data, "company"),
      person: sealImageUrl(platform, data, "person"),
      layout: normalizeSealLayout(platform.seals),
    },
  );
  const copy = new Uint8Array(pdf.byteLength);
  copy.set(pdf);
  return { blob: new Blob([copy], { type: "application/pdf" }), name: `${row.contractNo}.pdf` };
}

export function contractCapture(platform: PlatformState, actor: Actor, data: DemoDataset, id: string, kind: "signature" | "face") {
  return contractFile(platform, actor, data, id, kind);
}

function contractFile(platform: PlatformState, actor: Actor, data: DemoDataset, id: string, kind: "pdf" | "signature" | "face") {
  const row = contractOf(platform, actor, id);
  const fileId = kind === "pdf" ? row.pdfFileId : kind === "signature" ? row.signatureFileId : row.faceFileId;
  const file = fileId ? data.files.find((item) => item.id === fileId) : undefined;
  if (!file) throw new ClientError(kind === "pdf" ? "這份合約還沒有簽署檔" : "這份合約還沒有客戶簽名", { status: 404 });
  const binary = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
  return { blob: new Blob([binary], { type: file.mimeType }), name: file.originalName };
}

export function accessSettings(platform: PlatformState, actor: Actor, users: Actor[]) {
  assertFeature(platform, actor, "users.manage");
  return {
    accounts: users.filter((user) => user.role !== UserRole.APPLICANT).map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isActive: user.isActive,
      features: STAFF_FEATURES.map((feature) => ({
        featureKey: feature.key,
        label: feature.label,
        enabled: hasFeature(platform, user.id, feature.key),
      })),
    })),
    integrations: platform.integrations,
  };
}

export function updateFeature(platform: PlatformState, actor: Actor, users: Actor[], input: { userId: string; featureKey: string; enabled: boolean }) {
  assertFeature(platform, actor, "users.manage");
  const target = users.find((item) => item.id === input.userId);
  if (!target || target.role === UserRole.APPLICANT) throw new ClientError("找不到員工帳號。業者功能是固定的，不能在這裡調整", { status: 404 });
  if (!STAFF_FEATURES.some((feature) => feature.key === input.featureKey)) throw new ClientError("這不是員工功能", { status: 400 });
  if (input.featureKey === "users.manage" && !input.enabled) {
    const others = users.some((user) => user.id !== target.id && user.isActive && hasFeature(platform, user.id, "users.manage"));
    if (!others) throw new ClientError("不能關閉最後一個帳號的帳號管理，否則無法再改權限");
  }
  const row = platform.features.find((item) => item.userId === target.id && item.featureKey === input.featureKey);
  if (!row) throw new ClientError("找不到這項功能", { status: 404 });
  row.enabled = input.enabled;
  const enabled = platform.features.filter((item) => item.userId === target.id && item.enabled).map((item) => item.featureKey);
  target.role = roleForAccountFeatures(target.role, enabled);
}

export function grantAccountFeatures(platform: PlatformState, user: { id: string; role: UserRole }, enabledKeys: string[]) {
  platform.features = platform.features.filter((item) => item.userId !== user.id);
  platform.features.push(
    ...PLATFORM_FEATURES.map((feature) => ({
      userId: user.id,
      featureKey: feature.key,
      label: feature.label,
      enabled: enabledKeys.includes(feature.key),
    })),
  );
}

export function updateIntegration(platform: PlatformState, actor: Actor, input: { key: string; provider: string; enabled: boolean; note: string }) {
  assertFeature(platform, actor, "integrations.edit");
  const row = platform.integrations.find((item) => item.key === input.key);
  if (!row) throw new ClientError("找不到這項串接", { status: 404 });
  row.provider = input.provider;
  row.enabled = input.enabled;
  row.note = input.note;
}

function strip(row: PlatformState["contracts"][number]): ContractItem {
  return {
    id: row.id,
    contractNo: row.contractNo,
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    title: row.title,
    status: row.status,
    signerName: row.signerName,
    signerTitle: row.signerTitle,
    signedAt: row.signedAt,
    hasSignature: Boolean(row.signatureFileId),
    hasFace: Boolean(row.faceFileId),
    hasPdf: Boolean(row.pdfFileId),
    version: row.version,
    createdAt: row.createdAt,
  };
}

function detail(row: PlatformState["contracts"][number]) {
  const body = ensureContractHtml(row.body);
  if (body !== row.body) row.body = body;
  return { ...strip(row), body };
}

export function getContractSeals(platform: PlatformState, actor: Actor, data: DemoDataset) {
  if (!hasFeature(platform, actor.id, "contracts.issue") && !hasFeature(platform, actor.id, "contracts.sign")) {
    throw new ClientError("沒有權限查看合約印章", { status: 403, code: "FORBIDDEN" });
  }
  return presentSeals(platform, data);
}

export async function uploadContractSeal(
  platform: PlatformState,
  actor: Actor,
  data: DemoDataset,
  kind: "company" | "person",
  file: File,
) {
  assertFeature(platform, actor, "contracts.issue");
  assertIntegration(platform, "media");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf") throw new ClientError("印章只接受 JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
  const stored = await rememberFile(data, actor.id, file.name || `${kind}-seal`, mime, bytes);
  if (kind === "company") platform.seals.companySealFileId = stored.id;
  else platform.seals.personSealFileId = stored.id;
  platform.seals.updatedAt = new Date().toISOString();
  return presentSeals(platform, data);
}

function presentSeals(platform: PlatformState, data: DemoDataset) {
  const company = platform.seals.companySealFileId ? data.files.find((item) => item.id === platform.seals.companySealFileId) : undefined;
  const person = platform.seals.personSealFileId ? data.files.find((item) => item.id === platform.seals.personSealFileId) : undefined;
  const layout = normalizeSealLayout(platform.seals);
  return {
    companySealUrl: company ? `data:${company.mimeType};base64,${company.contentBase64}` : null,
    personSealUrl: person ? `data:${person.mimeType};base64,${person.contentBase64}` : null,
    hasCompanySeal: Boolean(company),
    hasPersonSeal: Boolean(person),
    ...layout,
    updatedAt: platform.seals.updatedAt,
  };
}

export function updateSealPositions(platform: PlatformState, actor: Actor, data: DemoDataset, input: unknown) {
  assertFeature(platform, actor, "contracts.issue");
  const parsed = (() => {
    try {
      return contractSealPositionsSchema.parse(input);
    } catch (error) {
      return rejectInput(error);
    }
  })();
  platform.seals.companySealX = parsed.companySealX;
  platform.seals.companySealY = parsed.companySealY;
  platform.seals.personSealX = parsed.personSealX;
  platform.seals.personSealY = parsed.personSealY;
  platform.seals.updatedAt = new Date().toISOString();
  return presentSeals(platform, data);
}

function sealImageUrl(platform: PlatformState, data: DemoDataset, kind: "company" | "person") {
  const fileId = kind === "company" ? platform.seals.companySealFileId : platform.seals.personSealFileId;
  const file = fileId ? data.files.find((item) => item.id === fileId) : undefined;
  return file ? `data:${file.mimeType};base64,${file.contentBase64}` : null;
}

export async function rememberFile(data: DemoDataset, uploadedById: string, originalName: string, mimeType: string, bytes: Uint8Array) {
  const file = {
    id: crypto.randomUUID(),
    uploadedById,
    storageKey: `mock/${crypto.randomUUID()}`,
    originalName,
    mimeType,
    sizeBytes: bytes.byteLength,
    sha256: await sha256Hex(bytes),
    contentBase64: base64(bytes),
    createdAt: new Date().toISOString(),
  };
  data.files.push(file);
  return file;
}

function base64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

async function loadBrowserImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return null;
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

async function renderIssuedBrowserPdf(
  input: { title: string; contractNo: string; body: string },
  sealUrls: { company: string | null; person: string | null; layout?: ReturnType<typeof normalizeSealLayout> },
) {
  const font = new FontFace("NotoSansTC", "url(/fonts/NotoSansTC-Subset.otf)");
  await font.load();
  document.fonts.add(font);
  const [companySeal, personSeal] = await Promise.all([loadBrowserImage(sealUrls.company), loadBrowserImage(sealUrls.person)]);
  const pages: Uint8Array[] = [];
  let canvas = document.createElement("canvas");
  canvas.width = CONTRACT_PAGE_WIDTH;
  canvas.height = CONTRACT_PAGE_HEIGHT;
  let context = canvas.getContext("2d");
  if (!context) throw new ClientError("無法產生合約 PDF");
  const clear = () => {
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, CONTRACT_PAGE_WIDTH, CONTRACT_PAGE_HEIGHT);
    context.fillStyle = "#1a1916";
    context.strokeStyle = "#1a1916";
  };
  clear();
  paintContract(
    {
      fillText(text, x, y, size) {
        if (!context) return;
        context.font = `${size}px NotoSansTC`;
        context.fillStyle = "#1a1916";
        context.textAlign = "left";
        context.textBaseline = "alphabetic";
        context.fillText(text, x, y);
      },
      measureText(text, size) {
        if (!context) return text.length * size * 0.6;
        context.font = `${size}px NotoSansTC`;
        return context.measureText(text).width;
      },
      strokeRect(x, y, width, height, lineWidth = 2) {
        if (!context) return;
        context.strokeStyle = "#111111";
        context.lineWidth = lineWidth;
        context.strokeRect(x, y, width, height);
      },
      fillRect(x, y, width, height, color) {
        if (!context) return;
        context.fillStyle = color;
        context.fillRect(x, y, width, height);
        context.fillStyle = "#1a1916";
      },
      drawSeal(x, y, size, kind) {
        if (!context) return;
        const image = kind === "company" ? companySeal : personSeal;
        if (image) {
          context.drawImage(image, x, y, size, size);
          return;
        }
        const radius = size / 2;
        const cx = x + radius;
        const cy = y + radius;
        context.save();
        context.strokeStyle = kind === "company" ? "#b91c1c" : "#9f1239";
        context.fillStyle = kind === "company" ? "rgba(185, 28, 28, 0.08)" : "rgba(159, 18, 57, 0.08)";
        context.lineWidth = 4;
        context.beginPath();
        context.arc(cx, cy, radius * 0.92, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.beginPath();
        context.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
        context.stroke();
        context.font = `${Math.max(18, Math.floor(size * 0.14))}px NotoSansTC`;
        context.fillStyle = context.strokeStyle;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(kind === "company" ? "公司大章" : "負責人小章", cx, cy);
        context.restore();
      },
      newPage() {
        const url = canvas.toDataURL("image/png");
        pages.push(Uint8Array.from(atob(url.split(",")[1] ?? ""), (char) => char.charCodeAt(0)));
        canvas = document.createElement("canvas");
        canvas.width = CONTRACT_PAGE_WIDTH;
        canvas.height = CONTRACT_PAGE_HEIGHT;
        context = canvas.getContext("2d");
        clear();
      },
    },
    { ...input, mode: "unsigned", sealLayout: sealUrls.layout },
  );
  const url = canvas.toDataURL("image/png");
  pages.push(Uint8Array.from(atob(url.split(",")[1] ?? ""), (char) => char.charCodeAt(0)));
  return pngPagesToPdf(pages);
}

function presentPayment(row: PlatformState["payments"][number]) {
  return {
    ...row,
    status: row.status ?? ("PENDING" as const),
    paymentMethod: row.paymentMethod ?? "",
    paidAt: row.paidAt ?? null,
    quoteConfirmedAt: row.quoteConfirmedAt ?? null,
    accountingConfirmedAt: row.accountingConfirmedAt ?? null,
    createdAt: row.createdAt ?? row.paidAt ?? new Date().toISOString(),
  };
}

function presentPlan(row: PlatformState["plans"][number], data?: DemoDataset) {
  const visibleUserIds = row.visibleUserIds ?? [];
  const viewers = data
    ? visibleUserIds.map((userId) => {
      const user = data.users.find((item) => item.id === userId);
      const organizationName = user?.organizationId
        ? data.organizations.find((org) => org.id === user.organizationId)?.organizationName ?? null
        : null;
      return {
        userId,
        displayName: user?.displayName ?? userId,
        email: user?.email ?? "",
        organizationName,
      };
    })
    : [];
  return {
    ...row,
    images: row.images ?? [],
    visibleUserIds,
    viewers,
    visibilityLabel: visibleUserIds.length === 0 ? "全體可見" : `指定 ${visibleUserIds.length} 人`,
  };
}

function rejectInput(error: unknown): never {
  if (error instanceof ZodError) throw new ClientError(error.issues[0]?.message ?? "內容不正確", { status: 400, code: "VALIDATION_ERROR" });
  throw error;
}

export function paymentDesk(platform: PlatformState, actor: Actor, data: DemoDataset) {
  assertFeature(platform, actor, "payments.manage");
  for (const plan of platform.plans) plan.visibleUserIds ??= [];
  const plans = [...(platform.plans ?? [])].map((item) => presentPlan(item, data)).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const payments = [...(platform.payments ?? [])].map(presentPayment).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const month = payments.filter((row) => row.status === "PAID" && row.paidAt && isInTaipeiMonth(row.paidAt));
  return {
    monthLabel: taipeiMonthTitle(),
    dealCount: month.length,
    paidAmount: month.reduce((sum, row) => sum + row.amount, 0),
    payments: month.slice(0, 100),
    awaitingReconciliation: payments.filter((row) => row.status === "PAID_PENDING"),
    plans,
    organizations: [...data.organizations].sort((left, right) => left.organizationName.localeCompare(right.organizationName, "zh-Hant")).map((org) => ({ id: org.id, organizationName: org.organizationName })),
    unlockedOrganizations: data.organizations
      .filter((org) => payments.some((row) => row.organizationId === org.id && row.status === "PAID"))
      .sort((left, right) => left.organizationName.localeCompare(right.organizationName, "zh-Hant"))
      .map((org) => ({
        id: org.id,
        organizationName: org.organizationName,
        taxId: org.taxId ?? null,
        address: org.address ?? null,
        contactName: org.contactName ?? null,
      })),
    applicantUsers: data.users
      .filter((user) => user.role === UserRole.APPLICANT && user.isActive)
      .sort((left, right) => left.displayName.localeCompare(right.displayName, "zh-Hant"))
      .map((user) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        organizationName: data.organizations.find((org) => org.id === user.organizationId)?.organizationName ?? null,
      })),
  };
}

export function createPlan(platform: PlatformState, actor: Actor, data: DemoDataset, input: unknown) {
  assertFeature(platform, actor, "payments.manage");
  const parsed = (() => {
    try {
      return servicePlanWriteSchema.parse(input);
    } catch (error) {
      return rejectInput(error);
    }
  })();
  const { visibleUserIds, ...rest } = parsed;
  const saved = {
    id: crypto.randomUUID(),
    ...rest,
    visibleUserIds: [...visibleUserIds],
    version: 1,
    updatedAt: new Date().toISOString(),
    images: [] as PlatformState["plans"][number]["images"],
  };
  platform.plans.unshift(saved);
  data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "PLAN_CREATE", entityType: "ServicePlan", entityId: saved.id, requestId: crypto.randomUUID(), safeChanges: { name: saved.name, amount: saved.amount, viewerCount: visibleUserIds.length }, createdAt: new Date().toISOString() });
  return presentPlan(saved, data);
}

export function updatePlan(platform: PlatformState, actor: Actor, data: DemoDataset, id: string, input: unknown) {
  assertFeature(platform, actor, "payments.manage");
  const parsed = (() => {
    try {
      return servicePlanUpdateSchema.parse(input);
    } catch (error) {
      return rejectInput(error);
    }
  })();
  const current = platform.plans.find((item) => item.id === id);
  if (!current) throw new ClientError("找不到方案", { status: 404, code: "NOT_FOUND" });
  if (current.version !== parsed.expectedVersion) throw new ClientError("方案已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
  current.name = parsed.name;
  current.amount = parsed.amount;
  current.description = parsed.description;
  current.paymentUrl = parsed.paymentUrl;
  current.isActive = parsed.isActive;
  current.visibleUserIds = [...parsed.visibleUserIds];
  current.version += 1;
  current.updatedAt = new Date().toISOString();
  data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "PLAN_UPDATE", entityType: "ServicePlan", entityId: current.id, requestId: crypto.randomUUID(), safeChanges: { name: current.name, amount: current.amount, isActive: current.isActive, viewerCount: current.visibleUserIds.length }, createdAt: current.updatedAt });
  return presentPlan(current, data);
}

export async function uploadPlanImage(platform: PlatformState, actor: Actor, data: DemoDataset, planId: string, file: File, caption = "") {
  assertFeature(platform, actor, "payments.manage");
  const plan = platform.plans.find((item) => item.id === planId);
  if (!plan) throw new ClientError("找不到方案", { status: 404, code: "NOT_FOUND" });
  if ((plan.images?.length ?? 0) >= 8) throw new ClientError("每個方案最多 8 張說明圖", { status: 400, code: "VALIDATION_ERROR" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf") throw new ClientError("圖片只接受 JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
  const fileId = crypto.randomUUID();
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  data.files.push({
    id: fileId,
    uploadedById: actor.id,
    storageKey: `mock/plans/${fileId}`,
    originalName: file.name,
    mimeType: mime,
    sizeBytes: file.size,
    sha256: await sha256Hex(bytes),
    contentBase64: btoa(binary),
    createdAt: new Date().toISOString(),
  });
  const image = {
    id: crypto.randomUUID(),
    fileId,
    caption: caption.slice(0, 200),
    sortOrder: plan.images.length,
    imageUrl: `data:${mime};base64,${btoa(binary)}`,
  };
  plan.images.push(image);
  plan.version += 1;
  plan.updatedAt = new Date().toISOString();
  return presentPlan(plan, data);
}

export function removePlanImage(platform: PlatformState, actor: Actor, data: DemoDataset, planId: string, imageId: string) {
  assertFeature(platform, actor, "payments.manage");
  const plan = platform.plans.find((item) => item.id === planId);
  if (!plan) throw new ClientError("找不到方案", { status: 404, code: "NOT_FOUND" });
  const next = plan.images.filter((item) => item.id !== imageId);
  if (next.length === plan.images.length) throw new ClientError("找不到方案圖片", { status: 404, code: "NOT_FOUND" });
  plan.images = next;
  plan.version += 1;
  plan.updatedAt = new Date().toISOString();
  return presentPlan(plan, data);
}

export function selectPlan(platform: PlatformState, actor: Actor, data: DemoDataset, input: unknown) {
  if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ClientError("只有業者可以選擇方案", { status: 403, code: "FORBIDDEN" });
  const parsed = (() => {
    try {
      return selectPlanSchema.parse(input);
    } catch (error) {
      return rejectInput(error);
    }
  })();
  const plan = platform.plans.find((item) => item.id === parsed.planId && item.isActive);
  const organization = data.organizations.find((item) => item.id === actor.organizationId);
  if (!plan) throw new ClientError("找不到開放中的方案", { status: 404, code: "NOT_FOUND" });
  if (!planIsVisibleToUser(plan.visibleUserIds ?? [], actor.id)) throw new ClientError("這個方案未開放給你的帳號", { status: 403, code: "FORBIDDEN" });
  if (!organization) throw new ClientError("找不到業者", { status: 404, code: "NOT_FOUND" });
  const alreadySelected = platform.payments.find((item) => {
    if (item.organizationId !== actor.organizationId || item.planId !== plan.id) return false;
    const status = item.status ?? "PENDING";
    return status === "QUOTED" || status === "PENDING" || status === "PAID_PENDING" || status === "PAID";
  });
  if (alreadySelected) {
    throw new ClientError("這個方案已經選過，不能再選；請改選尚未使用過的方案", { status: 400, code: "VALIDATION_ERROR" });
  }
  const now = new Date().toISOString();
  const saved = {
    id: crypto.randomUUID(),
    organizationId: organization.id,
    organizationName: organization.organizationName,
    planId: plan.id,
    planName: plan.name,
    amount: plan.amount,
    paidAt: null,
    quoteConfirmedAt: now,
    accountingConfirmedAt: null,
    createdAt: now,
    note: "已選擇方案，待付款",
    status: "PENDING" as const,
    paymentMethod: "",
  };
  platform.payments.unshift(saved);
  return presentPayment(saved);
}

export function confirmReconciliation(platform: PlatformState, actor: Actor, data: DemoDataset, input: unknown) {
  assertFeature(platform, actor, "payments.manage");
  const parsed = (() => {
    try {
      return paymentActionSchema.parse(input);
    } catch (error) {
      return rejectInput(error);
    }
  })();
  const row = platform.payments.find((item) => item.id === parsed.paymentId);
  if (!row) throw new ClientError("找不到付款紀錄", { status: 404, code: "NOT_FOUND" });
  if (row.status !== "PAID_PENDING") throw new ClientError("這筆不是待核帳", { status: 400, code: "VALIDATION_ERROR" });
  const now = new Date().toISOString();
  row.status = "PAID";
  row.accountingConfirmedAt = now;
  row.paidAt = row.paidAt ?? now;
  data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "RECONCILIATION_CONFIRM", entityType: "PaymentRecord", entityId: row.id, requestId: crypto.randomUUID(), safeChanges: { planName: row.planName, amount: row.amount }, createdAt: now });
  return presentPayment(row);
}

export function recordPayment(platform: PlatformState, actor: Actor, data: DemoDataset, input: unknown) {
  assertFeature(platform, actor, "payments.manage");
  const parsed = (() => {
    try {
      return paymentRecordWriteSchema.parse(input);
    } catch (error) {
      return rejectInput(error);
    }
  })();
  const plan = platform.plans.find((item) => item.id === parsed.planId);
  const organization = data.organizations.find((item) => item.id === parsed.organizationId);
  if (!plan) throw new ClientError("找不到方案", { status: 404, code: "NOT_FOUND" });
  if (!organization) throw new ClientError("找不到業者", { status: 404, code: "NOT_FOUND" });
  const alreadySelected = platform.payments.some((item) => {
    if (item.organizationId !== organization.id || item.planId !== plan.id) return false;
    const status = item.status ?? "PENDING";
    return status === "QUOTED" || status === "PENDING" || status === "PAID_PENDING" || status === "PAID";
  });
  if (alreadySelected) throw new ClientError("此業者已選過這個方案，不能重複登錄", { status: 400, code: "VALIDATION_ERROR" });
  const now = new Date().toISOString();
  const saved = {
    id: crypto.randomUUID(),
    organizationId: organization.id,
    organizationName: organization.organizationName,
    planId: plan.id,
    planName: plan.name,
    amount: plan.amount,
    paidAt: now,
    quoteConfirmedAt: now,
    accountingConfirmedAt: null,
    createdAt: now,
    note: parsed.note || "人工登錄待核帳",
    status: "PAID_PENDING" as const,
    paymentMethod: "",
  };
  platform.payments.unshift(saved);
  data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "PAYMENT_RECORD", entityType: "PaymentRecord", entityId: saved.id, requestId: crypto.randomUUID(), safeChanges: { organizationId: organization.id, planName: plan.name, amount: plan.amount }, createdAt: now });
  return presentPayment(saved);
}

export function myPayments(platform: PlatformState, actor: Actor, data: DemoDataset) {
  if (!actor.organizationId) throw new ClientError("這個帳號沒有所屬業者", { status: 403, code: "FORBIDDEN" });
  for (const plan of platform.plans) plan.visibleUserIds ??= [];
  const payments = platform.payments.filter((item) => item.organizationId === actor.organizationId).map(presentPayment).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return {
    payments,
    plans: platform.plans
      .filter((item) => item.isActive && planIsVisibleToUser(item.visibleUserIds ?? [], actor.id))
      .map((item) => presentPlan(item, data))
      .sort((left, right) => left.name.localeCompare(right.name, "zh-Hant")),
    serviceUnlocked: isServiceUnlocked(payments.map((item) => item.status)),
    activeOrder: payments.find((item) => item.status === "PENDING" || item.status === "PAID_PENDING" || item.status === "QUOTED") ?? null,
  };
}

export function markPaidPending(platform: PlatformState, actor: Actor, paymentId: string) {
  if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ClientError("只有業者可以付款", { status: 403, code: "FORBIDDEN" });
  const row = platform.payments.find((item) => item.id === paymentId && item.organizationId === actor.organizationId);
  if (!row) throw new ClientError("找不到訂單", { status: 404, code: "NOT_FOUND" });
  if (row.status !== "PENDING" && row.status !== "QUOTED") throw new ClientError("這筆目前不能付款", { status: 400, code: "VALIDATION_ERROR" });
  const now = new Date().toISOString();
  row.status = "PAID_PENDING";
  row.paidAt = now;
  row.paymentMethod = "MANUAL";
  row.note = row.note ? `${row.note}；業者已送出付款（待核帳）` : "業者已送出付款（待核帳）";
  return presentPayment(row);
}

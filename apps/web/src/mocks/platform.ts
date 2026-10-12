import {
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
  roleForAccountFeatures,
  paintContract,
  pngPagesToPdf,
  detectFileSignature,
  formatContractNo,
  readImageSize,
  renderContractBody,
  sha256Hex,
  taipeiDateLabel,
  taipeiDateTimeLabel,
  taipeiYear,
  type DemoDataset,
} from "@mf/contracts";
import { ZodError } from "zod";
import { ClientError, type AccessSettings, type AdminEditorialEntry, type AdminSiteSlot, type ContractItem, type SiteSlotInput } from "../services/types";

export type PlatformState = {
  contents: Array<AdminSiteSlot & { imageFileId: string | null }>;
  entries: Array<AdminEditorialEntry & { imageFileId: string | null }>;
  template: { id: string; code: string; title: string; body: string; version: number; updatedAt: string };
  contracts: Array<ContractItem & { body: string; templateId: string; faceFileId: string | null; signatureFileId: string | null; pdfFileId: string | null }>;
  features: Array<{ userId: string; featureKey: string; label: string; enabled: boolean }>;
  integrations: AccessSettings["integrations"];
  contractSequence: number;
  reports: Array<{ id: string; name: string; selections: Array<{ source: "APPLICATION" | "ORGANIZATION" | "ENROLLMENT" | "CONTRACT"; fieldKeys: string[] }>; chartKind: "table" | "bar" | "pie"; chartField: string; version: number; updatedAt: string; createdById: string }>;
};

type Actor = DemoDataset["users"][number];

export function createInitialPlatform(data: DemoDataset): PlatformState {
  const now = new Date().toISOString();
  const org = data.organizations[0];
  const admin = data.users.find((user) => user.role === UserRole.ADMIN);
  const contractNo = formatContractNo(taipeiYear(), 1);
  const template = {
    id: crypto.randomUUID(),
    code: "HALA_SERVICE_V1",
    title: DEFAULT_CONTRACT_TITLE,
    body: DEFAULT_CONTRACT_BODY,
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
  };
}

export function hasFeature(platform: PlatformState, userId: string, featureKey: string) {
  return platform.features.some((item) => item.userId === userId && item.featureKey === featureKey && item.enabled);
}

export function ensureAccountFeatures(platform: PlatformState, users: Array<{ id: string; role: UserRole }>) {
  const storedOnAccount = platform.features.some((item) => item.userId);
  if (!storedOnAccount) platform.features = [];
  for (const user of users) {
    if (platform.features.some((item) => item.userId === user.id)) continue;
    platform.features.push(
      ...PLATFORM_FEATURES.map((feature) => ({
        userId: user.id,
        featureKey: feature.key,
        label: feature.label,
        enabled: defaultFeatureEnabled(user.role, feature.key),
      })),
    );
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
  if (current.kind !== EditorialKind.NEWS) throw new ClientError("只有最新消息可以上傳圖片", { status: 400 });
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

export function templateOf(platform: PlatformState, actor: Actor) {
  assertFeature(platform, actor, "contracts.issue");
  return platform.template;
}

export function saveTemplate(platform: PlatformState, actor: Actor, input: { title: string; body: string; expectedVersion: number }) {
  assertFeature(platform, actor, "contracts.issue");
  if (platform.template.version !== input.expectedVersion) throw new ClientError("範本已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
  platform.template = { ...platform.template, title: input.title, body: input.body, version: platform.template.version + 1, updatedAt: new Date().toISOString() };
  return platform.template;
}

export function adminContracts(platform: PlatformState, actor: Actor) {
  assertFeature(platform, actor, "contracts.issue");
  return platform.contracts.map(strip);
}

export function issueContract(platform: PlatformState, actor: Actor, data: DemoDataset, organizationId: string) {
  assertFeature(platform, actor, "contracts.issue");
  const organization = data.organizations.find((item) => item.id === organizationId);
  if (!organization) throw new ClientError("找不到業者", { status: 404 });
  const contractNo = formatContractNo(taipeiYear(), platform.contractSequence);
  platform.contractSequence += 1;
  const created: PlatformState["contracts"][number] = {
    id: crypto.randomUUID(),
    contractNo,
    organizationId: organization.id,
    organizationName: organization.organizationName,
    title: platform.template.title,
    status: ContractStatus.ISSUED,
    signerName: null,
    signerTitle: null,
    signedAt: null,
    version: 1,
    createdAt: new Date().toISOString(),
    body: renderContractBody(platform.template.body, {
      organizationName: organization.organizationName,
      taxId: organization.taxId,
      contractNo,
      issuedOn: taipeiDateLabel(),
    }),
    templateId: platform.template.id,
    faceFileId: null,
    signatureFileId: null,
    pdfFileId: null,
  };
  platform.contracts.unshift(created);
  return strip(created);
}

export function saveContract(platform: PlatformState, actor: Actor, id: string, input: { title: string; body: string; expectedVersion: number }) {
  const row = contractOf(platform, actor, id);
  if (row.status !== ContractStatus.ISSUED || row.version !== input.expectedVersion) {
    throw new ClientError("合約已簽署、已作廢，或內容已被更新", { status: 409, code: "VERSION_CONFLICT" });
  }
  row.title = input.title;
  row.body = input.body;
  row.version += 1;
  return detail(row);
}

export function voidContract(platform: PlatformState, actor: Actor, id: string, expectedVersion: number) {
  const row = contractOf(platform, actor, id);
  if (row.status !== ContractStatus.ISSUED || row.version !== expectedVersion) throw new ClientError("這份合約不能作廢", { status: 409, code: "VERSION_CONFLICT" });
  row.status = ContractStatus.VOID;
  row.version += 1;
  return detail(row);
}

export async function signContract(
  platform: PlatformState,
  actor: Actor,
  data: DemoDataset,
  id: string,
  input: { signerName: string; signerTitle: string; expectedVersion: number; face: Blob; signature: Blob },
) {
  assertFeature(platform, actor, "contracts.sign");
  assertIntegration(platform, "signature");
  assertIntegration(platform, "media");
  const row = contractOf(platform, actor, id);
  if (row.status !== ContractStatus.ISSUED || row.version !== input.expectedVersion) {
    throw new ClientError("合約已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
  }
  const faceBytes = new Uint8Array(await input.face.arrayBuffer());
  const signatureBytes = new Uint8Array(await input.signature.arrayBuffer());
  const faceMime = detectFileSignature(faceBytes);
  if (!faceMime || faceMime === "application/pdf") throw new ClientError("人像只接受 JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
  const faceSize = readImageSize(faceBytes);
  if (!faceSize || faceSize.width < 120 || faceSize.height < 120) throw new ClientError("人像太小，請再拍一次或換一張較清楚的照片");
  if (detectFileSignature(signatureBytes) !== "image/png") throw new ClientError("手寫簽名需要 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
  await assertSignatureInk(input.signature);
  const pdf = await renderBrowserPdf({
    title: row.title,
    contractNo: row.contractNo,
    body: row.body,
    signerName: input.signerName.trim(),
    signerTitle: input.signerTitle.trim(),
    signedAtLabel: taipeiDateTimeLabel(),
    signaturePng: signatureBytes,
    faceBytes,
  });
  const faceFile = await rememberFile(data, actor.id, "face", faceMime, faceBytes);
  const signatureFile = await rememberFile(data, actor.id, "signature.png", "image/png", signatureBytes);
  const pdfFile = await rememberFile(data, actor.id, `${row.contractNo}.pdf`, "application/pdf", pdf);
  row.faceFileId = faceFile.id;
  row.signatureFileId = signatureFile.id;
  row.pdfFileId = pdfFile.id;
  row.signerName = input.signerName.trim();
  row.signerTitle = input.signerTitle.trim();
  row.signedAt = new Date().toISOString();
  row.status = ContractStatus.SIGNED;
  row.version += 1;
  return detail(row);
}

export function contractDocument(platform: PlatformState, actor: Actor, data: DemoDataset, id: string) {
  const row = contractOf(platform, actor, id);
  const file = row.pdfFileId ? data.files.find((item) => item.id === row.pdfFileId) : undefined;
  if (!file) throw new ClientError("這份合約還沒有簽署檔", { status: 404 });
  const binary = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
  return { blob: new Blob([binary], { type: "application/pdf" }), name: file.originalName };
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
    version: row.version,
    createdAt: row.createdAt,
  };
}

function detail(row: PlatformState["contracts"][number]) {
  return { ...strip(row), body: row.body };
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

async function assertSignatureInk(blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext("2d");
  if (!context) return;
  context.drawImage(bitmap, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let ink = 0;
  for (let index = 3; index < pixels.length; index += 4) {
    if ((pixels[index] ?? 0) > 16) ink += 1;
  }
  if (ink < 80) throw new ClientError("請先在簽名欄寫下簽名");
}

function blobFrom(bytes: Uint8Array, type: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

async function renderBrowserPdf(input: {
  title: string;
  contractNo: string;
  body: string;
  signerName: string;
  signerTitle: string;
  signedAtLabel: string;
  signaturePng: Uint8Array;
  faceBytes: Uint8Array;
}) {
  const font = new FontFace("NotoSansTC", "url(/fonts/NotoSansTC-Subset.otf)");
  await font.load();
  document.fonts.add(font);
  const signature = await createImageBitmap(blobFrom(input.signaturePng, "image/png"));
  const face = await createImageBitmap(blobFrom(input.faceBytes, "image/png"));
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
  };
  clear();
  paintContract(
    {
      fillText(text, x, y, size) {
        if (!context) return;
        context.font = `${size}px NotoSansTC`;
        context.fillText(text, x, y);
      },
      drawSignature(x, y, width, height) {
        context?.drawImage(signature, x, y, width, height);
      },
      drawFace(x, y, width, height) {
        context?.drawImage(face, x, y, width, height);
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
    input,
  );
  const url = canvas.toDataURL("image/png");
  pages.push(Uint8Array.from(atob(url.split(",")[1] ?? ""), (char) => char.charCodeAt(0)));
  return pngPagesToPdf(pages);
}

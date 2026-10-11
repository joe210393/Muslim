import {
  ContentSlot,
  ContractStatus,
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_TITLE,
  DEFAULT_SITE_CONTENT,
  INTEGRATION_DEFAULTS,
  PLATFORM_FEATURES,
  UserRole,
  CONTRACT_PAGE_HEIGHT,
  CONTRACT_PAGE_WIDTH,
  defaultFeatureEnabled,
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
import { ClientError, type AccessSettings, type AdminSiteSlot, type ContractItem, type SiteSlotInput } from "../services/types";

export type PlatformState = {
  contents: Array<AdminSiteSlot & { imageFileId: string | null }>;
  template: { id: string; code: string; title: string; body: string; version: number; updatedAt: string };
  contracts: Array<ContractItem & { body: string; templateId: string; faceFileId: string | null; signatureFileId: string | null; pdfFileId: string | null }>;
  features: AccessSettings["features"];
  integrations: AccessSettings["integrations"];
  contractSequence: number;
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
    contents: [ContentSlot.HOME_HERO, ContentSlot.HOME_BANNER].map((slot) => ({
      slot,
      ...DEFAULT_SITE_CONTENT[slot],
      imageUrl: null,
      imageFileId: null,
      isPublished: true,
      version: 1,
      updatedAt: now,
    })),
    template,
    contracts,
    features: [UserRole.APPLICANT, UserRole.CASE_OFFICER, UserRole.ADMIN].flatMap((role) =>
      PLATFORM_FEATURES.map((feature) => ({
        role,
        featureKey: feature.key,
        label: feature.label,
        enabled: defaultFeatureEnabled(role, feature.key),
      })),
    ),
    integrations: INTEGRATION_DEFAULTS.map((item) => ({ ...item })),
    contractSequence: 2,
  };
}

function assertFeature(platform: PlatformState, actor: Actor, featureKey: string) {
  const row = platform.features.find((item) => item.role === actor.role && item.featureKey === featureKey);
  if (!row?.enabled) throw new ClientError("這個角色目前沒有此功能", { status: 403, code: "FORBIDDEN" });
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

export function publicSite(platform: PlatformState, files: DemoDataset["files"]) {
  const hero = platform.contents.find((item) => item.slot === "HOME_HERO");
  const banner = platform.contents.find((item) => item.slot === "HOME_BANNER");
  return {
    hero: hero?.isPublished ? present(hero, files) : null,
    banner: banner?.isPublished ? present(banner, files) : null,
  };
}

export function adminSite(platform: PlatformState, actor: Actor, files: DemoDataset["files"]) {
  assertFeature(platform, actor, "cms.edit");
  return platform.contents.map((item) => present(item, files));
}

export function saveSite(platform: PlatformState, actor: Actor, files: DemoDataset["files"], slot: "HOME_HERO" | "HOME_BANNER", input: SiteSlotInput) {
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
  current.isPublished = input.isPublished;
  current.version += 1;
  current.updatedAt = new Date().toISOString();
  return present(current, files);
}

export async function uploadSiteImage(platform: PlatformState, actor: Actor, data: DemoDataset, slot: "HOME_HERO" | "HOME_BANNER", file: File) {
  assertFeature(platform, actor, "cms.edit");
  assertIntegration(platform, "media");
  const current = platform.contents.find((item) => item.slot === slot);
  if (!current) throw new ClientError("找不到版位", { status: 404 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf") throw new ClientError("首頁圖片只接受 JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
  const stored = await rememberFile(data, actor.id, file.name || "image", mime, bytes);
  current.imageFileId = stored.id;
  current.version += 1;
  current.updatedAt = new Date().toISOString();
  return present(current, data.files);
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

export function accessSettings(platform: PlatformState, actor: Actor) {
  assertFeature(platform, actor, "users.manage");
  return { features: platform.features, integrations: platform.integrations };
}

export function updateFeature(platform: PlatformState, actor: Actor, input: { role: string; featureKey: string; enabled: boolean }) {
  assertFeature(platform, actor, "users.manage");
  if (input.role === UserRole.ADMIN && input.featureKey === "users.manage" && !input.enabled) {
    throw new ClientError("不能關閉管理員的帳號管理，否則無法再改權限");
  }
  const row = platform.features.find((item) => item.role === input.role && item.featureKey === input.featureKey);
  if (!row) throw new ClientError("找不到這項功能", { status: 404 });
  row.enabled = input.enabled;
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

async function rememberFile(data: DemoDataset, uploadedById: string, originalName: string, mimeType: string, bytes: Uint8Array) {
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

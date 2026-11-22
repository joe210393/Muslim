import {
  ApplicationStatus,
  ContractStatus,
  ErrorCodes,
  UserRole,
  applicationNeedsContract,
  detectFileSignature,
  extensionForMime,
  formatContractNo,
  ensureContractHtml,
  isOpenApplicationForContract,
  issuableApplicationLabel,
  renderContractBody,
  sha256Hex,
  taipeiDateLabel,
  taipeiYear,
  type ContractRenewal,
  type ContractTemplateCreate,
  type ContractTemplateWrite,
  type IssueContractInput,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature } from "./access";
import { renderIssuedContractPdf } from "./contract-pdf";
import { ensureContent } from "./content";

function summary(row: {
  id: string;
  contractNo: string;
  organizationId: string;
  title: string;
  status: ContractStatus;
  signerName: string | null;
  signerTitle: string | null;
  signedAt: Date | null;
  signatureFileId?: string | null;
  faceFileId?: string | null;
  pdfFileId?: string | null;
  version: number;
  createdAt: Date;
  organization: { organizationName: string };
}) {
  return {
    id: row.id,
    contractNo: row.contractNo,
    organizationId: row.organizationId,
    organizationName: row.organization.organizationName,
    title: row.title,
    status: row.status,
    signerName: row.signerName,
    signerTitle: row.signerTitle,
    signedAt: row.signedAt?.toISOString() ?? null,
    hasSignature: Boolean(row.signatureFileId),
    hasFace: Boolean(row.faceFileId),
    hasPdf: Boolean(row.pdfFileId),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  };
}

function presentTemplate(template: { id: string; code: string; revision: number; title: string; body: string; version: number; updatedAt: Date }) {
  return { id: template.id, code: template.code, revision: template.revision, title: template.title, body: template.body, version: template.version, updatedAt: template.updatedAt.toISOString() };
}

export async function listTemplates(actor: SessionActor) {
  await assertFeature(actor, "contracts.issue");
  await ensureContent();
  const rows = await prisma.contractTemplate.findMany({ orderBy: [{ title: "asc" }, { revision: "desc" }] });
  return rows.map(presentTemplate);
}

export async function createTemplate(actor: SessionActor, input: ContractTemplateCreate) {
  await assertFeature(actor, "contracts.issue");
  const created = await prisma.contractTemplate.create({
    data: { code: `TPL_${randomUUID().slice(0, 8).toUpperCase()}`, revision: 1, title: input.title, body: ensureContractHtml(input.body), updatedById: actor.id },
  });
  return presentTemplate(created);
}

export async function createTemplateVersion(actor: SessionActor, id: string, input: ContractTemplateCreate) {
  await assertFeature(actor, "contracts.issue");
  const current = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到合約範本");
  const latest = await prisma.contractTemplate.aggregate({ where: { code: current.code }, _max: { revision: true } });
  const created = await prisma.contractTemplate.create({
    data: { code: current.code, revision: (latest._max.revision ?? current.revision) + 1, title: input.title, body: ensureContractHtml(input.body), updatedById: actor.id },
  });
  return presentTemplate(created);
}

export async function saveTemplate(actor: SessionActor, id: string, input: ContractTemplateWrite) {
  await assertFeature(actor, "contracts.issue");
  const result = await prisma.contractTemplate.updateMany({
    where: { id, version: input.expectedVersion },
    data: { title: input.title, body: ensureContractHtml(input.body), updatedById: actor.id, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "範本已被更新，請重新載入");
  const template = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!template) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到合約範本");
  return presentTemplate(template);
}

export async function listAdminContracts(actor: SessionActor) {
  await assertFeature(actor, "contracts.issue");
  const rows = await prisma.contractRecord.findMany({ include: { organization: true }, orderBy: { createdAt: "desc" } });
  return rows.map(summary);
}

/** 已核帳業者＋尚未完成合約的申請（供發約時帶出類別名稱）。 */
export async function listIssuableOrganizations(actor: SessionActor) {
  await assertFeature(actor, "contracts.issue");
  const paid = await prisma.paymentRecord.findMany({
    where: { status: "PAID" },
    select: { organizationId: true },
    distinct: ["organizationId"],
  });
  const ids = paid.map((row) => row.organizationId);
  if (ids.length === 0) return [];
  const [organizations, applications, contracts] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: ids } },
      orderBy: { organizationName: "asc" },
      select: { id: true, organizationName: true, taxId: true, address: true, contactName: true },
    }),
    prisma.application.findMany({
      where: {
        organizationId: { in: ids },
        status: { notIn: [ApplicationStatus.REJECTED] },
      },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.contractRecord.findMany({
      where: { organizationId: { in: ids }, status: { not: ContractStatus.VOID } },
      select: { applicationId: true, status: true },
    }),
  ]);
  return organizations.map((org) => {
    const pendingApplications = applications
      .filter((app) => app.organizationId === org.id && isOpenApplicationForContract(app.status) && applicationNeedsContract(app.id, contracts))
      .map((app) => ({
        id: app.id,
        applicationNo: app.applicationNo,
        categoryCode: app.category.code,
        categoryName: app.category.name,
        siteName: app.siteName,
        status: app.status,
        label: issuableApplicationLabel(app.category.name, app.siteName),
        formData: (app.formData ?? {}) as Record<string, unknown>,
      }));
    return { ...org, pendingApplications };
  });
}

export async function listMyContracts(actor: SessionActor) {
  await assertFeature(actor, "contracts.sign");
  if (!actor.organizationId) return [];
  const rows = await prisma.contractRecord.findMany({
    where: { organizationId: actor.organizationId },
    include: { organization: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(summary);
}

async function loadReadable(actor: SessionActor, id: string) {
  const row = await prisma.contractRecord.findUnique({ where: { id }, include: { organization: true } });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到合約");
  if (actor.role === UserRole.APPLICANT) {
    if (actor.organizationId !== row.organizationId) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到合約");
    await assertFeature(actor, "contracts.sign");
  } else {
    await assertFeature(actor, "contracts.issue");
  }
  return row;
}

export async function getContract(actor: SessionActor, id: string) {
  const row = await loadReadable(actor, id);
  const body = ensureContractHtml(row.bodySnapshot);
  if (body !== row.bodySnapshot) {
    await prisma.contractRecord.update({ where: { id: row.id }, data: { bodySnapshot: body } }).catch(() => undefined);
  }
  return { ...summary(row), body };
}

export async function issueContract(actor: SessionActor, input: IssueContractInput) {
  await assertFeature(actor, "contracts.issue");
  await ensureContent();
  const { organizationServiceUnlocked } = await import("../payments/service");
  const unlocked = await organizationServiceUnlocked(input.organizationId);
  if (!unlocked) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此業者尚未核帳完成，不能發出合約");
  const [organization, template] = await Promise.all([
    prisma.organization.findUnique({ where: { id: input.organizationId } }),
    prisma.contractTemplate.findUnique({ where: { id: input.templateId } }),
  ]);
  if (!organization || !template) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者或合約範本");
  let applicationId: string | null = input.applicationId ?? null;
  if (applicationId) {
    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application || application.organizationId !== organization.id) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "找不到此業者的申請");
    }
    const linked = await prisma.contractRecord.findFirst({
      where: { applicationId, status: { not: ContractStatus.VOID } },
    });
    if (linked) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這筆申請已有合約，請選其他尚未完成的申請");
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ nextval: number }>>(`SELECT nextval('contract_no_seq')::int AS nextval`);
  const contractNo = formatContractNo(taipeiYear(), rows[0]?.nextval ?? 0);
  const issuedOn = taipeiDateLabel();
  const created = await prisma.contractRecord.create({
    data: {
      contractNo,
      organizationId: organization.id,
      applicationId,
      templateId: template.id,
      title: template.title,
      bodySnapshot: renderContractBody(template.body, {
        organizationName: organization.organizationName,
        taxId: organization.taxId ?? "",
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
      status: ContractStatus.ISSUED,
      issuedById: actor.id,
    },
    include: { organization: true },
  });
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "CONTRACT_ISSUE",
      entityType: "ContractRecord",
      entityId: created.id,
      requestId: crypto.randomUUID(),
      safeChanges: { contractNo },
    },
  });
  return summary(created);
}

export async function recordRenewal(actor: SessionActor, id: string, input: ContractRenewal) {
  await assertFeature(actor, "contracts.sign");
  const contract = await loadReadable(actor, id);
  if (actor.role !== UserRole.APPLICANT || actor.organizationId !== contract.organizationId) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到合約");
  }
  if (contract.status !== ContractStatus.SIGNED || contract.version !== input.expectedVersion) {
    throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "只有已簽署的合約可以登記續約");
  }
  const status = input.decision === "RENEWED" ? ContractStatus.RENEWED : ContractStatus.NOT_RENEWED;
  const result = await prisma.contractRecord.updateMany({
    where: { id, status: ContractStatus.SIGNED, version: input.expectedVersion },
    data: { status, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "合約已被更新，請重新載入");
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "CONTRACT_RENEWAL",
      entityType: "ContractRecord",
      entityId: id,
      requestId: crypto.randomUUID(),
      safeChanges: { contractNo: contract.contractNo, status },
    },
  });
  return getContract(actor, id);
}

/** 業者下載合約 PDF：待上傳時依快照產生；已繳回則下載上傳檔。 */
export async function readContractPdf(actor: SessionActor, storage: StorageAdapter, repoRoot: string, id: string) {
  const contract = await loadReadable(actor, id);
  if (contract.pdfFileId) {
    const file = await prisma.fileObject.findUnique({ where: { id: contract.pdfFileId } });
    if (!file) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到合約 PDF");
    const bytes = await storage.read(file.storageKey);
    return { bytes, name: file.originalName, mimeType: file.mimeType };
  }
  if (contract.status !== ContractStatus.ISSUED) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, "這份合約還沒有 PDF");
  }
  const body = ensureContractHtml(contract.bodySnapshot);
  if (body !== contract.bodySnapshot) {
    await prisma.contractRecord.update({ where: { id: contract.id }, data: { bodySnapshot: body } }).catch(() => undefined);
  }
  const { loadSealBytes } = await import("./contract-seals");
  const seals = await loadSealBytes(storage);
  const bytes = await renderIssuedContractPdf(
    repoRoot,
    {
      title: contract.title,
      contractNo: contract.contractNo,
      body,
    },
    seals,
  );
  return { bytes, name: `${contract.contractNo}.pdf`, mimeType: "application/pdf" };
}

/** 業者蓋章後上傳 PDF，改為已繳回。 */
export async function uploadSignedContractPdf(
  actor: SessionActor,
  storage: StorageAdapter,
  id: string,
  input: { expectedVersion: number },
  pdf: { buffer: Buffer; mimetype: string; originalname?: string },
) {
  await assertFeature(actor, "contracts.sign");
  const { assertServiceUnlocked } = await import("../payments/service");
  await assertServiceUnlocked(actor, "請先完成方案付款與核帳後，才能上傳合約");
  const contract = await loadReadable(actor, id);
  if (contract.status !== ContractStatus.ISSUED) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "這份合約目前不能上傳");
  if (contract.version !== input.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "合約已被更新，請重新載入");
  const bytes = new Uint8Array(pdf.buffer);
  const mime = detectFileSignature(bytes);
  if (mime !== "application/pdf" || pdf.mimetype !== "application/pdf") {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "請上傳 PDF 檔");
  }
  if (bytes.byteLength < 100) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "PDF 檔案太小，請重新上傳");
  const pdfFile = await storeFile(actor.id, storage, `contracts/${id}`, `${contract.contractNo}-signed.pdf`, "application/pdf", bytes);
  try {
    const result = await prisma.contractRecord.updateMany({
      where: { id, status: ContractStatus.ISSUED, version: input.expectedVersion },
      data: {
        status: ContractStatus.SIGNED,
        pdfFileId: pdfFile.id,
        signedById: actor.id,
        signedAt: new Date(),
        signerName: actor.displayName,
        signerTitle: "蓋章上傳",
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "合約已被更新，請重新載入");
  } catch (error) {
    await storage.delete(pdfFile.storageKey).catch(() => undefined);
    throw error;
  }
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "CONTRACT_SIGN",
      entityType: "ContractRecord",
      entityId: id,
      requestId: crypto.randomUUID(),
      safeChanges: { contractNo: contract.contractNo, status: ContractStatus.SIGNED, method: "upload_pdf" },
    },
  });
  return getContract(actor, id);
}

export async function readContractCapture(actor: SessionActor, storage: StorageAdapter, id: string, kind: "signature" | "face") {
  return readContractFile(actor, storage, id, kind);
}

async function readContractFile(actor: SessionActor, storage: StorageAdapter, id: string, kind: "pdf" | "signature" | "face") {
  const contract = await loadReadable(actor, id);
  const fileId = kind === "pdf" ? contract.pdfFileId : kind === "signature" ? contract.signatureFileId : contract.faceFileId;
  if (!fileId) throw new ApiError(404, ErrorCodes.NOT_FOUND, kind === "pdf" ? "這份合約還沒有簽署檔" : "這份合約還沒有客戶簽名");
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到簽署檔");
  const bytes = await storage.read(file.storageKey);
  return { bytes, name: file.originalName, mimeType: file.mimeType };
}

async function storeFile(actorId: string, storage: StorageAdapter, folder: string, originalName: string, mime: "image/png" | "image/jpeg" | "application/pdf", bytes: Uint8Array) {
  const fileId = randomUUID();
  const storageKey = `${folder}/${fileId}.${extensionForMime(mime)}`;
  await storage.save(storageKey, bytes);
  return prisma.fileObject.create({
    data: {
      id: fileId,
      uploadedById: actorId,
      storageKey,
      originalName,
      mimeType: mime,
      sizeBytes: bytes.byteLength,
      sha256: await sha256Hex(bytes),
    },
  });
}

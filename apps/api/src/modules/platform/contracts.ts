import {
  ContractStatus,
  ErrorCodes,
  UserRole,
  detectFileSignature,
  extensionForMime,
  formatContractNo,
  readImageSize,
  renderContractBody,
  sha256Hex,
  taipeiDateLabel,
  taipeiDateTimeLabel,
  taipeiYear,
  type ContractRenewal,
  type ContractTemplateCreate,
  type ContractTemplateWrite,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { PNG } from "pngjs";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature, assertIntegration } from "./access";
import { renderSignedPdf } from "./contract-pdf";
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
    data: { code: `TPL_${randomUUID().slice(0, 8).toUpperCase()}`, revision: 1, title: input.title, body: input.body, updatedById: actor.id },
  });
  return presentTemplate(created);
}

export async function createTemplateVersion(actor: SessionActor, id: string, input: ContractTemplateCreate) {
  await assertFeature(actor, "contracts.issue");
  const current = await prisma.contractTemplate.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到合約範本");
  const latest = await prisma.contractTemplate.aggregate({ where: { code: current.code }, _max: { revision: true } });
  const created = await prisma.contractTemplate.create({
    data: { code: current.code, revision: (latest._max.revision ?? current.revision) + 1, title: input.title, body: input.body, updatedById: actor.id },
  });
  return presentTemplate(created);
}

export async function saveTemplate(actor: SessionActor, id: string, input: ContractTemplateWrite) {
  await assertFeature(actor, "contracts.issue");
  const result = await prisma.contractTemplate.updateMany({
    where: { id, version: input.expectedVersion },
    data: { title: input.title, body: input.body, updatedById: actor.id, version: { increment: 1 } },
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
  return { ...summary(row), body: row.bodySnapshot };
}

export async function issueContract(actor: SessionActor, organizationId: string, templateId: string) {
  await assertFeature(actor, "contracts.issue");
  await ensureContent();
  const [organization, template] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.contractTemplate.findUnique({ where: { id: templateId } }),
  ]);
  if (!organization || !template) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者或合約範本");
  const rows = await prisma.$queryRawUnsafe<Array<{ nextval: number }>>(`SELECT nextval('contract_no_seq')::int AS nextval`);
  const contractNo = formatContractNo(taipeiYear(), rows[0]?.nextval ?? 0);
  const created = await prisma.contractRecord.create({
    data: {
      contractNo,
      organizationId: organization.id,
      templateId: template.id,
      title: template.title,
      bodySnapshot: renderContractBody(template.body, {
        organizationName: organization.organizationName,
        taxId: organization.taxId ?? "",
        contractNo,
        issuedOn: taipeiDateLabel(),
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

export async function signContract(
  actor: SessionActor,
  storage: StorageAdapter,
  repoRoot: string,
  id: string,
  fields: { signerName: string; signerTitle: string; expectedVersion: number },
  face: { buffer: Buffer; mimetype: string },
  signature: { buffer: Buffer; mimetype: string },
) {
  await assertFeature(actor, "contracts.sign");
  await assertIntegration("signature");
  await assertIntegration("media");
  const contract = await loadReadable(actor, id);
  if (contract.status !== ContractStatus.ISSUED) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "這份合約目前不能簽署");
  if (contract.version !== fields.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "合約已被更新，請重新載入");
  const faceImage = inspectFace(face);
  const signatureImage = inspectSignature(signature);
  const pdfBytes = await renderSignedPdf(repoRoot, {
    title: contract.title,
    contractNo: contract.contractNo,
    body: contract.bodySnapshot,
    signerName: fields.signerName,
    signerTitle: fields.signerTitle,
    signedAtLabel: taipeiDateTimeLabel(),
    signaturePng: signatureImage.bytes,
    faceBytes: faceImage.bytes,
  });
  const stored = await Promise.all([
    storeFile(actor.id, storage, `contracts/${id}`, "face", faceImage.mime, faceImage.bytes),
    storeFile(actor.id, storage, `contracts/${id}`, "signature.png", "image/png", signatureImage.bytes),
    storeFile(actor.id, storage, `contracts/${id}`, `${contract.contractNo}.pdf`, "application/pdf", pdfBytes),
  ]);
  const [faceFile, signatureFile, pdfFile] = stored;
  if (!faceFile || !signatureFile || !pdfFile) throw new ApiError(500, ErrorCodes.VALIDATION_ERROR, "簽名檔沒有寫入");
  try {
    const result = await prisma.contractRecord.updateMany({
      where: { id, status: ContractStatus.ISSUED, version: fields.expectedVersion },
      data: {
        status: ContractStatus.SIGNED,
        signerName: fields.signerName,
        signerTitle: fields.signerTitle,
        faceFileId: faceFile.id,
        signatureFileId: signatureFile.id,
        pdfFileId: pdfFile.id,
        signedById: actor.id,
        signedAt: new Date(),
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "合約已被更新，請重新載入");
  } catch (error) {
    await Promise.all(stored.map((file) => storage.delete(file.storageKey).catch(() => undefined)));
    throw error;
  }
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "CONTRACT_SIGN",
      entityType: "ContractRecord",
      entityId: id,
      requestId: crypto.randomUUID(),
      safeChanges: { contractNo: contract.contractNo, status: ContractStatus.SIGNED },
    },
  });
  return getContract(actor, id);
}

export async function readContractPdf(actor: SessionActor, storage: StorageAdapter, id: string) {
  const file = await readContractFile(actor, storage, id, "pdf");
  return file;
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

function inspectFace(file: { buffer: Buffer; mimetype: string }) {
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf" || mime !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "人像只接受 JPEG 或 PNG");
  }
  const size = readImageSize(bytes);
  if (!size || size.width < 120 || size.height < 120) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "人像太小，請再拍一次或換一張較清楚的照片");
  return { bytes, mime };
}

function inspectSignature(file: { buffer: Buffer; mimetype: string }) {
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (mime !== "image/png" || file.mimetype !== "image/png") {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "手寫簽名需要 PNG");
  }
  const png = PNG.sync.read(Buffer.from(bytes));
  let ink = 0;
  for (let index = 3; index < png.data.length; index += 4) {
    if ((png.data[index] ?? 0) > 16) ink += 1;
  }
  if (ink < 80) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請先在簽名欄寫下簽名");
  return { bytes };
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

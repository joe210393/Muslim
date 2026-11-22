import { ErrorCodes, contractSealPositionsSchema, detectFileSignature, extensionForMime, normalizeSealLayout, sha256Hex } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature, assertIntegration, enabledFeatureKeys } from "./access";

const SEAL_ID = "default";

async function ensureSealRow() {
  const existing = await prisma.contractSealSetting.findUnique({ where: { id: SEAL_ID } });
  if (existing) return existing;
  return prisma.contractSealSetting.create({ data: { id: SEAL_ID } });
}

function present(row: {
  companySealFileId: string | null;
  personSealFileId: string | null;
  companySealX?: number;
  companySealY?: number;
  personSealX?: number;
  personSealY?: number;
  updatedAt: Date;
}) {
  const layout = normalizeSealLayout(row);
  return {
    companySealUrl: row.companySealFileId ? `/api/v1/contract-seals/media/company` : null,
    personSealUrl: row.personSealFileId ? `/api/v1/contract-seals/media/person` : null,
    hasCompanySeal: Boolean(row.companySealFileId),
    hasPersonSeal: Boolean(row.personSealFileId),
    ...layout,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 有合約權限即可讀取大小章 URL（畫面預覽／PDF）。 */
export async function getContractSeals(actor: SessionActor) {
  const keys = await enabledFeatureKeys(actor.id, actor.role);
  if (!keys.includes("contracts.issue") && !keys.includes("contracts.sign")) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有權限查看合約印章");
  }
  const row = await ensureSealRow();
  return present(row);
}

export async function updateSealPositions(actor: SessionActor, input: unknown) {
  await assertFeature(actor, "contracts.issue");
  const parsed = contractSealPositionsSchema.parse(input);
  await ensureSealRow();
  const saved = await prisma.contractSealSetting.update({
    where: { id: SEAL_ID },
    data: {
      companySealX: parsed.companySealX,
      companySealY: parsed.companySealY,
      personSealX: parsed.personSealX,
      personSealY: parsed.personSealY,
    },
  });
  return present(saved);
}

export async function uploadContractSeal(
  actor: SessionActor,
  storage: StorageAdapter,
  kind: "company" | "person",
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
) {
  await assertFeature(actor, "contracts.issue");
  await assertIntegration("media");
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf" || mime !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "印章只接受 JPEG 或 PNG");
  }
  await ensureSealRow();
  const fileId = randomUUID();
  const storageKey = `contract-seals/${kind}/${fileId}.${extensionForMime(mime)}`;
  await storage.save(storageKey, bytes);
  try {
    await prisma.fileObject.create({
      data: {
        id: fileId,
        uploadedById: actor.id,
        storageKey,
        originalName: file.originalname.slice(0, 180) || `${kind}-seal`,
        mimeType: mime,
        sizeBytes: bytes.byteLength,
        sha256: await sha256Hex(bytes),
      },
    });
    const data = kind === "company" ? { companySealFileId: fileId } : { personSealFileId: fileId };
    const saved = await prisma.contractSealSetting.update({ where: { id: SEAL_ID }, data });
    return present(saved);
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function readSealMedia(storage: StorageAdapter, kind: "company" | "person") {
  const row = await ensureSealRow();
  const fileId = kind === "company" ? row.companySealFileId : row.personSealFileId;
  if (!fileId) throw new ApiError(404, ErrorCodes.NOT_FOUND, "尚未設定印章圖檔");
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到印章圖檔");
  const bytes = await storage.read(file.storageKey);
  return { bytes, mimeType: file.mimeType, name: file.originalName };
}

export async function loadSealBytes(storage: StorageAdapter) {
  const row = await ensureSealRow();
  const layout = normalizeSealLayout(row);
  const [company, person] = await Promise.all([
    row.companySealFileId
      ? prisma.fileObject.findUnique({ where: { id: row.companySealFileId } }).then(async (file) => (file ? { bytes: await storage.read(file.storageKey), mimeType: file.mimeType } : null))
      : null,
    row.personSealFileId
      ? prisma.fileObject.findUnique({ where: { id: row.personSealFileId } }).then(async (file) => (file ? { bytes: await storage.read(file.storageKey), mimeType: file.mimeType } : null))
      : null,
  ]);
  return { company, person, layout };
}

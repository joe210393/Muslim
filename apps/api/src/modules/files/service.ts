import {
  ErrorCodes,
  FILE_POLICY,
  canDownloadApplicationFile,
  canEditApplicationContent,
  detectFileSignature,
  extensionForMime,
  isAllowedMimeType,
  parseCategoryDefinition,
  safeDisplayName,
  sha256Hex,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";

export async function addAttachment(actor: SessionActor, storage: StorageAdapter, applicationId: string, requirementKey: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { categoryFormVersion: true, attachments: { where: { removedAt: null }, include: { file: true } } },
  });
  if (!app || !canEditApplicationContent(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到可編輯的案件");
  const definition = parseCategoryDefinition(app.categoryFormVersion.definition);
  if (!definition.attachmentRequirements.some((item) => item.key === requirementKey)) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此表單版本沒有這個附件項目");
  }
  if (file.size > FILE_POLICY.maxFileBytes) throw new ApiError(413, ErrorCodes.FILE_TOO_LARGE, "檔案超過 10 MiB");
  const bytes = new Uint8Array(file.buffer);
  const signature = detectFileSignature(bytes);
  if (!signature || !isAllowedMimeType(file.mimetype) || signature !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "只接受 PDF、JPEG、PNG，且內容需與格式一致");
  }
  const used = app.attachments.reduce((sum, item) => sum + item.file.sizeBytes, 0);
  if (used + file.size > FILE_POLICY.maxApplicationBytes) throw new ApiError(413, ErrorCodes.FILE_TOO_LARGE, "本案附件合計超過 100 MiB");
  const fileId = randomUUID();
  const storageKey = `applications/${applicationId}/${fileId}.${extensionForMime(signature)}`;
  await storage.save(storageKey, bytes);
  try {
    const sameKey = app.attachments.filter((item) => item.requirementKey === requirementKey);
    const created = await prisma.$transaction(async (tx) => {
      if (sameKey.length) {
        await tx.applicationAttachment.updateMany({
          where: { id: { in: sameKey.map((item) => item.id) } },
          data: { removedAt: new Date() },
        });
      }
      const stored = await tx.fileObject.create({
        data: {
          id: fileId,
          uploadedById: actor.id,
          storageKey,
          originalName: safeDisplayName(file.originalname),
          mimeType: signature,
          sizeBytes: file.size,
          sha256: await sha256Hex(bytes),
        },
      });
      return tx.applicationAttachment.create({
        data: { applicationId, fileId: stored.id, requirementKey },
      });
    });
    return { id: created.id, fileId, requirementKey, originalName: safeDisplayName(file.originalname), mimeType: signature, sizeBytes: file.size };
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

export async function removeAttachment(actor: SessionActor, applicationId: string, attachmentId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canEditApplicationContent(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到可編輯的案件");
  const attachment = await prisma.applicationAttachment.findFirst({ where: { id: attachmentId, applicationId, removedAt: null } });
  if (!attachment) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到附件");
  await prisma.applicationAttachment.update({ where: { id: attachment.id }, data: { removedAt: new Date() } });
  return { removed: true };
}

export async function readAuthorizedFile(actor: SessionActor, storage: StorageAdapter, fileId: string) {
  const file = await prisma.fileObject.findUnique({
    where: { id: fileId },
    include: { attachments: { include: { application: true } } },
  });
  if (!file) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到檔案");
  const allowed = file.attachments.some((item) => canDownloadApplicationFile(actor, item.application));
  if (!allowed) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到檔案");
  const bytes = await storage.read(file.storageKey);
  return { bytes, mimeType: file.mimeType, originalName: file.originalName };
}

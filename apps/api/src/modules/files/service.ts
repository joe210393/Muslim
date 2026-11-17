import {
  ApplicationStatus,
  ErrorCodes,
  FILE_POLICY,
  UserRole,
  canDownloadApplicationFile,
  canEditApplicationContent,
  canViewApplication,
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
import { assertIntegration } from "../platform/access";

export async function addAttachment(actor: SessionActor, storage: StorageAdapter, applicationId: string, requirementKey: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  await assertIntegration("media");
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { categoryFormVersion: true, attachments: { where: { removedAt: null }, include: { file: true } } },
  });
  if (!app || !canEditApplicationContent(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到可編輯的案件");
  const definition = parseCategoryDefinition(app.categoryFormVersion.definition);
  const requirement = definition.attachmentRequirements.find((item) => item.key === requirementKey);
  if (!requirement) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此表單版本沒有這個附件項目");
  if (file.size > FILE_POLICY.maxFileBytes) throw new ApiError(413, ErrorCodes.FILE_TOO_LARGE, "檔案超過 10 MiB");
  const bytes = new Uint8Array(file.buffer);
  const signature = detectFileSignature(bytes);
  if (!signature || !isAllowedMimeType(file.mimetype) || signature !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "只接受 PDF、JPEG、PNG，且內容需與格式一致");
  }
  if (requirement.accept === "image" && !signature.startsWith("image/")) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "這個照片欄只接受 JPEG 或 PNG");
  }
  const used = app.attachments.reduce((sum, item) => sum + item.file.sizeBytes, 0);
  if (used + file.size > FILE_POLICY.maxApplicationBytes) throw new ApiError(413, ErrorCodes.FILE_TOO_LARGE, "本案附件合計超過 100 MiB");
  const fileId = randomUUID();
  const storageKey = `applications/${applicationId}/${fileId}.${extensionForMime(signature)}`;
  await storage.save(storageKey, bytes);
  try {
    const sameKey = app.attachments.filter((item) => item.requirementKey === requirementKey && !item.capturedOnSite);
    if (sameKey.length >= FILE_POLICY.maxImagesPerRequirement) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `這個項目最多 ${FILE_POLICY.maxImagesPerRequirement} 個檔案`);
    }
    const created = await prisma.$transaction(async (tx) => {
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
  if (attachment.capturedOnSite) throw new ApiError(403, ErrorCodes.FORBIDDEN, "不能移除現場拍攝的照片");
  await prisma.applicationAttachment.update({ where: { id: attachment.id }, data: { removedAt: new Date() } });
  return { removed: true };
}

export async function addSitePhoto(actor: SessionActor, storage: StorageAdapter, applicationId: string, requirementKey: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  await assertIntegration("media");
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { categoryFormVersion: true, attachments: { where: { removedAt: null }, include: { file: true } } },
  });
  if (!app || !canViewApplication(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
  if (app.status !== ApplicationStatus.SECOND_REVIEW) throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, "目前不是現場複審");
  if (actor.role !== UserRole.ADMIN && app.siteReviewerId !== actor.id) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有指定的複審人員或管理員可以上傳現場照片");
  const definition = parseCategoryDefinition(app.categoryFormVersion.definition);
  const requirement = definition.attachmentRequirements.find((item) => item.key === requirementKey);
  if (!requirement || requirement.group === "checklist") throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "只能在送件附件項目上補現場拍攝");
  if (file.size > FILE_POLICY.maxFileBytes) throw new ApiError(413, ErrorCodes.FILE_TOO_LARGE, "檔案超過 10 MiB");
  const bytes = new Uint8Array(file.buffer);
  const signature = detectFileSignature(bytes);
  if (!signature || !signature.startsWith("image/") || signature !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "現場拍攝只接受 JPEG 或 PNG");
  }
  const sitePhotos = app.attachments.filter((item) => item.requirementKey === requirementKey && item.capturedOnSite);
  if (sitePhotos.length >= FILE_POLICY.maxImagesPerRequirement) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `這個項目的現場照片最多 ${FILE_POLICY.maxImagesPerRequirement} 張`);
  const used = app.attachments.reduce((sum, item) => sum + item.file.sizeBytes, 0);
  if (used + file.size > FILE_POLICY.maxApplicationBytes) throw new ApiError(413, ErrorCodes.FILE_TOO_LARGE, "本案附件合計超過 100 MiB");
  const fileId = randomUUID();
  const storageKey = `applications/${applicationId}/${fileId}.${extensionForMime(signature)}`;
  await storage.save(storageKey, bytes);
  try {
    const stored = await prisma.fileObject.create({
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
    await prisma.applicationAttachment.create({
      data: { applicationId, fileId: stored.id, requirementKey, capturedOnSite: true },
    });
    return { id: stored.id, fileId, requirementKey };
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
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

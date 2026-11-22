import {
  ApplicationStatus,
  DEFAULT_AUDITOR_SIGNATURE_PATH,
  ErrorCodes,
  UserRole,
  buildCertificateFillValues,
  buildDefaultCertificateTemplates,
  certificateTemplateWriteSchema,
  detectFileSignature,
  ensureCertificateHtml,
  extensionForMime,
  fillCertificateHtml,
  findCertificateTemplateDef,
  matchCertificateTemplates,
  sha256Hex,
  validateCertificationDates,
  type CertificateTemplateKey,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../../lib/errors";
import { fieldFailure } from "../../lib/http";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature, assertIntegration, enabledFeatureKeys } from "./access";
import { renderCertificatePdf } from "./certificate-pdf";

type TemplateRow = {
  key: string;
  titleZh: string;
  titleEn: string;
  categoryCode: string;
  matchNote: string;
  body: string;
  logoFileId: string | null;
  signatureFileId: string | null;
  version: number;
  updatedAt: Date;
};

function needsOfficialBody(body: string) {
  return body.trim().length < 200 || !body.includes("data-certificate-logo");
}

export async function ensureCertificateTemplates() {
  const defaults = buildDefaultCertificateTemplates();
  const existing = await prisma.certificateTemplate.findMany();
  const byKey = new Map(existing.map((item) => [item.key, item]));
  for (const item of defaults) {
    const row = byKey.get(item.key);
    if (!row) {
      await prisma.certificateTemplate.create({
        data: {
          key: item.key,
          titleZh: item.titleZh,
          titleEn: item.titleEn,
          categoryCode: item.categoryCode,
          matchNote: item.matchNote,
          body: item.body,
          version: 1,
        },
      });
      continue;
    }
    if (needsOfficialBody(row.body)) {
      await prisma.certificateTemplate.update({
        where: { key: row.key },
        data: { body: item.body, titleZh: item.titleZh, titleEn: item.titleEn, matchNote: item.matchNote },
      });
    }
  }
  return prisma.certificateTemplate.findMany({ orderBy: { key: "asc" } });
}

function present(row: TemplateRow) {
  const def = findCertificateTemplateDef(row.key);
  return {
    key: row.key,
    titleZh: row.titleZh,
    titleEn: row.titleEn,
    categoryCode: row.categoryCode,
    matchNote: row.matchNote,
    body: row.body,
    logoUrl: row.logoFileId ? `/api/v1/admin/certificate-templates/${row.key}/logo` : def?.defaultLogoPath ?? null,
    logoFileId: row.logoFileId,
    signatureUrl: row.signatureFileId ? `/api/v1/admin/certificate-templates/${row.key}/signature` : DEFAULT_AUDITOR_SIGNATURE_PATH,
    signatureFileId: row.signatureFileId,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireTemplateReader(actor: SessionActor) {
  const keys = await enabledFeatureKeys(actor.id, actor.role);
  if (!keys.includes("applications.decide") && !keys.includes("applications.review")) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有權限查看證書範本");
  }
}

export async function listCertificateTemplates(actor: SessionActor) {
  await requireTemplateReader(actor);
  const rows = await ensureCertificateTemplates();
  return rows.map(present);
}

export async function saveCertificateTemplate(actor: SessionActor, key: string, input: unknown) {
  await assertFeature(actor, "applications.decide");
  const parsed = certificateTemplateWriteSchema.parse(input);
  if (!findCertificateTemplateDef(key)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到證書範本");
  await ensureCertificateTemplates();
  const row = await prisma.certificateTemplate.findUnique({ where: { key } });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到證書範本");
  if (row.version !== parsed.expectedVersion) {
    throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "範本已被其他人更新，請重新載入");
  }
  const saved = await prisma.certificateTemplate.update({
    where: { key },
    data: {
      body: ensureCertificateHtml(parsed.body),
      titleZh: parsed.titleZh?.trim() || row.titleZh,
      titleEn: parsed.titleEn?.trim() || row.titleEn,
      version: { increment: 1 },
    },
  });
  return present(saved);
}

async function storeImage(
  actor: SessionActor,
  storage: StorageAdapter,
  kind: "logo" | "signature",
  key: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
) {
  await assertFeature(actor, "applications.decide");
  await assertIntegration("media");
  if (!findCertificateTemplateDef(key)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到證書範本");
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf" || mime !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "只接受 JPEG 或 PNG");
  }
  await ensureCertificateTemplates();
  const fileId = randomUUID();
  const storageKey = `certificate-templates/${key}/${kind}/${fileId}.${extensionForMime(mime)}`;
  await storage.save(storageKey, bytes);
  try {
    await prisma.fileObject.create({
      data: {
        id: fileId,
        uploadedById: actor.id,
        storageKey,
        originalName: file.originalname.slice(0, 180) || `${key}-${kind}`,
        mimeType: mime,
        sizeBytes: bytes.byteLength,
        sha256: await sha256Hex(bytes),
      },
    });
    const data = kind === "logo" ? { logoFileId: fileId } : { signatureFileId: fileId };
    const saved = await prisma.certificateTemplate.update({
      where: { key },
      data: { ...data, version: { increment: 1 } },
    });
    return present(saved);
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
}

export function uploadCertificateLogo(actor: SessionActor, storage: StorageAdapter, key: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  return storeImage(actor, storage, "logo", key, file);
}

export function uploadCertificateSignature(actor: SessionActor, storage: StorageAdapter, key: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  return storeImage(actor, storage, "signature", key, file);
}

export async function readTemplateMedia(actor: SessionActor, storage: StorageAdapter, key: string, kind: "logo" | "signature") {
  await requireTemplateReader(actor);
  const row = await prisma.certificateTemplate.findUnique({ where: { key } });
  const fileId = kind === "logo" ? row?.logoFileId : row?.signatureFileId;
  if (!fileId) throw new ApiError(404, ErrorCodes.NOT_FOUND, "尚未上傳圖檔");
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖檔");
  return { bytes: await storage.read(file.storageKey), mimeType: file.mimeType, name: file.originalName };
}

function jsonRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function readPublicImage(repoRoot: string, urlPath: string | null | undefined) {
  if (!urlPath || !urlPath.startsWith("/cert-logos/")) return null;
  const name = path.basename(urlPath);
  return readFile(path.join(repoRoot, "apps/web/public/cert-logos", name));
}

async function readStoredImage(storage: StorageAdapter, fileId: string | null) {
  if (!fileId) return null;
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) return null;
  return storage.read(file.storageKey);
}

export async function composeCertificateBody(applicationId: string, input: { certificateNo: string; issuedOnDate: string; validUntilDate: string; templateKey?: string }) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { organization: true, category: true },
  });
  if (!app) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
  if (app.status !== ApplicationStatus.APPROVED) throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, "只有已核定案件可以登錄證書");
  const form = jsonRecord(app.formData);
  const matched = matchCertificateTemplates({
    categoryCode: app.category.code,
    applyType: typeof form.applyType === "string" ? form.applyType : null,
    mealBreakfast: form.mealBreakfast === true,
    mealLunch: form.mealLunch === true,
    mealDinner: form.mealDinner === true,
    mealDrink: form.mealDrink === true,
    mealSnack: form.mealSnack === true,
  });
  const templateKey = (input.templateKey as CertificateTemplateKey | undefined) ?? matched[0]?.key;
  if (!templateKey) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "找不到對應的證書範本");
  if (matched.length && !matched.some((item) => item.key === templateKey)) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此案件不能使用所選證書範本");
  }
  const rows = await ensureCertificateTemplates();
  const template = rows.find((item) => item.key === templateKey);
  const def = findCertificateTemplateDef(templateKey);
  if (!template || !def) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到證書範本");
  const shown = present(template);
  const bodyHtml = fillCertificateHtml(
    template.body,
    buildCertificateFillValues({
      organizationName: app.organizationNameSnapshot || app.organization.organizationName,
      siteName: app.siteName,
      addressZh: app.siteAddress || app.organizationAddressSnapshot || app.organization.address,
      certificateNameEn: typeof form.certificateNameEn === "string" ? form.certificateNameEn : null,
      certificateAddressEn: typeof form.certificateAddressEn === "string" ? form.certificateAddressEn : null,
      certificatePhone: typeof form.certificatePhone === "string" ? form.certificatePhone : null,
      certificateNo: input.certificateNo,
      issuedOnDate: input.issuedOnDate,
      validUntilDate: input.validUntilDate,
      template: def,
    }),
    shown.logoUrl,
    shown.signatureUrl,
  );
  return { app, template, templateKey, bodyHtml, templateTitle: def.titleZh };
}

export async function certificationDocument(actor: SessionActor, storage: StorageAdapter, repoRoot: string, applicationId: string) {
  const row = await prisma.certification.findUnique({
    where: { applicationId },
    include: { application: { include: { organization: true, category: true } } },
  });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "尚未發證或沒有證書內容");
  const staff = actor.role === UserRole.ADMIN || actor.role === UserRole.CASE_OFFICER;
  if (!staff && row.application.organizationId !== actor.organizationId) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有權限下載此證書");
  }
  let body = row.bodyHtml ?? "";
  let templateKey = row.templateKey;
  if (needsOfficialBody(body)) {
    const composed = await composeCertificateBody(applicationId, {
      certificateNo: row.certificateNo,
      issuedOnDate: row.issuedOnDate,
      validUntilDate: row.validUntilDate,
      templateKey: row.templateKey ?? undefined,
    });
    body = composed.bodyHtml;
    templateKey = composed.templateKey;
    await prisma.certification.update({
      where: { id: row.id },
      data: { bodyHtml: body, templateKey },
    });
  }
  const template = templateKey ? await prisma.certificateTemplate.findUnique({ where: { key: templateKey } }) : null;
  const def = templateKey ? findCertificateTemplateDef(templateKey) : null;
  const [logo, signature] = await Promise.all([
    readStoredImage(storage, template?.logoFileId ?? null).then((bytes) => bytes ?? readPublicImage(repoRoot, def?.defaultLogoPath)),
    readStoredImage(storage, template?.signatureFileId ?? null).then((bytes) => bytes ?? readPublicImage(repoRoot, DEFAULT_AUDITOR_SIGNATURE_PATH)),
  ]);
  const bytes = await renderCertificatePdf(repoRoot, { body, logo, signature });
  return { bytes, name: `${row.certificateNo}.pdf` };
}

export function assertCertificationDates(issuedOnDate: string, validUntilDate: string) {
  const issues = validateCertificationDates(issuedOnDate, validUntilDate);
  if (issues.length) fieldFailure(issues);
}

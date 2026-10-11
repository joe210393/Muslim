import {
  ContentSlot,
  CONTRACT_TEMPLATE_CODE,
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_TITLE,
  DEFAULT_SITE_CONTENT,
  ErrorCodes,
  type SiteContentWrite,
} from "@mf/contracts";
import { detectFileSignature, extensionForMime, sha256Hex } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature, assertIntegration, ensurePlatform } from "./access";

export async function ensureContent() {
  await ensurePlatform();
  for (const slot of [ContentSlot.HOME_HERO, ContentSlot.HOME_BANNER]) {
    const defaults = DEFAULT_SITE_CONTENT[slot];
    await prisma.siteContent.upsert({
      where: { slot },
      create: { slot, ...defaults },
      update: {},
    });
  }
  await prisma.contractTemplate.upsert({
    where: { code: CONTRACT_TEMPLATE_CODE },
    create: { code: CONTRACT_TEMPLATE_CODE, title: DEFAULT_CONTRACT_TITLE, body: DEFAULT_CONTRACT_BODY },
    update: {},
  });
}

function view(row: {
  slot: ContentSlot;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  imageFileId: string | null;
  isPublished: boolean;
  version: number;
  updatedAt: Date;
}, includeDraft: boolean) {
  return {
    slot: row.slot,
    eyebrow: row.eyebrow,
    title: row.title,
    subtitle: row.subtitle,
    body: row.body,
    ctaLabel: row.ctaLabel,
    ctaHref: row.ctaHref,
    secondaryCtaLabel: row.secondaryCtaLabel,
    secondaryCtaHref: row.secondaryCtaHref,
    imageUrl: row.imageFileId ? `/api/v1/site-content/media/${row.imageFileId}` : null,
    isPublished: includeDraft ? row.isPublished : undefined,
    version: includeDraft ? row.version : undefined,
    updatedAt: includeDraft ? row.updatedAt.toISOString() : undefined,
  };
}

export async function publicSite() {
  await ensureContent();
  const rows = await prisma.siteContent.findMany();
  const hero = rows.find((item) => item.slot === ContentSlot.HOME_HERO);
  const banner = rows.find((item) => item.slot === ContentSlot.HOME_BANNER);
  return {
    hero: hero?.isPublished ? view(hero, false) : null,
    banner: banner?.isPublished ? view(banner, false) : null,
  };
}

export async function adminSite(actor: SessionActor) {
  await assertFeature(actor, "cms.edit");
  await ensureContent();
  const rows = await prisma.siteContent.findMany();
  return rows.map((row) => view(row, true));
}

export async function updateSite(actor: SessionActor, slot: ContentSlot, input: SiteContentWrite) {
  await assertFeature(actor, "cms.edit");
  const { expectedVersion, ...fields } = input;
  const result = await prisma.siteContent.updateMany({
    where: { slot, version: expectedVersion },
    data: { ...fields, updatedById: actor.id, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "內容已被更新，請重新載入");
  const saved = await prisma.siteContent.findUnique({ where: { slot } });
  if (!saved) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到版位");
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "SITE_CONTENT_UPDATE",
      entityType: "SiteContent",
      entityId: saved.id,
      requestId: crypto.randomUUID(),
      safeChanges: { slot, isPublished: saved.isPublished },
    },
  });
  return view(saved, true);
}

export async function uploadSiteImage(actor: SessionActor, storage: StorageAdapter, slot: ContentSlot, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  await assertFeature(actor, "cms.edit");
  await assertIntegration("media");
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf" || mime !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "首頁圖片只接受 JPEG 或 PNG");
  }
  const current = await prisma.siteContent.findUnique({ where: { slot } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到版位");
  const fileId = randomUUID();
  const storageKey = `site/${slot.toLowerCase()}/${fileId}.${extensionForMime(mime)}`;
  await storage.save(storageKey, bytes);
  try {
    await prisma.fileObject.create({
      data: {
        id: fileId,
        uploadedById: actor.id,
        storageKey,
        originalName: file.originalname.slice(0, 180) || "image",
        mimeType: mime,
        sizeBytes: bytes.byteLength,
        sha256: await sha256Hex(bytes),
      },
    });
    await prisma.siteContent.update({ where: { slot }, data: { imageFileId: fileId, updatedById: actor.id, version: { increment: 1 } } });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
  const saved = await prisma.siteContent.findUnique({ where: { slot } });
  if (!saved) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到版位");
  return view(saved, true);
}

export async function readSiteImage(actor: SessionActor | null, storage: StorageAdapter, fileId: string) {
  await ensureContent();
  const content = await prisma.siteContent.findFirst({ where: { imageFileId: fileId } });
  if (!content) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖片");
  if (!content.isPublished && actor?.role !== "ADMIN") throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖片");
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖片");
  const bytes = await storage.read(file.storageKey);
  return { bytes, mimeType: file.mimeType };
}

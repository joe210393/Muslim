import {
  ContentSlot,
  CONTRACT_TEMPLATE_CODE,
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_TITLE,
  DEFAULT_EDITORIAL,
  DEFAULT_SITE_CONTENT,
  EditorialKind,
  ErrorCodes,
  editorialCreateSchema,
  editorialUpdateSchemaFor,
  type SiteContentWrite,
} from "@mf/contracts";
import { detectFileSignature, extensionForMime, sha256Hex } from "@mf/contracts";
import { prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { ApiError, isUniqueViolation } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature, assertIntegration, ensurePlatform } from "./access";

export async function ensureContent() {
  await ensurePlatform();
  for (const slot of Object.values(ContentSlot)) {
    const defaults = DEFAULT_SITE_CONTENT[slot];
    await prisma.siteContent.upsert({
      where: { slot },
      create: { slot, ...defaults },
      update: {},
    });
  }
  for (const kind of Object.values(EditorialKind)) {
    const count = await prisma.editorialEntry.count({ where: { kind } });
    if (count > 0) continue;
    await prisma.editorialEntry.createMany({
      data: DEFAULT_EDITORIAL.filter((item) => item.kind === kind).map((item) => ({
        kind: item.kind,
        slug: item.slug,
        groupLabel: item.groupLabel,
        title: item.title,
        summary: item.summary,
        body: item.body,
        note: item.note,
        publishedOn: item.publishedOn ? new Date(`${item.publishedOn}T00:00:00.000Z`) : null,
        sortOrder: item.sortOrder,
      })),
    });
  }
  const template = await prisma.contractTemplate.findFirst({ where: { code: CONTRACT_TEMPLATE_CODE } });
  if (!template) {
    await prisma.contractTemplate.create({ data: { code: CONTRACT_TEMPLATE_CODE, revision: 1, title: DEFAULT_CONTRACT_TITLE, body: DEFAULT_CONTRACT_BODY } });
  }
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
  youtubeUrl: string;
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
    youtubeUrl: row.youtubeUrl,
    imageUrl: row.imageFileId ? `/api/v1/site-content/media/${row.imageFileId}` : null,
    isPublished: includeDraft ? row.isPublished : undefined,
    version: includeDraft ? row.version : undefined,
    updatedAt: includeDraft ? row.updatedAt.toISOString() : undefined,
  };
}

function publishedSlot(rows: Array<{ slot: ContentSlot; isPublished: boolean } & Parameters<typeof view>[0]>, slot: ContentSlot) {
  const row = rows.find((item) => item.slot === slot);
  return row?.isPublished ? view(row, false) : null;
}

function entryView(row: {
  id: string;
  kind: EditorialKind;
  slug: string;
  groupLabel: string;
  title: string;
  summary: string;
  body: string;
  note: string;
  youtubeUrl: string;
  imageFileId: string | null;
  publishedOn: Date | null;
  sortOrder: number;
  isPublished: boolean;
  version: number;
  updatedAt: Date;
}, includeDraft: boolean) {
  return {
    id: row.id,
    kind: row.kind,
    slug: row.slug,
    groupLabel: row.groupLabel,
    title: row.title,
    summary: row.summary,
    body: row.body,
    note: row.note,
    youtubeUrl: row.youtubeUrl,
    imageUrl: row.imageFileId ? `/api/v1/media/${row.imageFileId}` : null,
    publishedOn: row.publishedOn ? row.publishedOn.toISOString().slice(0, 10) : null,
    sortOrder: row.sortOrder,
    isPublished: includeDraft ? row.isPublished : undefined,
    version: includeDraft ? row.version : undefined,
    updatedAt: includeDraft ? row.updatedAt.toISOString() : undefined,
  };
}

export async function publicSite() {
  await ensureContent();
  const rows = await prisma.siteContent.findMany();
  const entries = await prisma.editorialEntry.findMany({ where: { isPublished: true } });
  return {
    hero: publishedSlot(rows, ContentSlot.HOME_HERO),
    banner: publishedSlot(rows, ContentSlot.HOME_BANNER),
    about: publishedSlot(rows, ContentSlot.ABOUT),
    newsIntro: publishedSlot(rows, ContentSlot.NEWS_INTRO),
    verification: publishedSlot(rows, ContentSlot.VERIFICATION),
    faq: publishedSlot(rows, ContentSlot.FAQ),
    entries: entries.map((row) => entryView(row, false)),
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
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "圖片只接受 JPEG 或 PNG");
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

function staffCanSeeDraft(actor: SessionActor | null) {
  return actor?.role === "ADMIN" || actor?.role === "CASE_OFFICER";
}

async function readStoredFile(storage: StorageAdapter, fileId: string) {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });
  if (!file) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖片");
  const bytes = await storage.read(file.storageKey);
  return { bytes, mimeType: file.mimeType };
}

export async function readSiteImage(actor: SessionActor | null, storage: StorageAdapter, fileId: string) {
  await ensureContent();
  const content = await prisma.siteContent.findFirst({ where: { imageFileId: fileId } });
  if (content) {
    if (!content.isPublished && !staffCanSeeDraft(actor)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖片");
    return readStoredFile(storage, fileId);
  }
  const entry = await prisma.editorialEntry.findFirst({ where: { imageFileId: fileId } });
  if (entry) {
    if (!entry.isPublished && !staffCanSeeDraft(actor)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖片");
    return readStoredFile(storage, fileId);
  }
  const course = await prisma.course.findFirst({ where: { imageFileId: fileId } });
  if (course) {
    if (course.status === "DRAFT" && !staffCanSeeDraft(actor)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖片");
    return readStoredFile(storage, fileId);
  }
  throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到圖片");
}

export async function uploadEntryImage(actor: SessionActor, storage: StorageAdapter, id: string, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  await assertFeature(actor, "cms.edit");
  await assertIntegration("media");
  const current = await prisma.editorialEntry.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到這則內容");
  if (current.kind !== EditorialKind.NEWS && current.kind !== EditorialKind.HOME_GALLERY) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "只有最新消息與首頁圖庫可以上傳圖片");
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf" || mime !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "圖片只接受 JPEG 或 PNG");
  }
  const fileId = randomUUID();
  const storageKey = `editorial/${id}/${fileId}.${extensionForMime(mime)}`;
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
    await prisma.editorialEntry.update({ where: { id }, data: { imageFileId: fileId, updatedById: actor.id, version: { increment: 1 } } });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
  const saved = await prisma.editorialEntry.findUnique({ where: { id } });
  if (!saved) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到這則內容");
  return entryView(saved, true);
}

export async function adminEntries(actor: SessionActor) {
  await assertFeature(actor, "cms.edit");
  await ensureContent();
  const rows = await prisma.editorialEntry.findMany({ orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] });
  return rows.map((row) => entryView(row, true));
}

export async function createEntry(actor: SessionActor, raw: unknown) {
  await assertFeature(actor, "cms.edit");
  const input = editorialCreateSchema.parse(raw);
  try {
    const saved = await prisma.editorialEntry.create({
      data: {
        kind: input.kind,
        slug: input.slug,
        groupLabel: input.groupLabel,
        title: input.title,
        summary: input.summary,
        body: input.body,
        note: input.note,
        youtubeUrl: input.youtubeUrl,
        publishedOn: input.publishedOn ? new Date(`${input.publishedOn}T00:00:00.000Z`) : null,
        sortOrder: input.sortOrder,
        isPublished: input.isPublished,
        updatedById: actor.id,
      },
    });
    await prisma.auditLog.create({
      data: { actorId: actor.id, action: "EDITORIAL_CREATE", entityType: "EditorialEntry", entityId: saved.id, requestId: crypto.randomUUID(), safeChanges: { kind: saved.kind, slug: saved.slug } },
    });
    return entryView(saved, true);
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這個代碼已經用過");
    throw error;
  }
}

export async function updateEntry(actor: SessionActor, id: string, raw: unknown) {
  await assertFeature(actor, "cms.edit");
  const current = await prisma.editorialEntry.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到這則內容");
  const input = editorialUpdateSchemaFor(current.kind).parse(raw);
  const result = await prisma.editorialEntry.updateMany({
    where: { id, version: input.expectedVersion },
    data: {
      groupLabel: input.groupLabel,
      title: input.title,
      summary: input.summary,
      body: input.body,
      note: input.note,
      youtubeUrl: input.youtubeUrl,
      publishedOn: input.publishedOn ? new Date(`${input.publishedOn}T00:00:00.000Z`) : null,
      sortOrder: input.sortOrder,
      isPublished: input.isPublished,
      updatedById: actor.id,
      version: { increment: 1 },
    },
  });
  if (result.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "內容已被更新，請重新載入");
  const saved = await prisma.editorialEntry.findUnique({ where: { id } });
  if (!saved) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到這則內容");
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "EDITORIAL_UPDATE", entityType: "EditorialEntry", entityId: saved.id, requestId: crypto.randomUUID(), safeChanges: { kind: saved.kind, slug: saved.slug, isPublished: saved.isPublished } },
  });
  return entryView(saved, true);
}

export async function deleteEntry(actor: SessionActor, id: string) {
  await assertFeature(actor, "cms.edit");
  const current = await prisma.editorialEntry.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到這則內容");
  await prisma.editorialEntry.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "EDITORIAL_DELETE", entityType: "EditorialEntry", entityId: current.id, requestId: crypto.randomUUID(), safeChanges: { kind: current.kind, slug: current.slug } },
  });
  return { id };
}

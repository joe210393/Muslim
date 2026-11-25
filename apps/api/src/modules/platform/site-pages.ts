import {
  ErrorCodes,
  SitePageKind,
  detectFileSignature,
  extensionForMime,
  sha256Hex,
  siteBuiltinPage,
  sitePageCreateSchema,
  sitePagePath,
  sitePageReorderSchema,
  sitePageUpdateSchema,
  sitePageVersionSchema,
  siteSectionsSchema,
  type PublicSitePage,
  type SitePageItem,
  type SiteSection,
} from "@mf/contracts";
import { Prisma, prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { ApiError, isUniqueViolation } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature, assertIntegration } from "./access";

export const SITE_PAGE_FILE_PREFIX = "site-pages/";

type Row = Prisma.SitePageGetPayload<{ include: { updatedBy: { select: { displayName: true } } } }>;

function sections(value: Prisma.JsonValue | null): SiteSection[] {
  const parsed = siteSectionsSchema.safeParse(value ?? []);
  return parsed.success ? parsed.data : [];
}

function view(row: Row): SitePageItem {
  const draft = sections(row.draftSections);
  const published = row.publishedSections === null ? null : sections(row.publishedSections);
  const draftBackground = row.draftBackground ?? "";
  const publishedBackground = row.publishedBackground;
  return {
    id: row.id,
    slug: row.slug,
    path: sitePagePath(row.slug),
    name: row.name,
    kind: row.kind,
    builtin: Boolean(siteBuiltinPage(row.slug)),
    inHeader: row.inHeader,
    sortOrder: row.sortOrder,
    draftBackground,
    draftSections: draft,
    publishedBackground,
    publishedSections: published,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    hasUnpublishedChanges: published === null || JSON.stringify(draft) !== JSON.stringify(published) || draftBackground !== (publishedBackground ?? ""),
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    updatedByName: row.updatedBy?.displayName ?? null,
  };
}

const include = { updatedBy: { select: { displayName: true } } } as const;

async function audit(actor: SessionActor, action: string, entityId: string, safeChanges: Prisma.InputJsonObject, tx: Prisma.TransactionClient = prisma) {
  await tx.auditLog.create({ data: { actorId: actor.id, action, entityType: "SitePage", entityId, requestId: randomUUID(), safeChanges } });
}

async function findOrThrow(id: string) {
  const row = await prisma.sitePage.findUnique({ where: { id }, include });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到這個頁面");
  return row;
}

function conflict(): never {
  throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "頁面已被其他人更新，請重新載入");
}

export async function publicPages(): Promise<PublicSitePage[]> {
  const rows = await prisma.sitePage.findMany({ where: { publishedAt: { not: null } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows
    .filter((row) => row.publishedSections !== null)
    .map((row) => ({
      slug: row.slug,
      path: sitePagePath(row.slug),
      name: row.name,
      kind: row.kind,
      inHeader: row.inHeader && !siteBuiltinPage(row.slug),
      sortOrder: row.sortOrder,
      backgroundImage: row.publishedBackground ?? "",
      sections: sections(row.publishedSections),
    }));
}

export async function adminPages(actor: SessionActor) {
  await assertFeature(actor, "cms.edit");
  const rows = await prisma.sitePage.findMany({ include, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return rows.map(view);
}

export async function createPage(actor: SessionActor, raw: unknown) {
  await assertFeature(actor, "cms.edit");
  const input = sitePageCreateSchema.parse(raw);
  const builtin = siteBuiltinPage(input.slug);
  const last = await prisma.sitePage.aggregate({ _max: { sortOrder: true } });
  try {
    const saved = await prisma.$transaction(async (tx) => {
      const row = await tx.sitePage.create({
        data: {
          slug: input.slug,
          name: input.name,
          kind: builtin ? SitePageKind.PAGE : input.kind,
          inHeader: builtin ? false : input.inHeader,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
          draftBackground: input.backgroundImage ?? "",
          draftSections: input.sections as Prisma.InputJsonValue,
          updatedById: actor.id,
        },
        include,
      });
      await audit(actor, "SITE_PAGE_CREATE", row.id, { slug: row.slug, kind: row.kind }, tx);
      return row;
    });
    return view(saved);
  } catch (error) {
    if (isUniqueViolation(error)) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, builtin ? "這一頁已經存過版面，請重新載入" : "這個網址代碼已經用過");
    throw error;
  }
}

export async function updatePage(actor: SessionActor, id: string, raw: unknown) {
  await assertFeature(actor, "cms.edit");
  const input = sitePageUpdateSchema.parse(raw);
  const current = await findOrThrow(id);
  const builtin = Boolean(siteBuiltinPage(current.slug));
  const saved = await prisma.$transaction(async (tx) => {
    const result = await tx.sitePage.updateMany({
      where: { id, version: input.expectedVersion },
      data: {
        name: input.name,
        inHeader: builtin ? false : input.inHeader,
        ...(input.backgroundImage !== undefined ? { draftBackground: input.backgroundImage } : {}),
        draftSections: input.sections as Prisma.InputJsonValue | undefined,
        updatedById: actor.id,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) conflict();
    await audit(actor, "SITE_PAGE_UPDATE", id, { slug: current.slug, fields: Object.keys(input).filter((key) => key !== "expectedVersion") }, tx);
    return tx.sitePage.findUniqueOrThrow({ where: { id }, include });
  });
  return view(saved);
}

export async function publishPage(actor: SessionActor, id: string, raw: unknown, publish: boolean) {
  await assertFeature(actor, "cms.edit");
  const input = sitePageVersionSchema.parse(raw);
  const current = await findOrThrow(id);
  if (current.version !== input.expectedVersion) conflict();
  const draft = sections(current.draftSections);
  if (publish && draft.length === 0) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "頁面還沒有任何區塊，不能發布");
  const saved = await prisma.$transaction(async (tx) => {
    const result = await tx.sitePage.updateMany({
      where: { id, version: input.expectedVersion },
      data: publish
        ? { publishedSections: draft as Prisma.InputJsonValue, publishedBackground: current.draftBackground, publishedAt: new Date(), updatedById: actor.id, version: { increment: 1 } }
        : { publishedSections: Prisma.DbNull, publishedBackground: null, publishedAt: null, updatedById: actor.id, version: { increment: 1 } },
    });
    if (result.count !== 1) conflict();
    await audit(actor, publish ? "SITE_PAGE_PUBLISH" : "SITE_PAGE_UNPUBLISH", id, { slug: current.slug, sections: draft.length }, tx);
    return tx.sitePage.findUniqueOrThrow({ where: { id }, include });
  });
  return view(saved);
}

export async function deletePage(actor: SessionActor, id: string, raw: unknown) {
  await assertFeature(actor, "cms.edit");
  const input = sitePageVersionSchema.parse(raw);
  const current = await findOrThrow(id);
  await prisma.$transaction(async (tx) => {
    const result = await tx.sitePage.deleteMany({ where: { id, version: input.expectedVersion } });
    if (result.count !== 1) conflict();
    await audit(actor, "SITE_PAGE_DELETE", id, { slug: current.slug, builtin: Boolean(siteBuiltinPage(current.slug)) }, tx);
  });
  return { id };
}

export async function reorderPages(actor: SessionActor, raw: unknown) {
  await assertFeature(actor, "cms.edit");
  const input = sitePageReorderSchema.parse(raw);
  if (new Set(input.items.map((item) => item.id)).size !== input.items.length) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "頁面重複");
  await prisma.$transaction(async (tx) => {
    for (const [index, item] of input.items.entries()) {
      const result = await tx.sitePage.updateMany({ where: { id: item.id, version: item.expectedVersion }, data: { sortOrder: index, updatedById: actor.id, version: { increment: 1 } } });
      if (result.count !== 1) conflict();
    }
    await audit(actor, "SITE_PAGE_REORDER", input.items[0]!.id, { count: input.items.length }, tx);
  });
  return adminPages(actor);
}

export async function uploadPageImage(actor: SessionActor, storage: StorageAdapter, file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
  await assertFeature(actor, "cms.edit");
  await assertIntegration("media");
  const bytes = new Uint8Array(file.buffer);
  const mime = detectFileSignature(bytes);
  if (!mime || mime === "application/pdf" || mime !== file.mimetype) {
    throw new ApiError(400, ErrorCodes.UNSUPPORTED_FILE_TYPE, "圖片只接受 JPEG 或 PNG");
  }
  const fileId = randomUUID();
  const storageKey = `${SITE_PAGE_FILE_PREFIX}${fileId}.${extensionForMime(mime)}`;
  await storage.save(storageKey, bytes);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.fileObject.create({
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
      await audit(actor, "SITE_PAGE_IMAGE", fileId, { mimeType: mime, sizeBytes: bytes.byteLength }, tx);
    });
  } catch (error) {
    await storage.delete(storageKey).catch(() => undefined);
    throw error;
  }
  return { url: `/api/v1/media/${fileId}` };
}

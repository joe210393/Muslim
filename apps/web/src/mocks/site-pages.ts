import {
  SitePageKind,
  siteBuiltinPage,
  sitePageCreateSchema,
  sitePagePath,
  sitePageReorderSchema,
  sitePageUpdateSchema,
  sitePageVersionSchema,
  type DemoDataset,
  type PublicSitePage,
  type SitePageItem,
  type SiteSection,
} from "@mf/contracts";
import { ClientError } from "../services/types";
import { hasFeature, type PlatformState } from "./platform";

export type MockSitePage = {
  id: string;
  slug: string;
  name: string;
  kind: SitePageKind;
  inHeader: boolean;
  sortOrder: number;
  draftBackground: string;
  draftSections: SiteSection[];
  publishedBackground: string | null;
  publishedSections: SiteSection[] | null;
  publishedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  updatedById: string | null;
};

type Actor = { id: string };

function rows(platform: PlatformState) {
  platform.sitePages ??= [];
  return platform.sitePages;
}

function assertCms(platform: PlatformState, actor: Actor) {
  if (!hasFeature(platform, actor.id, "cms.edit")) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
}

function conflict(): never {
  throw new ClientError("頁面已被其他人更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
}

function audit(data: DemoDataset, actor: Actor, action: string, entityId: string, safeChanges: Record<string, unknown>) {
  data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action, entityType: "SitePage", entityId, requestId: crypto.randomUUID(), safeChanges, createdAt: new Date().toISOString() });
}

function view(row: MockSitePage, data: DemoDataset): SitePageItem {
  return {
    id: row.id,
    slug: row.slug,
    path: sitePagePath(row.slug),
    name: row.name,
    kind: row.kind,
    builtin: Boolean(siteBuiltinPage(row.slug)),
    inHeader: row.inHeader,
    sortOrder: row.sortOrder,
    draftBackground: row.draftBackground,
    draftSections: structuredClone(row.draftSections),
    publishedBackground: row.publishedBackground,
    publishedSections: row.publishedSections ? structuredClone(row.publishedSections) : null,
    publishedAt: row.publishedAt,
    hasUnpublishedChanges: row.publishedSections === null || JSON.stringify(row.draftSections) !== JSON.stringify(row.publishedSections) || row.draftBackground !== (row.publishedBackground ?? ""),
    version: row.version,
    updatedAt: row.updatedAt,
    updatedByName: data.users.find((user) => user.id === row.updatedById)?.displayName ?? null,
  };
}

function ordered(platform: PlatformState) {
  return rows(platform).slice().sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
}

function find(platform: PlatformState, id: string) {
  const row = rows(platform).find((item) => item.id === id);
  if (!row) throw new ClientError("找不到這個頁面", { status: 404, code: "NOT_FOUND" });
  return row;
}

function touch(row: MockSitePage, actor: Actor) {
  row.version += 1;
  row.updatedAt = new Date().toISOString();
  row.updatedById = actor.id;
}

export function publicSitePages(platform: PlatformState): PublicSitePage[] {
  return ordered(platform)
    .filter((row) => row.publishedSections !== null)
    .map((row) => ({
      slug: row.slug,
      path: sitePagePath(row.slug),
      name: row.name,
      kind: row.kind,
      inHeader: row.inHeader && !siteBuiltinPage(row.slug),
      sortOrder: row.sortOrder,
      backgroundImage: row.publishedBackground ?? "",
      sections: structuredClone(row.publishedSections ?? []),
    }));
}

export function adminSitePages(platform: PlatformState, actor: Actor, data: DemoDataset) {
  assertCms(platform, actor);
  return ordered(platform).map((row) => view(row, data));
}

export function createSitePage(platform: PlatformState, actor: Actor, data: DemoDataset, raw: unknown) {
  assertCms(platform, actor);
  const input = sitePageCreateSchema.parse(raw);
  const builtin = siteBuiltinPage(input.slug);
  if (rows(platform).some((item) => item.slug === input.slug)) {
    throw new ClientError(builtin ? "這一頁已經存過版面，請重新載入" : "這個網址代碼已經用過", { status: 400, code: "VALIDATION_ERROR" });
  }
  const now = new Date().toISOString();
  const row: MockSitePage = {
    id: crypto.randomUUID(),
    slug: input.slug,
    name: input.name,
    kind: builtin ? SitePageKind.PAGE : input.kind,
    inHeader: builtin ? false : input.inHeader,
    sortOrder: Math.max(-1, ...rows(platform).map((item) => item.sortOrder)) + 1,
    draftBackground: input.backgroundImage ?? "",
    draftSections: input.sections,
    publishedBackground: null,
    publishedSections: null,
    publishedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
    updatedById: actor.id,
  };
  rows(platform).push(row);
  audit(data, actor, "SITE_PAGE_CREATE", row.id, { slug: row.slug, kind: row.kind });
  return view(row, data);
}

export function updateSitePage(platform: PlatformState, actor: Actor, data: DemoDataset, id: string, raw: unknown) {
  assertCms(platform, actor);
  const input = sitePageUpdateSchema.parse(raw);
  const row = find(platform, id);
  if (row.version !== input.expectedVersion) conflict();
  if (input.name !== undefined) row.name = input.name;
  if (input.inHeader !== undefined) row.inHeader = siteBuiltinPage(row.slug) ? false : input.inHeader;
  if (input.backgroundImage !== undefined) row.draftBackground = input.backgroundImage;
  if (input.sections !== undefined) row.draftSections = input.sections;
  touch(row, actor);
  audit(data, actor, "SITE_PAGE_UPDATE", row.id, { slug: row.slug, fields: Object.keys(input).filter((key) => key !== "expectedVersion") });
  return view(row, data);
}

export function publishSitePage(platform: PlatformState, actor: Actor, data: DemoDataset, id: string, raw: unknown, publish: boolean) {
  assertCms(platform, actor);
  const input = sitePageVersionSchema.parse(raw);
  const row = find(platform, id);
  if (row.version !== input.expectedVersion) conflict();
  if (publish && row.draftSections.length === 0) throw new ClientError("頁面還沒有任何區塊，不能發布", { status: 400, code: "VALIDATION_ERROR" });
  row.publishedSections = publish ? structuredClone(row.draftSections) : null;
  row.publishedBackground = publish ? row.draftBackground : null;
  row.publishedAt = publish ? new Date().toISOString() : null;
  touch(row, actor);
  audit(data, actor, publish ? "SITE_PAGE_PUBLISH" : "SITE_PAGE_UNPUBLISH", row.id, { slug: row.slug, sections: row.draftSections.length });
  return view(row, data);
}

export function deleteSitePage(platform: PlatformState, actor: Actor, data: DemoDataset, id: string, raw: unknown) {
  assertCms(platform, actor);
  const input = sitePageVersionSchema.parse(raw);
  const row = find(platform, id);
  if (row.version !== input.expectedVersion) conflict();
  platform.sitePages = rows(platform).filter((item) => item.id !== id);
  audit(data, actor, "SITE_PAGE_DELETE", id, { slug: row.slug, builtin: Boolean(siteBuiltinPage(row.slug)) });
  return { id };
}

export function reorderSitePages(platform: PlatformState, actor: Actor, data: DemoDataset, raw: unknown) {
  assertCms(platform, actor);
  const input = sitePageReorderSchema.parse(raw);
  if (new Set(input.items.map((item) => item.id)).size !== input.items.length) throw new ClientError("頁面重複", { status: 400, code: "VALIDATION_ERROR" });
  const targets = input.items.map((item) => {
    const row = find(platform, item.id);
    if (row.version !== item.expectedVersion) conflict();
    return row;
  });
  targets.forEach((row, index) => {
    row.sortOrder = index;
    touch(row, actor);
  });
  audit(data, actor, "SITE_PAGE_REORDER", input.items[0]!.id, { count: input.items.length });
  return adminSitePages(platform, actor, data);
}

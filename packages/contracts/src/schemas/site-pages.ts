import { SitePageKind } from "@mf/db/enums";
import { z } from "zod";

export const SITE_PAGE_WIDTHS = ["1/5", "1/4", "1/3", "1/2", "2/3", "3/4", "1/1"] as const;
export const SITE_WIDGET_KINDS = ["heading", "text", "image", "video", "table", "button", "product", "banner", "carousel", "cards", "steps", "faq", "courses"] as const;
export const SITE_SECTION_STYLES = ["", "full", "band", "box"] as const;
/** 空字串是各小區塊的預設樣式；其餘只對下面註明的小區塊有效。 */
export const SITE_WIDGET_STYLES = ["", "callout", "small", "ghost", "natural", "bento", "mosaic", "gallery", "place", "points"] as const;
export type SitePageWidth = (typeof SITE_PAGE_WIDTHS)[number];
export type SiteWidgetKind = (typeof SITE_WIDGET_KINDS)[number];
export type SiteSectionStyle = (typeof SITE_SECTION_STYLES)[number];
export type SiteWidgetStyle = (typeof SITE_WIDGET_STYLES)[number];

export const siteWidgetKindLabels: Record<SiteWidgetKind, string> = {
  heading: "標題",
  text: "內文",
  image: "圖片",
  video: "影片",
  table: "表格",
  button: "按鈕",
  product: "商品",
  banner: "橫幅大圖",
  carousel: "輪播",
  cards: "圖卡",
  steps: "步驟",
  faq: "問答",
  courses: "課程清單",
};

export const siteSectionStyleLabels: Record<SiteSectionStyle, string> = {
  "": "一般",
  full: "滿版（圖貼齊兩側）",
  band: "色帶（圖填滿半邊）",
  box: "外框",
};

/** 每種小區塊可選的樣式，第一個是預設。 */
export const siteWidgetStyleOptions: Partial<Record<SiteWidgetKind, Array<[SiteWidgetStyle, string]>>> = {
  heading: [["", "大標題"], ["small", "小標題"]],
  text: [["", "一般內文"], ["callout", "深色重點框"]],
  image: [["", "固定高度"], ["natural", "原始比例"]],
  button: [["", "實心"], ["ghost", "外框"]],
  cards: [["gallery", "圖片在上、可點開大圖"], ["bento", "大小格照片卡"], ["mosaic", "拼貼照片卡"], ["place", "地名小圖"], ["points", "文字卡"]],
};

/** 有清單的小區塊：輪播、圖卡、步驟、問答。 */
export const siteListWidgetKinds: SiteWidgetKind[] = ["carousel", "cards", "steps", "faq"];

export const sitePageKindLabels: Record<SitePageKind, string> = {
  PAGE: "一般頁",
  PRODUCT: "商品內頁",
};

/** 前台頁首固定的頁。還沒存過時，前台與編輯器都用預設版面。 */
export const SITE_BUILTIN_PAGES = [
  { slug: "home", path: "/", name: "首頁" },
  { slug: "verification", path: "/verification", name: "七類驗證" },
  { slug: "places", path: "/places", name: "風景" },
  { slug: "dining", path: "/dining", name: "用餐" },
  { slug: "stay", path: "/stay", name: "旅宿與禮拜" },
  { slug: "about", path: "/about", name: "關於" },
  { slug: "news", path: "/news", name: "消息" },
  { slug: "faq", path: "/faq", name: "常見問題" },
  { slug: "contact", path: "/contact", name: "聯絡" },
  { slug: "courses", path: "/courses", name: "教育訓練" },
] as const;
export type SiteBuiltinSlug = (typeof SITE_BUILTIN_PAGES)[number]["slug"];

export function siteBuiltinPage(slug: string) {
  return SITE_BUILTIN_PAGES.find((page) => page.slug === slug);
}

export function sitePagePath(slug: string) {
  return siteBuiltinPage(slug)?.path ?? `/p/${slug}`;
}

/** 站內路徑（/preview/…、/api/v1/media/…）或 http(s) 網址。不收 data: 與 javascript:。 */
export function isSiteUrl(value: string) {
  return /^\/(?!\/)\S*$/.test(value) || /^https?:\/\/\S+$/i.test(value);
}

const siteUrl = (message: string) => z.string().trim().max(500).refine((value) => value === "" || isSiteUrl(value), message);

/** 內文裡的連結寫成 [文字](網址)。 */
export const SITE_INLINE_LINK = /\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/g;

export function siteInlineLinks(body: string) {
  return [...body.matchAll(SITE_INLINE_LINK)].map((match) => ({ text: match[1] ?? "", href: match[2] ?? "", index: match.index ?? 0, length: match[0].length }));
}

const itemId = z.string().trim().min(1).max(64);
const richBody = (max: number) => z.string().max(max).refine((value) => siteInlineLinks(value).every((item) => isSiteUrl(item.href)), "內文連結請用站內路徑或 http(s) 網址").default("");

/** 輪播、圖卡、步驟與問答的每一項。問答的 kicker 是分類。 */
export const siteListItemSchema = z.object({
  id: itemId,
  kicker: z.string().max(80).default(""),
  title: z.string().max(200).default(""),
  body: richBody(5000),
  image: siteUrl("圖片請用站內路徑或 http(s) 網址").default(""),
  badge: siteUrl("標章圖請用站內路徑或 http(s) 網址").default(""),
  link: siteUrl("連結請用站內路徑或 http(s) 網址").default(""),
});

export const siteWidgetSchema = z.object({
  id: itemId,
  kind: z.enum(SITE_WIDGET_KINDS),
  kicker: z.string().max(80).default(""),
  title: z.string().max(200).default(""),
  body: richBody(5000),
  image: siteUrl("圖片或影片請用站內路徑或 http(s) 網址").default(""),
  link: siteUrl("連結請用站內路徑或 http(s) 網址").default(""),
  style: z.enum(SITE_WIDGET_STYLES).default(""),
  hidden: z.boolean().default(false),
  table: z.array(z.array(z.string().max(500)).max(12)).max(60).default([]),
  items: z.array(siteListItemSchema).max(60, "一個小區塊最多 60 項").default([]),
});

export const siteColumnSchema = z.object({
  id: itemId,
  width: z.enum(SITE_PAGE_WIDTHS),
  widgets: z.array(siteWidgetSchema).max(30),
});

export const siteSectionSchema = z.object({
  id: itemId,
  name: z.string().trim().max(80).default(""),
  style: z.enum(SITE_SECTION_STYLES).default(""),
  hidden: z.boolean().default(false),
  columns: z.array(siteColumnSchema).min(1, "每個區塊至少一欄").max(6, "每個區塊最多六欄"),
});

export const siteSectionsSchema = z.array(siteSectionSchema).max(60, "一頁最多 60 個區塊");

const slugSchema = z.string().trim().min(1, "請填網址代碼").max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "網址代碼只能用小寫英文、數字與連字號");
const nameSchema = z.string().trim().min(1, "請填頁面名稱").max(80);
const expectedVersion = z.number().int().positive();

const backgroundSchema = siteUrl("背景圖請用站內路徑或 http(s) 網址").default("");

export const sitePageSchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  path: z.string(),
  name: z.string(),
  kind: z.nativeEnum(SitePageKind),
  builtin: z.boolean(),
  inHeader: z.boolean(),
  sortOrder: z.number().int(),
  draftBackground: z.string(),
  draftSections: siteSectionsSchema,
  publishedBackground: z.string().nullable(),
  publishedSections: siteSectionsSchema.nullable(),
  publishedAt: z.string().nullable(),
  hasUnpublishedChanges: z.boolean(),
  version: z.number().int(),
  updatedAt: z.string(),
  updatedByName: z.string().nullable(),
});

export const publicSitePageSchema = z.object({
  slug: z.string(),
  path: z.string(),
  name: z.string(),
  kind: z.nativeEnum(SitePageKind),
  inHeader: z.boolean(),
  sortOrder: z.number().int(),
  backgroundImage: z.string(),
  sections: siteSectionsSchema,
});

export const sitePageCreateSchema = z.object({
  slug: slugSchema,
  name: nameSchema,
  kind: z.nativeEnum(SitePageKind).default(SitePageKind.PAGE),
  inHeader: z.boolean().default(true),
  backgroundImage: backgroundSchema,
  sections: siteSectionsSchema.default([]),
}).strict();

export const sitePageUpdateSchema = z.object({
  expectedVersion,
  name: nameSchema.optional(),
  inHeader: z.boolean().optional(),
  backgroundImage: backgroundSchema.optional(),
  sections: siteSectionsSchema.optional(),
}).strict();

export const sitePageVersionSchema = z.object({ expectedVersion }).strict();

export const sitePageReorderSchema = z.object({
  items: z.array(z.object({ id: z.string().uuid(), expectedVersion }).strict()).min(1).max(200),
}).strict();

export const sitePageImageSchema = z.object({ url: z.string() });

export type SiteListItem = z.infer<typeof siteListItemSchema>;
export type SiteWidget = z.infer<typeof siteWidgetSchema>;
export type SiteColumn = z.infer<typeof siteColumnSchema>;
export type SiteSection = z.infer<typeof siteSectionSchema>;
export type SitePageItem = z.infer<typeof sitePageSchema>;
export type PublicSitePage = z.infer<typeof publicSitePageSchema>;
export type SitePageCreate = z.input<typeof sitePageCreateSchema>;
export type SitePageUpdate = z.infer<typeof sitePageUpdateSchema>;
export type SitePageReorder = z.infer<typeof sitePageReorderSchema>;

import {
  isSiteUrl,
  SITE_PAGE_WIDTHS,
  SITE_WIDGET_KINDS,
  siteWidgetKindLabels,
  type SiteColumn,
  type SiteListItem,
  type SitePageKind,
  type SitePageWidth,
  type SiteSection,
  type SiteSectionStyle,
  type SiteWidget,
  type SiteWidgetKind,
} from "@mf/contracts";
import { useQuery } from "@tanstack/react-query";
import { useServices } from "../../../app/session";

export type Width = SitePageWidth;
export type WidgetKind = SiteWidgetKind;
export type Widget = SiteWidget;
export type Column = SiteColumn;
export type Section = SiteSection;
export type ListItem = SiteListItem;

export const widths: Width[] = [...SITE_PAGE_WIDTHS];
export const widgetKinds: Array<[WidgetKind, string]> = SITE_WIDGET_KINDS.map((kind) => [kind, siteWidgetKindLabels[kind]]);
export const presets: Array<[string, Width[]]> = [
  ["全寬", ["1/1"]],
  ["二分", ["1/2", "1/2"]],
  ["三分", ["1/3", "1/3", "1/3"]],
  ["四分", ["1/4", "1/4", "1/4", "1/4"]],
  ["五分", ["1/5", "1/5", "1/5", "1/5", "1/5"]],
  ["左寬", ["2/3", "1/3"]],
  ["半與兩小", ["1/2", "1/4", "1/4"]],
];
export const library = [
  ["/preview/hero-welcome.jpg", "台北夜景"],
  ["/preview/hero-food.jpg", "餐食"],
  ["/preview/jiufen.jpg", "九份"],
  ["/preview/sunmoon.jpg", "日月潭"],
  ["/preview/food-hotpot.jpg", "鍋物"],
  ["/preview/mosque-taichung.jpg", "台中清真寺"],
  ["/preview/stay-room.jpg", "客房"],
  ["/preview/shop-vigor.jpg", "商店"],
] as const;

export function uid() {
  return crypto.randomUUID();
}

export function move<T>(list: T[], from: number, to: number) {
  const next = list.slice();
  const [picked] = next.splice(from, 1);
  if (!picked) return list;
  next.splice(to, 0, picked);
  return next;
}

export function blankTable(): string[][] {
  return [
    ["項目", "說明"],
    ["", ""],
    ["", ""],
  ];
}

export function safeMediaUrl(value: string, kind: "image" | "video") {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (kind === "image" && trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.protocol === "https:" || url.protocol === "http:") return trimmed;
  } catch {
    return "";
  }
  return "";
}

export function safeLink(value: string) {
  const trimmed = value.trim();
  return isSiteUrl(trimmed) ? trimmed : "";
}

export function videoEmbed(value: string): { mode: "iframe" | "file" | "empty"; src: string } {
  const src = safeMediaUrl(value, "video");
  if (!src) return { mode: "empty", src: "" };
  try {
    const url = new URL(src);
    const host = url.hostname.replace(/^www\./, "");
    const youtube = host === "youtu.be"
      ? url.pathname.split("/").filter(Boolean)[0]
      : host.endsWith("youtube.com")
        ? url.searchParams.get("v") || url.pathname.match(/\/(?:embed|shorts)\/([^/]+)/)?.[1] || ""
        : "";
    if (youtube && /^[\w-]{6,}$/.test(youtube)) return { mode: "iframe", src: `https://www.youtube.com/embed/${youtube}` };
    const vimeo = host.endsWith("vimeo.com") ? url.pathname.match(/\/(?:video\/)?(\d+)/)?.[1] ?? "" : "";
    if (vimeo) return { mode: "iframe", src: `https://player.vimeo.com/video/${vimeo}` };
  } catch {
    return { mode: "empty", src: "" };
  }
  return { mode: "file", src };
}

export function listItem(patch: Partial<ListItem> = {}): ListItem {
  return { id: uid(), kicker: "", title: "", body: "", image: "", badge: "", link: "", ...patch };
}

function starterItems(kind: WidgetKind): ListItem[] {
  if (kind === "carousel") return [listItem({ title: "台北夜景", image: "/preview/hero-welcome.jpg" }), listItem({ title: "餐食", image: "/preview/hero-food.jpg" })];
  if (kind === "cards") return [listItem({ title: "九份", body: "山城夜色。", image: "/preview/jiufen.jpg" }), listItem({ title: "日月潭", body: "日出時的湖面。", image: "/preview/sunmoon.jpg" }), listItem({ title: "台北", body: "城市天際線。", image: "/preview/taipei101.jpg" })];
  if (kind === "steps") return [listItem({ title: "第一步" }), listItem({ title: "第二步" }), listItem({ title: "第三步" })];
  if (kind === "faq") return [listItem({ kicker: "一般", title: "問題", body: "答案。" })];
  return [];
}

export function widget(kind: WidgetKind, title = "", body = "", image = ""): Widget {
  const label = siteWidgetKindLabels[kind];
  const defaultBody = kind === "product"
    ? "商品內頁的說明。售價以後由商品決定，現在不填金額。"
    : kind === "text" || kind === "banner"
      ? "在右邊改這段文字。"
      : "";
  return {
    id: uid(),
    kind,
    kicker: "",
    title: title || (kind === "product" ? "示範商品" : label),
    body: body || defaultBody,
    image: image || (kind === "image" || kind === "product" || kind === "banner" ? "/preview/jiufen.jpg" : ""),
    link: "",
    style: kind === "cards" ? "gallery" : "",
    hidden: false,
    table: kind === "table" ? blankTable() : [],
    items: starterItems(kind),
  };
}

export function column(width: Width, widgets: Widget[] = [widget("text")]): Column {
  return { id: uid(), width, widgets };
}

export function section(name: string, widthsForColumns: Width[], widgets: Widget[][] = [], style: SiteSectionStyle = ""): Section {
  return {
    id: uid(),
    name,
    style,
    hidden: false,
    columns: widthsForColumns.map((width, index) => column(width, widgets[index] ?? [widget("text")])),
  };
}

export function blankSections(kind: SitePageKind, name: string): Section[] {
  if (kind === "PRODUCT") {
    return [section("商品內頁", ["1/2", "1/2"], [
      [widget("image", "商品圖", "", "/preview/shop-rice.jpg")],
      [widget("product", name, "商品內頁示意。售價以後由商品決定。")],
    ])];
  }
  return [section("新區塊", ["1/1"], [[widget("heading", name), widget("text", "內文", "在右邊改這段文字。欄位在手機上會改成直排。")]])];
}

/** 前台讀已發布的頁面。 */
export function usePublishedPages() {
  const services = useServices();
  return useQuery({ queryKey: ["site-pages"], queryFn: () => services.publicSitePages(), staleTime: 30_000 });
}

import { EditorialKind, type SiteBuiltinSlug, type SiteSectionStyle, type SiteWidgetStyle } from "@mf/contracts";
import type { EditorialEntry, PublicSite, SiteSlot } from "../../../services/types";
import type { ListItem, Section, Widget, WidgetKind, Width } from "./preview-pages";

type WidgetInput = Partial<Omit<Widget, "items" | "style">> & { style?: SiteWidgetStyle; items?: Array<Partial<ListItem>> };

/** id 依建立順序編號，同一份資料每次產生的版面都一樣。 */
function builder(slug: string) {
  let count = 0;
  const id = () => `${slug}-${++count}`;
  const w = (kind: WidgetKind, input: WidgetInput = {}): Widget => ({
    kicker: "",
    title: "",
    body: "",
    image: "",
    link: "",
    hidden: false,
    table: [],
    ...input,
    id: id(),
    kind,
    style: input.style ?? "",
    items: (input.items ?? []).map((item) => ({ kicker: "", title: "", body: "", image: "", badge: "", link: "", ...item, id: id() })),
  });
  const s = (name: string, columns: Array<[Width, Widget[]]>, style: SiteSectionStyle = "", hidden = false): Section => ({
    id: id(),
    name,
    style,
    hidden,
    columns: columns.map(([width, widgets]) => ({ id: id(), width, widgets })),
  });
  return { w, s };
}

const slides = [
  { image: "/preview/hero-welcome.jpg", title: "Welcome to MuslimTW，台北 101 夜景主視覺" },
  { image: "/preview/hero-food.jpg", title: "Halal 餐食與共餐的主視覺" },
  { image: "/preview/hero-tour.jpg", title: "禮拜、旅行與體驗活動的主視覺" },
  { image: "/preview/hero-eid.png", title: "2026 開齋節主視覺" },
];

const categories = [
  { title: "穆斯林友善餐廳", body: "Halal 廚房、Halal 餐廳與穆斯林友善餐廳，依餐點種類準備附件。", image: "/preview/food-hotpot.jpg", badge: "/preview/seal-dining.png" },
  { title: "穆斯林友善旅宿", body: "含早餐或不含早餐。含早餐才需要廚房與菜單資料。", image: "/preview/stay-room.jpg", badge: "/preview/seal-stay.png" },
  { title: "穆斯林友善環境", body: "祈禱室、洗手間與指引指標，讓旅客找得到禮拜的地方。", image: "/preview/mosque-taichung.jpg", badge: "/preview/seal-place.png" },
  { title: "穆斯林友善體驗活動", body: "價格、器具食材與活動照片，一起放進申請。", image: "/preview/act-onion.jpg", badge: "/preview/seal-activity.png" },
  { title: "穆斯林友善商店", body: "Halal 商品一覽與陳列照片。", image: "/preview/shop-vigor.jpg", badge: "/preview/seal-shop.png" },
  { title: "穆斯林友善旅行社", body: "中英文行程，以及從業人員在職證明。", image: "/preview/group-tour.jpg", badge: "/preview/seal-travel.png" },
  { title: "穆斯林友善產品", body: "產品清單、產線與清真小組等固定附件。", image: "/preview/shop-rice.jpg", badge: "" },
];

const places = [
  ["/preview/jiufen.jpg", "九份", "山城夜色與海面燈火。"],
  ["/preview/taipei101.jpg", "台北 101", "城市天際線。"],
  ["/preview/sunmoon.jpg", "日月潭", "日出時的湖面。"],
  ["/preview/beach.jpg", "宜蘭內埤", "海岸與礁石。"],
  ["/preview/nightmarket.jpg", "饒河夜市", "夜市燈籠與人潮。"],
  ["/preview/hydrangea.jpg", "陽明山", "繡球花季。"],
  ["/preview/tamsui.jpg", "淡水漁人碼頭", "河岸與夕色。"],
  ["/preview/cks.jpg", "中正紀念堂", "廣場與牌樓。"],
  ["/preview/matsu.jpg", "馬祖芹壁", "石頭聚落。"],
  ["/preview/fulong.jpg", "福隆", "遊客中心與海岸。"],
  ["/preview/spot-shifen.jpg", "十分瀑布", "有人同行的風景。"],
  ["/preview/spot-yehliu.jpg", "野柳", "地質公園。"],
] as const;

const activities = [
  ["/preview/act-onion.jpg", "星寶蔥體驗", "手作與在地食材。"],
  ["/preview/act-kiln.jpg", "蘭陽窯", "窯燒體驗。"],
  ["/preview/act-honey.jpg", "大禾蜜工坊", "蜂蜜與工坊參觀。"],
  ["/preview/spot-tamsui.jpg", "淡水", "有人的街景與河岸。"],
  ["/preview/group-cks.jpg", "紀念堂合影", "團體行程的停留。"],
  ["/preview/group-935.jpg", "同行的旅客", "旅程裡的團體照。"],
] as const;

const dishes = [
  ["/preview/food-hotpot.jpg", "鍋物", "熱湯、肉片與蔬菜。"],
  ["/preview/food-lulu.jpg", "露露廚房", "南洋料理。"],
  ["/preview/food-spring.jpg", "春不老驛站", "餐食照片。"],
  ["/preview/food-moona.jpg", "暮娜餐館", "Halal 餐廳餐點。"],
  ["/preview/food-moona-2.jpg", "暮娜餐館", "另一道餐點。"],
  ["/preview/food-veg.jpg", "三合餅舖", "蔬食餐廳。"],
  ["/preview/food-plate.jpg", "盤中餐", "擺盤與配菜。"],
  ["/preview/hero-food.jpg", "共餐", "主視覺裡的 Halal 餐桌。"],
] as const;

const rooms = [
  ["/preview/stay-room.jpg", "客房", "乾淨床組與木質牆面。"],
  ["/preview/stay-prayer.jpg", "禮拜方向", "禮拜毯、時間表與朝向。"],
  ["/preview/stay-159.jpg", "朝拜時間", "客房裡的時間表、禮拜毯與朝向。"],
] as const;

const mosques = [
  ["/preview/mosque-taichung.jpg", "台中清真寺", "圓頂、邦克樓與寺名。"],
  ["/preview/mosque-taipei.jpg", "台北文化清真寺", "城市裡的禮拜場所。"],
  ["/preview/mosque-kaohsiung.jpg", "高雄清真寺", "南部的清真寺。"],
  ["/preview/mosque-tainan.jpg", "台南清真寺", "台南的禮拜場所。"],
  ["/preview/mosque-donggang.jpg", "東港清真寺", "屏東東港。"],
  ["/preview/mosque-dayuan.jpg", "大園清真寺", "桃園大園。"],
  ["/preview/mosque-hualien.jpg", "花蓮清真寺", "東部的禮拜場所。"],
] as const;

const regions = [
  ["台北", "/preview/region-taipei.jpg"],
  ["新北", "/preview/region-newtaipei.jpg"],
  ["桃園", "/preview/region-taoyuan.jpg"],
  ["新竹", "/preview/region-hsinchu.jpg"],
  ["苗栗", "/preview/region-miaoli.jpg"],
  ["台中", "/preview/region-taichung.jpg"],
  ["彰化", "/preview/region-changhua.jpg"],
  ["南投", "/preview/region-nantou.jpg"],
  ["嘉義", "/preview/region-chiayi.jpg"],
  ["台南", "/preview/region-tainan.jpg"],
  ["高雄", "/preview/region-kaohsiung.jpg"],
  ["屏東", "/preview/region-pingtung.jpg"],
  ["宜蘭", "/preview/region-yilan.jpg"],
  ["台東", "/preview/region-taitung.jpg"],
  ["金門", "/preview/region-kinmen.jpg"],
] as const;

const applySteps = ["註冊報價", "繳費及開發票", "設施改善", "申請書及簽約", "現場查核", "教育訓練", "審核通過", "核發證書"];

function photos(rows: ReadonlyArray<readonly [string, string, string]>) {
  return rows.map(([image, title, body]) => ({ image, title, body }));
}

function byKind(site: PublicSite | undefined, kind: EditorialKind) {
  return (site?.entries ?? []).filter((item) => item.kind === kind).sort((left, right) => {
    if (kind === EditorialKind.NEWS) return (right.publishedOn ?? "").localeCompare(left.publishedOn ?? "");
    return left.sortOrder - right.sortOrder;
  });
}

function chunks<T>(rows: T[], size = 60) {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) out.push(rows.slice(index, index + size));
  return out;
}

function joined(...parts: Array<string | null | undefined>) {
  return parts.map((part) => (part ?? "").trim()).filter(Boolean).join("\n\n");
}

/** 舊內容管理的文字段落。多半是示範說明，預設隱藏，在編輯器按「顯示」才上前台。 */
function oldSlot(b: ReturnType<typeof builder>, name: string, slot: SiteSlot | null | undefined, extra: Widget[] = []) {
  if (!slot && extra.length === 0) return [];
  const widgets: Widget[] = [];
  if (slot) {
    widgets.push(b.w("heading", { kicker: slot.eyebrow, title: slot.title }));
    const body = joined(slot.subtitle, slot.body);
    if (body) widgets.push(b.w("text", { title: "內文", body }));
    if (slot.ctaLabel && slot.ctaHref.startsWith("/")) widgets.push(b.w("button", { title: slot.ctaLabel, link: slot.ctaHref }));
    if (slot.secondaryCtaLabel && slot.secondaryCtaHref.startsWith("/")) widgets.push(b.w("button", { title: slot.secondaryCtaLabel, link: slot.secondaryCtaHref, style: "ghost" }));
  }
  return [b.s(name, [["1/1", [...widgets, ...extra]]], "", true)];
}

function entryCards(b: ReturnType<typeof builder>, entries: EditorialEntry[]) {
  return entries.length ? [b.w("cards", { style: "points", items: entries.map((item) => ({ title: item.title, body: item.body })) })] : [];
}

export function defaultSections(slug: SiteBuiltinSlug, site?: PublicSite): Section[] {
  const b = builder(slug);
  const { w, s } = b;
  const banner = (image: string, kicker: string, title: string, body: string) => s("頁首大圖", [["1/1", [w("banner", { image, kicker, title, body })]]], "full");
  switch (slug) {
    case "home":
      return [
        s("輪播", [["1/1", [w("carousel", { items: slides })]]], "full"),
        s("開場", [
          ["2/3", [
            w("heading", { kicker: "MUSLIM FRIENDLY TAIWAN", title: "把台灣，做成看得懂的穆斯林友善。" }),
            w("text", { title: "開場", body: "風景、餐廳、旅宿、商店、旅行社、體驗與禮拜環境，收在同一套驗證裡。旅客先看畫面，業者再進來申請。" }),
            w("button", { title: "看七類驗證", link: "/verification" }),
            w("button", { title: "先看台灣", link: "/places", style: "ghost" }),
          ]],
          ["1/3", [w("text", { style: "callout", title: "七類，一條路。", body: "從註冊報價、繳費，到設施改善、申請書及簽約、現場查核、教育訓練與核發證書。" })]],
        ]),
        s("七類驗證", [["1/1", [
          w("heading", { kicker: "CERTIFICATION", title: "七類驗證" }),
          w("cards", { style: "bento", items: categories.map((item) => ({ ...item, link: "/verification" })) }),
          w("button", { title: "整頁說明", link: "/verification", style: "ghost" }),
        ]]]),
        s("風景", [
          ["1/2", [w("image", { title: "九份夜景", image: "/preview/jiufen.jpg" })]],
          ["1/2", [
            w("heading", { kicker: "TAIWAN", title: "先讓人想留下。" }),
            w("text", { title: "說明", body: "九份、日月潭、夜市、海岸與離島。風景頁把全景、有人的景點，和各縣市照片放在一起。" }),
            w("button", { title: "進入風景", link: "/places" }),
          ]],
        ], "band"),
        s("用餐", [
          ["1/2", [
            w("heading", { kicker: "TABLE", title: "餐桌上的放心。" }),
            w("text", { title: "說明", body: "火鍋、南洋料理、蔬食與共餐。餐廳驗證看的是廚房、餐點種類和附件，畫面先讓人知道台灣吃得到什麼。" }),
            w("button", { title: "看用餐", link: "/dining" }),
          ]],
          ["1/2", [w("image", { title: "熱騰騰的鍋物", image: "/preview/food-hotpot.jpg" })]],
        ], "band"),
        s("旅宿與禮拜", [["1/1", [
          w("heading", { kicker: "STAY AND PRAYER", title: "住下來，也找得到禮拜的方向。" }),
          w("cards", {
            style: "mosaic",
            items: [
              { image: "/preview/mosque-taichung.jpg", title: "台中清真寺", body: "圓頂與邦克樓。", link: "/stay" },
              { image: "/preview/stay-room.jpg", title: "客房", link: "/stay" },
              { image: "/preview/stay-prayer.jpg", title: "禮拜方向", link: "/stay" },
              { image: "/preview/mosque-taipei.jpg", title: "台北文化清真寺", link: "/stay" },
              { image: "/preview/easycard.jpg", title: "移動", body: "悠遊卡素材。", link: "/stay" },
            ],
          }),
          w("button", { title: "旅宿與清真寺", link: "/stay", style: "ghost" }),
        ]]]),
        s("申請流程", [["1/1", [
          w("heading", { kicker: "HOW TO APPLY", title: "業者申請的八個站。" }),
          w("text", { title: "說明", body: "八個站依案件生命週期規格排列。下圖是舊版流程說明，新版流程圖待單位提供；金額、電話與正式文案仍待確認。" }),
          w("image", { title: "Halal 友善驗證申請流程，從加入 LINE 到核發證書", image: "/preview/process.jpg", style: "natural" }),
          w("steps", { items: applySteps.map((title) => ({ title })) }),
          w("button", { title: "我是業者，去登入", link: "/login" }),
          w("button", { title: "先看類別", link: "/verification", style: "ghost" }),
        ]]], "box"),
        s("縣市", [["1/1", [
          w("heading", { kicker: "ISLAND", title: "業者所在的地方" }),
          w("cards", { style: "place", items: regions.slice(0, 8).map(([title, image]) => ({ title, image, link: "/places" })) }),
        ]]]),
        ...oldSlot(b, "舊版首頁文字", site?.hero, entryCards(b, byKind(site, EditorialKind.HOME_POINT))),
        ...oldSlot(b, "舊版首頁橫幅", site?.banner),
      ];
    case "verification": {
      const fees = byKind(site, EditorialKind.FEE);
      const steps = byKind(site, EditorialKind.VERIFICATION_STEP);
      const oldExtra = [
        ...(steps.length ? [w("steps", { items: steps.map((item) => ({ title: item.title, body: item.body })) })] : []),
        ...(fees.length ? [w("table", { title: "費用", table: [["項目", "計費", "金額", "退費"], ...fees.map((fee) => [fee.title, fee.summary, fee.body, fee.note])] })] : []),
      ];
      return [
        banner("/preview/mosque-taichung.jpg", "CERTIFICATION", "七類驗證", "同一套申請，依類別準備不同的照片、清單與證明。"),
        s("七類", [["1/1", [w("cards", { style: "gallery", items: categories })]]]),
        s("申請路徑", [["1/1", [
          w("heading", { title: "申請路徑" }),
          w("image", { title: "申請驗證流程", image: "/preview/process.jpg", style: "natural" }),
          w("button", { title: "登入後建立申請", link: "/login" }),
        ]]], "box"),
        ...oldSlot(b, "舊版驗證介紹", site?.verification, oldExtra),
      ];
    }
    case "places":
      return [
        banner("/preview/sunmoon.jpg", "TAIWAN", "先看這座島", "全景、有人的景點、體驗，以及業者所在的縣市。"),
        s("全景", [["1/1", [w("heading", { title: "全景" }), w("cards", { style: "gallery", items: photos(places) })]]]),
        s("有人的風景與體驗", [["1/1", [w("heading", { title: "有人的風景與體驗" }), w("cards", { style: "gallery", items: photos(activities) })]]]),
        s("縣市", [["1/1", [w("heading", { title: "縣市" }), w("cards", { style: "place", items: regions.map(([title, image]) => ({ title, image })) })]]]),
      ];
    case "dining":
      return [
        banner("/preview/food-lulu.jpg", "HALAL TABLE", "用餐", "這些是餐食與餐廳照片，用來說明驗證想保護的餐桌。照片本身不是證書。"),
        s("餐食", [["1/1", [
          w("cards", { style: "gallery", items: photos(dishes) }),
          w("image", { title: "Muslim-friendly Shop 商品橫幅", image: "/preview/banner-shop.png", style: "natural" }),
        ]]]),
      ];
    case "stay":
      return [
        banner("/preview/stay-room.jpg", "STAY", "住下來，找得到方向。", "旅宿看房間與早餐。環境驗證看祈禱室、洗手間和指標。清真寺照片讓人知道台灣已經有這些場所。"),
        s("旅宿", [["1/1", [w("heading", { title: "旅宿" }), w("cards", { style: "gallery", items: photos(rooms) })]]]),
        s("清真寺", [["1/1", [w("heading", { title: "清真寺" }), w("cards", { style: "gallery", items: photos(mosques) })]]]),
      ];
    case "about":
      return [
        banner("/preview/taipei101-far.jpg", "MUSLIMTW", "關於這個前台", "MuslimTW 把旅遊畫面和驗證申請放在一起。旅客先認識台灣，業者再沿著七類表單送件。"),
        s("為什麼", [
          ["1/2", [w("image", { title: "得獎實績主視覺", image: "/preview/hero-award.png" })]],
          ["1/2", [
            w("heading", { kicker: "WHY", title: "好看，是為了讓人願意讀下去。" }),
            w("text", { title: "說明", body: "現有前台偏表單說明。這一版用輪播、七類標章、風景、餐食、旅宿和清真寺，把同一件事說得比較像一個地方，而不只是一份申請。" }),
            w("text", { title: "待確認", body: "正式名稱、費用、電話和地址仍待單位確認。" }),
          ]],
        ], "band"),
        ...oldSlot(b, "舊版關於我們", site?.about, entryCards(b, byKind(site, EditorialKind.ABOUT_FACT))),
      ];
    case "news": {
      const intro = site?.newsIntro;
      const news = byKind(site, EditorialKind.NEWS);
      return [
        banner("/preview/hero-award.png", intro?.eyebrow || "NEWS", intro?.title || "最新消息", intro?.subtitle || ""),
        s("消息", [["1/1", chunks(news).map((rows) => w("cards", {
          style: "points",
          items: rows.map((item) => ({ kicker: item.publishedOn ?? "", title: item.title, body: joined(item.summary, item.body), image: item.imageUrl ?? "" })),
        }))]]),
      ];
    }
    case "faq": {
      const intro = site?.faq;
      const faqs = byKind(site, EditorialKind.FAQ);
      return [
        banner("/preview/fulong.jpg", intro?.eyebrow || "FAQ", intro?.title || "常見問題", intro?.subtitle || ""),
        s("問答", [["1/1", chunks(faqs).map((rows) => w("faq", { items: rows.map((item) => ({ kicker: item.groupLabel, title: item.title, body: item.body })) }))]]),
      ];
    }
    case "contact":
      return [
        banner("/preview/fulong.jpg", "CONTACT", "聯絡", "正式電話、地址與收件信箱尚未公布。"),
        s("聯絡", [["1/1", [
          w("button", { title: "看常見問題", link: "/faq" }),
          w("button", { title: "業者登入", link: "/login", style: "ghost" }),
        ]]]),
      ];
    case "courses": {
      const intro = site?.training;
      return [
        s("介紹", [["1/1", [
          w("heading", { kicker: intro?.eyebrow || "教育訓練", title: intro?.title || "課程" }),
          w("text", { title: "說明", body: joined(intro?.subtitle || "每一梯次有介紹、圖片與影片。可切換列表或月曆。", intro?.body) }),
        ]]]),
        s("課程", [["1/1", [w("courses", { title: "課程清單" })]]]),
      ];
    }
  }
}

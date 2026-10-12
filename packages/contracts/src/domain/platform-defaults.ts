import { ContentSlot, EditorialKind, UserRole } from "@mf/db/enums";

export const PLATFORM_FEATURES = [
  { key: "cms.edit", label: "編輯首頁內容" },
  { key: "contracts.issue", label: "發出與修改合約" },
  { key: "contracts.sign", label: "簽署合約" },
  { key: "applications.create", label: "建立驗證申請" },
  { key: "applications.review", label: "審查案件" },
  { key: "applications.decide", label: "派案與核定" },
  { key: "training.manage", label: "管理教育訓練" },
  { key: "users.manage", label: "管理帳號與權限" },
  { key: "reports.export", label: "匯出報表" },
  { key: "audit.view", label: "查看操作紀錄" },
  { key: "integrations.edit", label: "調整串接設定" },
] as const;

export type PlatformFeatureKey = (typeof PLATFORM_FEATURES)[number]["key"];

const OFFICER_FEATURES = new Set<PlatformFeatureKey>(["applications.review", "training.manage", "reports.export"]);
const APPLICANT_FEATURES = new Set<PlatformFeatureKey>(["applications.create", "contracts.sign"]);

export const STAFF_FEATURES = PLATFORM_FEATURES.filter((feature) => !APPLICANT_FEATURES.has(feature.key));

export function defaultFeatureEnabled(role: UserRole, featureKey: PlatformFeatureKey): boolean {
  if (role === UserRole.ADMIN) return featureKey !== "contracts.sign" && featureKey !== "applications.create";
  if (role === UserRole.CASE_OFFICER) return OFFICER_FEATURES.has(featureKey);
  return APPLICANT_FEATURES.has(featureKey);
}

export function roleForAccountFeatures(current: UserRole, enabled: readonly string[]): UserRole {
  if (current === UserRole.APPLICANT) return UserRole.APPLICANT;
  return enabled.includes("users.manage") || enabled.includes("applications.decide") ? UserRole.ADMIN : UserRole.CASE_OFFICER;
}

export const INTEGRATION_DEFAULTS = [
  {
    key: "email",
    label: "Email 通知",
    provider: "console",
    enabled: true,
    note: "目前依環境的郵件驅動寄出。console 只寫入紀錄，不會真的寄信。",
  },
  {
    key: "payment",
    label: "第三方金流",
    provider: "unconfigured",
    enabled: false,
    note: "尚未設定金流服務商與金鑰，系統不會扣款。",
  },
  {
    key: "media",
    label: "媒體儲存",
    provider: "local",
    enabled: true,
    note: "圖片、附件與簽名檔存在本機上傳目錄。",
  },
  {
    key: "signature",
    label: "線上簽署",
    provider: "browser",
    enabled: true,
    note: "簽署時由瀏覽器拍攝人像並收集手寫簽名，再寫入 PDF。",
  },
] as const;

export type IntegrationKey = (typeof INTEGRATION_DEFAULTS)[number]["key"];

export const CONTRACT_TEMPLATE_CODE = "HALA_SERVICE_V1";

export const DEFAULT_CONTRACT_TITLE = "HALA 驗證服務合約（示範）";

export const DEFAULT_CONTRACT_BODY = `HALA 驗證服務合約

合約編號：{{contractNo}}
發出日期：{{issuedOn}}
甲方（申請業者）：{{organizationName}}
統一編號：{{taxId}}
乙方：HALA 驗證服務窗口（正式機構名稱待甲方確認後，可在合約管理整份替換）

一、目的
乙方受理甲方提出的穆斯林友善驗證申請，並依當時有效的審查流程處理文件、補件與現場複審安排。本合約是系統內可測試的示範文本，正式法律文字以甲方日後提供並儲存的版本為準。

二、甲方義務
甲方保證註冊資料、申請表與附件內容真實。場所地址、聯絡人與營業資料若有變更，應在會員區更新。甲方應配合補件與約定的現場訪查，並指定有權簽署本合約的人員。

三、費用
文件初審、現場複審、證書與續約的金額尚未核定，本合約不記載推測金額，也不構成扣款授權。金流服務商未設定前，系統不會向甲方收款。

四、效期
本合約自簽署日起一年內有效。到期前是否須重新審查、重新簽約或只做資料更新，待甲方確認後改寫本段。合約一經發出，這一份內容不再修改；若要換文字，應另發新合約。

五、簽署方式
甲方指定人員須核對本人姓名與職稱，拍攝當時人像，並在簽名欄手寫簽名。系統會把人像與簽名嵌進 PDF。簽署完成後，本份文字、人像與簽名不再隨範本修改而改變。此電子簽署供本系統測試與歸檔；是否等同法定電子簽章，待甲方法務確認。

六、資料使用
人像、簽名與申請資料只供本案審查、歸檔與爭議核對，不在未獲授權時公開。甲方可下載自己已簽署的 PDF。

七、其他
本合約未約定的審查標準、標章使用與授權素材，仍以甲方另行提供的規範為準。若與後續正式合約不一致，以正式合約替換後新發出的文件為準，已簽署文件保持原樣。`;

export const DEFAULT_SITE_CONTENT: Record<
  ContentSlot,
  {
    eyebrow: string;
    title: string;
    subtitle: string;
    body: string;
    ctaLabel: string;
    ctaHref: string;
    secondaryCtaLabel: string;
    secondaryCtaHref: string;
    youtubeUrl: string;
  }
> = {
  [ContentSlot.HOME_HERO]: {
    eyebrow: "HALA 驗證",
    title: "把申請、補件與簽約放在同一條路徑",
    subtitle: "訪客先看制度說明。業者登入後送出資料、補件，並在合約頁完成簽署。",
    body: "首頁這段文字、按鈕與圖片都可以在內部後台的內容管理修改。正式文案到手後直接覆蓋，不必改程式。",
    ctaLabel: "閱讀驗證介紹",
    ctaHref: "/verification",
    secondaryCtaLabel: "查看教育訓練",
    secondaryCtaHref: "/courses",
    youtubeUrl: "",
  },
  [ContentSlot.HOME_BANNER]: {
    eyebrow: "業者作業",
    title: "準備好資料後，就可以線上簽約",
    subtitle: "簽署時要拍攝人像並手寫簽名。系統會把兩者寫進 PDF，供下載留存。",
    body: "合約目前是示範文本。管理員可在合約管理修改；已簽署的那一份會保留簽署當下的內容。",
    ctaLabel: "業者登入",
    ctaHref: "/login",
    secondaryCtaLabel: "建立帳號",
    secondaryCtaHref: "/register",
    youtubeUrl: "",
  },
  [ContentSlot.ABOUT]: {
    eyebrow: "公開前台",
    title: "關於我們",
    subtitle: "本站用於受理穆斯林友善驗證的線上申請與審查。組織沿革、負責人、據點照片與品牌影片尚未由甲方提供，以下只保留頁面結構。",
    body: "對外名稱暫用 HALA 驗證。若甲方有正式機構名稱、標章使用規範或不可使用的用語，請直接替換本段，不要在畫面上另寫一套名稱。",
    ctaLabel: "",
    ctaHref: "",
    secondaryCtaLabel: "",
    secondaryCtaHref: "",
    youtubeUrl: "",
  },
  [ContentSlot.NEWS_INTRO]: {
    eyebrow: "公開前台",
    title: "最新消息",
    subtitle: "列表已先建好。正式消息由內容管理替換，未核定的內容不應被當成公告。",
    body: "已發布的消息依日期由新到舊排列。首頁只顯示最新五則，其餘從更多進入。",
    ctaLabel: "",
    ctaHref: "",
    secondaryCtaLabel: "",
    secondaryCtaHref: "",
    youtubeUrl: "",
  },
  [ContentSlot.VERIFICATION]: {
    eyebrow: "HALA 驗證",
    title: "驗證介紹",
    subtitle: "申請順序依需求分析簡報整理。用上方切換流程、費用、朝拜時間與通知草稿。",
    body: "甲方需提供正式朝拜時間表或指定資料來源。以下只保留欄位，不填入推測時間。",
    ctaLabel: "",
    ctaHref: "",
    secondaryCtaLabel: "",
    secondaryCtaHref: "",
    youtubeUrl: "",
  },
  [ContentSlot.FAQ]: {
    eyebrow: "公開前台",
    title: "常見問題",
    subtitle: "先選分類，再看這一組問答。正式問答可由內容管理整批替換。",
    body: "分類、問題與答案都可以新增、修改或下架。",
    ctaLabel: "",
    ctaHref: "",
    secondaryCtaLabel: "",
    secondaryCtaHref: "",
    youtubeUrl: "",
  },
};

export type EditorialSeed = {
  kind: EditorialKind;
  slug: string;
  groupLabel: string;
  title: string;
  summary: string;
  body: string;
  note: string;
  publishedOn: string | null;
  sortOrder: number;
};

function editorial(seed: EditorialSeed): EditorialSeed {
  return seed;
}

export const DEFAULT_EDITORIAL: EditorialSeed[] = [
  editorial({ kind: EditorialKind.HOME_POINT, slug: "understand", groupLabel: "", title: "先了解制度", summary: "", body: "驗證介紹說明申請順序。正式費用與合約文字尚未核定。", note: "", publishedOn: null, sortOrder: 1 }),
  editorial({ kind: EditorialKind.HOME_POINT, slug: "prepare", groupLabel: "", title: "再準備資料", summary: "", body: "七類申請共用同一份表單骨架。類別名稱與附件仍待甲方確認。", note: "", publishedOn: null, sortOrder: 2 }),
  editorial({ kind: EditorialKind.HOME_POINT, slug: "supplement", groupLabel: "", title: "依結果補件", summary: "", body: "補件會回到要求當下的審查階段，前後內容都留著。", note: "", publishedOn: null, sortOrder: 3 }),
  editorial({ kind: EditorialKind.ABOUT_FACT, slug: "audience", groupLabel: "", title: "服務對象", summary: "", body: "提出驗證申請的業者，以及負責審查與訓練的內部人員", note: "", publishedOn: null, sortOrder: 1 }),
  editorial({ kind: EditorialKind.ABOUT_FACT, slug: "not-yet", groupLabel: "", title: "目前不做", summary: "", body: "金流扣款、自動發證、簡訊與 LINE 通知。線上簽約可測試，正式法律效力待確認。", note: "", publishedOn: null, sortOrder: 2 }),
  editorial({ kind: EditorialKind.ABOUT_FACT, slug: "mailbox", groupLabel: "", title: "聯絡信箱", summary: "", body: "contact@example.test（占位，不可當成正式窗口）", note: "", publishedOn: null, sortOrder: 3 }),
  editorial({ kind: EditorialKind.NEWS, slug: "training-schedule-pending", groupLabel: "", title: "教育訓練梯次仍使用示範課程", summary: "月曆與列表已可瀏覽，題庫與正式教材尚未提供。", body: "目前課程用於確認報名、名額與出席登錄。及格分數、重考次數與影片完課規則待甲方確認後才會生效。此訊息可整篇替換或下架。", note: "", publishedOn: "2026-10-08", sortOrder: 1 }),
  editorial({ kind: EditorialKind.NEWS, slug: "draft-application-open", groupLabel: "", title: "線上申請草稿已開放試用", summary: "業者可以先建立草稿。這則不是正式公告。", body: "試用期間的類別名稱、附件與費用都尚未核定。送出前請再核對甲方提供的正式表單。此訊息可整篇替換或下架。", note: "", publishedOn: "2026-10-01", sortOrder: 2 }),
  editorial({ kind: EditorialKind.NEWS, slug: "fee-table-pending", groupLabel: "", title: "費用表仍待核定", summary: "項目欄位已留好，金額還不能填成正式收費。", body: "這則是示範消息，用來讓首頁在超過五則時出現更多。正式費用以甲方提供的版本為準。", note: "", publishedOn: "2026-09-18", sortOrder: 3 }),
  editorial({ kind: EditorialKind.NEWS, slug: "site-visit-draft", groupLabel: "", title: "現場複審檢查表為初稿", summary: "檢查項目尚未核定，不能當成正式判定標準。", body: "示範消息。拍照、錄影與判定標準待甲方提供後，再替換這段說明。", note: "", publishedOn: "2026-09-05", sortOrder: 4 }),
  editorial({ kind: EditorialKind.NEWS, slug: "signing-trial", groupLabel: "", title: "線上簽署可供測試", summary: "簽署會把人像與手寫簽名寫進 PDF。", body: "示範消息。這份電子簽署是否等同法定電子簽章，仍待甲方法務確認。", note: "", publishedOn: "2026-08-22", sortOrder: 5 }),
  editorial({ kind: EditorialKind.NEWS, slug: "category-names-pending", groupLabel: "", title: "七類名稱尚未定案", summary: "除已知類別外，其餘正式名稱仍待甲方提供。", body: "示範消息。這則日期較早，首頁只顯示較新的五則，這一則要點更多才看得到。", note: "", publishedOn: "2026-08-01", sortOrder: 6 }),
  editorial({ kind: EditorialKind.VERIFICATION_STEP, slug: "read", groupLabel: "", title: "閱讀驗證介紹", summary: "", body: "了解申請順序與尚未核定的項目。朝拜時間表待甲方提供後填入，此處不臆造禮拜時間。", note: "", publishedOn: null, sortOrder: 1 }),
  editorial({ kind: EditorialKind.VERIFICATION_STEP, slug: "fees", groupLabel: "", title: "確認費用", summary: "", body: "費用項目已留欄位。金額、退款與金流服務商未定，系統不會假裝扣款成功。", note: "", publishedOn: null, sortOrder: 2 }),
  editorial({ kind: EditorialKind.VERIFICATION_STEP, slug: "apply", groupLabel: "", title: "填寫申請", summary: "", body: "草稿可分次儲存。缺資料時不能送件。", note: "", publishedOn: null, sortOrder: 3 }),
  editorial({ kind: EditorialKind.VERIFICATION_STEP, slug: "review", groupLabel: "", title: "初審與補件", summary: "", body: "審查人員可要求補件。業者只看到需補充的說明，看不到內部註記。", note: "", publishedOn: null, sortOrder: 4 }),
  editorial({ kind: EditorialKind.VERIFICATION_STEP, slug: "site", groupLabel: "", title: "現場複審", summary: "", body: "檢查表為推論初稿。實地拍照與錄影仍以人工歸檔，尚未綁定手機拍攝流程。", note: "", publishedOn: null, sortOrder: 5 }),
  editorial({ kind: EditorialKind.VERIFICATION_STEP, slug: "sign", groupLabel: "", title: "簽約、證書與續約", summary: "", body: "合約可在線上簽署並下載 PDF。證書仍由管理員在核定後人工登錄。", note: "", publishedOn: null, sortOrder: 6 }),
  editorial({ kind: EditorialKind.FEE, slug: "fee-doc", groupLabel: "", title: "文件初審", summary: "每一申請案", body: "待填", note: "送件前取消是否退費，待確認", publishedOn: null, sortOrder: 1 }),
  editorial({ kind: EditorialKind.FEE, slug: "fee-site", groupLabel: "", title: "現場複審", summary: "每一場所", body: "待填", note: "已派出人員後的取消費，待確認", publishedOn: null, sortOrder: 2 }),
  editorial({ kind: EditorialKind.FEE, slug: "fee-cert-digital", groupLabel: "", title: "電子證書", summary: "核定後", body: "待填", note: "初版不自動產製", publishedOn: null, sortOrder: 3 }),
  editorial({ kind: EditorialKind.FEE, slug: "fee-cert-paper", groupLabel: "", title: "實體證書", summary: "另案申請", body: "待填", note: "印製後不退費與否，待確認", publishedOn: null, sortOrder: 4 }),
  editorial({ kind: EditorialKind.FEE, slug: "fee-renew", groupLabel: "", title: "續約", summary: "到期前辦理", body: "待填", note: "是否需重新現場複審，待確認", publishedOn: null, sortOrder: 5 }),
  editorial({ kind: EditorialKind.FAQ, slug: "who-registers", groupLabel: "申請", title: "誰可以註冊？", summary: "", body: "前台只開放業者自行註冊。承辦、驗證人員與管理員由管理員在後台建立。", note: "", publishedOn: null, sortOrder: 1 }),
  editorial({ kind: EditorialKind.FAQ, slug: "draft-partial", groupLabel: "申請", title: "草稿可以先不填完嗎？", summary: "", body: "可以。缺資料時不能送件，已填內容會保留。", note: "", publishedOn: null, sortOrder: 2 }),
  editorial({ kind: EditorialKind.FAQ, slug: "pay-online", groupLabel: "費用", title: "現在可以線上付款嗎？", summary: "", body: "不可以。金流服務商、金額與退款規則都還沒有。", note: "", publishedOn: null, sortOrder: 3 }),
  editorial({ kind: EditorialKind.FAQ, slug: "training-required", groupLabel: "訓練", title: "上完課才可以送件嗎？", summary: "", body: "初版不會用時數擋住申請。是否列為資格，待甲方確認。", note: "", publishedOn: null, sortOrder: 4 }),
  editorial({ kind: EditorialKind.FAQ, slug: "auto-certificate", groupLabel: "證書", title: "核定後會自動拿到證書嗎？", summary: "", body: "不會。編號、版型與效期由管理員人工登錄。", note: "", publishedOn: null, sortOrder: 5 }),
  editorial({ kind: EditorialKind.EMAIL_DRAFT, slug: "submitted", groupLabel: "", title: "已收到驗證申請", summary: "送件完成", body: "案件編號與下一步說明。正式寄件名稱與內文待核定。", note: "", publishedOn: null, sortOrder: 1 }),
  editorial({ kind: EditorialKind.EMAIL_DRAFT, slug: "supplement", groupLabel: "", title: "請補充驗證申請資料", summary: "要求補件", body: "只列出需補充的項目，不含內部審查意見。", note: "", publishedOn: null, sortOrder: 2 }),
  editorial({ kind: EditorialKind.EMAIL_DRAFT, slug: "approved", groupLabel: "", title: "驗證申請已核定", summary: "核定", body: "證書尚未自動核發時，信中不寫成已可下載正式證書。", note: "", publishedOn: null, sortOrder: 3 }),
  editorial({ kind: EditorialKind.EMAIL_DRAFT, slug: "renewal", groupLabel: "", title: "驗證效期即將屆滿", summary: "即將到期", body: "提醒日與是否需重新審查，待確認後才寄。", note: "", publishedOn: null, sortOrder: 4 }),
];

const SAFE_HREF = /^\/[A-Za-z0-9\-/_]*$/;

export function isSafeHref(value: string): boolean {
  return value === "" || SAFE_HREF.test(value);
}

export function youtubeVideoId(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    const idPattern = /^[\w-]{11}$/;
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return idPattern.test(id) ? id : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const fromQuery = url.searchParams.get("v") ?? "";
      if (url.pathname === "/watch" && idPattern.test(fromQuery)) return fromQuery;
      const parts = url.pathname.split("/").filter(Boolean);
      const id = parts[0] === "embed" || parts[0] === "shorts" ? parts[1] ?? "" : "";
      return idPattern.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function renderContractBody(
  template: string,
  values: { organizationName: string; taxId: string; contractNo: string; issuedOn: string },
): string {
  return template
    .replaceAll("{{organizationName}}", values.organizationName)
    .replaceAll("{{taxId}}", values.taxId || "未填")
    .replaceAll("{{contractNo}}", values.contractNo)
    .replaceAll("{{issuedOn}}", values.issuedOn);
}

export function formatContractNo(year: number, sequence: number): string {
  return `CT-${year}-${String(sequence).padStart(5, "0")}`;
}

export function taipeiDateLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function taipeiDateTimeLabel(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date).replace(" ", " ");
}

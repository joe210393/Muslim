import { ContentSlot, UserRole } from "@mf/db/enums";

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

export function defaultFeatureEnabled(role: UserRole, featureKey: PlatformFeatureKey): boolean {
  if (role === UserRole.ADMIN) return featureKey !== "contracts.sign" && featureKey !== "applications.create";
  if (role === UserRole.CASE_OFFICER) return OFFICER_FEATURES.has(featureKey);
  return APPLICANT_FEATURES.has(featureKey);
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
本合約自簽署日起一年內有效。到期前是否須重新審查、重新簽約或只做資料更新，待甲方確認後改寫本段。未簽署前，管理員可以改內容或作廢後重發。

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
  },
};

const SAFE_HREF = /^\/[A-Za-z0-9\-/_]*$/;

export function isSafeHref(value: string): boolean {
  return value === "" || SAFE_HREF.test(value);
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

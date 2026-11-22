import { sanitizeContractHtml } from "./official-contract";

/**
 * 驗證許可證書範本對應（依官方資料夾證書檔）。
 * 一案可對到多張（例如友善餐廳同時有正餐與飲品／點心）。
 */

export type CertificateTemplateKey =
  | "MFR_MEAL"
  | "MFR_DRINK_SNACK"
  | "HALAL_RESTAURANT"
  | "HALAL_KITCHEN"
  | "MFA_WITH_BREAKFAST"
  | "MFA_WITHOUT_BREAKFAST"
  | "MFE_ENVIRONMENT"
  | "MFEA_EXPERIENCE"
  | "MFS_STORE"
  | "MFTA_TRAVEL"
  | "HALAL_PRODUCT";

export type CertificateTemplateDef = {
  key: CertificateTemplateKey;
  /** 內部對照用；介面不顯示 */
  sourceFile: string;
  titleZh: string;
  titleEn: string;
  categoryCode: "CAT_01" | "CAT_02" | "CAT_03" | "CAT_04" | "CAT_05" | "CAT_06" | "CAT_07";
  matchNote: string;
  defaultItemsZh: string;
  defaultItemsEn: string;
  /** 預設 Logo（public/cert-logos） */
  defaultLogoPath: string;
};

export const CERTIFICATE_FIELD_DEFS = [
  { key: "licenseeNameZh", label: "單位名稱（中文）" },
  { key: "licenseeNameEn", label: "單位名稱（英文）" },
  { key: "certificateNo", label: "證書編號" },
  { key: "issuedOnDate", label: "核發日" },
  { key: "validUntilDate", label: "到期日" },
  { key: "certificationItemsZh", label: "驗證項目（中文）" },
  { key: "certificationItemsEn", label: "驗證項目（英文）" },
  { key: "addressZh", label: "單位地址（中文）" },
  { key: "addressEn", label: "單位地址（英文）" },
  { key: "telephone", label: "單位電話" },
  { key: "auditorName", label: "稽核人員" },
] as const;

export type CertificateFieldKey = (typeof CERTIFICATE_FIELD_DEFS)[number]["key"];

function certField(key: CertificateFieldKey) {
  const label = CERTIFICATE_FIELD_DEFS.find((item) => item.key === key)?.label ?? key;
  return `<span data-contract-field="${key}" class="contract-field">${label}</span>`;
}

/** 驗證單位簽名圖（官方簽名掃描，黑字透明底）。 */
export const DEFAULT_AUDITOR_SIGNATURE_PATH = "/cert-logos/auditor-signature.png";

/** 各證書預設內文（對齊官方 PDF：置中抬頭／Logo／業者／標題，左列欄位，簽名）。 */
export function defaultCertificateBody(def: Pick<CertificateTemplateDef, "titleZh" | "titleEn">): string {
  return sanitizeContractHtml(`<p class="certificate-center"><strong>بسم الله الرحمن الرحيم</strong></p>
<p class="certificate-center"><strong>伊 斯 蘭 商 務 發 展 有 限 公 司</strong></p>
<p class="certificate-center">Islamic Commercial Development Ltd.</p>
<div data-certificate-logo="true" class="certificate-logo-slot"></div>
<p class="certificate-center"><strong>${certField("licenseeNameZh")}</strong></p>
<p class="certificate-center">${certField("licenseeNameEn")}</p>
<p class="certificate-center"><strong>${def.titleZh}</strong></p>
<p class="certificate-center">${def.titleEn}</p>
<p>單位名稱 Licensee Name：${certField("licenseeNameZh")}</p>
<p>${certField("licenseeNameEn")}</p>
<p>證書編號 Certificate No.：${certField("certificateNo")}</p>
<p>證書效期 Date of Issue &amp; Expiry：${certField("issuedOnDate")}-${certField("validUntilDate")}</p>
<p>驗證項目 Certification Items：${certField("certificationItemsZh")}</p>
<p>${certField("certificationItemsEn")}</p>
<p>單位地址 Licensee Address：${certField("addressZh")}</p>
<p>${certField("addressEn")}</p>
<p>單位電話 Licensee Telephone：${certField("telephone")}</p>
<p>驗證單位 Certification Organization：</p>
<div data-certificate-signature="true" class="certificate-signature-slot"></div>
<p>${certField("auditorName")}</p>`);
}

export const DEFAULT_CERTIFICATE_LOGO_BY_KEY: Record<CertificateTemplateKey, string> = {
  MFR_MEAL: "/cert-logos/mfr.png",
  MFR_DRINK_SNACK: "/cert-logos/mfr.png",
  HALAL_RESTAURANT: "/cert-logos/halal-kitchen-restaurant.png",
  HALAL_KITCHEN: "/cert-logos/halal-kitchen-restaurant.png",
  MFA_WITH_BREAKFAST: "/cert-logos/mfa.png",
  MFA_WITHOUT_BREAKFAST: "/cert-logos/mfa.png",
  MFE_ENVIRONMENT: "/cert-logos/mfe.png",
  MFEA_EXPERIENCE: "/cert-logos/mfea.png",
  MFS_STORE: "/cert-logos/mfs.png",
  MFTA_TRAVEL: "/cert-logos/mfta.png",
  HALAL_PRODUCT: "/cert-logos/halal-product.png",
};

export const CERTIFICATE_TEMPLATES: CertificateTemplateDef[] = [
  {
    key: "MFR_MEAL",
    sourceFile: "4-1 MFR友善餐廳_證書.docx",
    titleZh: "穆斯林友善餐廳驗證許可證明書",
    titleEn: "Certificate of Muslim Friendly Restaurant",
    categoryCode: "CAT_01",
    matchNote: "申請項目＝穆斯林友善餐廳，且勾選早餐／午餐／晚餐任一",
    defaultItemsZh: "Halal 早／午／晚餐菜單",
    defaultItemsEn: "Halal Breakfast, Lunch, Dinner Meal",
    defaultLogoPath: "/cert-logos/mfr.png",
  },
  {
    key: "MFR_DRINK_SNACK",
    sourceFile: "4-2 MFR友善餐廳(飲品.點心)_證書.docx",
    titleZh: "穆斯林友善餐廳驗證許可證明書（飲品／點心）",
    titleEn: "Certificate of Muslim Friendly Restaurant",
    categoryCode: "CAT_01",
    matchNote: "申請項目＝穆斯林友善餐廳，且勾選飲品／點心任一",
    defaultItemsZh: "Halal 飲品／點心",
    defaultItemsEn: "Halal Drinks / Snacks",
    defaultLogoPath: "/cert-logos/mfr.png",
  },
  {
    key: "HALAL_RESTAURANT",
    sourceFile: "4-3 Halal餐廳_證書.docx",
    titleZh: "Halal餐廳驗證許可證明書",
    titleEn: "Certificate of Halal Restaurant",
    categoryCode: "CAT_01",
    matchNote: "申請項目＝Halal餐廳",
    defaultItemsZh: "全店餐點",
    defaultItemsEn: "All meals are Halal",
    defaultLogoPath: "/cert-logos/halal-kitchen-restaurant.png",
  },
  {
    key: "HALAL_KITCHEN",
    sourceFile: "4-4 Halal廚房_證書.docx",
    titleZh: "Halal廚房驗證許可證明書",
    titleEn: "Certificate of Halal Kitchen",
    categoryCode: "CAT_01",
    matchNote: "申請項目＝Halal廚房",
    defaultItemsZh: "Halal 專用廚房設備及原物料食材",
    defaultItemsEn: "Halal Kitchen Facilities & Raw materials",
    defaultLogoPath: "/cert-logos/halal-kitchen-restaurant.png",
  },
  {
    key: "MFA_WITH_BREAKFAST",
    sourceFile: "4-1 MFA友善旅宿(含早餐)_證書.docx",
    titleZh: "穆斯林友善旅宿驗證許可證明書（含早餐）",
    titleEn: "Certificate of Muslim Friendly Accommodation",
    categoryCode: "CAT_03",
    matchNote: "申請項目＝住宿含早餐",
    defaultItemsZh: "Halal 早餐，客房與祈禱設備",
    defaultItemsEn: "Halal Breakfast, Guest Room & Prayer Facilities",
    defaultLogoPath: "/cert-logos/mfa.png",
  },
  {
    key: "MFA_WITHOUT_BREAKFAST",
    sourceFile: "4-2 MFA友善旅宿(不含早)_證書.docx",
    titleZh: "穆斯林友善旅宿驗證許可證明書（不含早餐）",
    titleEn: "Certificate of Muslim Friendly Accommodation",
    categoryCode: "CAT_03",
    matchNote: "申請項目＝住宿不含早餐",
    defaultItemsZh: "客房與祈禱設備",
    defaultItemsEn: "Guest Room & Prayer Facilities",
    defaultLogoPath: "/cert-logos/mfa.png",
  },
  {
    key: "MFE_ENVIRONMENT",
    sourceFile: "4.MFE友善環境_證書.docx",
    titleZh: "穆斯林友善環境驗證許可證明書",
    titleEn: "Certificate of Muslim Friendly Environment",
    categoryCode: "CAT_06",
    matchNote: "類別＝穆斯林友善環境",
    defaultItemsZh: "祈禱室、洗手間與指引設施",
    defaultItemsEn: "Prayer Room, Restroom & Guidance Facilities",
    defaultLogoPath: "/cert-logos/mfe.png",
  },
  {
    key: "MFEA_EXPERIENCE",
    sourceFile: "4. MFEA穆斯林友善體驗活動_證書.docx",
    titleZh: "穆斯林友善體驗活動驗證許可證明書",
    titleEn: "Certificate of Muslim Friendly Experience Activity",
    categoryCode: "CAT_07",
    matchNote: "類別＝穆斯林友善體驗活動",
    defaultItemsZh: "穆斯林友善體驗活動",
    defaultItemsEn: "Muslim Friendly Experience Activity",
    defaultLogoPath: "/cert-logos/mfea.png",
  },
  {
    key: "MFS_STORE",
    sourceFile: "4 MFS友善商店_證書.docx",
    titleZh: "穆斯林友善商店驗證許可證明書",
    titleEn: "Certificate of Muslim Friendly Store",
    categoryCode: "CAT_04",
    matchNote: "類別＝穆斯林友善商店",
    defaultItemsZh: "商店 Halal 專區及擺放之商品",
    defaultItemsEn: "Store Halal Section & Halal products",
    defaultLogoPath: "/cert-logos/mfs.png",
  },
  {
    key: "MFTA_TRAVEL",
    sourceFile: "4 MFTA友善旅行社_證書.docx",
    titleZh: "穆斯林友善旅行社驗證許可證明書",
    titleEn: "Certificate of Muslim Friendly Travel Agent",
    categoryCode: "CAT_05",
    matchNote: "類別＝穆斯林友善旅行社",
    defaultItemsZh: "從業人員及穆斯林友善行程",
    defaultItemsEn: "Company Staff & Muslim Friendly Itinerary",
    defaultLogoPath: "/cert-logos/mfta.png",
  },
  {
    key: "HALAL_PRODUCT",
    sourceFile: "4 Halal產品_證書.docx",
    titleZh: "Halal產品驗證證明書",
    titleEn: "Certificate of Halal Product",
    categoryCode: "CAT_02",
    matchNote: "類別＝穆斯林友善產品（食用品）",
    defaultItemsZh: "該品牌之產品，如附件",
    defaultItemsEn: "Halal products of the brand as attached",
    defaultLogoPath: "/cert-logos/halal-product.png",
  },
];

export type CertificateMatchInput = {
  categoryCode: string;
  applyType?: string | null;
  mealBreakfast?: boolean;
  mealLunch?: boolean;
  mealDinner?: boolean;
  mealDrink?: boolean;
  mealSnack?: boolean;
};

function hasMainMeal(input: CertificateMatchInput) {
  return Boolean(input.mealBreakfast || input.mealLunch || input.mealDinner);
}

function hasDrinkSnack(input: CertificateMatchInput) {
  return Boolean(input.mealDrink || input.mealSnack);
}

export function matchCertificateTemplates(input: CertificateMatchInput): CertificateTemplateDef[] {
  const code = input.categoryCode;
  const applyType = (input.applyType ?? "").trim();

  if (code === "CAT_01") {
    if (applyType === "halal_kitchen") return pick("HALAL_KITCHEN");
    if (applyType === "halal_restaurant") return pick("HALAL_RESTAURANT");
    if (applyType === "friendly_restaurant") {
      const keys: CertificateTemplateKey[] = [];
      if (hasMainMeal(input)) keys.push("MFR_MEAL");
      if (hasDrinkSnack(input)) keys.push("MFR_DRINK_SNACK");
      if (!keys.length) keys.push("MFR_MEAL");
      return keys.map((key) => CERTIFICATE_TEMPLATES.find((item) => item.key === key)!);
    }
    return [];
  }
  if (code === "CAT_02") return pick("HALAL_PRODUCT");
  if (code === "CAT_03") {
    if (applyType === "with_breakfast") return pick("MFA_WITH_BREAKFAST");
    if (applyType === "without_breakfast") return pick("MFA_WITHOUT_BREAKFAST");
    return [];
  }
  if (code === "CAT_04") return pick("MFS_STORE");
  if (code === "CAT_05") return pick("MFTA_TRAVEL");
  if (code === "CAT_06") return pick("MFE_ENVIRONMENT");
  if (code === "CAT_07") return pick("MFEA_EXPERIENCE");
  return [];
}

function pick(...keys: CertificateTemplateKey[]) {
  return keys.map((key) => CERTIFICATE_TEMPLATES.find((item) => item.key === key)!).filter(Boolean);
}

export type CertificateFillValues = Partial<Record<CertificateFieldKey, string>>;

export type CertificateTemplateRow = {
  key: CertificateTemplateKey;
  titleZh: string;
  titleEn: string;
  categoryCode: CertificateTemplateDef["categoryCode"];
  matchNote: string;
  body: string;
  logoUrl: string | null;
  logoFileId: string | null;
  signatureUrl: string | null;
  signatureFileId: string | null;
  version: number;
  updatedAt: string;
};

export function buildDefaultCertificateTemplates(now = new Date().toISOString()): CertificateTemplateRow[] {
  return CERTIFICATE_TEMPLATES.map((item) => ({
    key: item.key,
    titleZh: item.titleZh,
    titleEn: item.titleEn,
    categoryCode: item.categoryCode,
    matchNote: item.matchNote,
    body: defaultCertificateBody(item),
    logoUrl: item.defaultLogoPath || DEFAULT_CERTIFICATE_LOGO_BY_KEY[item.key],
    logoFileId: null,
    signatureUrl: DEFAULT_AUDITOR_SIGNATURE_PATH,
    signatureFileId: null,
    version: 1,
    updatedAt: now,
  }));
}

export function certificateFieldLabel(key: string) {
  return CERTIFICATE_FIELD_DEFS.find((item) => item.key === key)?.label ?? key;
}

export function ensureCertificateHtml(body: string): string {
  return sanitizeContractHtml(body || "<p></p>");
}

/** 把黃底欄位換成實際值（發證／預覽）。 */
export function fillCertificateHtml(
  template: string,
  values: CertificateFillValues,
  logoUrl?: string | null,
  signatureUrl: string | null = DEFAULT_AUDITOR_SIGNATURE_PATH,
): string {
  const root = ensureCertificateHtml(template);
  let next = root;
  for (const def of CERTIFICATE_FIELD_DEFS) {
    const value = (values[def.key] ?? "").trim() || "—";
    const safe = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    next = next.replace(
      new RegExp(`<span[^>]*data-contract-field="${def.key}"[^>]*>[\\s\\S]*?<\\/span>`, "gi"),
      safe,
    );
  }
  next = applyCertificateLogo(ensureCertificateHtml(next), logoUrl);
  return applyCertificateSignature(next, signatureUrl);
}

/** 在 Logo 槽位放入圖片（對齊官方 PDF 置中位置）。 */
export function applyCertificateLogo(html: string, logoUrl?: string | null): string {
  const url = (logoUrl || "").trim();
  if (!url) {
    return html.replace(
      /<div[^>]*data-certificate-logo="true"[^>]*>[\s\S]*?<\/div>/gi,
      '<div data-certificate-logo="true" class="certificate-logo-slot certificate-center"><span class="certificate-logo-missing">（尚未上傳 Logo）</span></div>',
    );
  }
  const safe = url.replaceAll('"', "%22");
  const img = `<div data-certificate-logo="true" class="certificate-logo-slot certificate-center"><img class="certificate-logo" src="${safe}" alt="驗證 Logo" /></div>`;
  if (/data-certificate-logo/i.test(html)) {
    return html.replace(/<div[^>]*data-certificate-logo[^>]*>[\s\S]*?<\/div>/gi, img);
  }
  // 舊範本沒有槽位時，插在公司英文名稱後
  return html.replace(
    /(Islamic Commercial Development Ltd\.<\/p>)/i,
    `$1${img}`,
  );
}

/**
 * 畫面預覽用：把「標籤：值」段落與後面的續行合成一列，
 * 讓續行對齊冒號後的值（與 PDF 相同）。不改存檔內容。
 */
export function layoutCertificateRowsHtml(html: string): string {
  const chunkPattern = /<(p|div|h[1-4])\b[^>]*>[\s\S]*?<\/\1>/gi;
  const out: string[] = [];
  let row: { label: string; values: string[] } | null = null;
  let last = 0;
  const flush = () => {
    if (!row) return;
    out.push(
      `<div class="certificate-row"><span class="certificate-label">${row.label}</span><span class="certificate-value">${row.values.filter(Boolean).join("<br>")}</span></div>`,
    );
    row = null;
  };
  for (const match of html.matchAll(chunkPattern)) {
    const chunk = match[0];
    out.push(html.slice(last, match.index).trim());
    last = (match.index ?? 0) + chunk.length;
    const isPlainP = /^<p>/i.test(chunk);
    const inner = chunk.replace(/^<p>/i, "").replace(/<\/p>$/i, "");
    const colon = inner.indexOf("：");
    if (isPlainP && colon >= 0 && colon < 120) {
      flush();
      row = { label: inner.slice(0, colon + 1), values: [inner.slice(colon + 1).trim()] };
      if (/^驗證單位/.test(inner)) flush();
      continue;
    }
    if (row && (isPlainP || /certificate-center/.test(chunk)) && !/data-certificate-/.test(chunk)) {
      row.values.push(chunk.replace(/^<[^>]+>/, "").replace(/<\/[^>]+>$/, "").trim());
      continue;
    }
    flush();
    out.push(chunk);
  }
  flush();
  out.push(html.slice(last).trim());
  return out.filter(Boolean).join("\n");
}

/** 驗證單位簽名（官方 PDF 虛線簽名位）。 */
export function applyCertificateSignature(html: string, signatureUrl?: string | null): string {
  const url = (signatureUrl || DEFAULT_AUDITOR_SIGNATURE_PATH).trim();
  const safe = url.replaceAll('"', "%22");
  const slot = `<div data-certificate-signature="true" class="certificate-signature-slot"><img class="certificate-signature" src="${safe}" alt="驗證單位簽名" /></div>`;
  if (/data-certificate-signature/i.test(html)) {
    return html.replace(/<div[^>]*data-certificate-signature[^>]*>[\s\S]*?<\/div>/gi, slot);
  }
  // 舊範本或舊證書沒有槽位時，插在「驗證單位」那一行後
  return html.replace(/(<p\b[^>]*>(?:(?!<\/p>)[\s\S])*驗證單位(?:(?!<\/p>)[\s\S])*<\/p>)/i, `$1${slot}`);
}

export function buildCertificateFillValues(input: {
  organizationName: string;
  siteName?: string | null;
  addressZh?: string | null;
  certificateNameEn?: string | null;
  certificateAddressEn?: string | null;
  certificatePhone?: string | null;
  certificateNo?: string;
  issuedOnDate?: string;
  validUntilDate?: string;
  template?: Pick<CertificateTemplateDef, "defaultItemsZh" | "defaultItemsEn"> | null;
  auditorName?: string;
}): CertificateFillValues {
  const nameZh = (input.siteName || input.organizationName || "").trim();
  return {
    licenseeNameZh: nameZh,
    licenseeNameEn: (input.certificateNameEn || "").trim() || nameZh,
    certificateNo: input.certificateNo ?? "",
    issuedOnDate: input.issuedOnDate ?? "",
    validUntilDate: input.validUntilDate ?? "",
    certificationItemsZh: input.template?.defaultItemsZh ?? "",
    certificationItemsEn: input.template?.defaultItemsEn ?? "",
    addressZh: (input.addressZh || "").trim(),
    addressEn: (input.certificateAddressEn || "").trim(),
    telephone: (input.certificatePhone || "").trim(),
    auditorName: input.auditorName ?? "Auditor Ustaz Hj Ishag Ma",
  };
}

export function findCertificateTemplateDef(key: string) {
  return CERTIFICATE_TEMPLATES.find((item) => item.key === key) ?? null;
}

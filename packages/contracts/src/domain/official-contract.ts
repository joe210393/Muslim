import { parse as parseHtml, type HTMLElement, type Node as HtmlNode, type TextNode } from "node-html-parser";
import { contractFieldLabel, isContractCheckboxField } from "./contract-fields";
import { compactRuns, parseSafeStyle, type TextAlignValue, type TextRun } from "./rich-text";

/** 依《2.穆斯林友善驗證合約書_空白》（旅宿資料夾版本）整理的正式合約範本。 */
export const OFFICIAL_CONTRACT_TITLE = "穆斯林友善場域驗證合約書";

function field(key: string) {
  return `<span data-contract-field="${key}" class="contract-field">${contractFieldLabel(key)}</span>`;
}

function seal(kind: "company" | "person") {
  return `<span data-contract-seal="${kind}" class="contract-seal" contenteditable="false">${kind === "company" ? "公司大章" : "負責人小章"}</span>`;
}

/**
 * 預設合約為 HTML：可在範本編輯器直接排版／畫表格。
 * 黃底可填欄位為 data-contract-field；大小章為 data-contract-seal。
 */
export const OFFICIAL_CONTRACT_BODY = `<p>立約方：</p>
<p>伊斯蘭商務發展有限公司（以下簡稱甲方）</p>
<p>${field("partyBName")}（以下簡稱乙方）</p>
<p>一、輔導及驗證場域與項目：</p>
<p>（一）驗證場域名稱：${field("siteName")}</p>
<p>（二）驗證項目與費用：（下表未選取或申請書以外之項目不在本合約約定範圍內）</p>
<table>
<tr><th>驗證類別</th><th>項目</th></tr>
<tr><td>${field("checkHalalKitchen")}Halal廚房</td><td>1. Halal中英文菜單。<br>2. 廚房：為全Halal廚房，製作Halal餐點之廚房設備、使用之廚具、餐具、器具、洗劑。<br>3. 食材：製作Halal餐點之各類原物料、醬料、調味料。</td></tr>
<tr><td>${field("checkHalalRestaurant")}Halal餐廳<br>${field("checkMuslimFriendlyRestaurant")}穆斯林友善餐廳<br>${field("checkMealService")}早/午/晚餐<br>${field("checkDrinksSnacks")}飲品/點心</td><td>1. Halal中英文菜單。<br>2. 廚房：為 ${field("checkFullHalalKitchen")}全Halal廚房 ${field("checkPartialKitchen")}部分專區廚房，製作Halal餐點之廚房設備、使用之廚具、餐具、器具、洗劑。<br>3. 食材：製作Halal餐點之各類原物料、醬料、調味料。<br>4. ${field("checkRestaurantRestroom")}洗手間：備有淨下設施。</td></tr>
<tr><td>穆斯林友善旅宿<br>${field("lodgingWithBreakfast")}含早餐<br>${field("lodgingWithoutBreakfast")}不含早餐</td><td>1. ${field("itemBreakfast")}早餐：提供Halal早餐、製作Halal早餐之廚房及廚具、餐具、器具、洗劑等。<br>2. ${field("itemGuestRoom")}客房：標示麥加方向貼紙、備有禱告毯、無提供酒精飲料及非Halal點心、無人物或動物畫像掛畫、洗手間裝設有淨下設施。</td></tr>
<tr><td>${field("checkExperience")}穆斯林友善體驗活動<br>${field("checkExperienceWithFood")}含食用品<br>${field("checkExperienceWithoutFood")}不含食用品</td><td>1. 內容：穆斯林於乙方DIY活動使用之器材及場地。<br>2. 材料：穆斯林於乙方DIY活動使用之各類原物料、醬料、調味料、餐具、器具、洗劑等。<br>3. 洗手間：備有淨下設施。</td></tr>
<tr><td>${field("checkEnvironment")}穆斯林友善環境</td><td>1. 祈禱室：應備有禱告毯、麥加方向貼紙、禱告時間表、屏風、時鐘、鞋櫃、拖鞋。<br>2. 洗手間：備有淨下設施。</td></tr>
<tr><td>${field("checkShop")}穆斯林友善商店</td><td>1. 專區：販售Halal產品之專用區。<br>2. 產品：有Halal標示或證書可證明其Halal狀態之產品。</td></tr>
</table>
<p>二、費用總價與續約費用：</p>
<p>（一）乙方申請輔導與驗證費用總金額為新臺幣 ${field("feeAmount")} 元。（稅外加）</p>
<p>（二）甲方於完成本合約之簽署並收訖合約款項後始進行本合約相關之輔導驗證服務。</p>
<p>（三）甲方匯款帳號<br>銀行：中國信託羅東分行 822<br>戶名：伊斯蘭商務發展有限公司<br>帳號：164-540260259</p>
<p>（四）合約期間屆滿後，如雙方有意續約者，則另以書面議定之。</p>
<p>三、有效期限：</p>
<p>除本合約另有約定者外，合約有效期間自本合約簽署日起至驗證許可證書上所載明之有效期屆滿為止，期間為1年。</p>
<p>四、輔導、驗證程序：</p>
<p>（一）乙方應依照《伊斯蘭商務發展有限公司穆斯林友善驗證規範》（如附件）提供甲方驗證所需之文件，甲方並得至現場輔導訪視或視訊查核，乙方除因營業場所施工整修或暫停營業之外，若無不可抗力之因素，應配合甲方執行。乙方如無故不配合者，則甲方於限期催告乙方配合仍未配合時，則視為雙方同意終止本合約，甲方已收取之費用不予退還。</p>
<p>（二）甲方依《伊斯蘭商務發展有限公司穆斯林友善驗證規範》之標準開列乙方應改善之清單，乙方應於甲方所定之期間內予以修正，若逾期未修正或改善，則甲方於限期催告乙方完成改善仍未完成時，則視為雙方同意終止本合約，甲方已收取之費用不予退還。</p>
<p>（三）乙方通過甲方驗證所需文件及查核作業，繳納驗證費用、簽約並完成驗證程序後，甲方即會核發驗證許可證書。</p>
<p>五、廣告宣傳：</p>
<p>（一）甲方同意乙方於取得驗證項目資格後，於本合約有效期間內得使用甲方核發之驗證許可證書及圖示，惟於各項文宣或廣告張貼前需告知甲方，並經雙方討論同意後使用。</p>
<p>（二）乙方同意其所提供之單位營業資訊、活動及產品訊息，甲方得合理用於國內外推廣穆斯林市場。</p>
<p>六、抽查、記點、罰則：</p>
<p>（一）於驗證許可證書有效期限內，甲方得不定期派人員至現場輔導、檢查乙方驗證之項目，乙方除因營業場所施工整修或暫停營業之外，若無不可抗力之因素，應配合甲方執行。乙方如無故不配合者，甲方得撤銷已核發之合格證明，乙方並應繳回驗證許可證書。甲方已收取之費用不予退還。</p>
<p>（二）於驗證許可證書有效期限內，如甲方發現乙方有發生《伊斯蘭商務發展有限公司穆斯林友善驗證規範》（如附件）所示之違規事項時，甲方依該條列記點，如乙方累積違規事項達五點時，甲方得撤銷已核發之合格證明，乙方並應繳回驗證許可證書。甲方已收取之費用不予退還。</p>
<p>（三）乙方如將驗證許可證書轉讓、借予他方使用者，甲方得撤銷已核發之合格證明，乙方並應繳回驗證許可證書。甲方已收取之費用不予退還。</p>
<p>（四）乙方因違反《伊斯蘭商務發展有限公司穆斯林友善驗證規範》而被甲方記點時，乙方應於七日內改善，如乙方未如期改善完畢，甲方得按違規項目持續計點，直至乙方改善完畢為止。</p>
<p>（五）於驗證許可證書有效期限內，乙方申請驗證項目內容若有變更，乙方需主動告知，若未主動告知變更項目，甲方得依《伊斯蘭商務發展有限公司穆斯林友善驗證規範》撤銷已核發之驗證許可證書。</p>
<p>（六）乙方被通報未落實本合約之項目或供應本合約以外之項目給穆斯林旅客，而遭第三人請求損害賠償時，乙方須自行處理且負擔賠償責任。</p>
<p>七、其他：</p>
<p>（一）乙方如經甲方撤銷驗證許可證書，若有拒絕繳回驗證許可證書或繼續使用驗證許可證書或對外宣稱具有經過甲方驗證合格之資格者，應給付甲方之相當於本合約費用五倍之懲罰性違約金。</p>
<p>（二）乙方如將驗證許可證書轉讓、借予他方使用者，應給付甲方之相當於本合約費用五倍之懲罰性違約金。</p>
<p>八、合約終止：</p>
<p>（一）於本合約有效期間內，除經雙方書面同意或本合約另有規定外，不得任意終止或解除本合約。</p>
<p>（二）任一方如有違反本合約之約定，經他方以書面通知限期改正，仍逾期未改善者，他方得以書面通知終止本合約，並請求損害賠償。</p>
<p>（三）任一方若有破產、清算、解散、重整、停止營業、歇業等情事，或有票據退票、遭拒絕往來或其他減損其債信之情事時，他方得不經預告立即終止本合約。</p>
<p>九、甲乙雙方同意，皆負有保密義務，不得將驗證期間之作業細節如費用、流程、產品內容透露第三方得知，惟事前經他方書面同意者，不在此限。</p>
<p>十、本合約書一式兩份，經雙方簽章後生效，甲乙雙方各存一份。</p>
<p>十一、本合約未盡事宜，得依甲乙雙方之合意或因相關法令之變更，以書面修訂之。</p>
<p>十二、本合約之成立、解釋與執行應以中華民國法律為準據法。</p>
<p>十三、就本合約所生之任何爭議事項，如經涉訟，雙方合意以臺灣宜蘭地方法院為第一審管轄法院。</p>
<p>十四、附件《伊斯蘭商務發展有限公司穆斯林友善驗證規範》為本合約之一部分，與本合約具有同一效力。</p>
<p>合約編號：${field("contractNo")}</p>
<p>發出日期：${field("issuedOn")}</p>
<section data-contract-parties="true" class="contract-parties">
<p class="contract-parties-title"><strong>立約方</strong></p>
<div class="contract-parties-grid">
<div class="contract-parties-col" data-party="a">
<p>甲方：伊斯蘭商務發展有限公司${seal("company")}</p>
<p>負責人：簡佩平${seal("person")}</p>
<p>統編：91001128</p>
<p>地址：宜蘭縣宜蘭市神農路一段1號</p>
</div>
<div class="contract-parties-col" data-party="b">
<p>乙方：${field("partyBName")}</p>
<p>負責人：${field("partyBOwner")}</p>
<p>統編：${field("partyBTaxId")}</p>
<p>地址：${field("partyBAddress")}</p>
</div>
</div>
<p class="contract-parties-date">中華民國 ${field("signYear")} 年 ${field("signMonth")} 月 ${field("signDay")} 日</p>
</section>
`;

export type ContractFillValues = {
  organizationName: string;
  taxId: string;
  contractNo: string;
  issuedOn: string;
  partyBName?: string;
  partyBAddress?: string;
  partyBOwner?: string;
  partyBTaxId?: string;
  siteName?: string;
  feeAmount?: string;
  checkHalalKitchen?: boolean;
  checkHalalRestaurant?: boolean;
  checkMuslimFriendlyRestaurant?: boolean;
  checkMealService?: boolean;
  checkDrinksSnacks?: boolean;
  checkFullHalalKitchen?: boolean;
  checkPartialKitchen?: boolean;
  checkRestaurantRestroom?: boolean;
  lodgingWithBreakfast?: boolean;
  lodgingWithoutBreakfast?: boolean;
  itemBreakfast?: boolean;
  itemGuestRoom?: boolean;
  checkExperience?: boolean;
  checkExperienceWithFood?: boolean;
  checkExperienceWithoutFood?: boolean;
  checkEnvironment?: boolean;
  checkShop?: boolean;
  signYear?: string;
  signMonth?: string;
  signDay?: string;
};

function box(on: boolean | undefined) {
  return on ? "☑" : "□";
}

export function isContractHtml(body: string): boolean {
  const trimmed = body.trim();
  // 舊標記含 <<<TABLE>>>，字面上看起來像 <table，不可誤判成 HTML
  if (trimmed.includes("<<<TABLE>>>") || trimmed.includes("<<<PARTIES>>>") || trimmed.includes("<<<ENDTABLE>>>")) return false;
  if (/\{\{\w+\}\}/.test(trimmed) || trimmed.includes("〈大章〉") || trimmed.includes("〈小章〉")) return false;
  return /<(?:p|table|h[1-6]|ul|ol|section|div)\b/i.test(trimmed) || trimmed.includes("data-contract-field");
}

/** 舊標記／純文字轉成可編輯 HTML。 */
export function legacyContractToHtml(body: string): string {
  if (isContractHtml(body)) return sanitizeContractHtml(body);
  let next = body;
  next = next.replace(/\{\{(\w+)\}\}/g, (_all, key: string) => `<span data-contract-field="${key}" class="contract-field">${contractFieldLabel(key)}</span>`);
  next = next.replaceAll("〈大章〉", seal("company"));
  next = next.replaceAll("〈小章〉", seal("person"));
  const tableRe = /<<<TABLE>>>\n?([\s\S]*?)<<<ENDTABLE>>>/g;
  next = next.replace(tableRe, (_all, raw: string) => {
    const rows = String(raw)
      .split("\n")
      .filter((line) => line.includes("||"))
      .map((line, index) => {
        const [leftPart, ...rightParts] = line.split("||");
        const left = (leftPart ?? "").replaceAll("<<BR>>", "<br>").trim();
        const right = rightParts.join("||").replaceAll("<<BR>>", "<br>").trim();
        const tag = index === 0 ? "th" : "td";
        return `<tr><${tag}>${left}</${tag}><${tag}>${right}</${tag}></tr>`;
      });
    return `<table>${rows.join("")}</table>`;
  });
  const partiesAt = next.indexOf("<<<PARTIES>>>");
  let main = partiesAt >= 0 ? next.slice(0, partiesAt) : next;
  let parties = partiesAt >= 0 ? next.slice(partiesAt + "<<<PARTIES>>>".length).replace(/^\n+/, "") : "";
  if (!parties) {
    const signatureBlock = /\n立約方[：:]\s*\n+\s*甲方[：:]/;
    const match = main.match(signatureBlock);
    if (match && match.index != null && match.index > main.length * 0.4) {
      parties = main.slice(match.index).replace(/^\n+/, "");
      main = main.slice(0, match.index);
    }
  }
  const paragraphs = (text: string) =>
    text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.startsWith("<table") || line.startsWith("<section") ? line : `<p>${line}</p>`))
      .join("\n");
  const html = `${paragraphs(main)}${parties ? `\n<section data-contract-parties="true">${paragraphs(parties)}</section>` : ""}`;
  return sanitizeContractHtml(html || `<p>${escapeHtml(body)}</p>`);
}

export function ensureContractHtml(body: string): string {
  const html = isContractHtml(body) ? sanitizeContractHtml(body) : legacyContractToHtml(body);
  return upgradePartiesLayout(html);
}

/**
 * 已發出合約的立約頁若仍是舊直式段落，讀取／下載時升級成甲乙雙方對列版式。
 * 範本升版不會改 bodySnapshot，所以這裡補上。
 */
export function upgradePartiesLayout(html: string): string {
  const root = parseHtml(`<div id="root">${html}</div>`);
  const container = root.querySelector("#root");
  if (!container) return html;
  for (const section of [...container.querySelectorAll("section[data-contract-parties], section.contract-parties")]) {
    const el = section as HTMLElement;
    if (el.querySelector(".contract-parties-grid") || el.querySelector('[data-party="a"]')) {
      el.classList.add("contract-parties");
      continue;
    }
    const rebuilt = rebuildPartiesSection(el);
    if (!rebuilt) continue;
    const wrap = parseHtml(`<div id="upgrade-wrap">${rebuilt}</div>`);
    const next = wrap.querySelector("#upgrade-wrap")?.childNodes[0];
    if (next) el.replaceWith(next);
  }
  return sanitizeContractHtml(container.innerHTML);
}

function rebuildPartiesSection(section: HTMLElement): string | null {
  const lines: Array<{ text: string; html: string }> = [];
  for (const child of section.childNodes) {
    if (child.nodeType !== 1) continue;
    const el = child as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (tag !== "P" && tag !== "DIV" && !/^H[1-6]$/.test(tag)) continue;
    const text = textContent(el).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (!text) continue;
    lines.push({ text, html: el.innerHTML });
  }
  if (lines.length < 2) return null;

  let titleHtml = "<strong>立約方</strong>";
  const partyA: string[] = [];
  const partyB: string[] = [];
  let dateHtml = "";
  let side: "a" | "b" | null = null;

  for (const line of lines) {
    if (/^立約[方人]/.test(line.text)) {
      titleHtml = line.html.includes("<strong>") || line.html.includes("<b>") ? line.html : `<strong>${escapeHtml(line.text.replace(/[：:]\s*$/, ""))}</strong>`;
      continue;
    }
    if (/中華民國|簽約日期/.test(line.text)) {
      dateHtml = /中華民國/.test(line.text)
        ? line.html
        : line.text.replace(/^簽約日期[：:]\s*/, "中華民國 ").replace(/(\d+)\s*年/, "$1 年");
      continue;
    }
    if (/^甲方/.test(line.text)) {
      side = "a";
      partyA.push(`<p>${line.html}</p>`);
      continue;
    }
    if (/^乙方/.test(line.text)) {
      side = "b";
      partyB.push(`<p>${line.html}</p>`);
      continue;
    }
    if (side === "a") partyA.push(`<p>${line.html}</p>`);
    else if (side === "b") partyB.push(`<p>${line.html}</p>`);
    else partyA.push(`<p>${line.html}</p>`);
  }

  if (!partyA.length && !partyB.length) return null;

  const normalizeParty = (items: string[], who: "a" | "b") => {
    const cleaned = items.map((item) => item.replace(/統一編號/g, "統編"));
    const pick = (re: RegExp, fallback: string) => cleaned.find((item) => re.test(item)) ?? `<p>${fallback}</p>`;
    const name = pick(/^(甲方|乙方)/, who === "a" ? "甲方：" : "乙方：");
    const owner = pick(/負責人/, "負責人：");
    const tax = pick(/統編/, "統編：");
    const address = pick(/地址/, "地址：");
    const ordered = [name, owner, tax, address].map((item) => {
      if (who !== "a") return item;
      if (/^(甲方)/.test(stripTags(item)) && !item.includes("data-contract-seal")) {
        return item.replace(/<\/p>\s*$/, `${seal("company")}</p>`);
      }
      if (/負責人/.test(stripTags(item)) && !item.includes("data-contract-seal")) {
        return item.replace(/<\/p>\s*$/, `${seal("person")}</p>`);
      }
      return item;
    });
    return ordered;
  };

  const aBlocks = normalizeParty(partyA, "a").join("\n");
  const bBlocks = normalizeParty(partyB, "b").join("\n");
  const dateBlock = dateHtml
    ? `<p class="contract-parties-date">${/中華民國/.test(dateHtml) ? dateHtml : `中華民國 ${stripTags(dateHtml).replace(/^簽約日期[：:]\s*/, "")}`}</p>`
    : `<p class="contract-parties-date">中華民國　　年　　月　　日</p>`;

  return `<section data-contract-parties="true" class="contract-parties">
<p class="contract-parties-title">${titleHtml}</p>
<div class="contract-parties-grid">
<div class="contract-parties-col" data-party="a">
${aBlocks}
</div>
<div class="contract-parties-col" data-party="b">
${bBlocks}
</div>
</div>
${dateBlock}
</section>`;
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

const BLOCK_ALIGN_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "LI", "TD", "TH", "DIV"]);
const ALLOWED_TAGS = new Set(["P", "BR", "STRONG", "EM", "U", "B", "I", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "SECTION", "SPAN", "DIV", "IMG"]);

/** 僅保留合約允許的標籤與 data-contract-* 屬性。 */
export function sanitizeContractHtml(html: string): string {
  const root = parseHtml(`<div id="root">${html}</div>`, { blockTextElements: { script: true, style: true } });
  const container = root.querySelector("#root");
  if (!container) return "";
  const walk = (node: HtmlNode) => {
    if (node.nodeType === 3) return;
    if (node.nodeType !== 1) {
      node.remove();
      return;
    }
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME") {
      el.remove();
      return;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      el.replaceWith(...el.childNodes);
      return;
    }
    const keep: Record<string, string> = {};
    if (el.getAttribute("data-contract-field")) keep["data-contract-field"] = el.getAttribute("data-contract-field")!;
    if (el.getAttribute("data-contract-seal")) keep["data-contract-seal"] = el.getAttribute("data-contract-seal")!;
    if (el.getAttribute("data-contract-parties")) keep["data-contract-parties"] = "true";
    if (el.getAttribute("data-certificate-logo") === "true") keep["data-certificate-logo"] = "true";
    if (el.getAttribute("data-certificate-signature") === "true") keep["data-certificate-signature"] = "true";
    if (el.getAttribute("data-party") === "a" || el.getAttribute("data-party") === "b") keep["data-party"] = el.getAttribute("data-party")!;
    if (tag === "IMG") {
      const src = el.getAttribute("src") || "";
      if (src.startsWith("/cert-logos/") || src.startsWith("data:image/") || src.startsWith("blob:")) keep.src = src;
      keep.alt = el.getAttribute("alt") || "";
    }
    const classNames = [
      el.classList.contains("contract-field") ? "contract-field" : "",
      el.classList.contains("contract-seal") ? "contract-seal" : "",
      el.classList.contains("contract-parties") ? "contract-parties" : "",
      el.classList.contains("contract-parties-title") ? "contract-parties-title" : "",
      el.classList.contains("contract-parties-grid") ? "contract-parties-grid" : "",
      el.classList.contains("contract-parties-col") ? "contract-parties-col" : "",
      el.classList.contains("contract-parties-date") ? "contract-parties-date" : "",
      el.classList.contains("certificate-logo") ? "certificate-logo" : "",
      el.classList.contains("certificate-logo-slot") ? "certificate-logo-slot" : "",
      el.classList.contains("certificate-center") ? "certificate-center" : "",
      el.classList.contains("certificate-signature") ? "certificate-signature" : "",
      el.classList.contains("certificate-signature-slot") ? "certificate-signature-slot" : "",
      el.classList.contains("certificate-signature-line") ? "certificate-signature-line" : "",
    ].filter(Boolean);
    if (classNames.length) keep.class = classNames.join(" ");
    const safeStyle = parseSafeStyle(el.getAttribute("style"));
    const styles: string[] = [];
    if (safeStyle.textAlign && BLOCK_ALIGN_TAGS.has(tag)) styles.push(`text-align: ${safeStyle.textAlign}`);
    if (safeStyle.fontSizePt && tag === "SPAN") styles.push(`font-size: ${safeStyle.fontSizePt}pt`);
    if (styles.length) keep.style = styles.join("; ");
    for (const name of Object.keys(el.attributes)) el.removeAttribute(name);
    for (const [name, value] of Object.entries(keep)) el.setAttribute(name, value);
    for (const child of [...el.childNodes]) walk(child);
  };
  for (const child of [...container.childNodes]) walk(child);
  return container.innerHTML;
}

function fillMap(values: ContractFillValues): Record<string, string> {
  const issued = values.issuedOn || "";
  const [y, m, d] = issued.split("-");
  const partyBName = values.partyBName?.trim() || values.organizationName;
  const partyBTaxId = values.partyBTaxId?.trim() || values.taxId || "未填";
  return {
    organizationName: values.organizationName,
    taxId: values.taxId || "未填",
    contractNo: values.contractNo,
    issuedOn: values.issuedOn,
    partyBName,
    partyBAddress: values.partyBAddress?.trim() || "未填",
    partyBOwner: values.partyBOwner?.trim() || "未填",
    partyBTaxId,
    siteName: values.siteName?.trim() || "　　　　",
    feeAmount: values.feeAmount?.trim() || "　　　　",
    checkHalalKitchen: box(values.checkHalalKitchen),
    checkHalalRestaurant: box(values.checkHalalRestaurant),
    checkMuslimFriendlyRestaurant: box(values.checkMuslimFriendlyRestaurant),
    checkMealService: box(values.checkMealService),
    checkDrinksSnacks: box(values.checkDrinksSnacks),
    checkFullHalalKitchen: box(values.checkFullHalalKitchen),
    checkPartialKitchen: box(values.checkPartialKitchen),
    checkRestaurantRestroom: box(values.checkRestaurantRestroom),
    lodgingWithBreakfast: box(values.lodgingWithBreakfast),
    lodgingWithoutBreakfast: box(values.lodgingWithoutBreakfast),
    itemBreakfast: box(values.itemBreakfast),
    itemGuestRoom: box(values.itemGuestRoom),
    checkExperience: box(values.checkExperience),
    checkExperienceWithFood: box(values.checkExperienceWithFood),
    checkExperienceWithoutFood: box(values.checkExperienceWithoutFood),
    checkEnvironment: box(values.checkEnvironment),
    checkShop: box(values.checkShop),
    signYear: values.signYear?.trim() || (y ? String(Number(y) - 1911) : "　　"),
    signMonth: values.signMonth?.trim() || (m ? String(Number(m)) : "　"),
    signDay: values.signDay?.trim() || (d ? String(Number(d)) : "　"),
  };
}

/** 代換合約範本；黃底欄位由管理員於發出時填入。 */
export function renderContractBody(template: string, values: ContractFillValues): string {
  const html = ensureContractHtml(template);
  const map = fillMap(values);
  const root = parseHtml(`<div id="root">${html}</div>`);
  const container = root.querySelector("#root");
  if (!container) return html;
  for (const el of container.querySelectorAll("[data-contract-field]")) {
    const key = el.getAttribute("data-contract-field") ?? "";
    const value = map[key] ?? "";
    if (isContractCheckboxField(key)) {
      el.replaceWith(value);
    } else {
      el.replaceWith(value);
    }
  }
  // 相容舊 {{key}} 殘留
  let out = container.innerHTML;
  for (const [key, value] of Object.entries(map)) {
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return sanitizeContractHtml(out);
}

export type ContractTableRow = { left: string; right: string; header?: boolean; cells?: string[]; cellRuns?: TextRun[][]; cellAligns?: Array<TextAlignValue | null> };

export type ContractPartyLine = { text: string; seal?: "company" | "person"; runs?: TextRun[] };

export type ContractBodyPart =
  | { type: "text"; text: string; seal?: "company" | "person"; heading?: number; runs?: TextRun[]; align?: TextAlignValue | null }
  | { type: "table"; rows: ContractTableRow[] }
  | {
      type: "parties";
      html: string;
      parts: ContractBodyPart[];
      title?: string;
      partyA?: ContractPartyLine[];
      partyB?: ContractPartyLine[];
      dateLine?: string;
    };

function partyLinesFromColumn(el: HTMLElement): ContractPartyLine[] {
  const lines: ContractPartyLine[] = [];
  for (const child of el.childNodes) {
    if (child.nodeType !== 1) continue;
    const tag = (child as HTMLElement).tagName.toUpperCase();
    if (tag !== "P" && tag !== "DIV") continue;
    const { text, seal: sealKind, runs } = inlineText(child as HTMLElement);
    if (text.trim()) lines.push({ text: text.trim(), seal: sealKind, runs: trimRuns(runs) });
  }
  return lines;
}

function parsePartiesSection(el: HTMLElement): ContractBodyPart {
  const titleEl = el.querySelector(".contract-parties-title") ?? el.querySelector("p,h1,h2,h3");
  const dateEl = el.querySelector(".contract-parties-date");
  const colA = el.querySelector('[data-party="a"]') as HTMLElement | null;
  const colB = el.querySelector('[data-party="b"]') as HTMLElement | null;
  const title = titleEl ? textContent(titleEl).replace(/\u00a0/g, " ").trim() : "立約方";
  const dateLine = dateEl ? textContent(dateEl).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() : "";
  if (colA || colB) {
    return {
      type: "parties",
      html: el.innerHTML,
      parts: partsFromNodes(el.childNodes),
      title: title || "立約方",
      partyA: colA ? partyLinesFromColumn(colA) : [],
      partyB: colB ? partyLinesFromColumn(colB) : [],
      dateLine,
    };
  }
  return { type: "parties", html: el.innerHTML, parts: partsFromNodes(el.childNodes), title: title || "立約方", dateLine };
}

function textContent(node: HtmlNode): string {
  if (node.nodeType === 3) return (node as TextNode).rawText;
  if (node.nodeType !== 1) return "";
  const el = node as HTMLElement;
  if (el.tagName === "BR") return "\n";
  if (el.getAttribute("data-contract-seal")) return "";
  return el.childNodes.map(textContent).join("");
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/gi, "&");
}

function inlineText(el: HTMLElement): { text: string; seal?: "company" | "person"; runs: TextRun[] } {
  const runs: TextRun[] = [];
  let sealKind: "company" | "person" | undefined;
  const walk = (node: HtmlNode, sizePt: number | null) => {
    if (node.nodeType === 3) {
      runs.push({ text: decodeEntities((node as TextNode).rawText).replace(/\u00a0/g, " "), sizePt });
      return;
    }
    if (node.nodeType !== 1) return;
    const child = node as HTMLElement;
    if (child.tagName === "BR") {
      runs.push({ text: "\n", sizePt });
      return;
    }
    const sealAttr = child.getAttribute("data-contract-seal");
    if (sealAttr === "company" || sealAttr === "person") {
      sealKind = sealAttr;
      return;
    }
    const own = parseSafeStyle(child.getAttribute("style")).fontSizePt;
    for (const n of child.childNodes) walk(n, own ?? sizePt);
  };
  for (const n of el.childNodes) walk(n, null);
  const compact = compactRuns(runs);
  const last = compact[compact.length - 1];
  if (last) last.text = last.text.trimEnd();
  return { text: compact.map((run) => run.text).join(""), seal: sealKind, runs: compact.filter((run) => run.text) };
}

function trimRuns(runs: TextRun[]): TextRun[] {
  const out = runs.map((run) => ({ ...run }));
  while (out.length && !out[0]!.text.trimStart()) out.shift();
  if (out[0]) out[0].text = out[0].text.trimStart();
  return out;
}

function blockAlign(el: HTMLElement): TextAlignValue | null {
  return parseSafeStyle(el.getAttribute("style")).textAlign;
}

/** 表格儲存格：段落之間換行。 */
function cellRunsOf(cell: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  const blocks = cell.childNodes.filter((node) => node.nodeType === 1 && /^(P|DIV|H[1-6])$/.test((node as HTMLElement).tagName));
  if (!blocks.length) return inlineText(cell).runs;
  blocks.forEach((block, index) => {
    if (index > 0) runs.push({ text: "\n", sizePt: null });
    runs.push(...inlineText(block as HTMLElement).runs);
  });
  return compactRuns(runs);
}

function partsFromNodes(nodes: HtmlNode[]): ContractBodyPart[] {
  const parts: ContractBodyPart[] = [];
  for (const node of nodes) {
    if (node.nodeType === 3) {
      const raw = (node as TextNode).rawText.replace(/\s+/g, " ").trim();
      if (raw) parts.push({ type: "text", text: raw });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const el = node as HTMLElement;
    const tag = el.tagName.toUpperCase();
    if (el.getAttribute("data-contract-parties") === "true" || (tag === "SECTION" && el.getAttribute("data-contract-parties"))) {
      parts.push(parsePartiesSection(el));
      continue;
    }
    if (tag === "TABLE") {
      const rows: ContractTableRow[] = [];
      for (const tr of el.querySelectorAll("tr")) {
        const cellEls = tr.querySelectorAll("th,td");
        const cells = cellEls.map((cell) => textContent(cell).replace(/\u00a0/g, " ").trim());
        if (!cells.length) continue;
        rows.push({
          left: cells[0] ?? "",
          right: cells.slice(1).join("\n"),
          cells,
          cellRuns: cellEls.map((cell) => trimRuns(cellRunsOf(cell))),
          cellAligns: cellEls.map((cell) => blockAlign(cell) ?? (cell.querySelector("p") ? blockAlign(cell.querySelector("p")!) : null)),
          header: tr.querySelectorAll("th").length > 0 || rows.length === 0,
        });
      }
      if (rows.length) parts.push({ type: "table", rows });
      continue;
    }
    if (/^H[1-6]$/.test(tag)) {
      const { text, seal: sealKind, runs } = inlineText(el);
      parts.push({ type: "text", text, seal: sealKind, heading: Number(tag.slice(1)), runs, align: blockAlign(el) });
      continue;
    }
    if (tag === "UL" || tag === "OL") {
      const items = el.querySelectorAll("li").map((li, index) => `${tag === "OL" ? `${index + 1}.` : "•"} ${textContent(li).trim()}`);
      if (items.length) parts.push({ type: "text", text: items.join("\n") });
      continue;
    }
    if (tag === "P" || tag === "DIV") {
      const { text, seal: sealKind, runs } = inlineText(el);
      parts.push({ type: "text", text: text || " ", seal: sealKind, runs, align: blockAlign(el) });
      continue;
    }
    if (tag === "BR") {
      parts.push({ type: "text", text: " " });
      continue;
    }
    parts.push(...partsFromNodes(el.childNodes));
  }
  return parts;
}

/** 單一區塊 HTML（p／div／h*）轉成字級 runs 與對齊（證書 PDF 用）。 */
export function parseBlockRuns(blockHtml: string): { runs: TextRun[]; align: TextAlignValue | null; text: string } {
  const root = parseHtml(`<div id="root">${blockHtml}</div>`);
  const el = root.querySelector("#root")?.childNodes.find((node) => node.nodeType === 1) as HTMLElement | undefined;
  if (!el) return { runs: [], align: null, text: "" };
  const { runs } = inlineText(el);
  const cleaned = trimRuns(runs.map((run) => ({ ...run, text: run.text.replace(/\s+/g, " ") })));
  return { runs: cleaned, align: blockAlign(el), text: cleaned.map((run) => run.text).join("").trim() };
}

/** 拆成正文、框線表、立約方獨立頁（供畫面與 PDF）。 */
export function splitContractBody(body: string): ContractBodyPart[] {
  const html = ensureContractHtml(body);
  const root = parseHtml(`<div id="root">${html}</div>`);
  const container = root.querySelector("#root");
  if (!container) return [{ type: "text", text: body }];
  return partsFromNodes(container.childNodes);
}

/** 舊合約若沒有表格標記時的相容入口（已改走 HTML）。 */
export function normalizeContractBody(body: string): string {
  return ensureContractHtml(body);
}

/** 合約效期一年。可續約提醒天數預設 60，後台可改，不改已簽署合約。 */
export const CONTRACT_TERM_DAYS = 365;
export const CONTRACT_RENEWAL_WINDOW_DAYS = 60;

export function contractExpiresAt(signedAtIso: string): Date {
  const start = new Date(signedAtIso);
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + CONTRACT_TERM_DAYS);
  return end;
}

export function daysUntilContractExpiry(signedAtIso: string, now = new Date()): number {
  const ms = contractExpiresAt(signedAtIso).getTime() - now.getTime();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

/** 已簽約、尚未過期，且距離到期日在提醒天數內（含到期當日）。 */
export function isContractRenewalDue(signedAtIso: string | null | undefined, now = new Date(), windowDays = CONTRACT_RENEWAL_WINDOW_DAYS): boolean {
  if (!signedAtIso) return false;
  const days = daysUntilContractExpiry(signedAtIso, now);
  return days >= 0 && days <= windowDays;
}

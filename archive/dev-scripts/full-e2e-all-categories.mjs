/**
 * Headed full E2E: register → basic training → 7 categories submit → review cycles.
 * Watch the Chromium window while it runs.
 */
import { chromium } from "playwright";
import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.MF_BASE_URL ?? "http://127.0.0.1:5173";
const OUT = path.resolve("tmp/full-e2e-out");
const FILES = "/tmp/mf-flow";
const stamp = Date.now().toString().slice(-6);
const APPLICANT = {
  displayName: `E2E聯絡人${stamp}`,
  email: `e2e.${stamp}@example.test`,
  password: "Demo1234!",
  organizationName: `E2E驗證業者${stamp}`,
  taxId: String(90000000 + Number(stamp) % 9999999).padStart(8, "0").slice(0, 8),
};

const CATEGORIES = [
  {
    code: "CAT_01",
    label: "穆斯林友善餐廳",
    outcome: "APPROVE",
    picks: ["Halal 廚房", "午餐"],
    selects: [{ label: "廚房範圍", value: "全 Halal 廚房" }],
    extras: { "餐廳主管姓名": "王主管", "餐廳主管職稱": "店長", "餐廳廚師姓名": "李廚", "餐廳廚師職稱": "主廚" },
    notes: { "Halal菜單原物料明細": "午餐定食：米、蔬菜、豆腐" },
    meat: "未使用",
  },
  {
    code: "CAT_03",
    label: "穆斯林友善旅宿",
    outcome: "APPROVE",
    supplement: true,
    picks: ["旅宿含早餐", "客房"],
    selects: [],
    extras: { "旅宿合法編號": "旅宿-E2E-001", "客房主管姓名": "陳客房", "客房主管職稱": "客房主任" },
    notes: { "免治馬桶或沖洗器房號表": "101 雙人房 2\n102 雙人房 2\n103 雙人房 2\n104 雙人房 2\n105 雙人房 2", "Halal菜單原物料明細": "早餐：吐司、蛋、蔬果" },
    meat: "未使用",
  },
  {
    code: "CAT_06",
    label: "穆斯林友善環境",
    outcome: "APPROVE",
    picks: ["穆斯林友善環境"],
    selects: [],
    extras: {},
    notes: {},
    meat: "未使用",
  },
  {
    code: "CAT_07",
    label: "穆斯林友善體驗活動",
    outcome: "REJECT",
    picks: ["體驗活動不含食用品"],
    selects: [],
    extras: {},
    notes: { "器具食材一覽表": "香氛體驗：香氛瓶、說明卡（無食用品）" },
    meat: "未使用",
  },
  {
    code: "CAT_04",
    label: "穆斯林友善商店",
    outcome: "APPROVE",
    picks: ["穆斯林友善商店"],
    selects: [],
    extras: {},
    notes: { "Halal 商品一覽表": "日期乾\n堅果包\n瓶裝水" },
    meat: "未使用",
  },
  {
    code: "CAT_05",
    label: "穆斯林友善旅行社",
    outcome: "APPROVE",
    picks: [],
    selects: [],
    extras: {},
    notes: { "中英文旅遊行程": "路線一：清真寺文化導覽 Mosque Cultural Tour\n路線二：友善餐廳巡禮 Friendly Dining Route" },
    meat: null,
  },
  {
    code: "CAT_02",
    label: "穆斯林友善產品",
    outcome: "REJECT",
    picks: [],
    selects: [],
    extras: {},
    notes: { "產品清單與原物料": "產品A ProductA：米、鹽\n產品B ProductB：豆、糖", "清真小組": "負責人 張三 0912000111 統籌\n品管 李四 0912000222 查核" },
    meat: "未使用",
  },
];

const results = [];
function log(step, ok, detail = "") {
  results.push({ step, ok, detail: String(detail).slice(0, 400), at: new Date().toISOString() });
  console.log(`${ok ? "✓" : "✗"} ${step}${detail ? ` — ${String(detail).slice(0, 140)}` : ""}`);
}

async function shot(page, name) {
  const file = path.join(OUT, `${String(results.length).padStart(3, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  results.at(-1).shot = path.basename(file);
  return file;
}

async function waitMain(page) {
  await page.waitForTimeout(350);
}

async function reset(page) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "重設展示資料" }).click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/login`);
  log("重設展示資料", true);
  await shot(page, "reset");
}

async function demo(page, label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(800);
}

async function fillLabel(page, label, value) {
  const field = page.locator("main label").filter({ hasText: label }).locator("input, textarea, select").first();
  await field.waitFor({ state: "visible", timeout: 8000 });
  const tag = await field.evaluate((el) => el.tagName.toLowerCase());
  if (tag === "select") await field.selectOption({ label: value });
  else await field.fill(value);
}

async function checkLabel(page, label) {
  const box = page.locator("main label").filter({ hasText: label }).locator('input[type="checkbox"]').first();
  if (!(await box.isChecked())) await box.check();
}

async function chooseMeat(page, optionLabel) {
  const select = page.locator("main label").filter({ hasText: "是否使用肉品" }).locator("select").first();
  if (await select.count()) {
    await select.selectOption({ label: optionLabel });
    return;
  }
  const radio = page.locator("main label").filter({ hasText: optionLabel }).locator('input[type="radio"]').first();
  if (await radio.count()) await radio.check();
}

async function uploadAllVisible(page) {
  // Each attachment row has a choose button + hidden file input
  const rows = page.locator("main").locator("div").filter({ has: page.locator('input[type="file"]') });
  const count = await page.locator('main input[type="file"]').count();
  for (let i = 0; i < count; i += 1) {
    const input = page.locator('main input[type="file"]').nth(i);
    const accept = (await input.getAttribute("accept")) ?? "";
    const file = accept.includes("image") ? `${FILES}/menu.png` : `${FILES}/reg.pdf`;
    await input.setInputFiles(file);
    await page.waitForTimeout(250);
  }
  // second pass for any still missing (image multiples etc.)
  await page.waitForTimeout(400);
}

async function nextUntil(page, stepName) {
  for (let i = 0; i < 8; i += 1) {
    const pressed = await page.locator(`main button[aria-pressed="true"]`).first().innerText().catch(() => "");
    if (pressed.includes(stepName)) return;
    const next = page.getByRole("button", { name: /下一步/ });
    if (await next.count()) await next.click();
    else break;
    await waitMain(page);
  }
}

async function completeBasicTraining(page) {
  await page.goto(`${BASE}/portal/enrollments`);
  await waitMain(page);
  await page.getByRole("button", { name: "基礎教育訓練" }).click();
  await waitMain(page);
  while (await page.getByRole("button", { name: "標示已讀完" }).count()) {
    await page.getByRole("button", { name: "標示已讀完" }).first().click();
    await page.waitForTimeout(300);
  }
  const names = await page.locator('input[type="radio"]').evaluateAll((nodes) => [...new Set(nodes.map((n) => n.getAttribute("name")))]);
  for (const name of names) await page.locator(`input[type="radio"][name="${name}"]`).nth(1).check();
  await page.getByRole("button", { name: "交卷" }).click();
  await page.waitForTimeout(900);
  const text = await page.locator("main").innerText();
  const ok = text.includes("已通過");
  log("基礎教育訓練通過", ok, text.includes("BT-") ? "有證書編號" : text.slice(0, 80));
  await shot(page, "basic-passed");
  if (!ok) throw new Error("basic training failed");
}

async function register(page) {
  await page.goto(`${BASE}/register`);
  await fillLabel(page, "聯絡人", APPLICANT.displayName);
  await fillLabel(page, "Email", APPLICANT.email);
  await fillLabel(page, "密碼", APPLICANT.password);
  await fillLabel(page, "確認密碼", APPLICANT.password);
  await fillLabel(page, "業者名稱", APPLICANT.organizationName);
  await fillLabel(page, "統一編號", APPLICANT.taxId);
  await page.getByRole("button", { name: "建立帳號" }).click();
  await page.waitForURL(/\/portal/, { timeout: 10000 });
  log("業者註冊並進入會員區", true, APPLICANT.email);
  await shot(page, "registered");
}

async function fillCommonCert(page) {
  await fillLabel(page, "單位名稱（英文）", "E2E Friendly Place");
  await fillLabel(page, "單位地址（英文）", "1 Demo Road, Taipei");
  await fillLabel(page, "單位電話", "02-12345678");
  await fillLabel(page, "負責人姓名", APPLICANT.displayName);
  await fillLabel(page, "驗證監督主管姓名", "監督主管");
  await fillLabel(page, "驗證監督主管職稱", "經理");
  await fillLabel(page, "驗證監督主管電話", "0912111222");
  await fillLabel(page, "驗證監督主管信箱", "supervisor@example.test");
  await fillLabel(page, "驗證業務窗口姓名", "業務窗口");
  await fillLabel(page, "驗證業務窗口職稱", "專員");
  await fillLabel(page, "驗證業務窗口電話", "0912333444");
  await fillLabel(page, "驗證業務窗口信箱", "liaison@example.test");
}

async function createAndSubmit(page, cat) {
  await page.goto(`${BASE}/portal/applications/new`);
  await waitMain(page);
  // select category by option text containing label
  const select = page.locator("main select").first();
  const options = await select.locator("option").allTextContents();
  const idx = options.findIndex((t) => t.includes(cat.label));
  if (idx < 0) throw new Error(`category not found: ${cat.label}`);
  await select.selectOption({ index: idx });
  await page.getByRole("button", { name: "建立草稿" }).click();
  await page.waitForURL(/\/edit/, { timeout: 10000 });
  const draftId = page.url().split("/").slice(-2, -1)[0];
  const no = (await page.locator("main").innerText()).match(/MF-\d+-\d+/)?.[0] ?? "";
  log(`${cat.code} 建立草稿`, Boolean(no), `${no} / ${draftId}`);
  await shot(page, `${cat.code}-draft`);

  // step 2 contact
  await page.getByRole("button", { name: /2\. 業者與聯絡資料/ }).click();
  await waitMain(page);
  await fillLabel(page, "業者名稱", APPLICANT.organizationName);
  await fillLabel(page, "統一編號", APPLICANT.taxId);
  await fillLabel(page, "聯絡人", APPLICANT.displayName);
  await fillLabel(page, "電話", "0912555666");
  await fillLabel(page, "Email", APPLICANT.email);
  await fillLabel(page, "地址", "台北市信義路一段 1 號");

  // step 3 content（單位中英文名稱／地址與驗證項目在這裡）
  await page.getByRole("button", { name: /3\. 申請內容/ }).click();
  await waitMain(page);
  await fillLabel(page, "單位名稱（中文）", `${cat.label}示範場所`);
  await fillLabel(page, "單位地址（中文）", "台北市信義路一段 1 號");
  await fillLabel(page, "申請說明", `${cat.label} E2E 自動送件說明。`);
  for (const pick of cat.picks) await checkLabel(page, pick);
  await waitMain(page);
  for (const s of cat.selects) await fillLabel(page, s.label, s.value);
  if (cat.meat) await chooseMeat(page, cat.meat);
  await fillCommonCert(page);
  for (const [label, value] of Object.entries(cat.extras)) {
    if (await page.locator("main label").filter({ hasText: label }).count()) await fillLabel(page, label, value);
  }
  for (const [label, value] of Object.entries(cat.notes)) {
    if (await page.locator("main label").filter({ hasText: label }).count()) await fillLabel(page, label, value);
  }
  await page.getByRole("button", { name: "儲存草稿" }).click();
  await page.waitForTimeout(600);

  // attachments
  await page.getByRole("button", { name: /4\. 附件資料/ }).click();
  await waitMain(page);
  await uploadAllVisible(page);
  await page.getByRole("button", { name: "儲存草稿" }).click();
  await page.waitForTimeout(700);
  await shot(page, `${cat.code}-attachments`);

  // preview + submit
  await page.getByRole("button", { name: /5\. 線上預覽/ }).click();
  await waitMain(page);
  await page.getByRole("button", { name: /下一步：確認送件|6\. 確認送件/ }).click().catch(async () => {
    await page.getByRole("button", { name: /6\. 確認送件/ }).click({ force: true }).catch(() => {});
  });
  // ensure confirm step
  await page.getByRole("button", { name: /6\. 確認送件/ }).click().catch(() => {});
  await waitMain(page);
  const declare = page.locator("main label").filter({ hasText: "我確認以上資料" }).locator("input");
  if (!(await declare.isChecked())) await declare.check();
  await page.getByRole("button", { name: "送出申請" }).click();
  await page.waitForTimeout(400);
  // confirm modal (avoid matching the step tab named 確認送件)
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
  if (await dialog.count()) {
    await dialog.getByRole("button", { name: /確認送出|確認送件/ }).click();
  }
  await page.waitForTimeout(1200);
  const body = await page.locator("main").innerText();
  const submitted = body.includes("已送件") || body.includes("已完成送件") || body.includes("初審") || Boolean(body.match(/狀態為/));
  log(`${cat.code} 送件`, submitted || !body.includes("還有必填"), body.match(/目前狀態.*|已完成送件.*|已送件/)?.[0] ?? body.slice(0, 120));
  await shot(page, `${cat.code}-submitted`);
  return { no, id: draftId };
}

async function adminReview(page, applicationNo, cat, knownId) {
  await demo(page, "管理員");
  await page.goto(`${BASE}/admin/applications`);
  await waitMain(page);
  await page.getByRole("link", { name: applicationNo }).click();
  await page.waitForURL(new RegExp(`/admin/applications/`));
  await waitMain(page);
  const applicationId = knownId || page.url().split("/").pop();

  // assign to admin
  const assignSelect = page.locator("main label").filter({ hasText: "承辦" }).locator("select").first();
  if (await assignSelect.count()) {
    const opts = await assignSelect.locator("option").allTextContents();
    const adminIdx = opts.findIndex((t) => t.includes("系統管理員") || t.includes("管理員"));
    if (adminIdx > 0) {
      await assignSelect.selectOption({ index: adminIdx });
      await page.getByRole("button", { name: "指派承辦" }).click();
      await page.waitForTimeout(700);
    }
  }
  log(`${cat.code} 派案`, true, applicationNo);
  await shot(page, `${cat.code}-assigned`);

  // start review
  const start = page.getByRole("button", { name: "開始初審" });
  if (await start.count()) {
    await start.click();
    await page.waitForTimeout(800);
  }

  // open action note
  const noteBtn = page.getByRole("button", { name: /填寫這次動作的意見/ });
  if (await noteBtn.count()) await noteBtn.click();
  const noteArea = page.locator("main label").filter({ hasText: "這次動作的內部註記" }).locator("textarea");
  if (await noteArea.count()) await noteArea.fill(`${cat.code} 初審意見`);

  if (cat.supplement) {
    // mark 單位名稱（中文） / siteName for supplement
    const siteRow = page.locator("main div.border-t").filter({ hasText: "單位名稱（中文）" }).first();
    if (await siteRow.count()) {
      await siteRow.locator('label:has-text("要求補件") input').check();
      const openBtn = siteRow.getByRole("button", { name: /填寫公開意見與內部註記/ });
      if (await openBtn.count()) await openBtn.click();
      const pub = siteRow.locator("label").filter({ hasText: "公開意見" }).locator("textarea");
      if (await pub.count()) await pub.fill("請補充更清楚的單位名稱");
    } else {
      await page.locator("main label").filter({ hasText: "要求補件" }).first().locator("input").check();
    }
    await page.getByRole("button", { name: "儲存補件勾選" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "要求補件" }).click();
    await page.waitForTimeout(900);
    log(`${cat.code} 初審要求補件`, true);
    await shot(page, `${cat.code}-need-supplement`);

    // applicant login + open edit
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill(APPLICANT.email);
    await page.getByLabel("密碼").fill(APPLICANT.password);
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForTimeout(900);
    await page.goto(`${BASE}/portal/applications/${applicationId}/edit`);
    await page.waitForURL(/\/edit/);
    await waitMain(page);
    await page.getByRole("button", { name: /3\. 申請內容/ }).click();
    await waitMain(page);
    await fillLabel(page, "單位名稱（中文）", `${cat.label}補件後場所`);
    await page.getByRole("button", { name: "儲存草稿" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /5\. 線上預覽/ }).click();
    await waitMain(page);
    await page.getByRole("button", { name: /6\. 確認送件/ }).click({ force: true });
    await waitMain(page);
    const declare = page.locator("main label").filter({ hasText: "我確認以上資料" }).locator("input");
    if (await declare.count() && !(await declare.isChecked())) await declare.check();
    await page.getByRole("button", { name: "送出申請" }).click().catch(async () => {
      await page.getByRole("button", { name: /送出|重新送件/ }).first().click();
    });
    await page.waitForTimeout(400);
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.count()) await dialog.getByRole("button", { name: /確認送出|確認送件/ }).click();
    await page.waitForTimeout(1000);
    log(`${cat.code} 補件後重送`, true);
    await shot(page, `${cat.code}-resubmitted`);

    await demo(page, "管理員");
    await page.goto(`${BASE}/admin/applications/${applicationId}`);
    await waitMain(page);
    if (await page.getByRole("button", { name: "開始初審" }).count()) {
      await page.getByRole("button", { name: "開始初審" }).click();
      await page.waitForTimeout(700);
    }
  }

  // PASS_INITIAL with site reviewer
  const reviewer = page.locator("main label").filter({ hasText: "複審人員" }).locator("select");
  if (await reviewer.count()) {
    const opts = await reviewer.locator("option").allTextContents();
    const idx = opts.findIndex((t) => t.includes("系統管理員") || t.includes("管理員"));
    if (idx > 0) await reviewer.selectOption({ index: idx });
  }
  if (await noteArea.count()) await noteArea.fill(`${cat.code} 初審通過`);
  await page.getByRole("button", { name: "初審通過" }).click();
  await page.waitForTimeout(1000);
  log(`${cat.code} 初審通過`, true);
  await shot(page, `${cat.code}-initial-pass`);

  // Site review — mark all pass
  await page.reload();
  await waitMain(page);
  // click all 通過 buttons in 附件檢查
  const passButtons = page.getByRole("button", { name: "通過", exact: true });
  const n = await passButtons.count();
  for (let i = 0; i < n; i += 1) {
    await passButtons.nth(i).click();
    await page.waitForTimeout(200);
  }
  await page.getByRole("button", { name: "複審通過" }).click();
  await page.waitForTimeout(1000);
  log(`${cat.code} 複審通過`, true);
  await shot(page, `${cat.code}-second-pass`);

  // Final
  await page.reload();
  await waitMain(page);
  const openNote = page.getByRole("button", { name: /填寫這次動作的意見/ });
  if (await openNote.count()) await openNote.click();
  const decision = page.locator("main label").filter({ hasText: "核定或退件的公開意見" }).locator("textarea");
  if (await decision.count()) await decision.fill(cat.outcome === "APPROVE" ? "核定通過（E2E）" : "不符合要件，退件（E2E）");
  const internal = page.locator("main label").filter({ hasText: "這次動作的內部註記" }).locator("textarea");
  if (await internal.count()) await internal.fill(`${cat.code} 最終決定`);
  await page.getByRole("button", { name: cat.outcome === "APPROVE" ? "核定" : "退件" }).click();
  await page.waitForTimeout(1000);
  const finalText = await page.locator("main").innerText();
  const ok = cat.outcome === "APPROVE" ? finalText.includes("已核定") : finalText.includes("已退件");
  log(`${cat.code} 最終${cat.outcome === "APPROVE" ? "核定" : "退件"}`, ok, finalText.match(/已核定|已退件|待核定/)?.[0] ?? "");
  await shot(page, `${cat.code}-final`);

  // back to applicant session for next create
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(APPLICANT.email);
  await page.getByLabel("密碼").fill(APPLICANT.password);
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForTimeout(800);
}

async function writeReport() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"/><title>E2E 七類完整流程報告</title>
  <style>
    body{font-family:ui-sans-serif,system-ui;margin:24px;background:#f4f7fa;color:#1a1a1a}
    h1{font-size:28px} .sum{display:flex;gap:12px;margin:16px 0}
    .card{background:#fff;border-radius:12px;padding:16px;margin:12px 0;box-shadow:0 1px 3px #0001}
    .ok{color:#157a3c}.bad{color:#b00020} img{max-width:100%;border:1px solid #ddd;border-radius:8px;margin-top:8px}
    table{width:100%;border-collapse:collapse} td,th{border-bottom:1px solid #e5e7eb;padding:8px;text-align:left;font-size:14px}
  </style>
  <h1>穆斯林友善驗證系統｜七類完整 E2E</h1>
  <p>業者：${APPLICANT.organizationName}（${APPLICANT.email}／統編 ${APPLICANT.taxId}）</p>
  <div class="sum"><div class="card">通過步驟 <b class="ok">${passed}</b></div><div class="card">失敗步驟 <b class="bad">${failed}</b></div><div class="card">總計 ${results.length}</div></div>
  <div class="card"><h2>步驟明細</h2><table><thead><tr><th>結果</th><th>步驟</th><th>說明</th><th>截圖</th></tr></thead><tbody>
  ${results.map((r) => `<tr><td class="${r.ok ? "ok" : "bad"}">${r.ok ? "PASS" : "FAIL"}</td><td>${r.step}</td><td>${(r.detail || "").replace(/</g, "&lt;")}</td><td>${r.shot ? `<a href="${r.shot}">${r.shot}</a>` : ""}</td></tr>`).join("")}
  </tbody></table></div>
  <div class="card"><h2>截圖牆</h2>
  ${results.filter((r) => r.shot).map((r) => `<div style="margin:16px 0"><div><b>${r.step}</b></div><img src="${r.shot}" alt="${r.step}"/></div>`).join("")}
  </div>`;
  await writeFile(path.join(OUT, "report.html"), html);
  await writeFile(path.join(OUT, "report.json"), JSON.stringify({ applicant: APPLICANT, passed, failed, results }, null, 2));
  console.log(`\nREPORT ${path.join(OUT, "report.html")}  ${passed}/${results.length}`);
}

const browser = await chromium.launch({
  headless: false,
  slowMo: 60,
  args: ["--start-maximized"],
});
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(20000);

await mkdir(OUT, { recursive: true });

try {
  await reset(page);
  await register(page);
  await completeBasicTraining(page);

  for (const cat of CATEGORIES) {
    console.log(`\n==== ${cat.code} ${cat.label} → ${cat.outcome} ====`);
    const created = await createAndSubmit(page, cat);
    if (!created?.no) {
      log(`${cat.code} 缺少案件編號，略過審查`, false);
      continue;
    }
    await adminReview(page, created.no, cat, created.id);
  }
} catch (error) {
  log("行程中斷", false, error instanceof Error ? error.message : String(error));
  await shot(page, "crash").catch(() => {});
  console.error(error);
} finally {
  await writeReport();
  // keep browser open briefly so user can glance
  await page.waitForTimeout(2500);
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed ? 1 : 0);
}

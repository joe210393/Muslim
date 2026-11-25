/**
 * Deep role QA for mock mode at http://127.0.0.1:5173
 * Roles: applicant / officer / admin
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.MF_BASE_URL ?? "http://127.0.0.1:5173";
const OUT = path.resolve("tmp/deep-role-test-out");
const results = [];

function record(role, name, ok, detail = "") {
  results.push({ role, name, ok, detail: String(detail).slice(0, 500) });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark} [${role}] ${name}${detail ? ` — ${String(detail).slice(0, 160)}` : ""}`);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

async function text(page) {
  return page.locator("main").innerText().catch(() => page.locator("body").innerText());
}

async function clickDemo(page, label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(800);
}

async function resetDemo(page) {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "重設展示資料" }).click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/login`);
}

async function expectContains(page, role, name, needles) {
  const body = await text(page);
  const missing = needles.filter((n) => !body.includes(n));
  record(role, name, missing.length === 0, missing.length ? `missing: ${missing.join(" | ")}` : body.slice(0, 120).replace(/\n/g, " "));
  return missing.length === 0;
}

async function safe(role, name, fn) {
  try {
    await fn();
  } catch (error) {
    record(role, name, false, error instanceof Error ? error.message : String(error));
  }
}

async function applicantFlow(page) {
  const role = "業者";

  await safe(role, "登入後總覽顯示基礎課擋關", async () => {
    await clickDemo(page, "業者 applicant01");
    await page.waitForURL(/\/portal/);
    await shot(page, "01-applicant-home-blocked");
    await expectContains(page, role, "總覽提示完成基礎課", ["請先完成基礎教育訓練", "前往基礎教育訓練"]);
  });

  await safe(role, "未過基礎課時新增申請被擋", async () => {
    await page.goto(`${BASE}/portal/applications/new`);
    await page.waitForTimeout(500);
    // session may need demo switch after goto
    if ((await page.locator("body").innerText()).includes("請先")) {
      await clickDemo(page, "業者 applicant01");
      await page.goto(`${BASE}/portal/applications/new`);
      await page.waitForTimeout(500);
    }
    await shot(page, "02-applicant-new-app-blocked");
    const body = await text(page);
    const blocked = body.includes("請先完成基礎教育訓練") || body.includes("前往基礎教育訓練");
    record(role, "新增申請頁擋關或導向", blocked, body.slice(0, 160).replace(/\n/g, " "));
  });

  await safe(role, "基礎課讀完＋測驗通過＋PDF", async () => {
    await page.goto(`${BASE}/portal/enrollments`);
    await page.waitForTimeout(600);
    if ((await page.locator("body").innerText()).includes("請先")) {
      await clickDemo(page, "業者 applicant01");
      await page.goto(`${BASE}/portal/enrollments`);
      await page.waitForTimeout(600);
    }
    await page.getByRole("button", { name: "基礎教育訓練" }).click();
    const markButtons = page.getByRole("button", { name: "標示已讀完" });
    const count = await markButtons.count();
    for (let i = 0; i < count; i += 1) {
      await markButtons.nth(0).click();
      await page.waitForTimeout(400);
    }
    await expectContains(page, role, "可參加測驗", ["可參加測驗", "基礎測驗"]);
    // answer all questions with option index 1
    const groups = await page.locator('input[type="radio"]').evaluateAll((nodes) => {
      const map = new Map();
      for (const node of nodes) {
        const name = node.getAttribute("name") ?? "";
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(node);
      }
      return [...map.keys()];
    });
    for (const name of groups) {
      await page.locator(`input[type="radio"][name="${name}"]`).nth(1).check();
    }
    await page.getByRole("button", { name: "交卷" }).click();
    await page.waitForTimeout(800);
    await shot(page, "03-applicant-basic-passed");
    await expectContains(page, role, "測驗通過並可下載證書", ["已通過", "下載基礎課證書", "BT-"]);
    // download certificate
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
      page.getByRole("button", { name: /下載基礎課證書/ }).click(),
    ]);
    record(role, "基礎課 PDF 下載觸發", Boolean(download), download ? await download.suggestedFilename() : "no download event");
  });

  await safe(role, "通過後可建立驗證申請草稿", async () => {
    await page.goto(`${BASE}/portal/applications/new`);
    await page.waitForTimeout(500);
    await expectContains(page, role, "新增申請可選類別", ["申請類別", "建立草稿"]);
    await page.locator("select").first().selectOption({ index: 1 });
    await page.getByRole("button", { name: "建立草稿" }).click();
    await page.waitForURL(/\/portal\/applications\/.+\/edit/, { timeout: 8000 });
    await shot(page, "04-applicant-draft-created");
    await expectContains(page, role, "進入草稿編輯", ["案件 MF-", "儲存草稿"]);
  });

  await safe(role, "專班人數不足被擋", async () => {
    await page.goto(`${BASE}/portal/enrollments`);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "申請專班" }).click();
    await page.getByLabel(/預計人數/).fill("10");
    await page.getByLabel(/希望開始日/).fill("2026-12-20");
    await page.getByLabel(/希望結束日/).fill("2026-12-21");
    await page.getByLabel(/希望地點/).fill("台北測試教室");
    await page.getByRole("button", { name: "儲存並送出" }).click();
    await page.waitForTimeout(500);
    await shot(page, "05-applicant-company-too-few");
    await expectContains(page, role, "專班不足 20 人錯誤", ["至少需要 20 人"]);
  });

  await safe(role, "專班滿 20 可送出", async () => {
    await page.getByLabel(/預計人數/).fill("20");
    await page.getByRole("button", { name: "儲存並送出" }).click();
    await page.waitForTimeout(700);
    await shot(page, "06-applicant-company-submitted");
    await expectContains(page, role, "專班已送出待審核", ["已送出專班申請", "待審核", "20 人"]);
  });

  await safe(role, "一般課學習列表可見", async () => {
    await page.getByRole("button", { name: "線上／線下課程" }).click();
    await page.waitForTimeout(500);
    await shot(page, "07-applicant-general-courses");
    const body = await text(page);
    const ok = body.includes("課程名稱") || body.includes("學習狀態") || body.includes("沒有符合的課程") || body.includes("已結束示範課程");
    record(role, "一般課分頁可開啟", ok, body.slice(0, 160).replace(/\n/g, " "));
  });

  await safe(role, "合約／證書／資料頁可開", async () => {
    for (const [pathName, titleHint] of [
      ["/portal/contracts", "合約"],
      ["/portal/certifications", "證書"],
      ["/portal/profile", "業者"],
    ]) {
      await page.goto(`${BASE}${pathName}`);
      await page.waitForTimeout(400);
      const body = await text(page);
      record(role, `開啟 ${pathName}`, !body.includes("請先") && body.length > 20, body.slice(0, 100).replace(/\n/g, " "));
    }
  });
}

async function adminFlow(page) {
  const role = "管理員";
  await safe(role, "切換管理員進教育訓練中心", async () => {
    await clickDemo(page, "管理員");
    await page.waitForTimeout(600);
    await page.goto(`${BASE}/admin/courses`);
    await page.waitForTimeout(700);
    await shot(page, "10-admin-training-hub");
    await expectContains(page, role, "教育訓練中心五區塊", ["教育訓練", "課程梯次", "基礎課與題庫", "門檻設定", "專班申請", "一般課證書"]);
  });

  await safe(role, "門檻設定可讀寫", async () => {
    await page.getByRole("tab", { name: "門檻設定" }).click();
    await page.waitForTimeout(400);
    const passInput = page.getByLabel(/基礎課及格分數/);
    const minInput = page.getByLabel(/專班最低人數/);
    const passVal = await passInput.inputValue();
    const minVal = await minInput.inputValue();
    record(role, "門檻預設值", passVal === "80" && minVal === "20", `pass=${passVal} min=${minVal}`);
    await passInput.fill("85");
    await minInput.fill("15");
    await page.getByRole("button", { name: "儲存" }).click();
    await page.waitForTimeout(600);
    await shot(page, "11-admin-policy-saved");
    await expectContains(page, role, "門檻儲存成功", ["已儲存門檻"]);
    // restore defaults for later company min checks consistency
    await passInput.fill("80");
    await minInput.fill("20");
    await page.getByRole("button", { name: "儲存" }).click();
    await page.waitForTimeout(500);
  });

  await safe(role, "基礎課與題庫可見示範模組", async () => {
    await page.getByRole("tab", { name: "基礎課與題庫" }).click();
    await page.waitForTimeout(400);
    await shot(page, "12-admin-basic-modules");
    await expectContains(page, role, "示範模組列表", ["穆斯林友善與 Halal 基礎概念", "申請與現場複審流程概要", "新增模組"]);
  });

  await safe(role, "專班申請可核准", async () => {
    await page.getByRole("tab", { name: "專班申請" }).click();
    await page.waitForTimeout(500);
    await shot(page, "13-admin-company-queue");
    const body = await text(page);
    if (body.includes("沒有專班申請")) {
      record(role, "專班佇列有待審件", false, "佇列空白（可能業者流程未留下或狀態被重設）");
      return;
    }
    await expectContains(page, role, "看到待審專班", ["待審核", "20 人"]);
    await page.getByLabel(/管理員意見/).fill("深度測試核准");
    await page.getByRole("button", { name: "核准" }).click();
    await page.waitForTimeout(600);
    await shot(page, "14-admin-company-approved");
    await expectContains(page, role, "專班已核准", ["已核准", "深度測試核准"]);
  });

  await safe(role, "一般課證書人工登錄", async () => {
    await page.getByRole("tab", { name: "一般課證書" }).click();
    await page.waitForTimeout(400);
    const courseSelect = page.getByLabel(/^課程$/);
    await courseSelect.selectOption({ index: 1 });
    await page.waitForTimeout(900);
    const student = page.getByLabel(/完課學員/);
    const options = await student.locator("option").allTextContents();
    const pickIndex = options.findIndex((o) => o && !o.includes("選擇") && o.trim());
    if (pickIndex < 0) {
      record(role, "有完課學員可登錄", false, `options=${options.join(",")}`);
      return;
    }
    await student.selectOption({ index: pickIndex });
    await page.getByLabel(/證書編號/).fill("TR-QA-9001");
    await page.getByLabel(/核發日/).fill("2026-11-01");
    await page.getByLabel(/到期日/).fill("2027-11-01");
    await page.getByRole("button", { name: "登錄證書" }).click();
    await page.waitForTimeout(700);
    await shot(page, "15-admin-manual-cert");
    await expectContains(page, role, "人工證書登錄成功", ["已登錄訓練證書"]);
  });

  await safe(role, "課程梯次列表", async () => {
    await page.getByRole("tab", { name: "課程梯次" }).click();
    await page.waitForTimeout(400);
    await shot(page, "16-admin-courses");
    await expectContains(page, role, "課程梯次有示範課", ["新增課程", "已結束示範課程"]);
  });

  await safe(role, "案件審查／會員／員工頁可開", async () => {
    for (const href of ["/admin/applications", "/admin/organizations", "/admin/permissions", "/admin/reports"]) {
      await page.goto(`${BASE}${href}`);
      await page.waitForTimeout(400);
      const body = await text(page);
      record(role, `開啟 ${href}`, !body.includes("請先") && body.length > 30, body.slice(0, 100).replace(/\n/g, " "));
    }
  });
}

async function officerFlow(page) {
  const role = "承辦";
  await safe(role, "切換承辦人", async () => {
    await page.goto(`${BASE}/login`);
    await clickDemo(page, "承辦人林示範");
    await page.waitForTimeout(700);
    await shot(page, "20-officer-home");
    const body = await text(page);
    record(role, "進入後台總覽", body.includes("工作總覽") || body.includes("待派案") || body.includes("初審"), body.slice(0, 140).replace(/\n/g, " "));
  });

  await safe(role, "教育訓練管理可進入", async () => {
    await page.goto(`${BASE}/admin/courses`);
    await page.waitForTimeout(700);
    const body = await text(page);
    const allowed = body.includes("教育訓練") && body.includes("課程梯次");
    const forbidden = body.includes("沒有權限") || body.includes("請先");
    record(role, "承辦可開教育訓練（training.manage）", allowed && !forbidden, body.slice(0, 160).replace(/\n/g, " "));
    await shot(page, "21-officer-training");
  });

  await safe(role, "門檻與專班頁可讀", async () => {
    await page.getByRole("tab", { name: "門檻設定" }).click().catch(() => null);
    await page.waitForTimeout(400);
    let body = await text(page);
    record(role, "承辦可見門檻設定", body.includes("及格") || body.includes("專班最低"), body.slice(0, 120).replace(/\n/g, " "));
    await page.getByRole("tab", { name: "專班申請" }).click().catch(() => null);
    await page.waitForTimeout(400);
    body = await text(page);
    record(role, "承辦可見專班申請", body.includes("專班") || body.includes("沒有專班申請") || body.includes("已核准"), body.slice(0, 120).replace(/\n/g, " "));
  });

  await safe(role, "案件審查可開", async () => {
    await page.goto(`${BASE}/admin/applications`);
    await page.waitForTimeout(500);
    const body = await text(page);
    record(role, "承辦案件清單", body.includes("案件") || body.includes("申請") || body.includes("沒有"), body.slice(0, 120).replace(/\n/g, " "));
  });
}

async function applicantSeesManualCert(page) {
  const role = "業者";
  await safe(role, "學習列表顯示人工證書編號", async () => {
    await clickDemo(page, "業者 applicant01");
    await page.goto(`${BASE}/portal/enrollments`);
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "線上／線下課程" }).click();
    await page.waitForTimeout(500);
    await shot(page, "08-applicant-sees-manual-cert");
    const body = await text(page);
    record(role, "可見 TR-QA-9001", body.includes("TR-QA-9001"), body.slice(0, 200).replace(/\n/g, " "));
  });
}

async function negativeQuiz(page) {
  const role = "業者";
  await safe(role, "未讀完不能交卷（狀態檢查）", async () => {
    await page.goto(`${BASE}/portal/enrollments`);
    await page.waitForTimeout(400);
    await page.getByRole("button", { name: "基礎教育訓練" }).click();
    const body = await text(page);
    const noQuiz = !body.includes("交卷") && body.includes("已通過");
    record(role, "通過後不再顯示交卷", noQuiz, body.slice(0, 120).replace(/\n/g, " "));
  });
}

async function deeperApplicant(page) {
  const role = "業者";
  await safe(role, "草稿編輯六步驟可見", async () => {
    await clickDemo(page, "業者 applicant01");
    await page.goto(`${BASE}/portal/applications`);
    await page.waitForTimeout(500);
    const edit = page.getByRole("link", { name: /編輯|繼續/ }).first();
    if (await edit.count()) {
      await edit.click();
    } else {
      await page.goto(`${BASE}/portal/applications/new`);
      await page.locator("select").first().selectOption({ index: 1 });
      await page.getByRole("button", { name: "建立草稿" }).click();
      await page.waitForURL(/\/edit/);
    }
    await page.waitForTimeout(500);
    await shot(page, "30-applicant-draft-steps");
    await expectContains(page, role, "草稿六步驟", ["1. 申請類別", "2. 業者與聯絡資料", "3. 申請內容", "4. 附件資料", "5. 線上預覽", "6. 確認送件"]);
  });

  await safe(role, "公開課程報名頁可開", async () => {
    await page.goto(`${BASE}/courses`);
    await page.waitForTimeout(500);
    await shot(page, "31-public-courses");
    const body = await page.locator("body").innerText();
    record(role, "公開教育訓練列表", body.includes("教育訓練") || body.includes("課程"), body.slice(0, 120).replace(/\n/g, " "));
  });

  await safe(role, "公開課點進詳情並嘗試報名", async () => {
    await page.goto(`${BASE}/courses`);
    await page.waitForTimeout(400);
    const link = page.getByRole("link").filter({ hasText: /廚房入門|接待禮儀|示範/ }).first();
    if (!(await link.count())) {
      record(role, "找到可點的公開課", false, "no course link");
      return;
    }
    await link.click();
    await page.waitForTimeout(600);
    await shot(page, "32-course-detail");
    const body = await text(page);
    const hasEnroll = await page.getByRole("button", { name: /報名/ }).count();
    if (hasEnroll) {
      await page.getByRole("button", { name: /報名/ }).first().click();
      await page.waitForTimeout(700);
      const after = await text(page);
      record(role, "公開課報名操作", true, after.slice(0, 160).replace(/\n/g, " "));
    } else {
      record(role, "公開課詳情可開（無報名鈕或已額滿）", body.length > 40, body.slice(0, 160).replace(/\n/g, " "));
    }
  });
}

async function deeperAdmin(page) {
  const role = "管理員";
  await safe(role, "編輯基礎模組可開啟表單", async () => {
    await clickDemo(page, "管理員");
    await page.goto(`${BASE}/admin/courses?tab=basic`);
    await page.waitForTimeout(600);
    await page.getByRole("button", { name: "編輯" }).first().click();
    await page.waitForTimeout(400);
    await shot(page, "40-admin-edit-module");
    await expectContains(page, role, "模組編輯表單", ["編輯基礎模組", "標題", "內容", "儲存模組"]);
  });

  await safe(role, "新增課程頁可開", async () => {
    await page.goto(`${BASE}/admin/courses/new`);
    await page.waitForTimeout(500);
    await shot(page, "41-admin-new-course");
    const body = await text(page);
    record(role, "新增課程表單", body.includes("課程") || body.includes("名額") || body.includes("儲存"), body.slice(0, 140).replace(/\n/g, " "));
  });

  await safe(role, "內容管理首頁可開", async () => {
    await page.goto(`${BASE}/admin/content`);
    await page.waitForTimeout(500);
    const body = await text(page);
    // may redirect to a hub
    record(role, "內容管理入口", !body.includes("請先") && body.length > 20, body.slice(0, 120).replace(/\n/g, " "));
  });
}

async function wrongAnswerThenPass(page) {
  const role = "業者";
  await safe(role, "另一業者帳號：答錯後再通過", async () => {
    // Use applicant02 if exists via login form
    await page.goto(`${BASE}/login`);
    await page.getByLabel("Email").fill("applicant02@example.test");
    await page.getByLabel("密碼").fill("Demo1234!");
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForTimeout(900);
    const body = await page.locator("body").innerText();
    if (body.includes("不正確") || body.includes("失敗") || !body.includes("portal") && page.url().includes("/login")) {
      // try navigating after possible success
      if (!page.url().includes("/portal")) {
        record(role, "applicant02 可登入", false, body.slice(0, 120).replace(/\n/g, " "));
        return;
      }
    }
    await page.goto(`${BASE}/portal/enrollments`);
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "基礎教育訓練" }).click();
    const marks = page.getByRole("button", { name: "標示已讀完" });
    while (await marks.count()) {
      await marks.first().click();
      await page.waitForTimeout(350);
    }
    // wrong answers (index 0)
    const names = await page.locator('input[type="radio"]').evaluateAll((nodes) => [...new Set(nodes.map((n) => n.getAttribute("name")))]);
    for (const name of names) await page.locator(`input[type="radio"][name="${name}"]`).nth(0).check();
    await page.getByRole("button", { name: "交卷" }).click();
    await page.waitForTimeout(700);
    let t = await text(page);
    const failed = t.includes("尚未及格") || t.includes("再試");
    record(role, "答錯顯示未及格", failed, t.slice(0, 140).replace(/\n/g, " "));
    // correct answers
    for (const name of names) await page.locator(`input[type="radio"][name="${name}"]`).nth(1).check();
    if (await page.getByRole("button", { name: "交卷" }).count()) {
      await page.getByRole("button", { name: "交卷" }).click();
      await page.waitForTimeout(800);
    }
    t = await text(page);
    record(role, "applicant02 再考通過", t.includes("已通過") || t.includes("測驗通過"), t.slice(0, 140).replace(/\n/g, " "));
    await shot(page, "50-applicant02-pass");
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(15000);

await mkdir(OUT, { recursive: true });

try {
  await resetDemo(page);
  record("系統", "重設展示資料", true, "ok");
  await applicantFlow(page);
  await adminFlow(page);
  await applicantSeesManualCert(page);
  await deeperApplicant(page);
  await deeperAdmin(page);
  await officerFlow(page);
  await negativeQuiz(page);
  await wrongAnswerThenPass(page);
} catch (error) {
  record("系統", "測試行程中斷", false, error instanceof Error ? error.message : String(error));
  await shot(page, "99-crash").catch(() => undefined);
} finally {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const summary = { base: BASE, passed, failed, total: results.length, results };
  await writeFile(path.join(OUT, "report.json"), JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY ${passed}/${results.length} passed, ${failed} failed`);
  console.log(`Report: ${path.join(OUT, "report.json")}`);
  await browser.close();
  process.exit(failed > 0 ? 1 : 0);
}

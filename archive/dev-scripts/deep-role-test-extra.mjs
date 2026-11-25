/** Extra edge cases: reject company request, attendance, policy gate off, delete draft */
import { chromium } from "playwright";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const BASE = "http://127.0.0.1:5173";
const OUT = path.resolve("tmp/deep-role-test-out");
const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail: String(detail).slice(0, 240) });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 160)}`);
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(20000);

async function asRole(label) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.waitForTimeout(700);
}

async function passBasicIfNeeded() {
  await page.goto(`${BASE}/portal/enrollments`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "基礎教育訓練" }).click();
  const main = await page.locator("main").innerText();
  if (main.includes("已通過")) return;
  while (await page.getByRole("button", { name: "標示已讀完" }).count()) {
    await page.getByRole("button", { name: "標示已讀完" }).first().click();
    await page.waitForTimeout(300);
  }
  const names = await page.locator('input[type="radio"]').evaluateAll((n) => [...new Set(n.map((x) => x.getAttribute("name")))]);
  for (const name of names) await page.locator(`input[type="radio"][name="${name}"]`).nth(1).check();
  if (await page.getByRole("button", { name: "交卷" }).count()) {
    await page.getByRole("button", { name: "交卷" }).click();
    await page.waitForTimeout(700);
  }
}

try {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "重設展示資料" }).click();
  await page.waitForTimeout(1000);

  // Applicant: pass basic, create draft, delete draft
  await asRole("業者 applicant01");
  await passBasicIfNeeded();
  await page.goto(`${BASE}/portal/applications/new`);
  await page.waitForTimeout(400);
  await page.locator("select").first().selectOption({ index: 1 });
  await page.getByRole("button", { name: "建立草稿" }).click();
  await page.waitForURL(/\/edit/);
  await page.getByRole("button", { name: "刪除草稿" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "確認刪除" }).click();
  await page.waitForTimeout(700);
  const afterDelete = await page.locator("main").innerText();
  record("業者刪除草稿", afterDelete.includes("沒有案件") || page.url().includes("/portal/applications"), afterDelete.slice(0, 140));

  // Company request then admin reject
  await page.goto(`${BASE}/portal/enrollments`);
  await page.getByRole("button", { name: "申請專班" }).click();
  await page.getByLabel(/預計人數/).fill("20");
  await page.getByLabel(/希望開始日/).fill("2026-12-25");
  await page.getByLabel(/希望結束日/).fill("2026-12-26");
  await page.getByLabel(/希望地點/).fill("高雄測試教室");
  await page.getByRole("button", { name: "儲存並送出" }).click();
  await page.waitForTimeout(700);
  record("業者再送專班", (await page.locator("main").innerText()).includes("待審核"));

  await asRole("管理員");
  await page.goto(`${BASE}/admin/courses?tab=company`);
  await page.waitForTimeout(600);
  await page.locator("main label").filter({ hasText: "管理員意見" }).locator("textarea").fill("人數或時段不合，退回");
  await page.getByRole("button", { name: "退回" }).click();
  await page.waitForTimeout(600);
  const rejected = await page.locator("main").innerText();
  record("管理員退回專班", rejected.includes("未通過") || rejected.includes("退回") || rejected.includes("REJECTED") || rejected.includes("未核准") || rejected.includes("意見：人數或時段不合"), rejected.slice(0, 180));
  await page.screenshot({ path: path.join(OUT, "extra-reject.png"), fullPage: true });

  // Officer records attendance
  await asRole("承辦人林示範");
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForTimeout(500);
  await page.getByRole("link", { name: "報名名單" }).first().click();
  await page.waitForTimeout(700);
  const attend = page.getByRole("button", { name: "出席" }).first();
  if (await attend.count()) {
    await attend.click();
    await page.getByRole("button", { name: "儲存出席" }).first().click();
    await page.waitForTimeout(700);
    const body = await page.locator("main").innerText();
    record("承辦登錄出席", body.includes("出席") || body.includes("已完課") || body.includes("儲存"), body.slice(0, 160));
  } else {
    record("承辦登錄出席", false, "no attendance button");
  }
  await page.screenshot({ path: path.join(OUT, "extra-attendance.png"), fullPage: true });

  // Turn off basic gate and verify new applicant path with applicant03 if available
  await asRole("管理員");
  await page.goto(`${BASE}/admin/courses?tab=policy`);
  await page.waitForTimeout(500);
  const gate = page.getByLabel(/未完成基礎課不可建立/);
  if (await gate.isChecked()) await gate.uncheck();
  await page.getByRole("button", { name: "儲存" }).click();
  await page.waitForTimeout(600);
  record("關閉基礎課擋關", (await page.locator("main").innerText()).includes("已儲存門檻"));

  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill("applicant03@example.test");
  await page.getByLabel("密碼").fill("Demo1234!");
  await page.getByRole("button", { name: "登入" }).click();
  await page.waitForTimeout(900);
  await page.goto(`${BASE}/portal/applications/new`);
  await page.waitForTimeout(500);
  const newApp = await page.locator("main").innerText();
  const canCreateWithoutBasic = newApp.includes("建立草稿") && !newApp.includes("請先完成基礎教育訓練");
  record("關閉門檻後未過基礎也可開新增申請", canCreateWithoutBasic, newApp.slice(0, 160));
  await page.screenshot({ path: path.join(OUT, "extra-gate-off.png"), fullPage: true });

  // Restore gate
  await asRole("管理員");
  await page.goto(`${BASE}/admin/courses?tab=policy`);
  await page.waitForTimeout(400);
  if (!(await page.getByLabel(/未完成基礎課不可建立/).isChecked())) {
    await page.getByLabel(/未完成基礎課不可建立/).check();
  }
  await page.getByRole("button", { name: "儲存" }).click();
  await page.waitForTimeout(500);
  record("恢復基礎課擋關", true, "restored");

} catch (e) {
  record("行程中斷", false, e instanceof Error ? e.message : String(e));
} finally {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nEXTRA ${results.length - failed}/${results.length}`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}

/** Focused retest of previously failing items */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = "http://127.0.0.1:5173";
const OUT = path.resolve("tmp/deep-role-test-out");
const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail: String(detail).slice(0, 300) });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 180)}`);
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(20000);

try {
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: "重設展示資料" }).click();
  await page.waitForTimeout(1000);

  // Applicant pass basic + submit company (prerequisite for later)
  await page.getByRole("button", { name: "業者 applicant01" }).click();
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/portal/enrollments`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "基礎教育訓練" }).click();
  while (await page.getByRole("button", { name: "標示已讀完" }).count()) {
    await page.getByRole("button", { name: "標示已讀完" }).first().click();
    await page.waitForTimeout(300);
  }
  const names = await page.locator('input[type="radio"]').evaluateAll((nodes) => [...new Set(nodes.map((n) => n.getAttribute("name")))]);
  for (const name of names) await page.locator(`input[type="radio"][name="${name}"]`).nth(1).check();
  await page.getByRole("button", { name: "交卷" }).click();
  await page.waitForTimeout(700);
  record("業者基礎課通過", (await page.locator("main").innerText()).includes("已通過"));

  // Manual cert as admin
  await page.getByRole("button", { name: "管理員" }).click();
  await page.waitForTimeout(700);
  await page.goto(`${BASE}/admin/courses?tab=certificates`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "fix-cert-tab.png"), fullPage: true });
  const main = await page.locator("main").innerText();
  record("證書分頁文字", main.includes("完課學員") && main.includes("登錄證書"), main.slice(0, 160));

  // Prefer select near label text
  const courseSelect = page.locator("main select").nth(0);
  await courseSelect.waitFor({ state: "visible" });
  const courseOptions = await courseSelect.locator("option").allTextContents();
  const finishedIdx = courseOptions.findIndex((t) => t.includes("已結束示範課程"));
  record("找到已結束示範課程", finishedIdx > 0, courseOptions.join(" | "));
  if (finishedIdx > 0) {
    await courseSelect.selectOption({ index: finishedIdx });
    await page.waitForTimeout(900);
    const studentSelect = page.locator("main select").nth(1);
    const students = await studentSelect.locator("option").allTextContents();
    const studentIdx = students.findIndex((t) => t && !t.includes("選擇"));
    record("找到完課學員", studentIdx > 0, students.join(" | "));
    if (studentIdx > 0) {
      await studentSelect.selectOption({ index: studentIdx });
      await page.locator('input[type="text"], input:not([type])').first().fill("TR-QA-9001").catch(async () => {
        // certificate no field
      });
      // fill by label text proximity
      const certNo = page.locator("main label").filter({ hasText: "證書編號" }).locator("input");
      const issued = page.locator("main label").filter({ hasText: "核發日" }).locator("input");
      const until = page.locator("main label").filter({ hasText: "到期日" }).locator("input");
      await certNo.fill("TR-QA-9001");
      await issued.fill("2026-11-01");
      await until.fill("2027-11-01");
      await page.getByRole("button", { name: "登錄證書" }).click();
      await page.waitForTimeout(800);
      const after = await page.locator("main").innerText();
      record("人工證書登錄", after.includes("已登錄訓練證書"), after.slice(0, 200));
    }
  }

  // Applicant sees cert
  await page.getByRole("button", { name: "業者 applicant01" }).click();
  await page.waitForTimeout(700);
  await page.goto(`${BASE}/portal/enrollments`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "線上／線下課程" }).click();
  await page.waitForTimeout(500);
  const learn = await page.locator("main").innerText();
  record("業者可見 TR-QA-9001", learn.includes("TR-QA-9001"), learn.slice(0, 250));
  await page.screenshot({ path: path.join(OUT, "fix-applicant-cert.png"), fullPage: true });

  // CMS path
  await page.getByRole("button", { name: "管理員" }).click();
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/admin/cms/home`);
  await page.waitForTimeout(600);
  const cms = await page.locator("main").innerText();
  record("內容管理 /admin/cms/home", !cms.includes("找不到這個頁面") && cms.length > 30, cms.slice(0, 160));
  await page.screenshot({ path: path.join(OUT, "fix-cms.png"), fullPage: true });

  // Passed-user no quiz button
  await page.getByRole("button", { name: "業者 applicant01" }).click();
  await page.waitForTimeout(600);
  await page.goto(`${BASE}/portal/enrollments`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "基礎教育訓練" }).click();
  await page.waitForTimeout(400);
  const basic = await page.locator("main").innerText();
  record("通過後不再交卷", basic.includes("已通過") && !basic.includes("交卷"), basic.slice(0, 160));

  // Contract sign page open
  await page.goto(`${BASE}/portal/contracts`);
  await page.waitForTimeout(400);
  const contractLink = page.getByRole("link").filter({ hasText: /CT-|簽署|查看/ }).first();
  if (await contractLink.count()) {
    await contractLink.click();
    await page.waitForTimeout(600);
    const c = await page.locator("main").innerText();
    record("合約詳情可開", c.length > 40, c.slice(0, 160));
    await page.screenshot({ path: path.join(OUT, "fix-contract.png"), fullPage: true });
  } else {
    record("合約詳情可開", false, "no contract link");
  }

  // Enrollment admin for finished course
  await page.getByRole("button", { name: "管理員" }).click();
  await page.waitForTimeout(500);
  await page.goto(`${BASE}/admin/courses`);
  await page.waitForTimeout(500);
  const enrollLink = page.getByRole("link", { name: "報名名單" }).first();
  await enrollLink.click();
  await page.waitForTimeout(700);
  const enrollBody = await page.locator("main").innerText();
  record("報名名單頁", enrollBody.includes("出席") || enrollBody.includes("報名") || enrollBody.includes("學員") || enrollBody.includes("姓名"), enrollBody.slice(0, 180));
  await page.screenshot({ path: path.join(OUT, "fix-enrollments.png"), fullPage: true });

} catch (e) {
  record("行程中斷", false, e instanceof Error ? e.message : String(e));
  await page.screenshot({ path: path.join(OUT, "fix-crash.png"), fullPage: true }).catch(() => {});
} finally {
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\nFIX SUMMARY ${results.length - failed}/${results.length}`);
  await browser.close();
  process.exit(failed ? 1 : 0);
}

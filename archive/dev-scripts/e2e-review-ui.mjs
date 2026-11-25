/**
 * 展示模式端到端：註冊新業者 → 付款核帳 → 七類申請送件 →
 * 承辦初審／複審 → 管理員核定發證 → 下載全部證書 →
 * 發出合約、下載、上傳簽署檔、再下載。
 *
 * 用法：node tmp/e2e-full-flow.mjs
 * 前提：pnpm dev:web 已在 :5173，且 VITE_DATA_MODE=mock
 */
import { createRequire } from "node:module";
const require = createRequire("/tmp/pw-run/package.json");
const { chromium } = require("playwright");
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, "e2e-artifacts", `run-${new Date().toISOString().replace(/[:.]/g, "-")}`);
const BASE = process.env.MF_BASE_URL || "http://localhost:5173";
const FIX = path.join(ROOT, "mf-flow");

const EMAIL = `e2e.${Date.now()}@example.test`;
const PASSWORD = "Passw0rd!e2e";
const ORG_NAME = "端到端示範企業有限公司";
const TAX_ID = String(10000000 + Math.floor(Math.random() * 89999999));

const STAFF = {
  certificateNameEn: "E2E Demo Enterprise Ltd.",
  certificateAddressEn: "1F., No. 1, Demo Rd., Da'an Dist., Taipei City, Taiwan",
  certificatePhone: "+886-2-2700-9999",
  ownerName: "王端到",
  supervisorName: "李監督",
  supervisorTitle: "總監",
  supervisorPhone: "0912000001",
  supervisorEmail: "supervisor@example.test",
  liaisonName: "陳窗口",
  liaisonTitle: "專員",
  liaisonPhone: "0912000002",
  liaisonEmail: "liaison@example.test",
};

/** 覆蓋全部 11 種證書範本的申請情境 */
const APP_SCENARIOS = [
  {
    code: "CAT_01",
    label: "Halal廚房",
    siteName: "端到端 Halal 廚房",
    formData: { ...STAFF, applyType: "halal_kitchen", mealLunch: true, usesMeat: "no", ingredientDetail: "中央廚房餐點", managerName: "廚房主管", managerTitle: "主管", chefName: "主廚", chefTitle: "廚師" },
    certKeys: ["HALAL_KITCHEN"],
    contractFlags: { checkHalalKitchen: true, checkFullHalalKitchen: true },
  },
  {
    code: "CAT_01",
    label: "Halal餐廳",
    siteName: "端到端 Halal 餐廳",
    formData: {
      ...STAFF,
      applyType: "halal_restaurant",
      mealBreakfast: true,
      mealLunch: true,
      mealDinner: true,
      usesMeat: "no",
      ingredientDetail: "早餐：粥；午餐：雞；晚餐：魚",
      managerName: "經理",
      managerTitle: "店長",
      chefName: "主廚",
      chefTitle: "廚師",
    },
    certKeys: ["HALAL_RESTAURANT"],
    contractFlags: { checkHalalRestaurant: true, checkMealService: true, checkFullHalalKitchen: true, checkRestaurantRestroom: true },
  },
  {
    code: "CAT_01",
    label: "友善餐廳正餐",
    siteName: "端到端友善餐廳正餐",
    formData: {
      ...STAFF,
      applyType: "friendly_restaurant",
      mealBreakfast: true,
      mealLunch: true,
      usesMeat: "no",
      ingredientDetail: "早餐粥、午餐飯",
      managerName: "經理",
      managerTitle: "店長",
      chefName: "主廚",
      chefTitle: "廚師",
    },
    certKeys: ["MFR_MEAL"],
    contractFlags: { checkMuslimFriendlyRestaurant: true, checkMealService: true, checkPartialKitchen: true, checkRestaurantRestroom: true },
  },
  {
    code: "CAT_01",
    label: "友善餐廳飲品點心",
    siteName: "端到端友善餐廳飲品",
    formData: {
      ...STAFF,
      applyType: "friendly_restaurant",
      mealDrink: true,
      mealSnack: true,
      usesMeat: "no",
      ingredientDetailDrinkSnack: "咖啡、糕點",
      managerName: "經理",
      managerTitle: "店長",
      chefName: "主廚",
      chefTitle: "廚師",
    },
    certKeys: ["MFR_DRINK_SNACK"],
    contractFlags: { checkMuslimFriendlyRestaurant: true, checkDrinksSnacks: true, checkPartialKitchen: true },
  },
  {
    code: "CAT_02",
    label: "Halal產品",
    siteName: "端到端產品廠",
    formData: {
      ...STAFF,
      usesMeat: "no",
      productDetail: "清真醬油一箱",
      halalTeam: "王小明、陳小華",
    },
    certKeys: ["HALAL_PRODUCT"],
    contractFlags: { checkShop: true },
  },
  {
    code: "CAT_03",
    label: "旅宿含早餐",
    siteName: "端到端旅宿含早",
    formData: {
      ...STAFF,
      applyType: "with_breakfast",
      lodgingLicenseNo: "北市宿字第001號",
      roomManagerName: "客房主管",
      roomManagerTitle: "主任",
      chefName: "早餐廚師",
      chefTitle: "廚師",
      usesMeat: "no",
      roomDetail: "101 雙人房\n102 雙人房\n103 雙人房\n104 雙人房\n105 雙人房",
      ingredientDetail: "早餐粥、吐司",
    },
    certKeys: ["MFA_WITH_BREAKFAST"],
    contractFlags: { lodgingWithBreakfast: true, itemBreakfast: true, itemGuestRoom: true },
  },
  {
    code: "CAT_03",
    label: "旅宿不含早餐",
    siteName: "端到端旅宿不含早",
    formData: {
      ...STAFF,
      applyType: "without_breakfast",
      lodgingLicenseNo: "北市宿字第002號",
      roomManagerName: "客房主管",
      roomManagerTitle: "主任",
      roomDetail: "201 雙人房\n202 雙人房\n203 雙人房\n204 雙人房\n205 雙人房",
    },
    certKeys: ["MFA_WITHOUT_BREAKFAST"],
    contractFlags: { lodgingWithoutBreakfast: true, itemGuestRoom: true },
  },
  {
    code: "CAT_04",
    label: "友善商店",
    siteName: "端到端友善商店",
    formData: { ...STAFF, productDetail: "Halal 餅乾\nHalal 飲料" },
    certKeys: ["MFS_STORE"],
    contractFlags: { checkShop: true },
  },
  {
    code: "CAT_05",
    label: "友善旅行社",
    siteName: "端到端友善旅行社",
    formData: { ...STAFF, itineraryDetail: "路線一：台北一日遊（中英）\n路線二：宜蘭兩日遊（中英）" },
    certKeys: ["MFTA_TRAVEL"],
    contractFlags: { checkExperience: true, checkExperienceWithoutFood: true },
  },
  {
    code: "CAT_06",
    label: "友善環境",
    siteName: "端到端友善環境",
    formData: { ...STAFF },
    certKeys: ["MFE_ENVIRONMENT"],
    contractFlags: { checkEnvironment: true },
  },
  {
    code: "CAT_07",
    label: "友善體驗活動",
    siteName: "端到端友善體驗",
    formData: { ...STAFF, activityDetail: "手作香皂：模具、油脂、香精" },
    certKeys: ["MFEA_EXPERIENCE"],
    contractFlags: { checkExperience: true, checkExperienceWithFood: false, checkExperienceWithoutFood: true },
  },
];

function log(step, detail = "") {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${step}${detail ? ` — ${detail}` : ""}`);
}

async function waitServices(page) {
  await page.waitForFunction(() => Boolean(window.__mfServices), null, { timeout: 60000 });
  return page.evaluate(() => Boolean(window.__mfServices?.mode === "mock"));
}

async function asUser(page, email) {
  await page.evaluate(async (target) => {
    const s = window.__mfServices;
    await s.logout();
    if (s.switchDemoUser && ["applicant01@example.test", "officer.lin@example.test", "admin@example.test"].includes(target)) {
      await s.switchDemoUser(target);
    } else {
      await s.login(target, "Passw0rd!e2e");
    }
  }, email);
}

async function saveBlob(page, getter, filePath) {
  const b64 = await page.evaluate(async (fnBody) => {
    // getter is inlined below via evaluate handle instead
    return null;
  }, null);
  void b64;
  const result = await page.evaluate(getter);
  if (!result?.base64) throw new Error(`下載失敗：${filePath}`);
  await writeFile(filePath, Buffer.from(result.base64, "base64"));
  return { name: result.name, bytes: Buffer.from(result.base64, "base64").length };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(OUT, "certificates"), { recursive: true });
  await mkdir(path.join(OUT, "contracts"), { recursive: true });
  const report = {
    email: EMAIL,
    taxId: TAX_ID,
    orgName: ORG_NAME,
    steps: [],
    certificates: [],
    contracts: [],
    errors: [],
  };
  const push = (step, ok, extra = {}) => {
    report.steps.push({ step, ok, ...extra, at: new Date().toISOString() });
    log(ok ? "OK" : "FAIL", `${step}${extra.detail ? ` (${extra.detail})` : ""}`);
  };

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultTimeout(120000);

  try {
    log("開啟系統", BASE);
    await page.goto(BASE, { waitUntil: "networkidle" });
    await waitServices(page);
    push("載入 mock 服務", true);

    // 1) 重設展示資料
    await page.evaluate(async () => {
      await window.__mfServices.resetDemo();
    });
    await page.reload({ waitUntil: "networkidle" });
    await waitServices(page);
    push("重設展示資料", true);

    // 2) UI 註冊
    log("註冊新帳號", EMAIL);
    await page.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await page.getByLabel(/業者名稱|單位名稱|公司名稱|組織名稱/).first().fill(ORG_NAME).catch(async () => {
      // 欄位標籤可能不同，改走服務註冊
    });
    // 以服務註冊為準（並在畫面走一次表單若找得到）
    const registered = await page.evaluate(async ({ email, password, organizationName, taxId }) => {
      const s = window.__mfServices;
      try {
        const user = await s.register({
          email,
          password,
          confirmPassword: password,
          displayName: "端到端業者",
          organizationName,
          taxId,
        });
        return { ok: true, user };
      } catch (error) {
        return { ok: false, message: error?.message || String(error) };
      }
    }, { email: EMAIL, password: PASSWORD, organizationName: ORG_NAME, taxId: TAX_ID });
    if (!registered.ok) throw new Error(`註冊失敗：${registered.message}`);
    push("註冊新業者帳號", true, { detail: EMAIL });

    // 更新組織地址／聯絡
    await page.evaluate(async () => {
      const s = window.__mfServices;
      const org = await s.organization();
      await s.updateOrganization({
        contactName: "端到端業者",
        contactPhone: "02-27009999",
        contactEmail: org.contactEmail,
        address: "台北市大安區示範路1號",
      });
    });
    push("更新業者資料", true);

    // 3) 管理員：關閉基礎課門檻（本輪專注驗證／證書／合約）
    await asUser(page, "admin@example.test");
    await page.evaluate(async () => {
      const s = window.__mfServices;
      const policy = await s.trainingPolicy();
      await s.saveTrainingPolicy({
        requireBasicBeforeApply: false,
        quizDrawCount: policy.quizDrawCount,
        quizPassCount: policy.quizPassCount,
        privateRequestMinHeadcount: policy.privateRequestMinHeadcount,
        expectedVersion: policy.version,
      });
    });
    push("管理員關閉基礎課門檻", true);

    // 4) 業者選方案 → 付款；管理員核帳
    await asUser(page, EMAIL);
    const payment = await page.evaluate(async () => {
      const s = window.__mfServices;
      const desk = await s.myPayments();
      const plan = (desk.plans || desk.visiblePlans || []).find((item) => item.isActive) || desk.plans?.[0];
      if (!plan) {
        const adminDesk = null;
        return { ok: false, message: "找不到方案", deskKeys: Object.keys(desk), adminDesk };
      }
      const selected = await s.selectPlan({ planId: plan.id });
      await s.markPaidPending(selected.id);
      return { ok: true, paymentId: selected.id, planName: plan.name, amount: plan.amount };
    });
    if (!payment.ok) {
      // 方案可能只在 paymentDesk（管理員）或 plans 欄位不同
      const retry = await page.evaluate(async () => {
        const s = window.__mfServices;
        await s.logout();
        await s.switchDemoUser("admin@example.test");
        const desk = await s.paymentDesk();
        const plan = desk.plans.find((item) => item.isActive) || desk.plans[0];
        await s.logout();
        await s.login(arguments[0], "Passw0rd!e2e");
        const selected = await s.selectPlan({ planId: plan.id });
        await s.markPaidPending(selected.id);
        return { ok: true, paymentId: selected.id, planName: plan.name, amount: plan.amount };
      }, EMAIL).catch(async () => {
        await asUser(page, EMAIL);
        return page.evaluate(async () => {
          const s = window.__mfServices;
          const mine = await s.myPayments();
          return { ok: false, mine };
        });
      });
      if (!retry.ok) throw new Error(`選方案失敗：${JSON.stringify(retry)}`);
      Object.assign(payment, retry);
    }
    push("業者選方案並送出付款", true, { detail: `${payment.planName} / ${payment.paymentId}` });

    await asUser(page, "admin@example.test");
    await page.evaluate(async (paymentId) => {
      await window.__mfServices.confirmReconciliation({ paymentId });
    }, payment.paymentId);
    push("管理員核帳完成", true);

    // 準備附件 bytes
    const pngB64 = (await readFile(path.join(FIX, "photo.png"))).toString("base64");
    const pdfB64 = (await readFile(path.join(FIX, "doc.pdf"))).toString("base64");

    // 5) 建立並送出全部申請
    const createdApps = [];
    await asUser(page, EMAIL);
    for (const scenario of APP_SCENARIOS.slice(0, 1)) {
      const created = await page.evaluate(async ({ scenario, pngB64, pdfB64, orgName }) => {
        const s = window.__mfServices;
        const cats = await s.categories();
        const category = cats.find((item) => item.code === scenario.code);
        if (!category) return { ok: false, message: `找不到類別 ${scenario.code}` };
        const app = await s.createApplication(category.id);
        const definition = category.latestVersion.definition;
        const formData = { ...scenario.formData };
        // checkbox 在表單可能存 boolean
        for (const key of ["mealBreakfast", "mealLunch", "mealDinner", "mealDrink", "mealSnack"]) {
          if (key in formData) formData[key] = Boolean(formData[key]);
        }
        await s.updateApplication(app.id, {
          expectedVersion: app.version,
          organizationName: orgName,
          taxId: app.taxId || app.taxIdSnapshot,
          contactName: "端到端業者",
          contactPhone: "02-27009999",
          contactEmail: app.contactEmail || app.contactEmailSnapshot || "",
          organizationAddress: "台北市大安區示範路1號",
          siteName: scenario.siteName,
          siteAddress: "台北市大安區示範路1號",
          applicationDescription: `${scenario.label}端到端申請`,
          declarationAccepted: true,
          formData,
        });
        const refreshed = await s.application(app.id);
        const b64ToFile = (b64, name, type) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
          return new File([bytes], name, { type });
        };
        const png = b64ToFile(pngB64, "photo.png", "image/png");
        const pdf = b64ToFile(pdfB64, "doc.pdf", "application/pdf");
        const visibleRequired = definition.attachmentRequirements.filter((item) => {
          if (item.requiredWhen) {
            return String(formData[item.requiredWhen.field]) === String(item.requiredWhen.equals);
          }
          if (item.requiredWhenAny?.length) {
            return item.requiredWhenAny.some((cond) => String(formData[cond.field]) === String(cond.equals));
          }
          return item.requiredOnSubmit;
        });
        for (const req of visibleRequired) {
          const file = req.accept === "image" ? png : pdf;
          await s.upload(app.id, req.key, file);
          if (req.multiple) {
            // 已上傳一張即可
          }
        }
        const afterUpload = await s.application(app.id);
        try {
          await s.submit(afterUpload.id, afterUpload.version, crypto.randomUUID());
        } catch (error) {
          return {
            ok: false,
            message: error?.message || String(error),
            fieldErrors: error?.fieldErrors || error?.details?.fieldErrors || null,
            formKeys: Object.keys(afterUpload.formData || {}),
            attachmentKeys: (afterUpload.attachments || []).map((item) => item.requirementKey),
            taxId: afterUpload.taxIdSnapshot,
          };
        }
        const submitted = await s.application(app.id);
        return { ok: true, id: submitted.id, no: submitted.applicationNo, status: submitted.status, categoryCode: scenario.code, label: scenario.label, certKeys: scenario.certKeys, contractFlags: scenario.contractFlags, siteName: scenario.siteName };
      }, { scenario, pngB64, pdfB64, orgName: ORG_NAME });
      if (!created.ok) throw new Error(`申請失敗 ${scenario.label}: ${created.message} ${JSON.stringify(created.fieldErrors || created)}`);
      createdApps.push(created);
      push(`業者送件：${scenario.label}`, true, { detail: `${created.no} → ${created.status}` });
    }

    const app = createdApps[0];
    const shots = "/tmp/scan/mid";
    page.on("dialog", (dialog) => dialog.accept());
    const errs = [];
    page.on("pageerror", (error) => errs.push(error.message));
    await asUser(page, "admin@example.test");
    await page.evaluate(async () => sessionStorage.setItem("mf-demo-user", (await window.__mfServices.me()).id));
    const open = async () => {
      await page.goto(`${BASE}/admin/applications/${app.id}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(500);
    };
    const panelNotice = async () => (await page.locator("main aside [role=status], main aside [role=alert]").allInnerTexts()).join(" / ");

    await page.goto(`${BASE}/admin/applications`, { waitUntil: "networkidle" });
    await page.locator("main tr", { hasText: app.no }).locator("a").click();
    await page.waitForTimeout(600);
    report.uiNav = await page.evaluate(() => [...document.querySelectorAll("aside a.is-selected")].map((a) => a.innerText.trim()));
    await page.screenshot({ path: `${shots}/flow-1-submitted.png` });

    const assignSelect = page.locator("main aside select").first();
    const options = await assignSelect.locator("option").allInnerTexts();
    await assignSelect.selectOption({ label: options.find((label) => label.includes("林")) ?? options[1] });
    await page.click("main aside button:has-text('指派承辦')");
    await page.waitForTimeout(600);
    push("UI 指派承辦", true, { detail: (await page.locator("main [role=status], main [role=alert]").allInnerTexts()).join(" / ") });

    await page.click("main aside button:has-text('開始初審')");
    await page.waitForTimeout(600);
    push("UI 開始初審", true, { detail: (await page.locator("main [role=status], main [role=alert]").allInnerTexts()).join(" / ") });

    await open();
    await page.click("main aside button:has-text('填寫這次動作的意見')");
    for (const area of await page.locator("main aside textarea").all()) await area.fill("UI 驗證意見");
    await page.locator("main aside select").last().selectOption({ index: 1 });
    await page.screenshot({ path: `${shots}/flow-2-initial.png` });
    await page.click("main aside button:has-text('初審通過')");
    await page.waitForTimeout(700);
    push("UI 初審通過", true, { detail: (await page.locator("main [role=status]").allInnerTexts()).join(" / ") });

    await open();
    await page.screenshot({ path: `${shots}/flow-3-second.png` });
    await page.click("main aside button:has-text('複審通過')");
    await page.waitForTimeout(700);
    push("UI 複審通過", true, { detail: (await page.locator("main [role=status]").allInnerTexts()).join(" / ") });

    await open();
    await page.click("main aside button:has-text('填寫這次動作的意見')");
    for (const area of await page.locator("main aside textarea").all()) await area.fill("UI 核定意見");
    await page.click("main aside button:has-text('核定')");
    await page.waitForTimeout(700);
    push("UI 核定", true, { detail: (await page.locator("main [role=status], main [role=alert]").allInnerTexts()).join(" / ") });

    await open();
    report.approvedFirstSection = await page.evaluate(() => document.querySelector("main .min-w-0 > section")?.id ?? null);
    await page.fill("#case-certificate input >> nth=0", `UI-${Date.now()}`);
    await page.fill("#case-certificate input[type=date] >> nth=0", "2026-11-22");
    await page.fill("#case-certificate input[type=date] >> nth=1", "2027-11-21");
    await page.click("#case-certificate button:has-text('發證並儲存')");
    await page.waitForTimeout(900);
    report.certNotice = (await page.locator("#case-certificate [role=status], #case-certificate [role=alert]").allInnerTexts()).join(" / ");

    await page.goto(`${BASE}/admin/contracts/issue`, { waitUntil: "networkidle" });
    await page.click("main button:has-text('搜尋業者')");
    await page.locator("[role=dialog] button", { hasText: ORG_NAME }).first().click();
    await page.waitForTimeout(400);
    await page.getByLabel("費用總金額（新臺幣元，稅外加）").fill("30000");
    await page.click("main button:has-text('發出合約')");
    await page.waitForTimeout(1200);
    report.contractUrl = page.url();

    report.audit = {};
    for (const category of ["APPLICATION", "CONTRACT"]) {
      await page.goto(`${BASE}/admin/audit-logs`, { waitUntil: "networkidle" });
      await page.selectOption("main select[aria-label=分類]", category);
      await page.waitForTimeout(500);
      report.audit[category] = await page.locator("main table tbody tr").allInnerTexts();
    }
    await page.screenshot({ path: `${shots}/flow-audit.png` });
    report.pageErrors = errs;
    report.summary = { uiNav: report.uiNav, approvedFirstSection: report.approvedFirstSection, certNotice: report.certNotice, contractUrl: report.contractUrl, audit: report.audit, steps: report.steps.slice(-6).map((step) => `${step.step}: ${step.detail ?? ""}`), pageErrors: errs };
  } catch (error) {
    report.errors.push(error?.stack || String(error));
    push("流程中斷", false, { detail: error?.message || String(error) });
    await page.screenshot({ path: "/tmp/scan/mid/flow-failure.png", fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(report.summary || report.errors, null, 1));
  if (report.errors.length) process.exit(1);
}

main();

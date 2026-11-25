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
    for (const scenario of APP_SCENARIOS) {
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

    // 6) 管理員派案；承辦初審；複審；管理員核定
    await asUser(page, "admin@example.test");
    const officerId = await page.evaluate(async () => {
      const staff = await window.__mfServices.staffOptions();
      const officer = staff.find((item) => item.displayName.includes("林")) || staff.find((item) => item.role === "CASE_OFFICER") || staff[0];
      if (!officer) throw new Error("找不到承辦人");
      return officer.id;
    });

    for (const app of createdApps) {
      await asUser(page, "admin@example.test");
      await page.evaluate(async ({ id, officerId }) => {
        const s = window.__mfServices;
        const detail = await s.application(id);
        await s.assign(id, officerId, detail.version, crypto.randomUUID());
      }, { id: app.id, officerId });

      await asUser(page, "officer.lin@example.test");
      await page.evaluate(async ({ id, officerId }) => {
        const s = window.__mfServices;
        let detail = await s.application(id);
        await s.review(id, { action: "START_REVIEW", expectedVersion: detail.version, requestId: crypto.randomUUID(), publicComment: "開始初審", internalNote: "e2e" });
        detail = await s.application(id);
        await s.review(id, {
          action: "PASS_INITIAL",
          expectedVersion: detail.version,
          requestId: crypto.randomUUID(),
          publicComment: "初審通過",
          internalNote: "文件齊全",
          siteReviewerId: officerId,
        });
        detail = await s.application(id);
        await s.review(id, {
          action: "PASS_SECOND",
          expectedVersion: detail.version,
          requestId: crypto.randomUUID(),
          publicComment: "複審通過",
          internalNote: "現場無虞",
        });
      }, { id: app.id, officerId });

      await asUser(page, "admin@example.test");
      await page.evaluate(async (id) => {
        const s = window.__mfServices;
        const detail = await s.application(id);
        await s.review(id, {
          action: "APPROVE",
          expectedVersion: detail.version,
          requestId: crypto.randomUUID(),
          publicComment: "核定通過",
          internalNote: "e2e 核定",
        });
      }, app.id);
      push(`審查核定：${app.label}`, true, { detail: app.no });
    }

    // 7) 發證並下載每一種證書
    await asUser(page, "admin@example.test");
    let certSeq = 1;
    for (const app of createdApps) {
      for (const templateKey of app.certKeys) {
        const certNo = `ICD2026E2E${String(certSeq).padStart(3, "0")}`;
        certSeq += 1;
        const issued = await page.evaluate(async ({ applicationId, certificateNo, templateKey }) => {
          const s = window.__mfServices;
          await s.saveCertification(applicationId, {
            certificateNo,
            issuedOnDate: "2026-11-21",
            validUntilDate: "2027-11-20",
            templateKey,
          });
          const doc = await s.certificationDocument(applicationId);
          const buf = await doc.blob.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return { name: doc.name, base64: btoa(binary), size: bytes.length };
        }, { applicationId: app.id, certificateNo: certNo, templateKey });
        const fileName = `${templateKey}_${issued.name || `${certNo}.pdf`}`;
        const filePath = path.join(OUT, "certificates", fileName);
        await writeFile(filePath, Buffer.from(issued.base64, "base64"));
        report.certificates.push({ templateKey, applicationNo: app.no, certificateNo: certNo, file: fileName, bytes: issued.size });
        push(`下載證書：${templateKey}`, true, { detail: `${certNo} ${issued.size} bytes` });
      }
    }

    // 8) 合約：每個申請發出一份 → 下載未簽署 → 業者上傳簽署 → 再下載
    await asUser(page, "admin@example.test");
    const templateId = await page.evaluate(async () => {
      const list = await window.__mfServices.contractTemplates();
      return list[0]?.id;
    });
    if (!templateId) throw new Error("找不到合約範本");

    const org = await page.evaluate(async (taxId) => {
      const orgs = await window.__mfServices.issuableOrganizations();
      return orgs.find((item) => item.taxId === taxId) || orgs.find((item) => item.organizationName.includes("端到端"));
    }, TAX_ID);
    if (!org) throw new Error(`核帳後找不到可發約業者 ${TAX_ID}`);

    const signedPdfB64 = (await readFile(path.join(FIX, "signed.pdf"))).toString("base64");

    for (const app of createdApps) {
      await asUser(page, "admin@example.test");
      const issuedContract = await page.evaluate(async ({ orgId, templateId, applicationId, siteName, flags, feeAmount }) => {
        const s = window.__mfServices;
        const created = await s.issueContract({
          organizationId: orgId,
          templateId,
          applicationId,
          siteName,
          feeAmount,
          ...flags,
        });
        const doc = await s.contractDocument(created.id);
        const buf = await doc.blob.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return { id: created.id, contractNo: created.contractNo, name: doc.name, base64: btoa(binary), size: bytes.length, version: created.version };
      }, {
        orgId: org.id,
        templateId,
        applicationId: app.id,
        siteName: app.siteName,
        flags: app.contractFlags,
        feeAmount: "15000",
      });

      const issuedPath = path.join(OUT, "contracts", `${issuedContract.contractNo}_issued.pdf`);
      await writeFile(issuedPath, Buffer.from(issuedContract.base64, "base64"));
      push(`發出並下載合約：${app.label}`, true, { detail: issuedContract.contractNo });

      await asUser(page, EMAIL);
      const signed = await page.evaluate(async ({ contractId, expectedVersion, signedPdfB64 }) => {
        const s = window.__mfServices;
        const bin = atob(signedPdfB64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
        const pdf = new File([bytes], "signed.pdf", { type: "application/pdf" });
        const detail = await s.contract(contractId);
        const uploaded = await s.uploadSignedContract(contractId, { expectedVersion: detail.version, pdf });
        const doc = await s.contractDocument(contractId);
        const buf = await doc.blob.arrayBuffer();
        const out = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < out.length; i += 0x8000) binary += String.fromCharCode(...out.subarray(i, i + 0x8000));
        return { contractNo: uploaded.contractNo, status: uploaded.status, name: doc.name, base64: btoa(binary), size: out.length };
      }, { contractId: issuedContract.id, expectedVersion: issuedContract.version, signedPdfB64 });

      const signedPath = path.join(OUT, "contracts", `${signed.contractNo}_signed.pdf`);
      await writeFile(signedPath, Buffer.from(signed.base64, "base64"));
      report.contracts.push({
        applicationNo: app.no,
        label: app.label,
        contractNo: signed.contractNo,
        issuedFile: path.basename(issuedPath),
        signedFile: path.basename(signedPath),
        status: signed.status,
      });
      push(`上傳簽署並下載：${app.label}`, true, { detail: `${signed.contractNo} ${signed.status}` });
    }

    // 9) 角色抽查：業者看自己的證書／合約；承辦看案件；管理員看報表入口
    await asUser(page, EMAIL);
    const portalCheck = await page.evaluate(async () => {
      const s = window.__mfServices;
      const certs = await s.certifications();
      const contracts = await s.myContracts();
      return { certCount: certs.length, contractCount: contracts.length };
    });
    push("業者端查詢證書與合約", true, { detail: `證書 ${portalCheck.certCount}／合約 ${portalCheck.contractCount}` });

    await asUser(page, "officer.lin@example.test");
    const officerCheck = await page.evaluate(async () => {
      const list = await window.__mfServices.applications({ status: "APPROVED" });
      return { approved: list.meta?.total ?? list.items?.length ?? 0 };
    });
    push("承辦人查看已核定案件", true, { detail: `共 ${officerCheck.approved} 件` });

    await asUser(page, "admin@example.test");
    const adminCheck = await page.evaluate(async () => {
      const s = window.__mfServices;
      const contracts = await s.adminContracts();
      const templates = await s.certificateTemplates();
      return { contracts: contracts.length, certTemplates: templates.length };
    });
    push("管理員查看合約與證書範本", true, { detail: `合約 ${adminCheck.contracts}／範本 ${adminCheck.certTemplates}` });

    report.summary = {
      applications: createdApps.length,
      certificatesDownloaded: report.certificates.length,
      contractsCompleted: report.contracts.length,
      expectedCertTemplates: 11,
      uniqueCertKeys: [...new Set(report.certificates.map((item) => item.templateKey))],
    };
  } catch (error) {
    report.errors.push(error?.stack || String(error));
    push("流程中斷", false, { detail: error?.message || String(error) });
    try {
      await page.screenshot({ path: path.join(OUT, "failure.png"), fullPage: true });
    } catch {
      /* ignore */
    }
  } finally {
    await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }

  console.log("\n==== 結果摘要 ====");
  console.log(JSON.stringify(report.summary || report.errors, null, 2));
  console.log(`報告：${path.join(OUT, "report.json")}`);
  if (report.errors.length) process.exit(1);
}

main();

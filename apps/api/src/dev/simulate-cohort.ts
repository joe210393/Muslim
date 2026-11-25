import { writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  DEMO_PASSWORD,
  PLATFORM_FEATURES,
  VERIFICATION_EXCLUSIVE,
  VERIFICATION_PICK_KEYS,
  matchCertificateTemplates,
  attachmentIsRequired,
  defaultFeatureEnabled,
  fieldIsRequired,
  parseCategoryDefinition,
  reviewTargets,
  validateSubmit,
  type CategoryDefinition,
  type FieldReview,
} from "@mf/contracts";
import { ApplicationAction, AttendanceStatus, CourseDelivery, CourseStatus, UserRole } from "@mf/db/enums";
import { prisma } from "@mf/db/server";
import bcrypt from "bcryptjs";
import { getEnv, repoRoot } from "../config/env";
import { createStorage } from "../storage/storage";
import * as applications from "../modules/applications/service";
import * as payments from "../modules/payments/service";
import * as training from "../modules/training/service";
import * as basic from "../modules/training/basic";
import * as contracts from "../modules/platform/contracts";
import * as admin from "../modules/admin/service";
import * as files from "../modules/files/service";
import type { SessionActor } from "../middleware/auth";

const SCENARIOS: Array<[string, number]> = [
  ["只註冊，尚未選方案", 5],
  ["已選方案，待付款", 5],
  ["已付款，待核帳", 5],
  ["已開通，基礎課未完成", 6],
  ["基礎課已通過，草稿未送", 6],
  ["已送件，尚未派案", 6],
  ["初審中", 6],
  ["待補件", 6],
  ["複審中", 6],
  ["待核定", 5],
  ["已核定，尚未發證、尚未發約", 6],
  ["已核定，已發證，合約待上傳", 5],
  ["已核定，合約已收回", 1],
  ["合約已簽，即將到期", 6],
  ["合約已簽，尚未到期", 5],
  ["合約已續約", 4],
  ["合約未續約", 4],
  ["已退件", 5],
  ["專班待審", 4],
  ["專班已核准", 2],
  ["專班未通過", 2],
];

const CITIES = ["台北市中山區", "新北市板橋區", "桃園市中壢區", "台中市西區", "台南市中西區", "高雄市前金區", "基隆市仁愛區", "新竹市東區", "嘉義市西區", "宜蘭縣羅東鎮"];
const BRANDS = ["星河", "月灣", "青禾", "山風", "海鹽", "木棉", "石階", "竹影", "晴川", "野溪", "松子", "潮聲"];
const YOUTUBE = "https://www.youtube.com/watch?v=aqz-KE-bpKQ";

type Row = {
  no: number;
  email: string;
  organizationName: string;
  taxId: string;
  scenario: string;
  applicationNo: string;
  applicationStatus: string;
  categoryName: string;
  contractNo: string;
  contractStatus: string;
  certificateNo: string;
  training: string;
  companyRequest: string;
  courseNote: string;
};

function expandScenarios() {
  const rows = SCENARIOS.flatMap(([name, count]) => Array.from({ length: count }, () => name));
  if (rows.length !== 100) throw new Error(`情境數量是 ${rows.length}，不是 100`);
  return rows;
}

function actorOf(user: { id: string; email: string; displayName: string; role: UserRole; organizationId: string | null }): SessionActor {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, organizationId: user.organizationId, isActive: true };
}

function pdfBytes(label: string) {
  const body = `%PDF-1.4\n1 0 obj<</Length ${label.length}>>stream\n${label}\nendstream\nendobj\ntrailer<<>>\n%%EOF\n`;
  return Buffer.from(body.padEnd(140, " "));
}

function pngBytes() {
  return Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
}

function mp4Bytes() {
  const bytes = Buffer.alloc(32);
  bytes.writeUInt32BE(24, 0);
  bytes.write("ftyp", 4);
  bytes.write("isom", 8);
  return bytes;
}

function fillForm(definition: CategoryDefinition, index: number) {
  const data: Record<string, string | number | boolean | null> = {};
  for (const field of definition.fields) {
    if (field.inputType === "checkbox") data[field.key] = false;
    else if (field.inputType === "select") data[field.key] = field.options?.[index % (field.options.length || 1)]?.value ?? "";
    else if (field.inputType === "number") data[field.key] = 8 + (index % 30);
    else if (field.inputType === "date") data[field.key] = "2026-12-15";
    else data[field.key] = `${field.label}的示範內容，第 ${index + 1} 家。`;
  }
  if (definition.fields.some((field) => VERIFICATION_PICK_KEYS.includes(field.key as (typeof VERIFICATION_PICK_KEYS)[number]))) {
    const key = VERIFICATION_PICK_KEYS[index % VERIFICATION_PICK_KEYS.length]!;
    if (definition.fields.some((field) => field.key === key)) data[key] = true;
  }
  for (const [left, right] of VERIFICATION_EXCLUSIVE) {
    if (data[left] === true && data[right] === true) data[right] = false;
  }
  return data;
}

function contractChecks(code: string) {
  return {
    checkHalalKitchen: code === "CAT_02",
    checkHalalRestaurant: false,
    checkMuslimFriendlyRestaurant: code === "CAT_01",
    checkMealService: code === "CAT_01",
    checkDrinksSnacks: false,
    checkFullHalalKitchen: false,
    checkPartialKitchen: false,
    checkRestaurantRestroom: false,
    lodgingWithBreakfast: code === "CAT_03",
    lodgingWithoutBreakfast: false,
    itemBreakfast: code === "CAT_03",
    itemGuestRoom: code === "CAT_03",
    checkExperience: code === "CAT_05" || code === "CAT_07",
    checkExperienceWithFood: code === "CAT_07",
    checkExperienceWithoutFood: false,
    checkEnvironment: code === "CAT_06",
    checkShop: code === "CAT_04",
  };
}

async function wipe(keepIds: string[]) {
  await prisma.$transaction([
    prisma.courseQuizAttempt.deleteMany(),
    prisma.trainingCertificate.deleteMany(),
    prisma.enrollment.deleteMany(),
    prisma.notificationJob.deleteMany(),
    prisma.applicationEvent.deleteMany(),
    prisma.applicationSubmission.deleteMany(),
    prisma.applicationAttachment.deleteMany(),
    prisma.certification.deleteMany(),
    prisma.companyTrainingRequest.deleteMany(),
    prisma.contractRecord.deleteMany(),
    prisma.paymentRecord.deleteMany(),
    prisma.application.deleteMany(),
    prisma.course.deleteMany(),
    prisma.importBatch.deleteMany(),
    prisma.savedReport.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.userBasicTraining.deleteMany(),
    prisma.basicTrainingAttempt.deleteMany(),
    prisma.basicTrainingProgress.deleteMany(),
  ]);
  await prisma.$executeRawUnsafe(`
    DELETE FROM file_objects f
    WHERE NOT EXISTS (SELECT 1 FROM site_contents s WHERE s.image_file_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM editorial_entries e WHERE e.image_file_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM basic_training_modules m WHERE m.material_file_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM contract_seal_settings c WHERE c.company_seal_file_id = f.id OR c.person_seal_file_id = f.id)
      AND NOT EXISTS (SELECT 1 FROM service_plan_images p WHERE p.file_id = f.id)
  `);
  await prisma.fileObject.updateMany({ where: { uploadedById: { notIn: keepIds } }, data: { uploadedById: keepIds[0] } });
  await prisma.user.deleteMany({ where: { id: { notIn: keepIds } } });
  await prisma.organization.deleteMany({ where: { users: { none: {} } } });
}

async function watchModule(user: SessionActor, moduleId: string, seconds: number) {
  await basic.recordModuleWatch(user, moduleId, { watchedSeconds: 2, videoDurationSeconds: seconds });
  await prisma.basicTrainingProgress.update({
    where: { userId_moduleId: { userId: user.id, moduleId } },
    data: { watchUpdatedAt: new Date(Date.now() - 180_000) },
  });
  await basic.recordModuleWatch(user, moduleId, { watchedSeconds: seconds, videoDurationSeconds: seconds });
}

async function passBasic(user: SessionActor, moduleIds: string[]) {
  for (const moduleId of moduleIds) await watchModule(user, moduleId, 60);
  const quiz = await basic.startQuiz(user);
  const bank = await prisma.basicTrainingQuestion.findMany({ where: { isActive: true } });
  const answers = quiz.questions.map((question) => ({
    questionId: question.id,
    selectedIndex: bank.find((item) => item.id === question.id)?.correctIndex ?? 0,
  }));
  await basic.submitQuiz(user, { attemptId: quiz.attemptId, answers });
}

async function main() {
  if (process.env.CONFIRM_COHORT !== "yes" || process.env.MAIL_DRIVER !== "console") {
    throw new Error("請用 CONFIRM_COHORT=yes 與 MAIL_DRIVER=console 執行，避免清錯資料或寄出真實郵件");
  }
  const env = getEnv();
  if (env.MAIL_DRIVER !== "console") throw new Error("郵件驅動不是 console，已停止");
  const storage = createStorage(path.resolve(repoRoot(), env.UPLOAD_ROOT));
  const scenarios = expandScenarios();
  const adminUser = await prisma.user.findUnique({ where: { email: "admin@example.test" } });
  const officer = await prisma.user.findUnique({ where: { email: "officer.lin@example.test" } });
  if (!adminUser || !officer) throw new Error("找不到 admin@example.test 或 officer.lin@example.test");
  const adminActor = actorOf(adminUser);
  const officerActor = actorOf(officer);

  console.info("清除舊的業者、案件、課程與合約紀錄");
  await wipe([adminUser.id, officer.id]);

  const modules = await prisma.basicTrainingModule.findMany({ where: { isActive: true, isRequired: true }, orderBy: { sortOrder: "asc" } });
  for (const module of modules) {
    await basic.saveModule(adminActor, {
      title: module.title,
      description: module.description,
      youtubeUrl: YOUTUBE,
      requiredWatchPercent: module.requiredWatchPercent,
      sortOrder: module.sortOrder,
      isRequired: module.isRequired,
      isActive: true,
      expectedVersion: module.version,
    }, module.id);
  }

  const courseIds: { id: string; kind: "online" | "ended" | "upcoming" | "other" }[] = [];
  const courseTitles: string[] = [];
  for (let index = 0; index < 22; index += 1) {
    const online = index < 8;
    const draft = index >= 18 && index < 20;
    const cancelled = index >= 20;
    const ended = !online && index < 14;
    const starts = ended ? "2026-10-01T01:00:00.000Z" : "2026-12-01T01:00:00.000Z";
    const ends = ended ? "2026-10-02T04:00:00.000Z" : "2026-12-01T04:00:00.000Z";
    const title = online
      ? `線上第 ${index + 1} 梯：穆斯林友善服務實作`
      : `實體第 ${index + 1} 梯：${CITIES[index % CITIES.length]}示範教室`;
    const created = await training.saveCourse(adminActor, {
      title,
      description: `管理員建立的第 ${index + 1} 門課。教材仍是示範，正式教材待甲方提供。`,
      delivery: online ? "ONLINE" : "OFFLINE",
      youtubeUrl: online ? YOUTUBE : "",
      location: online ? "" : `${CITIES[index % CITIES.length]}示範訓練教室 ${index + 1}`,
      startsAt: starts,
      endsAt: ends,
      registrationOpensAt: "2026-09-01T00:00:00.000Z",
      registrationClosesAt: "2026-12-31T15:59:00.000Z",
      capacity: 40 + index,
      durationMinutes: online ? 60 : 180,
      requiredAttendanceMinutes: online ? 40 : 120,
      status: "DRAFT",
    });
    if (online) await training.uploadCourseVideo(adminActor, storage, created.id, { originalname: "demo.mp4", mimetype: "video/mp4", size: mp4Bytes().length, buffer: mp4Bytes() }, 90);
    const current = await prisma.course.findUniqueOrThrow({ where: { id: created.id } });
    const status: CourseStatus = draft ? CourseStatus.DRAFT : cancelled ? CourseStatus.CANCELLED : CourseStatus.PUBLISHED;
    if (status !== CourseStatus.DRAFT) {
      await training.saveCourse(adminActor, {
        title,
        description: created.description,
        delivery: online ? "ONLINE" : "OFFLINE",
        youtubeUrl: online ? YOUTUBE : "",
        location: online ? "" : `${CITIES[index % CITIES.length]}示範訓練教室 ${index + 1}`,
        startsAt: starts,
        endsAt: ends,
        registrationOpensAt: "2026-09-01T00:00:00.000Z",
        registrationClosesAt: "2026-12-31T15:59:00.000Z",
        capacity: 40 + index,
        durationMinutes: online ? 60 : 180,
        requiredAttendanceMinutes: online ? 40 : 120,
        status,
        expectedVersion: current.version,
      }, created.id);
    }
    courseTitles.push(title);
    courseIds.push({ id: created.id, kind: online ? "online" : ended ? "ended" : draft || cancelled ? "other" : "upcoming" });
  }
  const onlineCourse = courseIds.find((item) => item.kind === "online")!;
  const endedCourse = courseIds.find((item) => item.kind === "ended")!;
  const upcomingCourse = courseIds.find((item) => item.kind === "upcoming")!;

  const categories = await prisma.applicationCategory.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } });
  const plans = await prisma.servicePlan.findMany({ where: { isActive: true }, orderBy: { amount: "asc" } });
  const template = await prisma.contractTemplate.findFirst({ orderBy: { updatedAt: "desc" } });
  if (!template) throw new Error("沒有合約範本");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const questionBank = await prisma.basicTrainingQuestion.findMany({ where: { isActive: true } });
  const report: Row[] = [];

  for (let index = 0; index < scenarios.length; index += 1) {
    const scenario = scenarios[index]!;
    const serial = String(index + 1).padStart(3, "0");
    const category = categories[index % categories.length]!;
    const city = CITIES[index % CITIES.length]!;
    const brand = `${BRANDS[index % BRANDS.length]}${BRANDS[(index * 3) % BRANDS.length]}`;
    const organizationName = `${brand}${category.name}示範店`;
    const taxId = String(88000001 + index);
    const email = `vendor${serial}@example.test`;
    const displayName = `${brand}窗口`;
    const phone = `09${String(10000000 + index).slice(0, 8)}`;
    const address = `${city}示範路 ${index + 1} 號`;
    const organization = await prisma.organization.create({
      data: { organizationName, taxId, contactName: displayName, contactPhone: phone, contactEmail: email, address },
    });
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        displayName,
        role: UserRole.APPLICANT,
        organizationId: organization.id,
        features: { create: PLATFORM_FEATURES.map((feature) => ({ featureKey: feature.key, enabled: defaultFeatureEnabled(UserRole.APPLICANT, feature.key) })) },
      },
    });
    const applicant = actorOf(user);
    const row: Row = {
      no: index + 1,
      email,
      organizationName,
      taxId,
      scenario,
      applicationNo: "",
      applicationStatus: "",
      categoryName: "",
      contractNo: "",
      contractStatus: "",
      certificateNo: "",
      training: "未開始",
      companyRequest: "",
      courseNote: "",
    };

    const needsPay = !scenario.startsWith("只註冊");
    if (needsPay) {
      const plan = plans[index % plans.length]!;
      const payment = await payments.selectPlan(applicant, { planId: plan.id });
      if (!scenario.includes("待付款")) {
        await payments.markPaidPending(applicant, payment.id);
        if (!scenario.includes("待核帳")) await payments.confirmReconciliation(adminActor, { paymentId: payment.id });
      }
    }

    if (scenario.includes("基礎課未完成") && needsPay && !scenario.includes("待付款") && !scenario.includes("待核帳")) {
      await watchModule(applicant, modules[0]!.id, 60);
      row.training = "只看完一門基礎課";
    }
    const needsPass = !scenario.startsWith("只註冊") && !scenario.includes("待付款") && !scenario.includes("待核帳") && !scenario.includes("基礎課未完成");
    if (needsPass) {
      await passBasic(applicant, modules.map((item) => item.id));
      row.training = "基礎課已通過";
    }

    if (needsPass && !scenario.startsWith("專班")) {
      const picked = index % 3 === 0 ? endedCourse : index % 3 === 1 ? onlineCourse : upcomingCourse;
      const enrollment = await training.enroll(applicant, picked.id);
      if (picked.kind === "ended") {
        const attended = await training.updateAttendance(officerActor, enrollment.id, { expectedVersion: enrollment.version, attendanceStatus: AttendanceStatus.PRESENT, attendedMinutes: 180 });
        const quiz = await training.startCourseQuiz(applicant, enrollment.id);
        const answers = quiz.questions.map((question) => ({ questionId: question.id, selectedIndex: questionBank.find((item) => item.id === question.id)?.correctIndex ?? 0 }));
        await training.submitCourseQuiz(applicant, enrollment.id, { attemptId: quiz.attemptId, answers });
        if (index % 6 === 0) {
          const certificateNo = `TR-2026-${serial}`;
          await basic.registerCertificate(adminActor, { enrollmentId: enrollment.id, certificateNo, issuedOnDate: "2026-11-01", validUntilDate: "2027-10-31" });
          row.courseNote = `實體已完課並通過測驗，訓練證書 ${certificateNo}`;
        } else row.courseNote = "實體已完課並通過測驗";
        void attended;
      } else if (picked.kind === "online") {
        await training.recordWatch(applicant, enrollment.id, { expectedVersion: enrollment.version, watchedSeconds: 2 });
        await prisma.enrollment.update({ where: { id: enrollment.id }, data: { watchUpdatedAt: new Date(Date.now() - 180_000) } });
        const again = await prisma.enrollment.findUniqueOrThrow({ where: { id: enrollment.id } });
        await training.recordWatch(applicant, enrollment.id, { expectedVersion: again.version, watchedSeconds: 90 });
        const quiz = await training.startCourseQuiz(applicant, enrollment.id);
        const answers = quiz.questions.map((question) => ({ questionId: question.id, selectedIndex: questionBank.find((item) => item.id === question.id)?.correctIndex ?? 0 }));
        await training.submitCourseQuiz(applicant, enrollment.id, { attemptId: quiz.attemptId, answers });
        row.courseNote = "線上已看完並通過測驗";
      } else row.courseNote = "已報名尚未開始的實體課";
    }

    const needsApplication = !scenario.startsWith("只註冊") && !scenario.includes("待付款") && !scenario.includes("待核帳") && !scenario.includes("基礎課未完成") && !scenario.startsWith("專班");
    if (needsApplication) {
      const definition = parseCategoryDefinition(category.versions[0]!.definition);
      const formData = fillForm(definition, index);
      const draft = await applications.createDraft(applicant, category.id);
      const siteName = `${brand}場域`;
      const saved = await applications.updateDraft(applicant, draft.id, {
        expectedVersion: draft.version,
        organizationName,
        taxId,
        contactName: displayName,
        contactPhone: phone,
        contactEmail: email,
        organizationAddress: address,
        siteName,
        siteAddress: address,
        applicationDescription: `${organizationName}申請${category.name}。這是第 ${index + 1} 家的獨立說明，地址在${address}。`,
        declarationAccepted: !scenario.includes("草稿"),
        formData,
      });
      if (!scenario.includes("草稿")) {
        let version = saved.version;
        for (const requirement of definition.attachmentRequirements) {
          if (!attachmentIsRequired(requirement, formData)) continue;
          const image = requirement.accept === "image";
          const buffer = image ? pngBytes() : pdfBytes(`${organizationName}-${requirement.key}`);
          await files.addAttachment(applicant, storage, draft.id, requirement.key, {
            originalname: image ? `${requirement.key}.png` : `${requirement.key}.pdf`,
            mimetype: image ? "image/png" : "application/pdf",
            size: buffer.length,
            buffer,
          });
        }
        const issues = validateSubmit({
          organizationName, taxId, contactName: displayName, contactPhone: phone, contactEmail: email, organizationAddress: address,
          siteName, siteAddress: address, applicationDescription: "check", declarationAccepted: true, formData,
        }, definition, definition.attachmentRequirements.filter((item) => attachmentIsRequired(item, formData)).map((item) => item.key));
        if (issues.length) throw new Error(`${email} 送件前仍缺 ${issues.map((item) => item.message).join("、")}`);
        let current = await applications.submitApplication(env, applicant, draft.id, version, randomUUID());
        row.applicationNo = current.applicationNo;
        row.categoryName = current.categoryName;
        const reviewComment = `${organizationName}的審查意見，第 ${index + 1} 家。`;
        if (!scenario.includes("尚未派案") && !scenario.includes("草稿")) {
          current = await applications.assignApplication(env, adminActor, current.id, officer.id, current.version, randomUUID());
          if (!scenario.startsWith("已送件")) {
            current = await applications.reviewApplication(env, officerActor, current.id, { action: ApplicationAction.START_REVIEW, expectedVersion: current.version, requestId: randomUUID(), internalNote: reviewComment });
          }
        }
        if (scenario.includes("待補件")) {
          const target = reviewTargets(definition)[0];
          const fieldReviews: FieldReview[] = target ? [{ key: target.key, needsSupplement: true, publicComment: `請補${target.label}`, internalNote: "" }] : [];
          current = await applications.reviewApplication(env, officerActor, current.id, { action: ApplicationAction.REQUEST_SUPPLEMENT, expectedVersion: current.version, requestId: randomUUID(), fieldReviews });
        }
        if (scenario.includes("複審") || scenario.includes("待核定") || scenario.includes("已核定") || scenario.includes("合約")) {
          current = await applications.reviewApplication(env, officerActor, current.id, { action: ApplicationAction.PASS_INITIAL, expectedVersion: current.version, requestId: randomUUID(), internalNote: reviewComment, siteReviewerId: officer.id });
        }
        if (scenario.includes("待核定") || scenario.includes("已核定") || scenario.includes("合約")) {
          current = await applications.reviewApplication(env, officerActor, current.id, { action: ApplicationAction.PASS_SECOND, expectedVersion: current.version, requestId: randomUUID(), internalNote: reviewComment });
        }
        if (scenario.includes("已核定") || scenario.includes("合約")) {
          current = await applications.reviewApplication(env, adminActor, current.id, { action: ApplicationAction.APPROVE, expectedVersion: current.version, requestId: randomUUID(), publicComment: `${organizationName}核定通過。` });
        }
        if (scenario.includes("已退件")) {
          current = await applications.reviewApplication(env, adminActor, current.id, { action: ApplicationAction.REJECT, expectedVersion: current.version, requestId: randomUUID(), publicComment: `${organizationName}這次退件，原因是資料與現場說明不一致。` });
        }
        row.applicationStatus = current.status;
        const wantsContract = scenario.includes("合約") || scenario.includes("已發證");
        const wantsCertificate = scenario.includes("已發證") || scenario.includes("合約已簽") || scenario.includes("合約已續約") || scenario.includes("合約未續約") || scenario.includes("即將到期") || scenario.includes("已收回");
        if (wantsCertificate && current.status === "APPROVED") {
          const certificateNo = `MF-CERT-${serial}`;
          const matched = matchCertificateTemplates({
            categoryCode: category.code,
            applyType: typeof formData.applyType === "string" ? formData.applyType : null,
            mealBreakfast: formData.mealBreakfast === true,
            mealLunch: formData.mealLunch === true,
            mealDinner: formData.mealDinner === true,
            mealDrink: formData.mealDrink === true,
            mealSnack: formData.mealSnack === true,
          });
          const fallback: Record<string, string> = { CAT_01: "MFR_MEAL", CAT_02: "HALAL_PRODUCT", CAT_03: "MFA_WITH_BREAKFAST", CAT_04: "MFS_STORE", CAT_05: "MFTA_TRAVEL", CAT_06: "MFE_ENVIRONMENT", CAT_07: "MFEA_EXPERIENCE" };
          const savedCertificate = await admin.upsertCertification(adminActor, current.id, { certificateNo, issuedOnDate: "2026-11-01", validUntilDate: "2027-10-31", templateKey: matched[0]?.key ?? fallback[category.code] });
          row.certificateNo = savedCertificate.certificateNo;
        }
        if (wantsContract && current.status === "APPROVED") {
          const issued = await contracts.issueContract(adminActor, {
            organizationId: organization.id,
            templateId: template.id,
            applicationId: current.id,
            siteName,
            feeAmount: String(plans[index % plans.length]!.amount),
            ...contractChecks(category.code),
            partyBName: organizationName,
            partyBAddress: address,
            partyBOwner: displayName,
            partyBTaxId: taxId,
          });
          row.contractNo = issued.contractNo;
          row.contractStatus = issued.status;
          if (!scenario.includes("待上傳") && !scenario.includes("已收回")) {
            await contracts.uploadSignedContractPdf(applicant, storage, issued.id, { expectedVersion: issued.version }, { buffer: pdfBytes(issued.contractNo), mimetype: "application/pdf", originalname: `${issued.contractNo}.pdf` });
            const signed = await prisma.contractRecord.findUniqueOrThrow({ where: { id: issued.id } });
            row.contractStatus = signed.status;
            if (scenario.includes("即將到期")) {
              await prisma.contractRecord.update({ where: { id: issued.id }, data: { signedAt: new Date(Date.now() - 335 * 24 * 60 * 60 * 1000) } });
            }
            if (scenario.includes("已續約") || scenario.includes("未續約")) {
              const decision = scenario.includes("已續約") ? "RENEWED" : "NOT_RENEWED";
              const renewed = await contracts.recordRenewal(applicant, issued.id, { decision, expectedVersion: signed.version });
              row.contractStatus = renewed.status;
            }
          }
          if (scenario.includes("已收回")) {
            const recalled = await contracts.recallContract(adminActor, issued.id, issued.version);
            row.contractStatus = recalled.status;
          }
        }
      } else {
        row.applicationNo = draft.applicationNo;
        row.applicationStatus = "DRAFT";
        row.categoryName = category.name;
      }
      if (!row.categoryName) row.categoryName = category.name;
    }

    if (scenario.startsWith("專班")) {
      const created = await basic.saveCompanyRequest(applicant, {
        headcount: 24 + (index % 5),
        preferredStartsOn: "2026-12-08",
        preferredEndsOn: "2026-12-10",
        delivery: index % 2 === 0 ? CourseDelivery.OFFLINE : CourseDelivery.ONLINE,
        location: index % 2 === 0 ? address : "",
        note: `${organizationName}希望開${24 + (index % 5)}人的專班。`,
      });
      const submitted = await basic.submitCompanyRequest(applicant, created.id, created.version);
      if (scenario.includes("已核准")) {
        const reviewed = await basic.reviewCompanyRequest(adminActor, submitted.id, { action: "APPROVE", adminNote: "已核准這梯專班。", courseId: upcomingCourse.id, expectedVersion: submitted.version });
        row.companyRequest = reviewed.status;
      } else if (scenario.includes("未通過")) {
        const reviewed = await basic.reviewCompanyRequest(adminActor, submitted.id, { action: "REJECT", adminNote: "日期與教室無法配合。", expectedVersion: submitted.version });
        row.companyRequest = reviewed.status;
      } else row.companyRequest = submitted.status;
    }

    report.push(row);
    if ((index + 1) % 10 === 0) console.info(`已完成 ${index + 1} / 100`);
  }

  const probes = await probeAdmin(adminActor.email, officer.email, report.find((item) => item.applicationNo)?.applicationNo ?? "");
  const output = {
    generatedAt: new Date().toISOString(),
    keptAccounts: ["admin@example.test", "officer.lin@example.test"],
    password: DEMO_PASSWORD,
    courseCount: courseTitles.length,
    courses: courseTitles,
    rows: report,
    probes,
  };
  const target = path.resolve(repoRoot(), "tmp-cohort-report.json");
  await writeFile(target, JSON.stringify(output, null, 2));
  console.info(`完成，報告寫在 ${target}`);
}

async function probeAdmin(adminEmail: string, officerEmail: string, applicationNo: string) {
  const paths = [
    "/api/v1/admin/summary",
    "/api/v1/admin/applications?page=1&pageSize=5",
    "/api/v1/admin/applications?status=APPROVED&page=1&pageSize=5",
    "/api/v1/admin/applications?status=REJECTED&page=1&pageSize=5",
    "/api/v1/admin/applications?status=NEED_SUPPLEMENT&page=1&pageSize=5",
    "/api/v1/admin/payments",
    "/api/v1/admin/courses",
    "/api/v1/admin/contracts",
    "/api/v1/admin/certificate-templates",
    "/api/v1/admin/training/policy",
    "/api/v1/admin/training/basic-modules",
    "/api/v1/admin/training/question-bank",
    "/api/v1/admin/training/company-requests",
    "/api/v1/admin/organizations?page=1&pageSize=5",
    "/api/v1/admin/users?page=1&pageSize=5",
    "/api/v1/admin/mail-templates",
    "/api/v1/admin/audit-logs?page=1&pageSize=5",
    "/api/v1/admin/site-content",
    "/api/v1/admin/editorial",
    "/api/v1/admin/reports",
    "/api/v1/admin/access",
    "/api/v1/admin/staff-options",
    "/health/live",
    "/health/ready",
  ];
  async function login(email: string) {
    const csrf = await fetch("http://127.0.0.1:4000/api/v1/auth/csrf");
    const token = ((await csrf.json()) as { data: { csrfToken: string } }).data.csrfToken;
    const cookie = (csrf.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
    const response = await fetch("http://127.0.0.1:4000/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": token, cookie },
      body: JSON.stringify({ email, password: DEMO_PASSWORD }),
    });
    const nextCookie = (response.headers.get("set-cookie") ?? "").split(";")[0] || cookie;
    const body = await response.json() as { data?: { csrfToken?: string } };
    return { cookie: nextCookie, token: body.data?.csrfToken ?? token, status: response.status };
  }
  const session = await login(adminEmail);
  const results: Array<{ path: string; status: number }> = [];
  for (const item of paths) {
    const response = await fetch(`http://127.0.0.1:4000${item}`, { headers: { cookie: session.cookie, "x-csrf-token": session.token } });
    results.push({ path: item, status: response.status });
  }
  const officerSession = await login(officerEmail);
  const officerList = await fetch("http://127.0.0.1:4000/api/v1/applications?page=1&pageSize=5", { headers: { cookie: officerSession.cookie, "x-csrf-token": officerSession.token } });
  results.push({ path: "承辦人 GET /api/v1/applications", status: officerList.status });
  const sample = await prisma.application.findFirst({ where: { applicationNo }, select: { id: true, organizationId: true } });
  const other = sample
    ? await prisma.user.findFirst({ where: { role: "APPLICANT", organizationId: { not: sample.organizationId } }, select: { email: true } })
    : null;
  if (sample && other) {
    const owner = await login(other.email);
    const denied = await fetch(`http://127.0.0.1:4000/api/v1/applications/${sample.id}`, { headers: { cookie: owner.cookie, "x-csrf-token": owner.token } });
    results.push({ path: "其他業者讀取不是自己的案件", status: denied.status });
    const allowed = await fetch(`http://127.0.0.1:4000/api/v1/applications/${sample.id}`, { headers: { cookie: session.cookie, "x-csrf-token": session.token } });
    results.push({ path: `管理員讀取 ${applicationNo}`, status: allowed.status });
  }
  return { login: session.status, officerLogin: officerSession.status, results };
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

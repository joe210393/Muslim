import { ApplicationAction, ApplicationStatus, AttendanceStatus, EnrollmentStatus, UserRole } from "@mf/db/enums";
import { describe, expect, it } from "vitest";
import { validateDraft, validateSubmit } from "./application-validation";
import { resolveTransition } from "./application-workflow";
import { certificationValidity, validateCertificationDates } from "./certification";
import { cat01DefinitionV1, officialCategoryDefinition } from "../fixtures/categories";
import { buildDemoDataset } from "../fixtures/demo-dataset";
import { sanitizeCsvCell, toCsv } from "./csv";
import { acceptWatchProgress, buildLearningRecord, canEnroll } from "./training";
import { CourseStatus } from "@mf/db/enums";
import { applicationStatusLabels, userRoleLabels } from "./status-labels";
import {
  canStartVerificationApplication,
  basicWatchPassSeconds,
  drawRandomQuestions,
  parseQuestionBankUpload,
  quizPassed,
  quizPassedByCount,
  requiredModulesComplete,
  scoreBasicQuiz,
  validateCompanyTrainingRequest,
  validateTrainingPolicy,
} from "./basic-training";

const filled = {
  organizationName: "星月廚房示範店",
  taxId: "12345601",
  contactName: "聯絡人",
  contactPhone: "0912000001",
  contactEmail: "org1@example.test",
  organizationAddress: "台北市示範路 1 號",
  siteName: "星月場所",
  siteAddress: "台北市示範路 1 號",
  applicationDescription: "示範說明",
  declarationAccepted: true,
  formData: { kitchenType: "restaurant" },
};

describe("申請驗證", () => {
  it("草稿允許缺資料", () => {
    const issues = validateDraft(
      { ...filled, taxId: null, siteName: null, declarationAccepted: false, formData: {} },
      cat01DefinitionV1,
    );
    expect(issues).toEqual([]);
  });

  it("缺附件不能送件", () => {
    const issues = validateSubmit(filled, cat01DefinitionV1, []);
    expect(issues.some((issue) => issue.path.startsWith("attachments."))).toBe(true);
  });

  it("未使用肉品時不必上傳肉品證書", () => {
    const definition = officialCategoryDefinition("CAT_01");
    const formData = {
      scopeKitchen: true,
      certificateNameEn: "Star Kitchen",
      certificateAddressEn: "1 Demo Road",
      certificatePhone: "02-12345678",
      ownerName: "負責人",
      supervisorName: "主管",
      supervisorTitle: "經理",
      supervisorPhone: "0912000001",
      supervisorEmail: "lead@example.test",
      liaisonName: "窗口",
      liaisonTitle: "專員",
      liaisonPhone: "0912000002",
      liaisonEmail: "desk@example.test",
      managerName: "餐廳主管",
      managerTitle: "主管",
      chefName: "廚師",
      chefTitle: "主廚",
      usesMeat: "no",
      ingredientDetail: "咖哩雞飯：雞肉、洋蔥",
    };
    const issues = validateSubmit({ ...filled, formData }, definition, []);
    expect(issues.some((issue) => issue.path === "attachments.meat_certificate")).toBe(false);
    expect(issues.some((issue) => issue.path === "attachments.photo_kitchen_set")).toBe(true);
    expect(issues.some((issue) => issue.path === "attachments.menu_bilingual")).toBe(true);
    expect(issues.some((issue) => issue.path === "attachments.photo_shop_zone")).toBe(false);
    expect(issues.some((issue) => issue.path === "attachments.check_menu")).toBe(false);
  });
});

describe("狀態轉移", () => {
  it("複審補件後回到複審", () => {
    const supplement = resolveTransition({
      action: ApplicationAction.REQUEST_SUPPLEMENT,
      status: ApplicationStatus.SECOND_REVIEW,
      resumeStatus: null,
      role: UserRole.CASE_OFFICER,
      isAssignee: false,
      isSiteReviewer: true,
      hasAssignee: true,
    });
    expect(supplement.ok && supplement.toStatus).toBe(ApplicationStatus.NEED_SUPPLEMENT);
    const resubmit = resolveTransition({
      action: ApplicationAction.RESUBMIT,
      status: ApplicationStatus.NEED_SUPPLEMENT,
      resumeStatus: supplement.ok ? supplement.nextResumeStatus : null,
      role: UserRole.APPLICANT,
      isAssignee: false,
      isSiteReviewer: false,
      hasAssignee: true,
    });
    expect(resubmit.ok && resubmit.toStatus).toBe(ApplicationStatus.SECOND_REVIEW);
  });

  it("承辦不能核定", () => {
    const result = resolveTransition({
      action: ApplicationAction.APPROVE,
      status: ApplicationStatus.FINAL_REVIEW,
      resumeStatus: null,
      role: UserRole.CASE_OFFICER,
      isAssignee: true,
      isSiteReviewer: false,
      hasAssignee: true,
    });
    expect(result.ok).toBe(false);
  });

  it("初審承辦不是複審人員時不能複審通過", () => {
    const result = resolveTransition({
      action: ApplicationAction.PASS_SECOND,
      status: ApplicationStatus.SECOND_REVIEW,
      resumeStatus: null,
      role: UserRole.CASE_OFFICER,
      isAssignee: true,
      isSiteReviewer: false,
      hasAssignee: true,
    });
    expect(result.ok).toBe(false);
  });
});

describe("學習紀錄", () => {
  it("未登錄不算不合格，取消不計時數", () => {
    expect(
      buildLearningRecord({
        enrollmentStatus: EnrollmentStatus.CONFIRMED,
        attendanceStatus: AttendanceStatus.NOT_RECORDED,
        attendedMinutes: 0,
        requiredAttendanceMinutesSnapshot: 60,
      }).completion,
    ).toBe("PENDING");
    expect(
      buildLearningRecord({
        enrollmentStatus: EnrollmentStatus.CANCELLED,
        attendanceStatus: AttendanceStatus.PRESENT,
        attendedMinutes: 120,
        requiredAttendanceMinutesSnapshot: 60,
      }).countsTowardTotal,
    ).toBe(false);
  });

  it("線上課程要看完影片時間的三分之二才算通過", () => {
    expect(
      buildLearningRecord({
        enrollmentStatus: EnrollmentStatus.CONFIRMED,
        attendanceStatus: AttendanceStatus.NOT_RECORDED,
        attendedMinutes: 0,
        requiredAttendanceMinutesSnapshot: 0,
        delivery: "ONLINE",
        watchedSeconds: 39,
        videoDurationSeconds: 60,
      }).completion,
    ).toBe("PENDING");
    expect(
      buildLearningRecord({
        enrollmentStatus: EnrollmentStatus.CONFIRMED,
        attendanceStatus: AttendanceStatus.NOT_RECORDED,
        attendedMinutes: 0,
        requiredAttendanceMinutesSnapshot: 0,
        delivery: "ONLINE",
        watchedSeconds: 40,
        videoDurationSeconds: 60,
      }).completion,
    ).toBe("COMPLETED");
  });

  it("觀看進度不能一次跳到影片結尾", () => {
    expect(acceptWatchProgress({
      currentSeconds: 0,
      reportedSeconds: 60,
      videoDurationSeconds: 60,
      lastReportedAt: null,
      nowIso: "2026-10-12T08:00:00.000Z",
    })).toBe(2);
  });

  it("額滿不可報名", () => {
    const result = canEnroll({
      status: CourseStatus.PUBLISHED,
      registrationOpensAt: "2026-09-01T00:00:00.000Z",
      registrationClosesAt: "2026-10-01T00:00:00.000Z",
      capacity: 1,
      confirmedCount: 1,
      nowIso: "2026-09-28T02:00:00.000Z",
      existingStatus: null,
    });
    expect(result.ok).toBe(false);
  });
});

describe("證書與 CSV", () => {
  it("依台北日期判斷效期，不另存過期旗標", () => {
    expect(certificationValidity({ issuedOnDate: "2026-09-01", validUntilDate: "2026-09-27", today: "2026-09-28" }).label).toBe(
      "已逾效期",
    );
    expect(validateCertificationDates("2026-10-02", "2026-10-01")).toHaveLength(1);
  });

  it("避免 CSV 公式注入", () => {
    expect(sanitizeCsvCell("=1+1").startsWith("'")).toBe(true);
    expect(toCsv(["名稱"], [["=cmd"]])).toContain("'=cmd");
  });
});

describe("基礎教育訓練與專班", () => {
  it("門檻開啟時未通過不可申請", () => {
    expect(canStartVerificationApplication({ requireBasicBeforeApply: true, basicPassed: false }).ok).toBe(false);
    expect(canStartVerificationApplication({ requireBasicBeforeApply: true, basicPassed: true }).ok).toBe(true);
    expect(canStartVerificationApplication({ requireBasicBeforeApply: false, basicPassed: false }).ok).toBe(true);
  });

  it("必做模組與測驗分數", () => {
    expect(requiredModulesComplete({ requiredModuleIds: ["a", "b"], completedModuleIds: ["a"] })).toBe(false);
    expect(requiredModulesComplete({ requiredModuleIds: ["a", "b"], completedModuleIds: ["b", "a"] })).toBe(true);
    const scored = scoreBasicQuiz(
      [
        { id: "q1", correctIndex: 1, options: ["x", "y"] },
        { id: "q2", correctIndex: 0, options: ["a", "b"] },
      ],
      [
        { questionId: "q1", selectedIndex: 1 },
        { questionId: "q2", selectedIndex: 1 },
      ],
    );
    expect(scored.scorePercent).toBe(50);
    expect(quizPassed(80, 80)).toBe(true);
    expect(quizPassed(79, 80)).toBe(false);
  });

  it("抽題與題庫上傳解析", () => {
    const pool = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
    expect(drawRandomQuestions(pool, 3, () => 0)).toHaveLength(3);
    expect(quizPassedByCount(4, 4)).toBe(true);
    expect(quizPassedByCount(3, 4)).toBe(false);
    expect(basicWatchPassSeconds(100, 80)).toBe(80);
    expect(basicWatchPassSeconds(10, 80)).toBe(Number.POSITIVE_INFINITY);
    const csv = parseQuestionBankUpload("題目,選項,正解\n示範題,甲|乙|丙,1");
    expect(csv.error).toBeUndefined();
    expect(csv.rows[0]?.correctIndex).toBe(1);
    expect(validateTrainingPolicy({ requireBasicBeforeApply: true, quizDrawCount: 5, quizPassCount: 6, privateRequestMinHeadcount: 20 }).some((issue) => issue.path === "quizPassCount")).toBe(true);
  });

  it("專班人數與政策驗證", () => {
    expect(validateTrainingPolicy({ requireBasicBeforeApply: true, quizDrawCount: 5, quizPassCount: 4, privateRequestMinHeadcount: 20 })).toEqual([]);
    expect(validateCompanyTrainingRequest({
      headcount: 19,
      minHeadcount: 20,
      preferredStartsOn: "2026-12-01",
      preferredEndsOn: "2026-12-02",
      delivery: "ONLINE",
      location: "",
      note: "",
    }).some((issue) => issue.path === "headcount")).toBe(true);
    expect(validateCompanyTrainingRequest({
      headcount: 20,
      minHeadcount: 20,
      preferredStartsOn: "2026-12-01",
      preferredEndsOn: "2026-12-02",
      delivery: "ONLINE",
      location: "",
      note: "",
    })).toEqual([]);
  });
});

describe("示範資料", () => {
  it("含 8 家業者、6 門課程，且標籤覆蓋角色與狀態", () => {
    const data = buildDemoDataset();
    expect(data.organizations).toHaveLength(8);
    expect(data.applications).toHaveLength(0);
    expect(data.courses).toHaveLength(6);
    expect(data.basicModules.length).toBeGreaterThanOrEqual(2);
    expect(data.basicQuestions.length).toBeGreaterThanOrEqual(3);
    expect(data.trainingPolicy?.privateRequestMinHeadcount).toBe(20);
    expect(data.users.filter((user) => user.role === UserRole.ADMIN)).toHaveLength(1);
    expect(data.users.filter((user) => user.role === UserRole.CASE_OFFICER)).toHaveLength(2);
    expect(Object.keys(applicationStatusLabels).length).toBe(Object.values(ApplicationStatus).length);
    expect(Object.keys(userRoleLabels).length).toBe(Object.values(UserRole).length);
  });
});

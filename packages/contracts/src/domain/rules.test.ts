import { ApplicationAction, ApplicationStatus, AttendanceStatus, EnrollmentStatus, UserRole } from "@mf/db/enums";
import { describe, expect, it } from "vitest";
import { validateDraft, validateSubmit } from "./application-validation";
import { resolveTransition } from "./application-workflow";
import { certificationValidity, validateCertificationDates } from "./certification";
import { cat01DefinitionV1 } from "../fixtures/categories";
import { buildDemoDataset } from "../fixtures/demo-dataset";
import { sanitizeCsvCell, toCsv } from "./csv";
import { buildLearningRecord, canEnroll } from "./training";
import { CourseStatus } from "@mf/db/enums";
import { applicationStatusLabels, userRoleLabels } from "./status-labels";

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
});

describe("狀態轉移", () => {
  it("複審補件後回到複審", () => {
    const supplement = resolveTransition({
      action: ApplicationAction.REQUEST_SUPPLEMENT,
      status: ApplicationStatus.SECOND_REVIEW,
      resumeStatus: null,
      role: UserRole.CASE_OFFICER,
      isAssignee: true,
      hasAssignee: true,
    });
    expect(supplement.ok && supplement.toStatus).toBe(ApplicationStatus.NEED_SUPPLEMENT);
    const resubmit = resolveTransition({
      action: ApplicationAction.RESUBMIT,
      status: ApplicationStatus.NEED_SUPPLEMENT,
      resumeStatus: supplement.ok ? supplement.nextResumeStatus : null,
      role: UserRole.APPLICANT,
      isAssignee: false,
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

describe("示範資料", () => {
  it("含 40 案、8 家業者、6 門課程，且標籤覆蓋角色與狀態", () => {
    const data = buildDemoDataset();
    expect(data.organizations).toHaveLength(8);
    expect(data.applications).toHaveLength(40);
    expect(data.courses).toHaveLength(6);
    expect(data.users.filter((user) => user.role === UserRole.ADMIN)).toHaveLength(1);
    expect(data.users.filter((user) => user.role === UserRole.CASE_OFFICER)).toHaveLength(2);
    expect(Object.keys(applicationStatusLabels).length).toBe(Object.values(ApplicationStatus).length);
    expect(Object.keys(userRoleLabels).length).toBe(Object.values(UserRole).length);
  });
});

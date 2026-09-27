import {
  ApplicationAction,
  ApplicationStatus,
  AttendanceStatus,
  ConfigurationStatus,
  CourseStatus,
  EnrollmentStatus,
  NotificationJobStatus,
  NotificationType,
  UserRole,
} from "@mf/db/enums";
import { resolveTransition } from "../domain/application-workflow";
import type { CategoryDefinition } from "../domain/category-definition";
import { formatApplicationNo } from "../domain/hash";
import { categoryBlueprints, cat01DefinitionV1, cat01DefinitionV2, genericCategoryDefinition } from "./categories";

export const DEMO_PASSWORD = "Demo1234!";
export const DEMO_SOURCE_SYSTEM = "DEMO_SEED";
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

export function demoUuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

const NOW = "2026-09-28T02:00:00.000Z";

export type DemoUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  organizationId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DemoOrganization = {
  id: string;
  organizationName: string;
  taxId: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  address: string;
  createdAt: string;
  updatedAt: string;
};

export type DemoCategory = {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
};

export type DemoFormVersion = {
  id: string;
  categoryId: string;
  version: number;
  configurationStatus: ConfigurationStatus;
  definition: CategoryDefinition;
  createdAt: string;
};

export type DemoApplication = {
  id: string;
  applicationNo: string;
  organizationId: string;
  createdById: string;
  categoryId: string;
  categoryFormVersionId: string;
  status: ApplicationStatus;
  resumeStatus: ApplicationStatus | null;
  assignedToId: string | null;
  version: number;
  organizationNameSnapshot: string | null;
  taxIdSnapshot: string | null;
  contactNameSnapshot: string | null;
  contactPhoneSnapshot: string | null;
  contactEmailSnapshot: string | null;
  organizationAddressSnapshot: string | null;
  siteName: string | null;
  siteAddress: string | null;
  applicationDescription: string | null;
  declarationAccepted: boolean;
  formData: Record<string, string | number | boolean | null>;
  sourceSystem: string | null;
  sourceRecordKey: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DemoDataset = {
  generatedAt: string;
  organizations: DemoOrganization[];
  users: DemoUser[];
  categories: DemoCategory[];
  formVersions: DemoFormVersion[];
  applications: DemoApplication[];
  submissions: {
    id: string;
    applicationId: string;
    revision: number;
    submittedById: string;
    submittedAt: string;
    formVersionId: string;
    payloadSnapshot: Record<string, unknown>;
    attachmentIdsSnapshot: string[];
  }[];
  events: {
    id: string;
    applicationId: string;
    submissionId: string | null;
    actorId: string;
    action: ApplicationAction;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus | null;
    publicComment: string | null;
    internalNote: string | null;
    requestId: string;
    requestHash: string;
    createdAt: string;
  }[];
  files: {
    id: string;
    uploadedById: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    contentBase64: string;
    createdAt: string;
  }[];
  attachments: {
    id: string;
    applicationId: string;
    fileId: string;
    requirementKey: string;
    createdAt: string;
    removedAt: string | null;
  }[];
  courses: {
    id: string;
    title: string;
    description: string;
    location: string;
    startsAt: string;
    endsAt: string;
    registrationOpensAt: string;
    registrationClosesAt: string;
    capacity: number;
    durationMinutes: number;
    requiredAttendanceMinutes: number;
    status: CourseStatus;
    createdById: string;
    version: number;
    createdAt: string;
    updatedAt: string;
  }[];
  enrollments: {
    id: string;
    courseId: string;
    userId: string;
    status: EnrollmentStatus;
    attendanceStatus: AttendanceStatus;
    attendedMinutes: number;
    requiredAttendanceMinutesSnapshot: number;
    attendanceRecordedById: string | null;
    attendanceRecordedAt: string | null;
    version: number;
    enrolledAt: string;
    cancelledAt: string | null;
  }[];
  certifications: {
    id: string;
    applicationId: string;
    certificateNo: string;
    issuedOnDate: string;
    validUntilDate: string;
    registeredById: string;
    registeredAt: string;
    updatedAt: string;
  }[];
  notificationJobs: {
    id: string;
    dedupeKey: string;
    type: NotificationType;
    recipientUserId: string | null;
    recipientEmail: string;
    applicationId: string | null;
    status: NotificationJobStatus;
    attemptCount: number;
    lastErrorCode: string | null;
    createdAt: string;
    sentAt: string | null;
  }[];
  auditLogs: {
    id: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    requestId: string;
    safeChanges: Record<string, unknown>;
    createdAt: string;
  }[];
};

const ORG_NAMES = [
  ["星月廚房示範店", "12345601", "台北市大安區示範路 1 號"],
  ["和平餐飲示範公司", "12345602", "新北市板橋區示範路 2 號"],
  ["綠洲食品示範行", "12345603", "桃園市中壢區示範路 3 號"],
  ["安康旅宿示範館", "12345604", "台中市西區示範路 4 號"],
  ["清泉烘焙示範坊", "12345605", "台南市中西區示範路 5 號"],
  ["南海物流示範社", "12345606", "高雄市前金區示範路 6 號"],
  ["晨光超市示範店", "12345607", "新竹市東區示範路 7 號"],
  ["竹風文創示範社", "12345608", "嘉義市東區示範路 8 號"],
] as const;

function isoDaysBefore(days: number): string {
  return new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString();
}

function actionsFor(status: ApplicationStatus, resume: ApplicationStatus | null): ApplicationAction[] {
  if (status === ApplicationStatus.DRAFT) return [];
  if (status === ApplicationStatus.SUBMITTED) return [ApplicationAction.SUBMIT];
  if (status === ApplicationStatus.INITIAL_REVIEW) return [ApplicationAction.SUBMIT, ApplicationAction.START_REVIEW];
  if (status === ApplicationStatus.SECOND_REVIEW) {
    return [ApplicationAction.SUBMIT, ApplicationAction.START_REVIEW, ApplicationAction.PASS_INITIAL];
  }
  if (status === ApplicationStatus.FINAL_REVIEW) {
    return [
      ApplicationAction.SUBMIT,
      ApplicationAction.START_REVIEW,
      ApplicationAction.PASS_INITIAL,
      ApplicationAction.PASS_SECOND,
    ];
  }
  if (status === ApplicationStatus.APPROVED) {
    return [
      ApplicationAction.SUBMIT,
      ApplicationAction.START_REVIEW,
      ApplicationAction.PASS_INITIAL,
      ApplicationAction.PASS_SECOND,
      ApplicationAction.APPROVE,
    ];
  }
  if (status === ApplicationStatus.REJECTED) {
    return [ApplicationAction.SUBMIT, ApplicationAction.START_REVIEW, ApplicationAction.REJECT];
  }
  const head =
    resume === ApplicationStatus.FINAL_REVIEW
      ? [ApplicationAction.SUBMIT, ApplicationAction.START_REVIEW, ApplicationAction.PASS_INITIAL, ApplicationAction.PASS_SECOND]
      : resume === ApplicationStatus.SECOND_REVIEW
        ? [ApplicationAction.SUBMIT, ApplicationAction.START_REVIEW, ApplicationAction.PASS_INITIAL]
        : [ApplicationAction.SUBMIT, ApplicationAction.START_REVIEW];
  return [...head, ApplicationAction.REQUEST_SUPPLEMENT];
}

export function buildDemoDataset(): DemoDataset {
  const organizations: DemoOrganization[] = ORG_NAMES.map(([name, taxId, address], index) => ({
    id: demoUuid(0x100 + index + 1),
    organizationName: name,
    taxId,
    contactName: `聯絡人${index + 1}示範`,
    contactPhone: `091200000${index + 1}`,
    contactEmail: `org${index + 1}@example.test`,
    address,
    createdAt: isoDaysBefore(40 - index),
    updatedAt: isoDaysBefore(3),
  }));

  const users: DemoUser[] = [
    {
      id: demoUuid(0x201),
      email: "admin@example.test",
      displayName: "系統管理員（示範）",
      role: UserRole.ADMIN,
      organizationId: null,
      isActive: true,
      createdAt: isoDaysBefore(60),
      updatedAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x202),
      email: "officer.lin@example.test",
      displayName: "承辦人林示範",
      role: UserRole.CASE_OFFICER,
      organizationId: null,
      isActive: true,
      createdAt: isoDaysBefore(50),
      updatedAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x203),
      email: "officer.chen@example.test",
      displayName: "承辦人陳示範",
      role: UserRole.CASE_OFFICER,
      organizationId: null,
      isActive: true,
      createdAt: isoDaysBefore(50),
      updatedAt: isoDaysBefore(1),
    },
    ...organizations.map((org, index) => ({
      id: demoUuid(0x210 + index + 1),
      email: `applicant${String(index + 1).padStart(2, "0")}@example.test`,
      displayName: `${org.organizationName}申請人`,
      role: UserRole.APPLICANT,
      organizationId: org.id,
      isActive: true,
      createdAt: isoDaysBefore(30 - index),
      updatedAt: isoDaysBefore(2),
    })),
  ];

  const admin = users[0]!;
  const officers = [users[1]!, users[2]!];
  const applicants = users.slice(3);

  const categories: DemoCategory[] = categoryBlueprints.map((item, index) => ({
    id: demoUuid(0x300 + index + 1),
    code: item.code,
    name: item.name,
    description: item.description,
    isActive: true,
    displayOrder: index + 1,
  }));

  const formVersions: DemoFormVersion[] = [];
  const versionByCategory = new Map<string, { v1: string; latest: string; definition: CategoryDefinition }>();
  categories.forEach((category, index) => {
    const v1Id = demoUuid(0x400 + index + 1);
    const definition = category.code === "CAT_01" ? cat01DefinitionV1 : genericCategoryDefinition(category.code);
    formVersions.push({
      id: v1Id,
      categoryId: category.id,
      version: 1,
      configurationStatus: ConfigurationStatus.DEMO,
      definition,
      createdAt: isoDaysBefore(20),
    });
    let latest = v1Id;
    let latestDefinition = definition;
    if (category.code === "CAT_01") {
      const v2Id = demoUuid(0x410);
      formVersions.push({
        id: v2Id,
        categoryId: category.id,
        version: 2,
        configurationStatus: ConfigurationStatus.DEMO,
        definition: cat01DefinitionV2,
        createdAt: isoDaysBefore(5),
      });
      latest = v2Id;
      latestDefinition = cat01DefinitionV2;
    }
    versionByCategory.set(category.id, { v1: v1Id, latest, definition: latestDefinition });
  });

  const statusPattern: ApplicationStatus[] = [
    ApplicationStatus.DRAFT,
    ApplicationStatus.DRAFT,
    ApplicationStatus.SUBMITTED,
    ApplicationStatus.INITIAL_REVIEW,
    ApplicationStatus.SECOND_REVIEW,
    ApplicationStatus.NEED_SUPPLEMENT,
    ApplicationStatus.FINAL_REVIEW,
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
    ApplicationStatus.SUBMITTED,
  ];

  const applications: DemoApplication[] = [];
  const submissions: DemoDataset["submissions"] = [];
  const events: DemoDataset["events"] = [];
  const files: DemoDataset["files"] = [];
  const attachments: DemoDataset["attachments"] = [];
  const certifications: DemoDataset["certifications"] = [];
  const notificationJobs: DemoDataset["notificationJobs"] = [];

  for (let index = 1; index <= 40; index += 1) {
    const org = organizations[(index - 1) % organizations.length]!;
    const applicant = applicants[(index - 1) % applicants.length]!;
    const category = categories[(index - 1) % categories.length]!;
    const versions = versionByCategory.get(category.id)!;
    const useV2 = index === 15;
    const formVersionId = useV2 ? versions.latest : versions.v1;
    const definition = useV2 ? cat01DefinitionV2 : formVersions.find((item) => item.id === formVersionId)!.definition;
    const status = index === 15 ? ApplicationStatus.DRAFT : statusPattern[(index - 1) % statusPattern.length]!;
    const incomplete = status === ApplicationStatus.DRAFT && index % 2 === 1;
    const missingFiles = index === 2;
    const needsAssignee = status !== ApplicationStatus.DRAFT && status !== ApplicationStatus.SUBMITTED;
    const assignee = needsAssignee ? officers[index % officers.length]! : null;
    const resumeStatus =
      status === ApplicationStatus.NEED_SUPPLEMENT
        ? index === 6 || index % 10 === 6
          ? ApplicationStatus.SECOND_REVIEW
          : ApplicationStatus.INITIAL_REVIEW
        : null;
    const formData: Record<string, string | number | boolean | null> = {};
    if (!incomplete) {
      if (definition.fields.some((field) => field.key === "kitchenType")) {
        formData.kitchenType = "restaurant";
        formData.operationNote = "示範作業說明，非正式審查內容。";
        if (definition.fields.some((field) => field.key === "serviceHoursNote")) {
          formData.serviceHoursNote = "11:00-21:00（示範）";
        }
      } else {
        formData.serviceDescription = "示範服務說明，正式欄位待確認。";
        formData.operationStartDate = "2024-03-01";
      }
    }
    const application: DemoApplication = {
      id: demoUuid(0x1000 + index),
      applicationNo: formatApplicationNo(2026, index),
      organizationId: org.id,
      createdById: applicant.id,
      categoryId: category.id,
      categoryFormVersionId: formVersionId,
      status,
      resumeStatus,
      assignedToId: assignee?.id ?? null,
      version: status === ApplicationStatus.DRAFT ? 1 : 2,
      organizationNameSnapshot: incomplete ? org.organizationName : org.organizationName,
      taxIdSnapshot: incomplete ? null : org.taxId,
      contactNameSnapshot: incomplete ? null : org.contactName,
      contactPhoneSnapshot: incomplete ? null : org.contactPhone,
      contactEmailSnapshot: incomplete ? null : org.contactEmail,
      organizationAddressSnapshot: incomplete ? null : org.address,
      siteName: incomplete ? null : `${org.organizationName}場所`,
      siteAddress: incomplete ? null : org.address,
      applicationDescription: incomplete ? null : "這是示範申請說明，用來展示送件與審核流程。",
      declarationAccepted: !incomplete,
      formData,
      sourceSystem: DEMO_SOURCE_SYSTEM,
      sourceRecordKey: `demo-app-${String(index).padStart(2, "0")}`,
      submittedAt: status === ApplicationStatus.DRAFT ? null : isoDaysBefore(12),
      decidedAt:
        status === ApplicationStatus.APPROVED || status === ApplicationStatus.REJECTED ? isoDaysBefore(2) : null,
      createdAt: isoDaysBefore(20),
      updatedAt: isoDaysBefore(1),
    };
    applications.push(application);

    const attachmentIds: string[] = [];
    if (!incomplete && !missingFiles && status !== ApplicationStatus.DRAFT) {
      for (const key of ["business_registration", "site_photo"]) {
        const fileId = demoUuid(0x4000 + files.length + 1);
        const attachmentId = demoUuid(0x5000 + attachments.length + 1);
        files.push({
          id: fileId,
          uploadedById: applicant.id,
          storageKey: `demo/${application.id}/${key}.png`,
          originalName: `${key}.png`,
          mimeType: "image/png",
          sizeBytes: 70,
          sha256: "demo-placeholder-hash",
          contentBase64: TINY_PNG_BASE64,
          createdAt: isoDaysBefore(11),
        });
        attachments.push({
          id: attachmentId,
          applicationId: application.id,
          fileId,
          requirementKey: key,
          createdAt: isoDaysBefore(11),
          removedAt: null,
        });
        attachmentIds.push(attachmentId);
      }
    }

    if (status !== ApplicationStatus.DRAFT) {
      const submissionId = demoUuid(0x2000 + submissions.length + 1);
      submissions.push({
        id: submissionId,
        applicationId: application.id,
        revision: 1,
        submittedById: applicant.id,
        submittedAt: application.submittedAt ?? isoDaysBefore(12),
        formVersionId,
        payloadSnapshot: {
          schemaVersion: 1,
          categoryFormVersionId: formVersionId,
          organizationName: application.organizationNameSnapshot,
          taxId: application.taxIdSnapshot,
          contactName: application.contactNameSnapshot,
          contactPhone: application.contactPhoneSnapshot,
          contactEmail: application.contactEmailSnapshot,
          organizationAddress: application.organizationAddressSnapshot,
          siteName: application.siteName,
          siteAddress: application.siteAddress,
          applicationDescription: application.applicationDescription,
          declarationAccepted: application.declarationAccepted,
          formData,
        },
        attachmentIdsSnapshot: attachmentIds,
      });

      let cursor: ApplicationStatus = ApplicationStatus.DRAFT;
      let resume: ApplicationStatus | null = null;
      for (const action of actionsFor(status, resumeStatus)) {
        const role =
          action === ApplicationAction.SUBMIT
            ? UserRole.APPLICANT
            : action === ApplicationAction.APPROVE || action === ApplicationAction.REJECT
              ? UserRole.ADMIN
              : action === ApplicationAction.REQUEST_SUPPLEMENT && cursor === ApplicationStatus.FINAL_REVIEW
                ? UserRole.ADMIN
                : UserRole.CASE_OFFICER;
        const actorId =
          role === UserRole.APPLICANT ? applicant.id : role === UserRole.ADMIN ? admin.id : (assignee?.id ?? officers[0]!.id);
        const transition = resolveTransition({
          action,
          status: cursor,
          resumeStatus: resume,
          role,
          isAssignee: role === UserRole.CASE_OFFICER,
          hasAssignee: action !== ApplicationAction.SUBMIT,
        });
        if (!transition.ok) throw new Error(`示範資料流程無效：${application.applicationNo} ${action} ${transition.message}`);
        events.push({
          id: demoUuid(0x3000 + events.length + 1),
          applicationId: application.id,
          submissionId: action === ApplicationAction.SUBMIT ? submissionId : null,
          actorId,
          action,
          fromStatus: cursor,
          toStatus: transition.toStatus,
          publicComment:
            action === ApplicationAction.REQUEST_SUPPLEMENT
              ? "請補上場所照片與登記文件（示範意見）。"
              : action === ApplicationAction.REJECT
                ? "不符合暫定審查條件，予以退件（示範意見）。"
                : action === ApplicationAction.APPROVE
                  ? "核定通過（示範意見，非正式證書）。"
                  : action === ApplicationAction.PASS_INITIAL || action === ApplicationAction.PASS_SECOND
                    ? "審查意見：資料齊備，進入下一階段（示範）。"
                    : null,
          internalNote: action === ApplicationAction.PASS_INITIAL ? "內部註記：同一承辦初審與複審，尚未實行雙人覆核。" : null,
          requestId: `seed-${application.id}-${action}`,
          requestHash: `seed-${action}`,
          createdAt: isoDaysBefore(10),
        });
        cursor = transition.toStatus;
        resume = transition.nextResumeStatus;
      }
    }

    if (status === ApplicationStatus.APPROVED) {
      const expired = index === 8;
      certifications.push({
        id: demoUuid(0x6000 + certifications.length + 1),
        applicationId: application.id,
        certificateNo: `DEMO-${application.applicationNo}`,
        issuedOnDate: expired ? "2025-01-01" : "2026-09-01",
        validUntilDate: expired ? "2026-01-01" : "2027-08-31",
        registeredById: admin.id,
        registeredAt: isoDaysBefore(1),
        updatedAt: isoDaysBefore(1),
      });
      notificationJobs.push({
        id: demoUuid(0x7000 + notificationJobs.length + 1),
        dedupeKey: `decision:${application.id}:seed`,
        type: NotificationType.DECISION_RESULT,
        recipientUserId: applicant.id,
        recipientEmail: applicant.email,
        applicationId: application.id,
        status: NotificationJobStatus.MOCKED,
        attemptCount: 1,
        lastErrorCode: "MAIL_DRIVER_CONSOLE",
        createdAt: isoDaysBefore(1),
        sentAt: null,
      });
    }
  }

  const courses: DemoDataset["courses"] = [
    {
      id: demoUuid(0x501),
      title: "穆斯林友善廚房入門（示範）",
      description: "示範課程，說明廚房作業時的注意事項。非正式訓練綱要。",
      location: "台北市示範訓練教室 A",
      startsAt: "2026-10-20T01:00:00.000Z",
      endsAt: "2026-10-20T07:00:00.000Z",
      registrationOpensAt: "2026-09-01T00:00:00.000Z",
      registrationClosesAt: "2026-10-15T15:59:00.000Z",
      capacity: 30,
      durationMinutes: 360,
      requiredAttendanceMinutes: 180,
      status: CourseStatus.PUBLISHED,
      createdById: admin.id,
      version: 1,
      createdAt: isoDaysBefore(15),
      updatedAt: isoDaysBefore(2),
    },
    {
      id: demoUuid(0x502),
      title: "接待禮儀示範梯次（已額滿）",
      description: "名額僅 2 人，用來展示額滿狀態。",
      location: "新北市示範訓練教室 B",
      startsAt: "2026-10-22T01:00:00.000Z",
      endsAt: "2026-10-22T04:00:00.000Z",
      registrationOpensAt: "2026-09-01T00:00:00.000Z",
      registrationClosesAt: "2026-10-18T15:59:00.000Z",
      capacity: 2,
      durationMinutes: 180,
      requiredAttendanceMinutes: 120,
      status: CourseStatus.PUBLISHED,
      createdById: officers[0]!.id,
      version: 1,
      createdAt: isoDaysBefore(12),
      updatedAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x503),
      title: "報名已截止示範課程",
      description: "課程仍公開，但已過報名期限。",
      location: "台中市示範訓練教室 C",
      startsAt: "2026-11-05T01:00:00.000Z",
      endsAt: "2026-11-05T04:00:00.000Z",
      registrationOpensAt: "2026-08-01T00:00:00.000Z",
      registrationClosesAt: "2026-09-20T15:59:00.000Z",
      capacity: 20,
      durationMinutes: 180,
      requiredAttendanceMinutes: 120,
      status: CourseStatus.PUBLISHED,
      createdById: admin.id,
      version: 1,
      createdAt: isoDaysBefore(40),
      updatedAt: isoDaysBefore(8),
    },
    {
      id: demoUuid(0x504),
      title: "尚未公開的草稿課程（示範）",
      description: "草稿不會出現在公開課程列表。",
      location: "高雄市示範訓練教室 D",
      startsAt: "2026-12-01T01:00:00.000Z",
      endsAt: "2026-12-01T04:00:00.000Z",
      registrationOpensAt: "2026-11-01T00:00:00.000Z",
      registrationClosesAt: "2026-11-25T15:59:00.000Z",
      capacity: 16,
      durationMinutes: 180,
      requiredAttendanceMinutes: 120,
      status: CourseStatus.DRAFT,
      createdById: admin.id,
      version: 1,
      createdAt: isoDaysBefore(2),
      updatedAt: isoDaysBefore(2),
    },
    {
      id: demoUuid(0x505),
      title: "已結束示範課程",
      description: "含出席、缺席與待登錄三種紀錄。",
      location: "台南市示範訓練教室 E",
      startsAt: "2026-08-10T01:00:00.000Z",
      endsAt: "2026-08-10T04:00:00.000Z",
      registrationOpensAt: "2026-07-01T00:00:00.000Z",
      registrationClosesAt: "2026-08-05T15:59:00.000Z",
      capacity: 20,
      durationMinutes: 180,
      requiredAttendanceMinutes: 120,
      status: CourseStatus.COMPLETED,
      createdById: admin.id,
      version: 1,
      createdAt: isoDaysBefore(70),
      updatedAt: isoDaysBefore(20),
    },
    {
      id: demoUuid(0x506),
      title: "已取消示範課程",
      description: "取消後不可再報名。",
      location: "新竹市示範訓練教室 F",
      startsAt: "2026-10-28T01:00:00.000Z",
      endsAt: "2026-10-28T03:00:00.000Z",
      registrationOpensAt: "2026-09-01T00:00:00.000Z",
      registrationClosesAt: "2026-10-20T15:59:00.000Z",
      capacity: 12,
      durationMinutes: 120,
      requiredAttendanceMinutes: 90,
      status: CourseStatus.CANCELLED,
      createdById: officers[1]!.id,
      version: 1,
      createdAt: isoDaysBefore(9),
      updatedAt: isoDaysBefore(1),
    },
  ];

  const enrollments: DemoDataset["enrollments"] = [
    enrollment(0x601, courses[0]!.id, applicants[0]!.id, EnrollmentStatus.CONFIRMED, AttendanceStatus.NOT_RECORDED, 0, 180, null),
    enrollment(0x602, courses[0]!.id, applicants[1]!.id, EnrollmentStatus.CONFIRMED, AttendanceStatus.NOT_RECORDED, 0, 180, null),
    enrollment(0x603, courses[0]!.id, applicants[2]!.id, EnrollmentStatus.CANCELLED, AttendanceStatus.NOT_RECORDED, 0, 180, isoDaysBefore(4)),
    enrollment(0x604, courses[1]!.id, applicants[3]!.id, EnrollmentStatus.CONFIRMED, AttendanceStatus.NOT_RECORDED, 0, 120, null),
    enrollment(0x605, courses[1]!.id, applicants[4]!.id, EnrollmentStatus.CONFIRMED, AttendanceStatus.NOT_RECORDED, 0, 120, null),
    enrollment(0x606, courses[2]!.id, applicants[6]!.id, EnrollmentStatus.CONFIRMED, AttendanceStatus.NOT_RECORDED, 0, 120, null),
    enrollment(0x607, courses[4]!.id, applicants[0]!.id, EnrollmentStatus.CONFIRMED, AttendanceStatus.PRESENT, 180, 120, null, officers[0]!.id),
    enrollment(0x608, courses[4]!.id, applicants[1]!.id, EnrollmentStatus.CONFIRMED, AttendanceStatus.ABSENT, 0, 120, null, officers[0]!.id),
    enrollment(0x609, courses[4]!.id, applicants[5]!.id, EnrollmentStatus.CONFIRMED, AttendanceStatus.NOT_RECORDED, 0, 120, null),
  ];

  const auditLogs: DemoDataset["auditLogs"] = [
    {
      id: demoUuid(0x801),
      actorId: admin.id,
      action: "SEED_DEMO",
      entityType: "Dataset",
      entityId: null,
      requestId: "seed-demo",
      safeChanges: { applications: 40, note: "示範資料，非實際市場驗證" },
      createdAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x802),
      actorId: applicants[0]!.id,
      action: "LOGIN_SUCCESS",
      entityType: "User",
      entityId: applicants[0]!.id,
      requestId: "seed-login",
      safeChanges: { result: "success" },
      createdAt: isoDaysBefore(1),
    },
  ];

  return {
    generatedAt: NOW,
    organizations,
    users,
    categories,
    formVersions,
    applications,
    submissions,
    events,
    files,
    attachments,
    courses,
    enrollments,
    certifications,
    notificationJobs,
    auditLogs,
  };
}

function enrollment(
  id: number,
  courseId: string,
  userId: string,
  status: EnrollmentStatus,
  attendanceStatus: AttendanceStatus,
  attendedMinutes: number,
  requiredAttendanceMinutesSnapshot: number,
  cancelledAt: string | null,
  attendanceRecordedById: string | null = null,
): DemoDataset["enrollments"][number] {
  return {
    id: demoUuid(id),
    courseId,
    userId,
    status,
    attendanceStatus,
    attendedMinutes,
    requiredAttendanceMinutesSnapshot,
    attendanceRecordedById,
    attendanceRecordedAt: attendanceRecordedById ? isoDaysBefore(20) : null,
    version: attendanceRecordedById ? 2 : 1,
    enrolledAt: isoDaysBefore(18),
    cancelledAt,
  };
}

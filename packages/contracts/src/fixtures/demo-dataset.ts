import {
  ApplicationAction,
  ApplicationStatus,
  AttendanceStatus,
  ConfigurationStatus,
  CourseStatus,
  CourseDelivery,
  EnrollmentStatus,
  CompanyTrainingRequestStatus,
  NotificationJobStatus,
  NotificationType,
  UserRole,
} from "@mf/db/enums";
import { DEFAULT_TRAINING_POLICY } from "../domain/basic-training";
import { resolveTransition } from "../domain/application-workflow";
import type { CategoryDefinition } from "../domain/category-definition";
import { formatApplicationNo } from "../domain/hash";
import { categoryBlueprints, cat01DefinitionV1, cat01DefinitionV2, genericCategoryDefinition, officialCategoryDefinition } from "./categories";

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
  siteReviewerId: string | null;
  siteChecks: Array<{ key: string; result: "pass" | "fail" }>;
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
  fieldReviews?: Array<{ key: string; needsSupplement: boolean; publicComment: string; internalNote: string }>;
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
    capturedOnSite: boolean;
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
    delivery: CourseDelivery;
    youtubeUrl: string;
    imageFileId: string | null;
    videoFileId: string | null;
    materialFileId: string | null;
    videoDurationSeconds: number;
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
    watchedSeconds: number;
    watchUpdatedAt: string | null;
    requiredAttendanceMinutesSnapshot: number;
    attendanceRecordedById: string | null;
    attendanceRecordedAt: string | null;
    quizPassedAt: string | null;
    recognizedMinutes: number;
    version: number;
    enrolledAt: string;
    cancelledAt: string | null;
  }[];
  courseQuizAttempts: {
    id: string;
    enrollmentId: string;
    userId: string;
    correctCount: number;
    drawCount: number;
    passCountSnapshot: number;
    passed: boolean;
    drawnQuestionIds: string[];
    answers: { questionId: string; selectedIndex: number }[] | null;
    submittedAt: string | null;
    createdAt: string;
  }[];
  certifications: {
    id: string;
    applicationId: string;
    certificateNo: string;
    issuedOnDate: string;
    validUntilDate: string;
    templateKey?: string | null;
    bodyHtml?: string | null;
    registeredById: string;
    registeredAt: string;
    updatedAt: string;
  }[];
  trainingPolicy: {
    id: string;
    requireBasicBeforeApply: boolean;
    quizDrawCount: number;
    quizPassCount: number;
    privateRequestMinHeadcount: number;
    updatedById: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
  };
  basicModules: {
    id: string;
    title: string;
    description: string;
    youtubeUrl: string;
    requiredWatchPercent: number;
    sortOrder: number;
    isRequired: boolean;
    isActive: boolean;
    materialFileId: string | null;
    updatedById: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
  }[];
  basicQuestions: {
    id: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }[];
  basicProgress: {
    id: string;
    userId: string;
    moduleId: string;
    watchedSeconds: number;
    videoDurationSeconds: number;
    watchUpdatedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  basicAttempts: {
    id: string;
    userId: string;
    scorePercent: number;
    correctCount: number;
    drawCount: number;
    passCountSnapshot: number;
    passed: boolean;
    drawnQuestionIds: string[];
    answers: Array<{ questionId: string; selectedIndex: number }> | null;
    submittedAt: string | null;
    createdAt: string;
  }[];
  userBasicTrainings: {
    id: string;
    userId: string;
    passedAt: string | null;
    certificateNo: string | null;
    certificateFileId: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  companyTrainingRequests: {
    id: string;
    organizationId: string;
    requestedById: string;
    headcount: number;
    preferredStartsOn: string;
    preferredEndsOn: string;
    delivery: CourseDelivery;
    location: string;
    note: string;
    status: CompanyTrainingRequestStatus;
    adminNote: string;
    reviewedById: string | null;
    reviewedAt: string | null;
    courseId: string | null;
    version: number;
    submittedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  trainingCertificates: {
    id: string;
    enrollmentId: string;
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
    subject: string;
    body: string;
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
    displayOrder: item.displayOrder,
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
    const official = officialCategoryDefinition(category.code);
    const beforeChecklist = { ...official, attachmentRequirements: official.attachmentRequirements.filter((item) => item.group !== "checklist") };
    formVersions.push({
      id: demoUuid(0x420 + index + 1),
      categoryId: category.id,
      version: category.code === "CAT_01" ? 3 : 2,
      configurationStatus: ConfigurationStatus.CONFIRMED,
      definition: beforeChecklist,
      createdAt: isoDaysBefore(1),
    });
    formVersions.push({
      id: demoUuid(0x430 + index + 1),
      categoryId: category.id,
      version: category.code === "CAT_01" ? 4 : 3,
      configurationStatus: ConfigurationStatus.CONFIRMED,
      definition: official,
      createdAt: isoDaysBefore(0),
    });
    formVersions.push({
      id: demoUuid(0x440 + index + 1),
      categoryId: category.id,
      version: category.code === "CAT_01" ? 5 : 4,
      configurationStatus: ConfigurationStatus.CONFIRMED,
      definition: official,
      createdAt: isoDaysBefore(0),
    });
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
    const pastInitial =
      status === ApplicationStatus.SECOND_REVIEW ||
      status === ApplicationStatus.FINAL_REVIEW ||
      status === ApplicationStatus.APPROVED ||
      status === ApplicationStatus.REJECTED ||
      (status === ApplicationStatus.NEED_SUPPLEMENT && resumeStatus !== ApplicationStatus.INITIAL_REVIEW);
    const siteReviewer = pastInitial ? officers[(index + 1) % officers.length]! : null;
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
      siteReviewerId: siteReviewer?.id ?? null,
      siteChecks: [],
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
          capturedOnSite: false,
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
          role === UserRole.APPLICANT
            ? applicant.id
            : role === UserRole.ADMIN
              ? admin.id
              : cursor === ApplicationStatus.SECOND_REVIEW
                ? (siteReviewer?.id ?? assignee?.id ?? officers[0]!.id)
                : (assignee?.id ?? officers[0]!.id);
        const transition = resolveTransition({
          action,
          status: cursor,
          resumeStatus: resume,
          role,
          isAssignee: role === UserRole.CASE_OFFICER && cursor !== ApplicationStatus.SECOND_REVIEW,
          isSiteReviewer: role === UserRole.CASE_OFFICER && cursor === ApplicationStatus.SECOND_REVIEW,
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
          internalNote: action === ApplicationAction.PASS_INITIAL ? `已指定複審：${siteReviewer?.displayName ?? "未指定"}` : null,
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
        subject: "",
        body: "",
        createdAt: isoDaysBefore(1),
        sentAt: null,
      });
    }
  }

  const courses: DemoDataset["courses"] = ([
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
  ] satisfies Array<Omit<DemoDataset["courses"][number], "youtubeUrl" | "imageFileId" | "delivery" | "videoFileId" | "materialFileId" | "videoDurationSeconds">>).map((course) => ({ ...course, youtubeUrl: "", imageFileId: null, delivery: CourseDelivery.OFFLINE, videoFileId: null, materialFileId: null, videoDurationSeconds: 0 }));
  courses.push({
    id: demoUuid(0x510),
    title: "線上示範：穆斯林友善接待",
    description: "示範用線上課程。看完影片並通過測驗後，才把這一門的時數計入證明。",
    location: "",
    startsAt: "2026-11-01T01:00:00.000Z",
    endsAt: "2026-12-31T15:59:00.000Z",
    registrationOpensAt: "2026-09-01T00:00:00.000Z",
    registrationClosesAt: "2026-12-20T15:59:00.000Z",
    capacity: 40,
    durationMinutes: 60,
    requiredAttendanceMinutes: 40,
    status: CourseStatus.PUBLISHED,
    delivery: CourseDelivery.ONLINE,
    youtubeUrl: "",
    imageFileId: null,
    videoFileId: null,
    materialFileId: null,
    videoDurationSeconds: 0,
    createdById: admin.id,
    version: 1,
    createdAt: isoDaysBefore(5),
    updatedAt: isoDaysBefore(1),
  });

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

  // 展示改為只留已核定、尚未發證的案件：七類各兩筆，方便測證書對應與登錄。
  applications.length = 0;
  submissions.length = 0;
  events.length = 0;
  files.length = 0;
  attachments.length = 0;
  certifications.length = 0;
  notificationJobs.length = 0;

  const approvedSpecs: Array<{
    categoryCode: string;
    formData: Record<string, string | number | boolean | null>;
    siteLabel: string;
  }> = [
    {
      categoryCode: "CAT_01",
      siteLabel: "友善餐廳正餐示範店",
      formData: {
        applyType: "friendly_restaurant",
        mealBreakfast: false,
        mealLunch: true,
        mealDinner: true,
        mealDrink: false,
        mealSnack: false,
        certificateNameEn: "Star Moon Kitchen Demo Restaurant",
        certificateAddressEn: "1 Demo Rd., Da’an Dist., Taipei City, Taiwan",
        certificatePhone: "+886-2-2700-0001",
        usesMeat: false,
      },
    },
    {
      categoryCode: "CAT_01",
      siteLabel: "Halal廚房示範店",
      formData: {
        applyType: "halal_kitchen",
        mealBreakfast: false,
        mealLunch: false,
        mealDinner: false,
        mealDrink: false,
        mealSnack: false,
        certificateNameEn: "Halal Kitchen Demo Co.",
        certificateAddressEn: "2 Demo Rd., Da’an Dist., Taipei City, Taiwan",
        certificatePhone: "+886-2-2700-0002",
        usesMeat: false,
      },
    },
    {
      categoryCode: "CAT_02",
      siteLabel: "Halal產品示範廠 A",
      formData: {
        certificateNameEn: "Halal Product Demo Factory A",
        certificateAddressEn: "3 Demo Rd., Taichung City, Taiwan",
        certificatePhone: "+886-4-2200-0001",
        productDetail: "示範產品清單（非正式）",
        halalTeam: "示範清真小組名單",
        usesMeat: false,
      },
    },
    {
      categoryCode: "CAT_02",
      siteLabel: "Halal產品示範廠 B",
      formData: {
        certificateNameEn: "Halal Product Demo Factory B",
        certificateAddressEn: "4 Demo Rd., Taichung City, Taiwan",
        certificatePhone: "+886-4-2200-0002",
        productDetail: "示範產品清單 B",
        halalTeam: "示範清真小組名單 B",
        usesMeat: false,
      },
    },
    {
      categoryCode: "CAT_03",
      siteLabel: "友善旅宿含早餐示範",
      formData: {
        applyType: "with_breakfast",
        certificateNameEn: "Friendly Stay with Breakfast Demo",
        certificateAddressEn: "5 Demo Rd., Hualien City, Taiwan",
        certificatePhone: "+886-3-8200-0001",
        lodgingLicenseNo: "LODGE-DEMO-001",
        roomDetail: "101 雙人房 2 間",
        usesMeat: false,
      },
    },
    {
      categoryCode: "CAT_03",
      siteLabel: "友善旅宿不含早餐示範",
      formData: {
        applyType: "without_breakfast",
        certificateNameEn: "Friendly Stay without Breakfast Demo",
        certificateAddressEn: "6 Demo Rd., Hualien City, Taiwan",
        certificatePhone: "+886-3-8200-0002",
        lodgingLicenseNo: "LODGE-DEMO-002",
        roomDetail: "201 雙人房 3 間",
      },
    },
    {
      categoryCode: "CAT_04",
      siteLabel: "友善商店示範 A",
      formData: {
        certificateNameEn: "Muslim Friendly Store Demo A",
        certificateAddressEn: "7 Demo Rd., Tainan City, Taiwan",
        certificatePhone: "+886-6-2200-0001",
      },
    },
    {
      categoryCode: "CAT_04",
      siteLabel: "友善商店示範 B",
      formData: {
        certificateNameEn: "Muslim Friendly Store Demo B",
        certificateAddressEn: "8 Demo Rd., Tainan City, Taiwan",
        certificatePhone: "+886-6-2200-0002",
      },
    },
    {
      categoryCode: "CAT_05",
      siteLabel: "友善旅行社示範 A",
      formData: {
        certificateNameEn: "Muslim Friendly Travel Demo A",
        certificateAddressEn: "9 Demo Rd., Kaohsiung City, Taiwan",
        certificatePhone: "+886-7-3300-0001",
      },
    },
    {
      categoryCode: "CAT_05",
      siteLabel: "友善旅行社示範 B",
      formData: {
        certificateNameEn: "Muslim Friendly Travel Demo B",
        certificateAddressEn: "10 Demo Rd., Kaohsiung City, Taiwan",
        certificatePhone: "+886-7-3300-0002",
      },
    },
    {
      categoryCode: "CAT_06",
      siteLabel: "友善環境示範 A",
      formData: {
        certificateNameEn: "Muslim Friendly Environment Demo A",
        certificateAddressEn: "11 Demo Rd., Taoyuan City, Taiwan",
        certificatePhone: "+886-3-3500-0001",
      },
    },
    {
      categoryCode: "CAT_06",
      siteLabel: "友善環境示範 B",
      formData: {
        certificateNameEn: "Muslim Friendly Environment Demo B",
        certificateAddressEn: "12 Demo Rd., Taoyuan City, Taiwan",
        certificatePhone: "+886-3-3500-0002",
      },
    },
    {
      categoryCode: "CAT_07",
      siteLabel: "友善體驗活動示範 A",
      formData: {
        certificateNameEn: "Muslim Friendly Experience Demo A",
        certificateAddressEn: "13 Demo Rd., Nantou County, Taiwan",
        certificatePhone: "+886-49-220-0001",
      },
    },
    {
      categoryCode: "CAT_07",
      siteLabel: "友善體驗活動示範 B",
      formData: {
        certificateNameEn: "Muslim Friendly Experience Demo B",
        certificateAddressEn: "14 Demo Rd., Nantou County, Taiwan",
        certificatePhone: "+886-49-220-0002",
      },
    },
  ];

  approvedSpecs.forEach((spec, index) => {
    const n = index + 1;
    const category = categories.find((item) => item.code === spec.categoryCode)!;
    const formVersion = [...formVersions]
      .filter((item) => item.categoryId === category.id && item.configurationStatus === ConfigurationStatus.CONFIRMED)
      .sort((a, b) => b.version - a.version)[0]!;
    const org = organizations[(n - 1) % organizations.length]!;
    const applicant = applicants[(n - 1) % applicants.length]!;
    const assignee = officers[n % officers.length]!;
    const siteReviewer = officers[(n + 1) % officers.length]!;
    const applicationId = demoUuid(0x1800 + n);
    const applicationNo = formatApplicationNo(2026, 900 + n);
    const formData = {
      ...spec.formData,
      managerName: "示範主管",
      managerTitle: "經理",
    };
    const application: DemoApplication = {
      id: applicationId,
      applicationNo,
      organizationId: org.id,
      createdById: applicant.id,
      categoryId: category.id,
      categoryFormVersionId: formVersion.id,
      status: ApplicationStatus.APPROVED,
      resumeStatus: null,
      assignedToId: assignee.id,
      siteReviewerId: siteReviewer.id,
      siteChecks: [],
      version: 4,
      organizationNameSnapshot: org.organizationName,
      taxIdSnapshot: org.taxId,
      contactNameSnapshot: org.contactName,
      contactPhoneSnapshot: org.contactPhone,
      contactEmailSnapshot: org.contactEmail,
      organizationAddressSnapshot: org.address,
      siteName: spec.siteLabel,
      siteAddress: org.address,
      applicationDescription: `已核定待發證示範案件（${category.name}）。`,
      declarationAccepted: true,
      formData,
      sourceSystem: DEMO_SOURCE_SYSTEM,
      sourceRecordKey: `demo-cert-ready-${String(n).padStart(2, "0")}`,
      submittedAt: isoDaysBefore(20),
      decidedAt: isoDaysBefore(1),
      createdAt: isoDaysBefore(25),
      updatedAt: isoDaysBefore(1),
    };
    applications.push(application);

    const attachmentIds: string[] = [];
    for (const key of ["registration_copy", "operating_license"]) {
      const fileId = demoUuid(0x4800 + files.length + 1);
      const attachmentId = demoUuid(0x5800 + attachments.length + 1);
      files.push({
        id: fileId,
        uploadedById: applicant.id,
        storageKey: `demo/${application.id}/${key}.png`,
        originalName: `${key}.png`,
        mimeType: "image/png",
        sizeBytes: 70,
        sha256: "demo-placeholder-hash",
        contentBase64: TINY_PNG_BASE64,
        createdAt: isoDaysBefore(18),
      });
      attachments.push({
        id: attachmentId,
        applicationId: application.id,
        fileId,
        requirementKey: key,
        capturedOnSite: false,
        createdAt: isoDaysBefore(18),
        removedAt: null,
      });
      attachmentIds.push(attachmentId);
    }

    const submissionId = demoUuid(0x2800 + n);
    submissions.push({
      id: submissionId,
      applicationId: application.id,
      revision: 1,
      submittedById: applicant.id,
      submittedAt: application.submittedAt!,
      formVersionId: formVersion.id,
      payloadSnapshot: {
        schemaVersion: 1,
        categoryFormVersionId: formVersion.id,
        organizationName: application.organizationNameSnapshot,
        taxId: application.taxIdSnapshot,
        contactName: application.contactNameSnapshot,
        contactPhone: application.contactPhoneSnapshot,
        contactEmail: application.contactEmailSnapshot,
        organizationAddress: application.organizationAddressSnapshot,
        siteName: application.siteName,
        siteAddress: application.siteAddress,
        applicationDescription: application.applicationDescription,
        declarationAccepted: true,
        formData,
      },
      attachmentIdsSnapshot: attachmentIds,
    });

    const flow: Array<{ action: ApplicationAction; actorId: string; from: ApplicationStatus; to: ApplicationStatus; comment?: string }> = [
      { action: ApplicationAction.SUBMIT, actorId: applicant.id, from: ApplicationStatus.DRAFT, to: ApplicationStatus.SUBMITTED },
      { action: ApplicationAction.START_REVIEW, actorId: assignee.id, from: ApplicationStatus.SUBMITTED, to: ApplicationStatus.INITIAL_REVIEW },
      { action: ApplicationAction.PASS_INITIAL, actorId: assignee.id, from: ApplicationStatus.INITIAL_REVIEW, to: ApplicationStatus.SECOND_REVIEW, comment: `已指定複審：${siteReviewer.displayName}` },
      { action: ApplicationAction.PASS_SECOND, actorId: siteReviewer.id, from: ApplicationStatus.SECOND_REVIEW, to: ApplicationStatus.FINAL_REVIEW },
      { action: ApplicationAction.APPROVE, actorId: admin.id, from: ApplicationStatus.FINAL_REVIEW, to: ApplicationStatus.APPROVED, comment: "核定通過，待發證（示範）。" },
    ];
    flow.forEach((step, stepIndex) => {
      events.push({
        id: demoUuid(0x3800 + events.length + 1),
        applicationId: application.id,
        submissionId: step.action === ApplicationAction.SUBMIT ? submissionId : null,
        actorId: step.actorId,
        action: step.action,
        fromStatus: step.from,
        toStatus: step.to,
        publicComment: step.comment ?? null,
        internalNote: step.action === ApplicationAction.PASS_INITIAL ? step.comment ?? null : null,
        requestId: `seed-cert-${application.id}-${step.action}`,
        requestHash: `seed-cert-${step.action}`,
        createdAt: isoDaysBefore(15 - stepIndex),
      });
    });
  });

  const auditLogs: DemoDataset["auditLogs"] = [
    {
      id: demoUuid(0x801),
      actorId: admin.id,
      action: "SEED_DEMO",
      entityType: "Dataset",
      entityId: null,
      requestId: "seed-demo",
      safeChanges: { applications: applications.length, note: "七類各兩筆已核定待發證示範案件" },
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

  const trainingPolicy: DemoDataset["trainingPolicy"] = {
    id: demoUuid(0x900),
    requireBasicBeforeApply: DEFAULT_TRAINING_POLICY.requireBasicBeforeApply,
    quizDrawCount: DEFAULT_TRAINING_POLICY.quizDrawCount,
    quizPassCount: DEFAULT_TRAINING_POLICY.quizPassCount,
    privateRequestMinHeadcount: DEFAULT_TRAINING_POLICY.privateRequestMinHeadcount,
    updatedById: admin.id,
    version: 1,
    createdAt: isoDaysBefore(30),
    updatedAt: isoDaysBefore(1),
  };

  const basicModules: DemoDataset["basicModules"] = [
    {
      id: demoUuid(0x910),
      title: "基礎課1：穆斯林友善與 Halal 基礎概念（示範）",
      description: "示範設定。說明穆斯林友善場域的基本概念、禁止項目與服務注意事項。可搭配網址與教材檔。正式教材待甲方提供後替換。",
      youtubeUrl: "",
      requiredWatchPercent: 80,
      sortOrder: 1,
      isRequired: true,
      isActive: true,
      materialFileId: null,
      updatedById: admin.id,
      version: 1,
      createdAt: isoDaysBefore(30),
      updatedAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x911),
      title: "基礎課2：申請與現場複審流程概要（示範）",
      description: "示範設定。說明業者送件附件、初審與現場複審的角色分工。正式流程說明待確認。",
      youtubeUrl: "",
      requiredWatchPercent: 80,
      sortOrder: 2,
      isRequired: true,
      isActive: true,
      materialFileId: null,
      updatedById: admin.id,
      version: 1,
      createdAt: isoDaysBefore(30),
      updatedAt: isoDaysBefore(1),
    },
  ];

  const basicQuestions: DemoDataset["basicQuestions"] = [
    {
      id: demoUuid(0x920),
      prompt: "示範題：穆斯林友善服務中，酒精類飲料應如何處理？",
      options: ["可與 Halal 餐點並陳", "應避免提供或以明確方式與 Halal 區隔", "只可在大廳販售", "沒有限制"],
      correctIndex: 1,
      sortOrder: 1,
      isActive: true,
      createdAt: isoDaysBefore(30),
      updatedAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x921),
      prompt: "示範題：肉品若要符合 Halal，通常需要什麼？",
      options: ["只要新鮮即可", "Halal 證書與可追溯採購證明", "進口即可", "廚師口頭保證即可"],
      correctIndex: 1,
      sortOrder: 2,
      isActive: true,
      createdAt: isoDaysBefore(30),
      updatedAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x922),
      prompt: "示範題：現場複審主要核對什麼？",
      options: ["只看合約金額", "業者送件附件，必要時可加拍現場存證", "只看社群貼文", "只看統編"],
      correctIndex: 1,
      sortOrder: 3,
      isActive: true,
      createdAt: isoDaysBefore(30),
      updatedAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x923),
      prompt: "示範題：驗證申請前通常需要先完成什麼？",
      options: ["廣告投放", "基礎教育訓練內容與測驗", "只填統編", "現場拍照即可"],
      correctIndex: 1,
      sortOrder: 4,
      isActive: true,
      createdAt: isoDaysBefore(30),
      updatedAt: isoDaysBefore(1),
    },
    {
      id: demoUuid(0x924),
      prompt: "示範題：Halal 相關證明文件建議如何保存？",
      options: ["口頭告知即可", "妥善保存並可供查核", "只放社群", "不必保存"],
      correctIndex: 1,
      sortOrder: 5,
      isActive: true,
      createdAt: isoDaysBefore(30),
      updatedAt: isoDaysBefore(1),
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
    courseQuizAttempts: [],
    certifications,
    trainingPolicy,
    basicModules,
    basicQuestions,
    basicProgress: [],
    basicAttempts: [],
    userBasicTrainings: [],
    companyTrainingRequests: [],
    trainingCertificates: [],
    notificationJobs: [],
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
    watchedSeconds: 0,
    watchUpdatedAt: null,
    requiredAttendanceMinutesSnapshot,
    attendanceRecordedById,
    attendanceRecordedAt: attendanceRecordedById ? isoDaysBefore(20) : null,
    quizPassedAt: null,
    recognizedMinutes: 0,
    version: attendanceRecordedById ? 2 : 1,
    enrolledAt: isoDaysBefore(18),
    cancelledAt,
  };
}

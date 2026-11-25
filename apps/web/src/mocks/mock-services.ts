import {
  APP_NAME,
  ApplicationAction,
  ApplicationStatus,
  ConfigurationStatus,
  AttendanceStatus,
  CourseStatus,
  DEMO_CONTACT_EMAIL,
  DEMO_PASSWORD,
  EnrollmentStatus,
  FILE_POLICY,
  UserRole,
  PLATFORM_FEATURES,
  roleForAccountFeatures,
  defaultFeatureEnabled,
  acceptWatchProgress,
  auditCategoryOf,
  auditRetentionCutoff,
  buildDemoDataset,
  categoryBlueprints,
  officialCategoryDefinition,
  buildLearningRecord,
  canCancelEnrollment,
  courseQuizState,
  drawRandomQuestions,
  quizPassedByCount,
  scoreBasicQuiz,
  detectCourseVideo,
  onlinePassSeconds,
  withdrawState,
  canEditApplicationContent,
  canEnroll,
  canViewApplication,
  commentRequirement,
  customerNotice,
  DEFAULT_MAIL_TEMPLATES,
  renewalNotice,
  isMailTemplateKey,
  mailSendSchema,
  mailTemplateWriteSchema,
  isContractRenewalDue,
  daysUntilContractExpiry,
  CONTRACT_RENEWAL_WINDOW_DAYS,
  checkFieldReviews,
  reviewTargets,
  ATTACHMENT_MIME_TYPES,
  detectAttachmentSignature,
  detectFileSignature,
  formatByteLimit,
  isAttachmentMimeType,
  formatApplicationNo,
  minutesToHourLabel,
  pageMeta,
  parseCategoryDefinition,
  remainingSeats,
  resolveTransition,
  sha256Hex,
  snapshotPayload,
  taipeiYear,
  validateAttendance,
  validateCourseDraft,
  validateDraft,
  validateSubmit,
  certificationValidity,
  validateCertificationDates,
  toCsv,
  reportFieldsFor,
  countReportValues,
  reportPreviewSchema,
  reportSelectionsSchema,
  reportSectionsCsv,
  sourceLabel,
  applicationStatusLabels,
  enrollmentStatusLabels,
  attendanceStatusLabels,
  contractStatusLabels,
  DEFAULT_CONTRACT_BODY,
  DEFAULT_CONTRACT_TITLE,
  ensureContractHtml,
  buildCertificateFillValues,
  fillCertificateHtml,
  findCertificateTemplateDef,
  matchCertificateTemplates,
  parseCsv,
  rowsToObjects,
  type CertificateTemplateKey,
  type DemoDataset,
} from "@mf/contracts";
import { ClientError, type Services } from "../services/types";
import {
  accessSettings,
  adminContracts,
  adminSite,
  contractDocument,
  contractOf,
  createInitialPlatform,
  assertMockServiceUnlocked,
  confirmReconciliation,
  createPlan,
  deletePlan,
  markPaidPending,
  paymentDesk,
  paymentReceipt,
  reviewPayment,
  uploadPaymentReceipt,
  recordPayment,
  myPayments,
  removePlanImage,
  selectPlan,
  updatePlan,
  uploadPlanImage,
  adminEntries,
  createEntry,
  deleteEntry,
  ensureAccountFeatures,
  ensureCertificateTemplates,
  ensureEditorial,
  ensureOperationSetting,
  readOperationSetting,
  readSystemConnection,
  saveSystemConnection,
  saveOperationSetting,
  fixHalalSpelling,
  grantAccountFeatures,
  hasFeature,
  createTemplate,
  createTemplateVersion,
  getContractSeals,
  issueContract,
  recallContract,
  reviseContract,
  listCertificateTemplates,
  listIssuableOrganizations,
  listTemplates,
  myContracts,
  publicSite,
  rememberFile,
  renderCertificateBrowserPdf,
  uploadCertificateLogo,
  uploadCertificateSignature,
  uploadContractSeal,
  updateSealPositions,
  updateEntry,
  recordRenewal,
  saveCertificateTemplate,
  saveSite,
  saveTemplate,
  uploadSignedContractPdf,
  updateFeature,
  updateIntegration,
  uploadEntryImage,
  uploadSiteImage,
  type PlatformState,
} from "./platform";
import { assertCanApply, ensureTrainingData, trainingDesk } from "./training-desk";
import { adminSitePages, createSitePage, deleteSitePage, publicSitePages, publishSitePage, reorderSitePages, updateSitePage } from "./site-pages";

type State = {
  data: DemoDataset;
  digests: Record<string, string>;
  sequence: number;
  imports: Array<{ id: string; type: "ORGANIZATIONS" | "APPLICATION_DRAFTS"; status: string; rows: { rowNumber: number; ok: boolean; messages: string[]; preview: Record<string, string> }[]; records: Record<string, string>[]; ready: boolean; commitKey?: string; committed?: number }>;
  resetTokens: Array<{ token: string; userId: string; expiresAt: string; used: boolean }>;
  platform: PlatformState;
};

const KEY = "mf-demo-state-v3";

function ensureSiteReview(state: State) {
  for (const app of state.data.applications) {
    app.siteReviewerId ??= null;
    if (!Array.isArray(app.siteChecks)) app.siteChecks = [];
    const pastInitial =
      app.status === ApplicationStatus.SECOND_REVIEW ||
      app.status === ApplicationStatus.FINAL_REVIEW ||
      app.status === ApplicationStatus.APPROVED ||
      app.status === ApplicationStatus.REJECTED ||
      (app.status === ApplicationStatus.NEED_SUPPLEMENT && app.resumeStatus !== ApplicationStatus.INITIAL_REVIEW && app.resumeStatus !== null);
    if (pastInitial && !app.siteReviewerId && app.assignedToId) app.siteReviewerId = app.assignedToId;
  }
  for (const item of state.data.attachments) item.capturedOnSite ??= false;
}

const categoryFormDrafts = new Map<string, ReturnType<typeof parseCategoryDefinition>>();

function attachmentLimits(state: State) {
  const row = ensureOperationSetting(state.platform);
  const maxFileBytes = row.attachmentMaxBytes ?? 10 * 1024 * 1024;
  return { maxFileBytes, maxApplicationBytes: Math.max(FILE_POLICY.maxApplicationBytes, maxFileBytes) };
}

function ensureOfficialCategories(state: State) {
  const now = new Date().toISOString();
  for (const blueprint of categoryBlueprints) {
    const category = state.data.categories.find((item) => item.code === blueprint.code);
    if (!category) continue;
    category.name = blueprint.name;
    category.description = blueprint.description;
    const versions = state.data.formVersions.filter((item) => item.categoryId === category.id);
    const parsed = versions.flatMap((item) => {
      try { return [parseCategoryDefinition(item.definition)]; } catch { return []; }
    });
    const hasForm = parsed.some((definition) => definition.fields.some((field) => field.key === "certificateNameEn"));
    const newest = [...versions].sort((a, b) => b.version - a.version)[0];
    let newestHasApplicantChecklist = false;
    if (newest) {
      try {
        newestHasApplicantChecklist = parseCategoryDefinition(newest.definition).attachmentRequirements.some((item) => item.group === "checklist");
      } catch {
        newestHasApplicantChecklist = false;
      }
    }
    let newestDefinition = null as ReturnType<typeof parseCategoryDefinition> | null;
    if (newest) {
      try { newestDefinition = parseCategoryDefinition(newest.definition); } catch { newestDefinition = null; }
    }
    const hasFixedForm = (() => {
      if (!newestDefinition) return false;
      if (newestDefinition.fields.some((field) => ["scopeKitchen", "mealBreakfast", "lodgingBreakfast", "scopeShop", "scopeEnvironment", "activityWithFood"].includes(field.key))) {
        return false;
      }
      if (blueprint.code === "CAT_01") {
        return newestDefinition.fields.some((field) => field.key === "applyType")
          && newestDefinition.fields.some((field) => field.key === "mealBreakfast")
          && newestDefinition.attachmentRequirements.some((item) => item.key === "menu_drink_snack")
          && !newestDefinition.fields.some((field) => field.key === "mealMain");
      }
      if (blueprint.code === "CAT_03") {
        return newestDefinition.fields.some((field) => field.key === "applyType"
          && field.options?.some((option) => option.value === "with_breakfast"));
      }
      if (blueprint.code === "CAT_02") return newestDefinition.attachmentRequirements.some((item) => item.key === "halal_team_list");
      if (blueprint.code === "CAT_04") return newestDefinition.attachmentRequirements.some((item) => item.key === "photo_shop_display");
      if (blueprint.code === "CAT_05") return newestDefinition.attachmentRequirements.some((item) => item.key === "itinerary_files");
      if (blueprint.code === "CAT_06") return newestDefinition.attachmentRequirements.some((item) => item.key === "photo_prayer_restroom");
      if (blueprint.code === "CAT_07") return newestDefinition.attachmentRequirements.some((item) => item.key === "photo_activity_set");
      return true;
    })();
    if (hasForm && !newestHasApplicantChecklist && hasFixedForm) continue;
    const nextVersion = versions.reduce((max, item) => Math.max(max, item.version), 0) + 1;
    state.data.formVersions.push({
      id: crypto.randomUUID(),
      categoryId: category.id,
      version: nextVersion,
      configurationStatus: ConfigurationStatus.CONFIRMED,
      definition: officialCategoryDefinition(blueprint.code),
      createdAt: now,
    });
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mf-demo", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("kv");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(): Promise<State | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("kv").objectStore("kv").get(KEY);
    request.onsuccess = () => resolve((request.result as State | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(state: State) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction("kv", "readwrite").objectStore("kv").put(state, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function actorOf(state: State) {
  const id = sessionStorage.getItem("mf-demo-user");
  const user = state.data.users.find((item) => item.id === id);
  if (!user || !user.isActive) return null;
  return user;
}

function requireActor(state: State) {
  const actor = actorOf(state);
  if (!actor) throw new ClientError("請先登入", { status: 401, code: "UNAUTHENTICATED" });
  return actor;
}

function publicUser(state: State, user: DemoDataset["users"][number]) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    organizationId: user.organizationId,
    isActive: user.isActive,
    featureKeys: state.platform.features.filter((item) => item.userId === user.id && item.enabled).map((item) => item.featureKey),
  };
}

function toDetail(state: State, id: string, viewer: DemoDataset["users"][number]) {
  const app = state.data.applications.find((item) => item.id === id);
  if (!app || !canViewApplication(viewer, app)) throw new ClientError("找不到案件", { status: 404, code: "NOT_FOUND" });
  const org = state.data.organizations.find((item) => item.id === app.organizationId);
  const category = state.data.categories.find((item) => item.id === app.categoryId);
  const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId);
  const assignee = state.data.users.find((item) => item.id === app.assignedToId);
  const siteReviewer = state.data.users.find((item) => item.id === app.siteReviewerId);
  if (!org || !category || !version) throw new ClientError("案件資料不完整", { status: 500 });
  const definition = parseCategoryDefinition(version.definition);
  const staff = viewer.role !== UserRole.APPLICANT;
  const attachments = state.data.attachments
    .filter((item) => item.applicationId === app.id && !item.removedAt && (staff || !item.capturedOnSite))
    .map((item) => {
      const file = state.data.files.find((entry) => entry.id === item.fileId)!;
      return { id: item.id, requirementKey: item.requirementKey, fileId: item.fileId, originalName: file.originalName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, capturedOnSite: Boolean(item.capturedOnSite), createdAt: item.createdAt };
    });
  return {
    id: app.id,
    applicationNo: app.applicationNo,
    organizationId: app.organizationId,
    categoryId: app.categoryId,
    categoryCode: category.code,
    categoryName: category.name,
    status: app.status,
    assignedToId: app.assignedToId,
    assignedToName: assignee?.displayName ?? null,
    siteReviewerId: staff ? app.siteReviewerId ?? null : null,
    siteReviewerName: staff ? siteReviewer?.displayName ?? null : null,
    certificateNo: state.data.certifications.find((item) => item.applicationId === app.id)?.certificateNo ?? null,
    issuedOnDate: state.data.certifications.find((item) => item.applicationId === app.id)?.issuedOnDate ?? null,
    validUntilDate: state.data.certifications.find((item) => item.applicationId === app.id)?.validUntilDate ?? null,
    templateKey: state.data.certifications.find((item) => item.applicationId === app.id)?.templateKey ?? null,
    version: app.version,
    submittedAt: app.submittedAt,
    updatedAt: app.updatedAt,
    createdAt: app.createdAt,
    organizationName: app.organizationNameSnapshot ?? org.organizationName,
    taxId: app.taxIdSnapshot,
    contactName: app.contactNameSnapshot,
    contactPhone: app.contactPhoneSnapshot,
    contactEmail: app.contactEmailSnapshot,
    organizationAddress: app.organizationAddressSnapshot,
    siteName: app.siteName,
    siteAddress: app.siteAddress,
    applicationDescription: app.applicationDescription,
    declarationAccepted: app.declarationAccepted,
    formData: app.formData,
    categoryFormVersionId: app.categoryFormVersionId,
    formVersion: version.version,
    configurationStatus: version.configurationStatus,
    definition,
    resumeStatus: app.resumeStatus,
    createdById: app.createdById,
    sourceSystem: app.sourceSystem,
    sourceRecordKey: app.sourceRecordKey,
    decidedAt: app.decidedAt,
    attachments,
    fieldReviews: (app.fieldReviews ?? []).map((item) => ({ ...item, internalNote: viewer.role === UserRole.APPLICANT ? "" : item.internalNote })),
    siteChecks: staff ? app.siteChecks ?? [] : [],
  };
}

function listItem(detail: ReturnType<typeof toDetail>) {
  const { definition: _definition, attachments: _attachments, formData: _formData, ...item } = detail;
  return item;
}

function content(app: DemoDataset["applications"][number]) {
  return {
    organizationName: app.organizationNameSnapshot,
    taxId: app.taxIdSnapshot,
    contactName: app.contactNameSnapshot,
    contactPhone: app.contactPhoneSnapshot,
    contactEmail: app.contactEmailSnapshot,
    organizationAddress: app.organizationAddressSnapshot,
    siteName: app.siteName,
    siteAddress: app.siteAddress,
    applicationDescription: app.applicationDescription,
    declarationAccepted: app.declarationAccepted,
    formData: app.formData,
  };
}

function courseImage(state: State, course: DemoDataset["courses"][number]) {
  const file = course.imageFileId ? state.data.files.find((item) => item.id === course.imageFileId) : undefined;
  return file ? `data:${file.mimeType};base64,${file.contentBase64}` : null;
}

function courseDto(state: State, course: DemoDataset["courses"][number]) {
  const confirmedCount = state.data.enrollments.filter((item) => item.courseId === course.id && item.status === EnrollmentStatus.CONFIRMED).length;
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    delivery: course.delivery ?? "OFFLINE",
    youtubeUrl: course.youtubeUrl ?? "",
    imageUrl: courseImage(state, course),
    hasVideo: Boolean(course.videoFileId),
    hasMaterial: Boolean(course.materialFileId),
    materialName: course.materialFileId ? state.data.files.find((item) => item.id === course.materialFileId)?.originalName ?? "已上傳" : null,
    videoDurationSeconds: course.videoDurationSeconds ?? 0,
    location: course.location,
    startsAt: course.startsAt,
    endsAt: course.endsAt,
    registrationOpensAt: course.registrationOpensAt,
    registrationClosesAt: course.registrationClosesAt,
    capacity: course.capacity,
    confirmedCount,
    remainingSeats: remainingSeats(course.capacity, confirmedCount),
    durationMinutes: course.durationMinutes,
    requiredAttendanceMinutes: course.requiredAttendanceMinutes,
    status: course.status,
    version: course.version,
    isDemo: course.title.includes("示範"),
  };
}

function learningOf(state: State, enrollment: DemoDataset["enrollments"][number]) {
  const course = state.data.courses.find((item) => item.id === enrollment.courseId)!;
  const user = state.data.users.find((item) => item.id === enrollment.userId)!;
  const org = state.data.organizations.find((item) => item.id === user.organizationId);
  const delivery = course.delivery ?? "OFFLINE";
  const watchedSeconds = enrollment.watchedSeconds ?? 0;
  const videoDurationSeconds = course.videoDurationSeconds ?? 0;
  const learning = buildLearningRecord({
    enrollmentStatus: enrollment.status,
    attendanceStatus: enrollment.attendanceStatus,
    attendedMinutes: enrollment.attendedMinutes,
    requiredAttendanceMinutesSnapshot: enrollment.requiredAttendanceMinutesSnapshot,
    delivery,
    watchedSeconds,
    videoDurationSeconds,
  });
  const passSeconds = delivery === "ONLINE" ? onlinePassSeconds(videoDurationSeconds) : 0;
  const quiz = courseQuizState({
    enrollmentStatus: enrollment.status,
    attendanceStatus: enrollment.attendanceStatus,
    delivery,
    watchedSeconds,
    videoDurationSeconds,
    endsAtIso: course.endsAt,
    nowIso: new Date().toISOString(),
    quizPassedAt: enrollment.quizPassedAt ?? null,
    recognizedMinutes: enrollment.recognizedMinutes ?? 0,
  });
  const withdraw = withdrawState({
    enrollmentStatus: enrollment.status,
    completed: learning.completion === "COMPLETED" || quiz.quizPassed,
    registrationClosesAt: course.registrationClosesAt,
    nowIso: new Date().toISOString(),
  });
  return {
    id: enrollment.id,
    courseId: course.id,
    courseTitle: course.title,
    userId: user.id,
    userName: user.displayName,
    userEmail: user.email,
    organizationName: org?.organizationName ?? null,
    status: enrollment.status,
    attendanceStatus: enrollment.attendanceStatus,
    attendedMinutes: enrollment.attendedMinutes,
    watchedSeconds,
    requiredAttendanceMinutesSnapshot: enrollment.requiredAttendanceMinutesSnapshot,
    delivery,
    videoDurationSeconds,
    passSeconds: Number.isFinite(passSeconds) ? passSeconds : 0,
    durationMinutes: course.durationMinutes,
    canCancel: withdraw.canCancel,
    withdrawLabel: withdraw.label,
    completion: learning.completion,
    countsTowardTotal: learning.countsTowardTotal,
    attendedHoursLabel: minutesToHourLabel(delivery === "ONLINE" ? Math.floor(watchedSeconds / 60) : enrollment.attendedMinutes),
    version: enrollment.version,
    enrolledAt: enrollment.enrolledAt,
    cancelledAt: enrollment.cancelledAt,
    startsAt: course.startsAt,
    endsAt: course.endsAt,
    location: course.location,
    quizReady: quiz.quizReady,
    quizBlockedReason: quiz.quizBlockedReason,
    quizPassed: quiz.quizPassed,
    recognizedMinutes: quiz.recognizedMinutes,
    quizPassedAt: enrollment.quizPassedAt ?? null,
    hasMaterial: Boolean(course.materialFileId),
    materialName: course.materialFileId ? state.data.files.find((item) => item.id === course.materialFileId)?.originalName ?? "已上傳" : null,
    trainingCertificateNo: state.data.trainingCertificates?.find((item) => item.enrollmentId === enrollment.id)?.certificateNo ?? null,
    trainingCertificateIssuedOn: state.data.trainingCertificates?.find((item) => item.enrollmentId === enrollment.id)?.issuedOnDate ?? null,
    trainingCertificateValidUntil: state.data.trainingCertificates?.find((item) => item.enrollmentId === enrollment.id)?.validUntilDate ?? null,
  };
}

function reportWhen(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value));
}

function reportRows(state: State, actor: DemoDataset["users"][number], source: "APPLICATION" | "ORGANIZATION" | "ENROLLMENT" | "CONTRACT"): Array<Record<string, string>> {
  if (source === "APPLICATION") {
    return state.data.applications.filter((app) => canViewApplication(actor, app)).map((app) => {
      const organization = state.data.organizations.find((item) => item.id === app.organizationId);
      const category = state.data.categories.find((item) => item.id === app.categoryId);
      const assignee = state.data.users.find((item) => item.id === app.assignedToId);
      return {
        applicationNo: app.applicationNo,
        status: applicationStatusLabels[app.status]?.label ?? app.status,
        categoryName: category?.name ?? "",
        organizationName: app.organizationNameSnapshot ?? organization?.organizationName ?? "",
        taxId: app.taxIdSnapshot ?? organization?.taxId ?? "",
        contactName: app.contactNameSnapshot ?? organization?.contactName ?? "",
        contactPhone: app.contactPhoneSnapshot ?? organization?.contactPhone ?? "",
        contactEmail: app.contactEmailSnapshot ?? organization?.contactEmail ?? "",
        organizationAddress: app.organizationAddressSnapshot ?? organization?.address ?? "",
        siteName: app.siteName ?? "",
        siteAddress: app.siteAddress ?? "",
        applicationDescription: app.applicationDescription ?? "",
        assignedToName: assignee?.displayName ?? "",
        submittedAt: reportWhen(app.submittedAt),
        decidedAt: reportWhen(app.decidedAt),
        createdAt: reportWhen(app.createdAt),
        certificateNo: state.data.certifications.find((item) => item.applicationId === app.id)?.certificateNo ?? "",
        certificateIssuedOn: state.data.certifications.find((item) => item.applicationId === app.id)?.issuedOnDate ?? "",
        certificateValidUntil: state.data.certifications.find((item) => item.applicationId === app.id)?.validUntilDate ?? "",
      };
    });
  }
  if (source === "ORGANIZATION") {
    return state.data.organizations.map((org) => ({
      organizationName: org.organizationName,
      taxId: org.taxId ?? "",
      contactName: org.contactName ?? "",
      contactPhone: org.contactPhone ?? "",
      contactEmail: org.contactEmail ?? "",
      address: org.address ?? "",
    }));
  }
  if (source === "ENROLLMENT") {
    return state.data.enrollments.map((row) => {
      const course = state.data.courses.find((item) => item.id === row.courseId);
      const user = state.data.users.find((item) => item.id === row.userId);
      const organization = state.data.organizations.find((item) => item.id === user?.organizationId);
      return {
        courseTitle: course?.title ?? "",
        courseStartsAt: reportWhen(course?.startsAt),
        location: course?.location ?? "",
        userName: user?.displayName ?? "",
        userEmail: user?.email ?? "",
        organizationName: organization?.organizationName ?? "",
        enrollmentStatus: enrollmentStatusLabels[row.status]?.label ?? row.status,
        attendanceStatus: attendanceStatusLabels[row.attendanceStatus]?.label ?? row.attendanceStatus,
        attendedMinutes: String(row.attendedMinutes),
        recognizedMinutes: String(row.recognizedMinutes),
        trainingCertificateNo: state.data.trainingCertificates?.find((item) => item.enrollmentId === row.id)?.certificateNo ?? "",
        trainingCertificateIssuedOn: state.data.trainingCertificates?.find((item) => item.enrollmentId === row.id)?.issuedOnDate ?? "",
        trainingCertificateValidUntil: state.data.trainingCertificates?.find((item) => item.enrollmentId === row.id)?.validUntilDate ?? "",
      };
    });
  }
  return state.platform.contracts.map((row) => ({
    contractNo: row.contractNo,
    organizationName: row.organizationName,
    title: row.title,
    status: contractStatusLabels[row.status]?.label ?? row.status,
    signerName: row.signerName ?? "",
    signerTitle: row.signerTitle ?? "",
    signedAt: reportWhen(row.signedAt),
    createdAt: reportWhen(row.createdAt),
  }));
}

function presentCertification(state: State, item: DemoDataset["certifications"][number]) {
  const app = state.data.applications.find((entry) => entry.id === item.applicationId)!;
  const org = state.data.organizations.find((entry) => entry.id === app.organizationId)!;
  const validity = certificationValidity(item);
  const def = item.templateKey ? findCertificateTemplateDef(item.templateKey) : null;
  return {
    id: item.id,
    applicationId: item.applicationId,
    applicationNo: app.applicationNo,
    organizationName: org.organizationName,
    certificateNo: item.certificateNo,
    issuedOnDate: item.issuedOnDate,
    validUntilDate: item.validUntilDate,
    templateKey: item.templateKey ?? null,
    templateTitle: def?.titleZh ?? null,
    bodyHtml: item.bodyHtml ?? null,
    isCurrent: validity.isCurrent,
    validityLabel: validity.label,
    registeredAt: item.registeredAt,
    hasDocument: Boolean(item.bodyHtml),
  };
}

export async function createMockServices(): Promise<Services> {
  const digest = await sha256Hex(DEMO_PASSWORD);
  const blank = (): State => {
    const data = buildDemoDataset();
    return {
      data,
      digests: Object.fromEntries(data.users.map((user) => [user.id, digest])),
      sequence: 1,
      imports: [],
      resetTokens: [],
      platform: createInitialPlatform(data),
    };
  };
  let state = (await idbGet()) ?? blank();
  state.platform ??= createInitialPlatform(state.data);
  state.platform.reports = (state.platform.reports ?? []).map((report) => {
    const legacy = report as typeof report & { source?: "APPLICATION" | "ORGANIZATION" | "ENROLLMENT" | "CONTRACT"; fieldKeys?: string[] };
    if (legacy.selections) return { ...legacy, chartKind: legacy.chartKind ?? "table", chartField: legacy.chartField ?? "" };
    if (legacy.source && legacy.fieldKeys?.length) {
      return { id: legacy.id, name: legacy.name, selections: [{ source: legacy.source, fieldKeys: legacy.fieldKeys }], chartKind: "table" as const, chartField: "", version: legacy.version, updatedAt: legacy.updatedAt, createdById: legacy.createdById };
    }
    return { ...legacy, selections: legacy.selections ?? [], chartKind: legacy.chartKind ?? "table", chartField: legacy.chartField ?? "" };
  });
  state.platform.plans ??= [];
  state.platform.payments ??= [];
  for (const plan of state.platform.plans) {
    plan.images ??= [];
    plan.visibleUserIds ??= [];
  }
  // 清掉舊版「示範直接開通」紀錄，避免一進業者端就已開通、也無法走選方案→付款→核帳。
  state.platform.payments = state.platform.payments.filter((item) => item.note !== "示範帳號已入帳開通" && item.paymentMethod !== "DEMO");
  for (const payment of state.platform.payments) {
    payment.status ??= "PENDING";
  }
  // 合約範本改為旅宿資料夾正式空白版（黃底欄位＋甲乙雙方對列立約頁）。
  for (const template of state.platform.templates ?? []) {
    if (
      template.title.includes("示範")
      || template.body.includes("HALAL 驗證服務合約")
      || !template.body.includes("<table")
      || (!template.body.includes("data-contract-parties") && !template.body.includes("<<<PARTIES>>>") && !template.body.includes("data-contract-field"))
      || !template.body.includes("checkHalalKitchen")
      || !template.body.includes("contract-parties-grid")
    ) {
      template.title = DEFAULT_CONTRACT_TITLE;
      template.body = DEFAULT_CONTRACT_BODY;
      template.version += 1;
      template.updatedAt = new Date().toISOString();
    } else {
      template.body = ensureContractHtml(template.body);
    }
  }
  if (
    state.platform.template
    && (
      state.platform.template.title.includes("示範")
      || !state.platform.template.body.includes("<table")
      || !state.platform.template.body.includes("checkHalalKitchen")
      || !state.platform.template.body.includes("contract-parties-grid")
    )
  ) {
    state.platform.template.title = DEFAULT_CONTRACT_TITLE;
    state.platform.template.body = DEFAULT_CONTRACT_BODY;
    state.platform.template.version += 1;
    state.platform.template.updatedAt = new Date().toISOString();
  } else if (state.platform.template) {
    state.platform.template.body = ensureContractHtml(state.platform.template.body);
  }
  state.platform.seals ??= {
    companySealFileId: null,
    personSealFileId: null,
    companySealX: 8,
    companySealY: 4,
    personSealX: 42,
    personSealY: 14,
    updatedAt: new Date().toISOString(),
  };
  // 補上七類各兩筆「已核定待發證」示範案件（不整包重設）。
  if (!state.data.applications.some((item) => item.sourceRecordKey?.startsWith("demo-cert-ready-"))) {
    const fresh = buildDemoDataset();
    const keepIds = new Set(fresh.applications.map((item) => item.id));
    const versionKey = (item: { categoryId: string; version: number }) => `${item.categoryId}:${item.version}`;
    const existingVersions = new Set(state.data.formVersions.map(versionKey));
    state.data.formVersions = [
      ...state.data.formVersions,
      ...fresh.formVersions.filter((item) => !existingVersions.has(versionKey(item))),
    ];
    state.data.applications = [
      ...state.data.applications.filter((item) => !item.sourceRecordKey?.startsWith("demo-cert-ready-")),
      ...fresh.applications,
    ];
    state.data.submissions = [
      ...state.data.submissions.filter((item) => !keepIds.has(item.applicationId)),
      ...fresh.submissions,
    ];
    state.data.events = [
      ...state.data.events.filter((item) => !keepIds.has(item.applicationId)),
      ...fresh.events,
    ];
    state.data.attachments = [
      ...state.data.attachments.filter((item) => !keepIds.has(item.applicationId)),
      ...fresh.attachments,
    ];
    const freshFileIds = new Set(fresh.files.map((item) => item.id));
    state.data.files = [
      ...state.data.files.filter((item) => !freshFileIds.has(item.id)),
      ...fresh.files,
    ];
  }
  state.platform.seals.companySealX ??= 8;
  state.platform.seals.companySealY ??= 4;
  state.platform.seals.personSealX ??= 42;
  state.platform.seals.personSealY ??= 14;
  for (const contract of state.platform.contracts) {
    contract.body = ensureContractHtml(contract.body);
  }
  const hasOfficialCatalog = state.platform.plans.some((item) => item.name === "穆斯林友善環境" && item.amount === 15000)
    && state.platform.plans.some((item) => item.name === "Halal廚房");
  if (!hasOfficialCatalog) {
    const fresh = createInitialPlatform(state.data);
    const keptIds = new Set(state.platform.payments.map((item) => item.planId));
    const keepCustom = state.platform.plans.filter((item) => keptIds.has(item.id) && !fresh.plans.some((official) => official.name === item.name));
    state.platform.plans = [...fresh.plans, ...keepCustom];
  }
  ensureOfficialCategories(state);
  ensureCertificateTemplates(state.platform);
  ensureSiteReview(state);
  ensureTrainingData(state.data);
  ensureAccountFeatures(state.platform, state.data.users);
  ensureEditorial(state.platform);
  ensureOperationSetting(state.platform);
  fixHalalSpelling(state.platform);
  for (const course of state.data.courses) {
    course.youtubeUrl ??= "";
    course.imageFileId ??= null;
  }
  const save = () => idbSet(state);
  await save();

  const services: Services = {
    mode: "mock",
    async config() {
      return {
        appName: APP_NAME,
        dataMode: "mock",
        demoMode: true,
        maxFileBytes: attachmentLimits(state).maxFileBytes,
        maxApplicationBytes: attachmentLimits(state).maxApplicationBytes,
        allowedMimeTypes: [...ATTACHMENT_MIME_TYPES],
        contactEmail: DEMO_CONTACT_EMAIL,
        contactNote: "展示模式，聯絡信箱為示範用。",
      };
    },
    async login(email, password) {
      const user = state.data.users.find((item) => item.email === email.trim().toLowerCase());
      const incoming = await sha256Hex(password);
      if (!user || state.digests[user.id] !== incoming) throw new ClientError("帳號或密碼不正確", { status: 401, code: "UNAUTHENTICATED" });
      if (!user.isActive) throw new ClientError("帳號已停用", { status: 403, code: "FORBIDDEN" });
      sessionStorage.setItem("mf-demo-user", user.id);
      return publicUser(state, user);
    },
    async register(input) {
      if (input.password !== input.confirmPassword) throw new ClientError("兩次密碼不一致", { fieldErrors: [{ path: "confirmPassword", message: "兩次密碼不一致" }] });
      const email = input.email.trim().toLowerCase();
      if (state.data.users.some((item) => item.email === email)) throw new ClientError("此 Email 已註冊");
      if (state.data.organizations.some((item) => item.taxId === input.taxId)) {
        throw new ClientError("此統一編號已有業者帳號，請聯繫管理員處理，系統不會自動加入既有企業");
      }
      const now = new Date().toISOString();
      const orgId = crypto.randomUUID();
      const userId = crypto.randomUUID();
      state.data.organizations.push({ id: orgId, organizationName: input.organizationName, taxId: input.taxId, contactName: input.displayName, contactPhone: "", contactEmail: email, address: "", createdAt: now, updatedAt: now });
      state.data.users.push({ id: userId, email, displayName: input.displayName, role: UserRole.APPLICANT, organizationId: orgId, isActive: true, createdAt: now, updatedAt: now });
      grantAccountFeatures(state.platform, { id: userId, role: UserRole.APPLICANT }, PLATFORM_FEATURES.filter((feature) => defaultFeatureEnabled(UserRole.APPLICANT, feature.key)).map((feature) => feature.key));
      state.digests[userId] = await sha256Hex(input.password);
      sessionStorage.setItem("mf-demo-user", userId);
      await save();
      return publicUser(state, state.data.users.at(-1)!);
    },
    async logout() {
      sessionStorage.removeItem("mf-demo-user");
    },
    async me() {
      const actor = actorOf(state);
      return actor ? publicUser(state, actor) : null;
    },
    async forgot(email) {
      const user = state.data.users.find((item) => item.email === email.trim().toLowerCase());
      const message = "若帳號存在，展示模式會在下方顯示重設連結。這不是真正寄出的信件。";
      if (!user) return { message };
      const token = crypto.randomUUID() + crypto.randomUUID();
      state.resetTokens.push({ token, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), used: false });
      await save();
      return { message, demoResetUrl: `/reset-password?token=${token}` };
    },
    async reset(token, password, confirmPassword) {
      if (password !== confirmPassword) throw new ClientError("兩次密碼不一致");
      const record = state.resetTokens.find((item) => item.token === token && !item.used && Date.parse(item.expiresAt) > Date.now());
      if (!record) throw new ClientError("重設連結無效或已過期");
      record.used = true;
      state.digests[record.userId] = await sha256Hex(password);
      await save();
      return { message: "密碼已更新，請重新登入" };
    },
    async changePassword(currentPassword, password, confirmPassword) {
      const actor = requireActor(state);
      if ((await sha256Hex(currentPassword)) !== state.digests[actor.id]) throw new ClientError("目前密碼不正確");
      if (password !== confirmPassword) throw new ClientError("兩次密碼不一致");
      state.digests[actor.id] = await sha256Hex(password);
      await save();
      return { message: "密碼已更新" };
    },
    async organization() {
      const actor = requireActor(state);
      const org = state.data.organizations.find((item) => item.id === actor.organizationId);
      if (!org) throw new ClientError("找不到業者資料", { status: 404 });
      return { ...org, updatedAt: org.updatedAt };
    },
    async updateOrganization(patch) {
      const actor = requireActor(state);
      const org = state.data.organizations.find((item) => item.id === actor.organizationId);
      if (!org || actor.role !== UserRole.APPLICANT) throw new ClientError("不能修改業者資料", { status: 403 });
      Object.assign(org, patch, { updatedAt: new Date().toISOString() });
      await save();
      return org;
    },
    async categories() {
      return state.data.categories.map((category) => {
        const versions = state.data.formVersions.filter((item) => item.categoryId === category.id).sort((a, b) => b.version - a.version);
        const latest = versions[0]!;
        return { ...category, latestVersion: { id: latest.id, version: latest.version, configurationStatus: latest.configurationStatus, definition: parseCategoryDefinition(latest.definition) } };
      }).sort((a, b) => a.displayOrder - b.displayOrder);
    },
    async applications(query = {}) {
      const actor = requireActor(state);
      let rows = state.data.applications.filter((app) => canViewApplication(actor, app));
      if (query.status) rows = rows.filter((app) => app.status === query.status);
      if (query.categoryId) rows = rows.filter((app) => app.categoryId === query.categoryId);
      if (query.certification) {
        const certified = new Set(state.data.certifications.map((item) => item.applicationId));
        rows = rows.filter((app) => certified.has(app.id) === (query.certification === "issued"));
      }
      if (query.q) {
        const q = query.q.toLowerCase();
        rows = rows.filter((app) => {
          const org = state.data.organizations.find((item) => item.id === app.organizationId);
          return app.applicationNo.toLowerCase().includes(q) || org?.organizationName.toLowerCase().includes(q);
        });
      }
      const page = query.page ?? 1;
      const slice = rows.slice((page - 1) * 10, page * 10);
      return { items: slice.map((app) => listItem(toDetail(state, app.id, actor))), meta: pageMeta(page, 10, rows.length) };
    },
    async categoryForm(categoryId) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.decide")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const category = state.data.categories.find((item) => item.id === categoryId);
      const versions = state.data.formVersions.filter((item) => item.categoryId === categoryId).sort((a, b) => b.version - a.version);
      const latest = versions[0];
      if (!category || !latest) throw new ClientError("找不到申請類別", { status: 404 });
      const publishedDefinition = parseCategoryDefinition(latest.definition);
      return {
        categoryId: category.id,
        code: category.code,
        name: category.name,
        publishedVersion: latest.version,
        publishedDefinition,
        draftDefinition: categoryFormDrafts.get(categoryId) ?? null,
      };
    },
    async saveCategoryFormDraft(categoryId, definition) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.decide")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      let parsed;
      try { parsed = parseCategoryDefinition(definition); } catch (error) {
        throw new ClientError(error instanceof Error ? error.message : "表單內容不正確", { status: 400 });
      }
      categoryFormDrafts.set(categoryId, parsed);
      const category = state.data.categories.find((item) => item.id === categoryId);
      const versions = state.data.formVersions.filter((item) => item.categoryId === categoryId).sort((a, b) => b.version - a.version);
      const latest = versions[0];
      if (!category || !latest) throw new ClientError("找不到申請類別", { status: 404 });
      return {
        categoryId: category.id,
        code: category.code,
        name: category.name,
        publishedVersion: latest.version,
        publishedDefinition: parseCategoryDefinition(latest.definition),
        draftDefinition: parsed,
      };
    },
    async publishCategoryForm(categoryId, definition) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.decide")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      let parsed;
      try { parsed = parseCategoryDefinition(definition); } catch (error) {
        throw new ClientError(error instanceof Error ? error.message : "表單內容不正確", { status: 400 });
      }
      const versions = state.data.formVersions.filter((item) => item.categoryId === categoryId).sort((a, b) => b.version - a.version);
      const latest = versions[0];
      if (!latest) throw new ClientError("找不到申請類別", { status: 404 });
      if (JSON.stringify(parseCategoryDefinition(latest.definition)) === JSON.stringify(parsed)) {
        throw new ClientError("內容和目前正式版本相同，不用再完成一次", { status: 400 });
      }
      const version = latest.version + 1;
      state.data.formVersions.push({
        id: crypto.randomUUID(),
        categoryId,
        version,
        configurationStatus: latest.configurationStatus,
        definition: parsed,
        createdAt: new Date().toISOString(),
      });
      categoryFormDrafts.delete(categoryId);
      await save();
      return { version, definition: parsed };
    },
    async application(id) {
      return toDetail(state, id, requireActor(state));
    },
    async createApplication(categoryId) {
      const actor = requireActor(state);
      if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ClientError("只有業者可以建立申請", { status: 403 });
      assertCanApply(state.data, actor, state.platform);
      const org = state.data.organizations.find((item) => item.id === actor.organizationId)!;
      const versions = state.data.formVersions.filter((item) => item.categoryId === categoryId).sort((a, b) => b.version - a.version);
      const latest = versions[0];
      if (!latest) throw new ClientError("找不到申請類別", { status: 404 });
      const now = new Date().toISOString();
      const applicationNo = formatApplicationNo(taipeiYear(), state.sequence);
      state.sequence += 1;
      const createdId = crypto.randomUUID();
      state.data.applications.unshift({
        id: createdId,
        applicationNo,
        organizationId: org.id,
        createdById: actor.id,
        categoryId,
        categoryFormVersionId: latest.id,
        status: ApplicationStatus.DRAFT,
        resumeStatus: null,
        assignedToId: null,
        siteReviewerId: null,
        siteChecks: [],
        version: 1,
        organizationNameSnapshot: org.organizationName,
        taxIdSnapshot: org.taxId,
        contactNameSnapshot: org.contactName,
        contactPhoneSnapshot: org.contactPhone,
        contactEmailSnapshot: org.contactEmail,
        organizationAddressSnapshot: org.address,
        siteName: null,
        siteAddress: null,
        applicationDescription: null,
        declarationAccepted: false,
        formData: {},
        sourceSystem: null,
        sourceRecordKey: null,
        submittedAt: null,
        decidedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      const created = state.data.applications[0]!;
      await save();
      return toDetail(state, created.id, actor);
    },
    async deleteDraft(id) {
      const actor = requireActor(state);
      if (actor.role !== UserRole.APPLICANT) throw new ClientError("只有業者可以刪除草稿", { status: 403 });
      const app = state.data.applications.find((item) => item.id === id);
      if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
      if (app.status !== ApplicationStatus.DRAFT) throw new ClientError("只有草稿可以刪除", { status: 409, code: "INVALID_TRANSITION" });
      const fileIds = new Set(state.data.attachments.filter((item) => item.applicationId === id).map((item) => item.fileId));
      state.data.applications = state.data.applications.filter((item) => item.id !== id);
      state.data.events = state.data.events.filter((item) => item.applicationId !== id);
      state.data.submissions = state.data.submissions.filter((item) => item.applicationId !== id);
      state.data.attachments = state.data.attachments.filter((item) => item.applicationId !== id);
      state.data.certifications = state.data.certifications.filter((item) => item.applicationId !== id);
      state.data.notificationJobs = state.data.notificationJobs.filter((item) => item.applicationId !== id);
      state.data.files = state.data.files.filter((item) => !fileIds.has(item.id));
      await save();
    },
    async updateApplication(id, patch) {
      const actor = requireActor(state);
      const app = state.data.applications.find((item) => item.id === id);
      if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
      if (!canEditApplicationContent(actor, app)) throw new ClientError("目前狀態不能修改申請內容", { status: 403 });
      if (app.version !== patch.expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      if (patch.categoryId && patch.categoryId !== app.categoryId) {
        if (app.status !== ApplicationStatus.DRAFT) throw new ClientError("送件後不能變更類別");
        const latest = state.data.formVersions.filter((item) => item.categoryId === patch.categoryId).sort((a, b) => b.version - a.version)[0];
        if (!latest) throw new ClientError("找不到申請類別");
        app.categoryId = patch.categoryId;
        app.categoryFormVersionId = latest.id;
        const allowed = new Set(parseCategoryDefinition(latest.definition).fields.map((field) => field.key));
        app.formData = Object.fromEntries(Object.entries(app.formData).filter(([key]) => allowed.has(key)));
      }
      const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId)!;
      const next = { ...content(app), ...patch, formData: patch.formData ?? app.formData };
      const issues = validateDraft(next, parseCategoryDefinition(version.definition));
      if (issues.length) throw new ClientError("資料尚未通過驗證", { fieldErrors: issues });
      app.organizationNameSnapshot = next.organizationName ?? null;
      app.taxIdSnapshot = next.taxId ?? null;
      app.contactNameSnapshot = next.contactName ?? null;
      app.contactPhoneSnapshot = next.contactPhone ?? null;
      app.contactEmailSnapshot = next.contactEmail ?? null;
      app.organizationAddressSnapshot = next.organizationAddress ?? null;
      app.siteName = next.siteName ?? null;
      app.siteAddress = next.siteAddress ?? null;
      app.applicationDescription = next.applicationDescription ?? null;
      app.declarationAccepted = next.declarationAccepted;
      app.formData = next.formData;
      app.version += 1;
      app.updatedAt = new Date().toISOString();
      await save();
      return { version: app.version, updatedAt: app.updatedAt };
    },
    async submit(id, expectedVersion, requestId) {
      return transition(id, expectedVersion, requestId, ApplicationAction.SUBMIT);
    },
    async resubmit(id, expectedVersion, requestId) {
      return transition(id, expectedVersion, requestId, ApplicationAction.RESUBMIT);
    },
    async assign(id, assignedToId, expectedVersion, requestId) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.decide")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const app = state.data.applications.find((item) => item.id === id);
      const assignee = state.data.users.find((item) => item.id === assignedToId);
      if (!app || !assignee) throw new ClientError("找不到案件或承辦人", { status: 404 });
      if (app.version !== expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      app.assignedToId = assignedToId;
      app.version += 1;
      app.updatedAt = new Date().toISOString();
      state.data.events.push({ id: crypto.randomUUID(), applicationId: id, submissionId: null, actorId: actor.id, action: ApplicationAction.ASSIGN, fromStatus: app.status, toStatus: app.status, publicComment: `已指派承辦：${assignee.displayName}`, internalNote: null, requestId, requestHash: requestId, createdAt: app.updatedAt });
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "ASSIGN", entityType: "Application", entityId: id, requestId, safeChanges: { assignedToId }, createdAt: app.updatedAt });
      await save();
      queueNotice(app, ApplicationAction.ASSIGN, app.status, `已指派承辦：${assignee.displayName}`, `ASSIGN:${id}:${requestId}`, app.updatedAt);
      await deliverPending();
      return toDetail(state, id, actor);
    },
    async review(id, input) {
      const actor = requireActor(state);
      const existing = state.data.events.find((event) => event.applicationId === id && event.requestId === input.requestId);
      if (existing) return toDetail(state, id, actor);
      const app = state.data.applications.find((item) => item.id === id);
      if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
      const decision = resolveTransition({ action: input.action as ApplicationAction, status: app.status, resumeStatus: app.resumeStatus, role: actor.role, isAssignee: app.assignedToId === actor.id, isSiteReviewer: app.siteReviewerId === actor.id, hasAssignee: Boolean(app.assignedToId) });
      if (!decision.ok) throw new ClientError(decision.message, { code: "INVALID_TRANSITION" });
      if (app.version !== input.expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId);
      const reviews = input.fieldReviews ?? app.fieldReviews ?? [];
      const checked = checkFieldReviews(input.action as ApplicationAction, reviewTargets(parseCategoryDefinition(version?.definition ?? { schemaVersion: 1, fields: [], attachmentRequirements: [], helpText: "" })), reviews);
      if (!checked.ok) throw new ClientError(checked.message, { status: 400 });
      const publicComment = checked.publicComment ?? input.publicComment;
      const requirement = commentRequirement(input.action as ApplicationAction);
      const hasInternal = Boolean(input.internalNote?.trim() || reviews.some((item) => item.internalNote.trim()));
      if (requirement === "public" && !publicComment?.trim()) throw new ClientError("請填寫公開意見");
      if (requirement === "review" && !publicComment?.trim() && !hasInternal) throw new ClientError("請填寫審查意見");
      let assignmentNote: string | null = null;
      if (input.action === "PASS_INITIAL") {
        const reviewer = state.data.users.find((user) => user.id === input.siteReviewerId && user.isActive && user.role !== UserRole.APPLICANT);
        if (!reviewer) throw new ClientError("請指定在職的複審人員");
        app.siteReviewerId = reviewer.id;
        assignmentNote = `已指定複審：${reviewer.displayName}`;
      }
      const now = new Date().toISOString();
      const visibleComment = [publicComment?.trim(), assignmentNote].filter(Boolean).join("\n");
      state.data.events.push({ id: crypto.randomUUID(), applicationId: id, submissionId: null, actorId: actor.id, action: input.action as ApplicationAction, fromStatus: app.status, toStatus: decision.toStatus, publicComment: visibleComment || null, internalNote: input.internalNote ?? null, requestId: input.requestId, requestHash: input.requestId, createdAt: now });
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: input.action, entityType: "Application", entityId: id, requestId: input.requestId, safeChanges: { fromStatus: app.status, toStatus: decision.toStatus, siteReviewerId: app.siteReviewerId ?? null }, createdAt: now });
      app.fieldReviews = reviews;
      app.status = decision.toStatus;
      app.resumeStatus = decision.nextResumeStatus;
      app.version += 1;
      app.updatedAt = now;
      if (decision.toStatus === ApplicationStatus.APPROVED || decision.toStatus === ApplicationStatus.REJECTED) app.decidedAt = now;
      await save();
      queueNotice(app, input.action as ApplicationAction, decision.toStatus, visibleComment || null, `${input.action}:${id}:${input.requestId}`, now);
      await deliverPending();
      return toDetail(state, id, actor);
    },
    async saveFieldReviews(id, expectedVersion, fieldReviews) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.review")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const app = state.data.applications.find((item) => item.id === id);
      if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
      if (actor.role !== UserRole.ADMIN && app.assignedToId !== actor.id) throw new ClientError("只有指派承辦或管理員可以寫審查意見", { status: 403 });
      if (app.status !== ApplicationStatus.INITIAL_REVIEW && app.status !== ApplicationStatus.SECOND_REVIEW && app.status !== ApplicationStatus.FINAL_REVIEW) {
        throw new ClientError("目前階段不能勾選補件", { status: 409 });
      }
      const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId);
      const checked = checkFieldReviews(ApplicationAction.PASS_INITIAL, reviewTargets(parseCategoryDefinition(version?.definition ?? { schemaVersion: 1, fields: [], attachmentRequirements: [], helpText: "" })), fieldReviews);
      if (!checked.ok) throw new ClientError(checked.message, { status: 400 });
      if (app.version !== expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      app.fieldReviews = fieldReviews;
      app.version += 1;
      app.updatedAt = new Date().toISOString();
      await save();
      return toDetail(state, id, actor);
    },
    async staffOptions() {
      const actor = requireActor(state);
      if (actor.role === UserRole.APPLICANT || !hasFeature(state.platform, actor.id, "applications.review")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      return state.data.users
        .filter((user) => user.isActive && user.role !== UserRole.APPLICANT)
        .map((user) => ({ id: user.id, displayName: user.displayName, role: user.role }));
    },
    async saveSiteCheck(id, input) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.review")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const app = state.data.applications.find((item) => item.id === id);
      if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
      if (app.status !== ApplicationStatus.SECOND_REVIEW) throw new ClientError("目前不是現場複審", { code: "INVALID_TRANSITION" });
      if (actor.role !== UserRole.ADMIN && app.siteReviewerId !== actor.id) throw new ClientError("只有指定的複審人員或管理員可以登錄現場結果", { status: 403 });
      const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId);
      const requirement = parseCategoryDefinition(version?.definition ?? { schemaVersion: 1, fields: [], attachmentRequirements: [], helpText: "" }).attachmentRequirements.find((item) => item.key === input.requirementKey);
      if (!requirement || requirement.group === "checklist") throw new ClientError("這個項目不能標通過或沒通過");
      if (app.version !== input.expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      app.siteChecks = [...(app.siteChecks ?? []).filter((item) => item.key !== input.requirementKey), { key: input.requirementKey, result: input.result }];
      app.version += 1;
      app.updatedAt = new Date().toISOString();
      await save();
      return toDetail(state, id, actor);
    },
    async uploadSitePhoto(applicationId, requirementKey, file) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.review")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const app = state.data.applications.find((item) => item.id === applicationId);
      if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
      if (app.status !== ApplicationStatus.SECOND_REVIEW) throw new ClientError("目前不是現場複審", { code: "INVALID_TRANSITION" });
      if (actor.role !== UserRole.ADMIN && app.siteReviewerId !== actor.id) throw new ClientError("只有指定的複審人員或管理員可以上傳現場照片", { status: 403 });
      const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId);
      const requirement = parseCategoryDefinition(version?.definition ?? { schemaVersion: 1, fields: [], attachmentRequirements: [], helpText: "" }).attachmentRequirements.find((item) => item.key === requirementKey);
      if (!requirement || requirement.group === "checklist") throw new ClientError("只能在送件附件項目上補現場拍攝");
      const limits = attachmentLimits(state);
      if (file.size > limits.maxFileBytes) throw new ClientError(`檔案超過 ${formatByteLimit(limits.maxFileBytes)}`, { code: "FILE_TOO_LARGE" });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature = detectFileSignature(bytes);
      if (!signature || !signature.startsWith("image/") || signature !== file.type) throw new ClientError("現場拍攝只接受 JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
      const sitePhotos = state.data.attachments.filter((item) => item.applicationId === applicationId && item.requirementKey === requirementKey && !item.removedAt && item.capturedOnSite);
      if (sitePhotos.length >= FILE_POLICY.maxImagesPerRequirement) throw new ClientError(`這個項目的現場照片最多 ${FILE_POLICY.maxImagesPerRequirement} 張`);
      const now = new Date().toISOString();
      const fileId = crypto.randomUUID();
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      state.data.files.push({ id: fileId, uploadedById: actor.id, storageKey: `mock/${fileId}`, originalName: file.name, mimeType: signature, sizeBytes: file.size, sha256: await sha256Hex(bytes), contentBase64: btoa(binary), createdAt: now });
      state.data.attachments.push({ id: crypto.randomUUID(), applicationId, fileId, requirementKey, capturedOnSite: true, createdAt: now, removedAt: null });
      await save();
    },
    async events(id) {
      const actor = requireActor(state);
      toDetail(state, id, actor);
      return state.data.events
        .filter((event) => event.applicationId === id)
        .map((event) => ({
          id: event.id,
          action: event.action,
          publicComment: event.publicComment,
          internalNote: actor.role === UserRole.APPLICANT ? null : event.internalNote,
          actorName: state.data.users.find((user) => user.id === event.actorId)?.displayName ?? "系統",
          createdAt: event.createdAt,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
        }));
    },
    async submissions(id) {
      const actor = requireActor(state);
      toDetail(state, id, actor);
      return state.data.submissions
        .filter((item) => item.applicationId === id)
        .map((item) => ({ id: item.id, revision: item.revision, submittedAt: item.submittedAt, payloadSnapshot: item.payloadSnapshot }));
    },
    async upload(applicationId, requirementKey, file) {
      const actor = requireActor(state);
      const app = state.data.applications.find((item) => item.id === applicationId);
      if (!app || !canEditApplicationContent(actor, app)) throw new ClientError("找不到可編輯的案件", { status: 404 });
      const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId)!;
      const definition = parseCategoryDefinition(version.definition);
      const requirement = definition.attachmentRequirements.find((item) => item.key === requirementKey);
      if (!requirement) throw new ClientError("此表單版本沒有這個附件項目");
      const limits = attachmentLimits(state);
      if (file.size > limits.maxFileBytes) throw new ClientError(`檔案超過 ${formatByteLimit(limits.maxFileBytes)}`, { code: "FILE_TOO_LARGE" });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature = detectAttachmentSignature(bytes);
      const active = state.data.attachments.filter((item) => item.applicationId === applicationId && item.requirementKey === requirementKey && !item.removedAt && !item.capturedOnSite);
      if (!signature || !isAttachmentMimeType(file.type) || signature !== file.type) throw new ClientError("只接受 PDF、JPEG、PNG、MP4、WebM，且內容需與格式一致", { code: "UNSUPPORTED_FILE_TYPE" });
      if (active.length >= FILE_POLICY.maxImagesPerRequirement) throw new ClientError(`這個項目最多 ${FILE_POLICY.maxImagesPerRequirement} 個檔案`);
      const now = new Date().toISOString();
      const fileId = crypto.randomUUID();
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      state.data.files.push({ id: fileId, uploadedById: actor.id, storageKey: `mock/${fileId}`, originalName: file.name, mimeType: signature, sizeBytes: file.size, sha256: await sha256Hex(bytes), contentBase64: btoa(binary), createdAt: now });
      state.data.attachments.push({ id: crypto.randomUUID(), applicationId, fileId, requirementKey, capturedOnSite: false, createdAt: now, removedAt: null });
      await save();
    },
    async removeAttachment(applicationId, attachmentId) {
      const actor = requireActor(state);
      const app = state.data.applications.find((item) => item.id === applicationId);
      if (!app || !canEditApplicationContent(actor, app)) throw new ClientError("找不到可編輯的案件", { status: 404 });
      const attachment = state.data.attachments.find((item) => item.id === attachmentId && item.applicationId === applicationId && !item.removedAt);
      if (!attachment) throw new ClientError("找不到附件", { status: 404 });
      if (attachment.capturedOnSite) throw new ClientError("不能移除現場拍攝的照片", { status: 403 });
      attachment.removedAt = new Date().toISOString();
      await save();
    },
    async download(fileId) {
      const actor = requireActor(state);
      const file = state.data.files.find((item) => item.id === fileId);
      const linked = state.data.attachments.some((item) => item.fileId === fileId && canViewApplication(actor, state.data.applications.find((app) => app.id === item.applicationId)!));
      if (!file || !linked) throw new ClientError("找不到檔案", { status: 404 });
      const binary = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
      return { blob: new Blob([binary], { type: file.mimeType }), name: file.originalName };
    },
    async summary() {
      const actor = requireActor(state);
      const rows = state.data.applications.filter((app) => canViewApplication(actor, app));
      const count = (status: ApplicationStatus) => rows.filter((app) => app.status === status).length;
      const upcoming = state.data.courses.filter((course) => course.status === CourseStatus.PUBLISHED && Date.parse(course.startsAt) > Date.now()).slice(0, 3);
      return {
        draft: count(ApplicationStatus.DRAFT),
        submitted: count(ApplicationStatus.SUBMITTED),
        initialReview: count(ApplicationStatus.INITIAL_REVIEW),
        secondReview: count(ApplicationStatus.SECOND_REVIEW),
        finalReview: count(ApplicationStatus.FINAL_REVIEW),
        needSupplement: count(ApplicationStatus.NEED_SUPPLEMENT),
        approved: count(ApplicationStatus.APPROVED),
        rejected: count(ApplicationStatus.REJECTED),
        upcomingCourses: upcoming.length,
        upcoming: upcoming.map((course) => ({ id: course.id, title: course.title, startsAt: course.startsAt, location: course.location })),
      };
    },
    async courses(scope) {
      return state.data.courses
        .filter((course) => scope === "manage" || course.status !== CourseStatus.DRAFT)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((course) => courseDto(state, course));
    },
    async notices() {
      const actor = requireActor(state);
      await scanRenewals();
      return state.data.notificationJobs
        .filter((job) => job.recipientUserId === actor.id && job.type !== "PASSWORD_RESET")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 100)
        .map((job) => presentNotice(job, false));
    },
    async adminNotices() {
      const actor = requireActor(state);
      if (actor.role === UserRole.APPLICANT) throw new ClientError("沒有此操作的權限", { status: 403 });
      const allowed = hasFeature(state.platform, actor.id, "applications.review") || hasFeature(state.platform, actor.id, "applications.decide") || hasFeature(state.platform, actor.id, "audit.view");
      if (!allowed) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      return state.data.notificationJobs
        .filter((job) => job.applicationId && job.type !== "PASSWORD_RESET")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 100)
        .map((job) => presentNotice(job, true));
    },
    async mailTemplates() {
      if (!hasFeature(state.platform, requireActor(state).id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      return mailDrafts().map((item) => {
        const draft = DEFAULT_MAIL_TEMPLATES.find((entry) => entry.key === item.key)!;
        return { key: draft.key, label: draft.label, hint: draft.hint, subject: item.subject, body: item.body, version: item.version };
      });
    },
    async saveMailTemplate(key, input) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const parsed = mailTemplateWriteSchema.parse(input);
      if (!isMailTemplateKey(key)) throw new ClientError("找不到這一種通知", { status: 404 });
      const current = mailDrafts().find((item) => item.key === key);
      if (!current || current.version !== parsed.expectedVersion) throw new ClientError("內容已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      current.subject = parsed.subject;
      current.body = parsed.body;
      current.version += 1;
      current.updatedAt = new Date().toISOString();
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "MAIL_TEMPLATE_UPDATE", entityType: "MailTemplate", entityId: key, requestId: crypto.randomUUID(), safeChanges: { key }, createdAt: current.updatedAt });
      await save();
      const draft = DEFAULT_MAIL_TEMPLATES.find((item) => item.key === key)!;
      return { key: draft.key, label: draft.label, hint: draft.hint, subject: current.subject, body: current.body, version: current.version };
    },
    async sendMail(input) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const parsed = mailSendSchema.parse(input);
      const recipients = state.data.users.filter((user) => user.role === UserRole.APPLICANT && user.isActive && (parsed.audience === "all" || user.id === parsed.userId));
      if (!recipients.length) throw new ClientError("沒有可寄送的業者");
      const batch = crypto.randomUUID();
      const now = new Date().toISOString();
      for (const user of recipients) {
        state.data.notificationJobs.push({
          id: crypto.randomUUID(),
          dedupeKey: `manual:${batch}:${user.id}`,
          type: "MANUAL",
          subject: parsed.subject,
          body: parsed.body,
          recipientUserId: user.id,
          recipientEmail: user.email,
          applicationId: null,
          status: "PENDING",
          attemptCount: 0,
          lastErrorCode: null,
          createdAt: now,
          sentAt: null,
        });
      }
      await deliverPending();
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "MAIL_SEND", entityType: "NotificationJob", entityId: batch, requestId: batch, safeChanges: { audience: parsed.audience, count: recipients.length }, createdAt: now });
      await save();
      const batchJobs = state.data.notificationJobs.filter((item) => item.dedupeKey.startsWith(`manual:${batch}:`));
      const failed = batchJobs.filter((item) => item.status === "FAILED").length;
      return { count: recipients.length, failed, local: failed === 0 && batchJobs.some((item) => item.status === "MOCKED") };
    },
    async organizationNotices(organizationId) {
      if (!hasFeature(state.platform, requireActor(state).id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const org = state.data.organizations.find((item) => item.id === organizationId);
      if (!org) throw new ClientError("找不到業者", { status: 404 });
      const userIds = new Set(state.data.users.filter((user) => user.organizationId === organizationId).map((user) => user.id));
      return state.data.notificationJobs
        .filter((job) => job.recipientUserId && userIds.has(job.recipientUserId) && job.type !== "PASSWORD_RESET")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 200)
        .map((job) => presentNotice(job, true));
    },
    async course(id) {
      const course = state.data.courses.find((item) => item.id === id);
      const actor = actorOf(state);
      const staff = actor && actor.role !== UserRole.APPLICANT;
      if (!course || (!staff && course.status === CourseStatus.DRAFT)) throw new ClientError("找不到課程", { status: 404 });
      return courseDto(state, course);
    },
    async saveCourse(input, id) {
      const actor = requireActor(state);
      if (actor.role === UserRole.APPLICANT) throw new ClientError("沒有課程管理權限", { status: 403 });
      const current = id ? state.data.courses.find((item) => item.id === id) : undefined;
      if (id && !current) throw new ClientError("找不到課程", { status: 404 });
      if (current && input.expectedVersion !== undefined && current.version !== input.expectedVersion) throw new ClientError("課程已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      const confirmed = current ? state.data.enrollments.filter((item) => item.courseId === current.id && item.status === EnrollmentStatus.CONFIRMED).length : 0;
      const issues = validateCourseDraft({ ...input, hasVideo: Boolean(current?.videoFileId), location: input.delivery === "ONLINE" ? "" : input.location }, confirmed);
      if (issues.length) throw new ClientError("課程資料不正確", { fieldErrors: issues });
      const now = new Date().toISOString();
      if (!current) {
        state.data.courses.push({ id: crypto.randomUUID(), title: input.title, description: input.description, delivery: input.delivery, youtubeUrl: input.youtubeUrl, imageFileId: null, videoFileId: null, materialFileId: null, videoDurationSeconds: 0, location: input.delivery === "ONLINE" ? "" : input.location, startsAt: input.startsAt, endsAt: input.endsAt, registrationOpensAt: input.registrationOpensAt, registrationClosesAt: input.registrationClosesAt, capacity: input.capacity, durationMinutes: input.durationMinutes, requiredAttendanceMinutes: input.requiredAttendanceMinutes, status: input.status, createdById: actor.id, version: 1, createdAt: now, updatedAt: now });
      } else {
        Object.assign(current, { title: input.title, description: input.description, delivery: input.delivery, youtubeUrl: input.youtubeUrl, location: input.delivery === "ONLINE" ? "" : input.location, startsAt: input.startsAt, endsAt: input.endsAt, registrationOpensAt: input.registrationOpensAt, registrationClosesAt: input.registrationClosesAt, capacity: input.capacity, durationMinutes: input.durationMinutes, requiredAttendanceMinutes: input.requiredAttendanceMinutes, status: input.status, version: current.version + 1, updatedAt: now });
      }
      await save();
      return courseDto(state, (current ?? state.data.courses.at(-1))!);
    },
    async enroll(courseId) {
      const actor = requireActor(state);
      assertMockServiceUnlocked(state.platform, actor);
      const course = state.data.courses.find((item) => item.id === courseId);
      if (!course) throw new ClientError("找不到課程", { status: 404 });
      const existing = state.data.enrollments.find((item) => item.courseId === courseId && item.userId === actor.id);
      const confirmed = state.data.enrollments.filter((item) => item.courseId === courseId && item.status === EnrollmentStatus.CONFIRMED).length;
      const decision = canEnroll({
        status: course.status,
        registrationOpensAt: course.registrationOpensAt,
        registrationClosesAt: course.registrationClosesAt,
        capacity: course.capacity,
        confirmedCount: existing?.status === EnrollmentStatus.CONFIRMED ? confirmed - 1 : confirmed,
        nowIso: new Date().toISOString(),
        existingStatus: existing?.status ?? null,
      });
      if (!decision.ok) throw new ClientError(decision.message, { code: decision.code, status: decision.code === "COURSE_FULL" ? 409 : 400 });
      const now = new Date().toISOString();
      if (existing) {
        Object.assign(existing, { status: EnrollmentStatus.CONFIRMED, cancelledAt: null, attendanceStatus: AttendanceStatus.NOT_RECORDED, attendedMinutes: 0, watchedSeconds: 0, watchUpdatedAt: null, requiredAttendanceMinutesSnapshot: course.requiredAttendanceMinutes, quizPassedAt: null, recognizedMinutes: 0, version: existing.version + 1 });
      } else {
        state.data.enrollments.push({ id: crypto.randomUUID(), courseId, userId: actor.id, status: EnrollmentStatus.CONFIRMED, attendanceStatus: AttendanceStatus.NOT_RECORDED, attendedMinutes: 0, watchedSeconds: 0, watchUpdatedAt: null, requiredAttendanceMinutesSnapshot: course.requiredAttendanceMinutes, attendanceRecordedById: null, attendanceRecordedAt: null, quizPassedAt: null, recognizedMinutes: 0, version: 1, enrolledAt: now, cancelledAt: null });
      }
      const row = state.data.enrollments.find((item) => item.courseId === courseId && item.userId === actor.id)!;
      return learningOf(state, row);
    },
    async cancelEnrollment(id) {
      const actor = requireActor(state);
      const enrollment = state.data.enrollments.find((item) => item.id === id && item.userId === actor.id);
      if (!enrollment) throw new ClientError("找不到報名", { status: 404 });
      const course = state.data.courses.find((item) => item.id === enrollment.courseId)!;
      const learning = learningOf(state, enrollment);
      const decision = canCancelEnrollment({ enrollmentStatus: enrollment.status, registrationClosesAt: course.registrationClosesAt, nowIso: new Date().toISOString(), completed: learning.completion === "COMPLETED" });
      if (!decision.ok) throw new ClientError(decision.message);
      enrollment.status = EnrollmentStatus.CANCELLED;
      enrollment.cancelledAt = new Date().toISOString();
      enrollment.version += 1;
      await save();
      return learningOf(state, enrollment);
    },
    async learning() {
      const actor = requireActor(state);
      return state.data.enrollments.filter((item) => item.userId === actor.id).map((item) => learningOf(state, item));
    },
    async courseEnrollments(courseId) {
      requireActor(state);
      return state.data.enrollments.filter((item) => item.courseId === courseId).map((item) => learningOf(state, item));
    },
    async attendance(id, input) {
      const actor = requireActor(state);
      if (actor.role === UserRole.APPLICANT) throw new ClientError("沒有出席登錄權限", { status: 403 });
      const enrollment = state.data.enrollments.find((item) => item.id === id);
      if (!enrollment) throw new ClientError("找不到報名", { status: 404 });
      if (enrollment.version !== input.expectedVersion) throw new ClientError("出席資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      const course = state.data.courses.find((item) => item.id === enrollment.courseId)!;
      if ((course.delivery ?? "OFFLINE") === "ONLINE") throw new ClientError("線上課程以觀看時間計算通過，不能改出席");
      const issues = validateAttendance({ attendanceStatus: input.attendanceStatus, attendedMinutes: input.attendedMinutes, durationMinutes: course.durationMinutes });
      if (issues.length) throw new ClientError("出席資料不正確", { fieldErrors: issues });
      enrollment.attendanceStatus = input.attendanceStatus;
      enrollment.attendedMinutes = input.attendanceStatus === AttendanceStatus.ABSENT ? 0 : input.attendedMinutes;
      enrollment.attendanceRecordedById = actor.id;
      enrollment.attendanceRecordedAt = new Date().toISOString();
      enrollment.version += 1;
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "ATTENDANCE_UPDATE", entityType: "Enrollment", entityId: id, requestId: crypto.randomUUID(), safeChanges: { attendedMinutes: enrollment.attendedMinutes }, createdAt: new Date().toISOString() });
      await save();
      return learningOf(state, enrollment);
    },
    async certificateTemplates() {
      return listCertificateTemplates(state.platform, requireActor(state));
    },
    async saveCertificateTemplate(key, input) {
      const saved = saveCertificateTemplate(state.platform, requireActor(state), key as CertificateTemplateKey, input);
      await save();
      return saved;
    },
    async uploadCertificateLogo(key, file) {
      const saved = await uploadCertificateLogo(state.platform, requireActor(state), state.data, key as CertificateTemplateKey, file);
      await save();
      return saved;
    },
    async uploadCertificateSignature(key, file) {
      const saved = await uploadCertificateSignature(state.platform, requireActor(state), state.data, key as CertificateTemplateKey, file);
      await save();
      return saved;
    },
    async certifications() {
      const actor = requireActor(state);
      return state.data.certifications
        .filter((item) => state.data.applications.find((app) => app.id === item.applicationId)?.organizationId === actor.organizationId || actor.role === UserRole.ADMIN || actor.role === UserRole.CASE_OFFICER)
        .map((item) => presentCertification(state, item));
    },
    async saveCertification(applicationId, input) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.decide")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const issues = validateCertificationDates(input.issuedOnDate, input.validUntilDate);
      if (issues.length) throw new ClientError("證書日期不正確", { fieldErrors: issues });
      const app = state.data.applications.find((item) => item.id === applicationId);
      if (!app || app.status !== ApplicationStatus.APPROVED) throw new ClientError("只有已核定案件可以登錄證書", { code: "INVALID_TRANSITION" });
      const category = state.data.categories.find((item) => item.id === app.categoryId);
      const matched = matchCertificateTemplates({
        categoryCode: category?.code ?? "",
        applyType: typeof app.formData.applyType === "string" ? app.formData.applyType : null,
        mealBreakfast: Boolean(app.formData.mealBreakfast),
        mealLunch: Boolean(app.formData.mealLunch),
        mealDinner: Boolean(app.formData.mealDinner),
        mealDrink: Boolean(app.formData.mealDrink),
        mealSnack: Boolean(app.formData.mealSnack),
      });
      const templateKey = (input.templateKey as CertificateTemplateKey | undefined) ?? matched[0]?.key;
      if (!templateKey) throw new ClientError("找不到對應的證書範本");
      if (matched.length && !matched.some((item) => item.key === templateKey)) {
        throw new ClientError("此案件不能使用所選證書範本");
      }
      const templates = ensureCertificateTemplates(state.platform);
      const template = templates.find((item) => item.key === templateKey);
      if (!template) throw new ClientError("找不到證書範本");
      const def = findCertificateTemplateDef(templateKey);
      const org = state.data.organizations.find((item) => item.id === app.organizationId);
      const values = buildCertificateFillValues({
        organizationName: app.organizationNameSnapshot || org?.organizationName || "",
        siteName: app.siteName,
        addressZh: app.siteAddress || app.organizationAddressSnapshot || org?.address,
        certificateNameEn: typeof app.formData.certificateNameEn === "string" ? app.formData.certificateNameEn : null,
        certificateAddressEn: typeof app.formData.certificateAddressEn === "string" ? app.formData.certificateAddressEn : null,
        certificatePhone: typeof app.formData.certificatePhone === "string" ? app.formData.certificatePhone : null,
        certificateNo: input.certificateNo,
        issuedOnDate: input.issuedOnDate,
        validUntilDate: input.validUntilDate,
        template: def,
      });
      const bodyHtml = fillCertificateHtml(template.body, values, template.logoUrl, template.signatureUrl);
      const now = new Date().toISOString();
      const current = state.data.certifications.find((item) => item.applicationId === applicationId);
      if (current) {
        Object.assign(current, {
          certificateNo: input.certificateNo,
          issuedOnDate: input.issuedOnDate,
          validUntilDate: input.validUntilDate,
          templateKey,
          bodyHtml,
          updatedAt: now,
        });
      } else {
        state.data.certifications.push({
          id: crypto.randomUUID(),
          applicationId,
          certificateNo: input.certificateNo,
          issuedOnDate: input.issuedOnDate,
          validUntilDate: input.validUntilDate,
          templateKey,
          bodyHtml,
          registeredById: actor.id,
          registeredAt: now,
          updatedAt: now,
        });
      }
      state.data.auditLogs.unshift({
        id: crypto.randomUUID(),
        actorId: actor.id,
        action: "CERTIFICATION_SAVE",
        entityType: "Certification",
        entityId: applicationId,
        requestId: crypto.randomUUID(),
        safeChanges: { certificateNo: input.certificateNo, templateKey },
        createdAt: now,
      });
      await save();
      return (await services.certifications()).find((item) => item.applicationId === applicationId)!;
    },
    async certificationDocument(applicationId) {
      const actor = requireActor(state);
      const item = state.data.certifications.find((row) => row.applicationId === applicationId);
      if (!item?.bodyHtml) throw new ClientError("尚未發證或沒有證書內容");
      const app = state.data.applications.find((row) => row.id === applicationId);
      if (!app) throw new ClientError("找不到案件");
      const canSee =
        actor.role === UserRole.ADMIN
        || actor.role === UserRole.CASE_OFFICER
        || app.organizationId === actor.organizationId;
      if (!canSee) throw new ClientError("沒有權限下載此證書", { status: 403 });
      const def = item.templateKey ? findCertificateTemplateDef(item.templateKey) : null;
      const title = def?.titleZh ?? "驗證許可證明書";
      const template = item.templateKey
        ? ensureCertificateTemplates(state.platform).find((row) => row.key === item.templateKey)
        : null;
      const bytes = await renderCertificateBrowserPdf({
        title,
        certificateNo: item.certificateNo,
        body: item.bodyHtml,
        logoUrl: template?.logoUrl ?? null,
        signatureUrl: template?.signatureUrl ?? null,
      });
      return { blob: new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" }), name: `${item.certificateNo}.pdf` };
    },
    async users(q) {
      if (!hasFeature(state.platform, requireActor(state).id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      return state.data.users
        .filter((user) => !q || user.email.includes(q) || user.displayName.includes(q))
        .map((user) => ({ id: user.id, email: user.email, displayName: user.displayName, role: user.role, organizationName: state.data.organizations.find((org) => org.id === user.organizationId)?.organizationName ?? null, isActive: user.isActive }));
    },
    async createUser(input) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const role = roleForAccountFeatures(UserRole.CASE_OFFICER, input.features);
      state.data.users.push({ id, email: input.email.toLowerCase(), displayName: input.displayName, role, organizationId: null, isActive: true, createdAt: now, updatedAt: now });
      grantAccountFeatures(state.platform, { id, role }, input.features);
      state.digests[id] = await sha256Hex(input.password);
      await save();
    },
    async updateUser(id, input) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const user = state.data.users.find((item) => item.id === id);
      if (!user || user.role === UserRole.APPLICANT) throw new ClientError("找不到內部帳號", { status: 404 });
      const admins = state.data.users.filter((item) => item.role === UserRole.ADMIN && item.isActive && item.id !== id);
      if (user.role === UserRole.ADMIN && user.isActive && (input.role !== undefined && input.role !== "ADMIN" || input.isActive === false) && admins.length === 0) {
        throw new ClientError("不能停用或調降最後一位管理員");
      }
      if (input.role) user.role = input.role;
      if (input.isActive !== undefined) user.isActive = input.isActive;
      await save();
    },
    async organizations(q) {
      if (!hasFeature(state.platform, requireActor(state).id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      return state.data.organizations.filter((org) => !q || org.organizationName.includes(q) || org.taxId.includes(q));
    },
    async organizationProfile(lookup) {
      const actor = requireActor(state);
      if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.CASE_OFFICER) throw new ClientError("沒有此操作的權限", { status: 403 });
      const wide = ["users.manage", "payments.manage", "contracts.issue", "training.manage"].some((key) => hasFeature(state.platform, actor.id, key));
      const reviews = hasFeature(state.platform, actor.id, "applications.review") || hasFeature(state.platform, actor.id, "applications.decide");
      if (!wide && !reviews) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const organizationId = lookup.organizationId
        ?? (lookup.userId ? state.data.users.find((user) => user.id === lookup.userId && user.role === UserRole.APPLICANT)?.organizationId : undefined)
        ?? (lookup.applicationId ? state.data.applications.find((app) => app.id === lookup.applicationId)?.organizationId : undefined);
      const org = organizationId ? state.data.organizations.find((item) => item.id === organizationId) : undefined;
      if (!org) throw new ClientError("找不到業者", { status: 404, code: "NOT_FOUND" });
      const limited = !wide && actor.role === UserRole.CASE_OFFICER;
      const apps = state.data.applications
        .filter((app) => app.organizationId === org.id && (!limited || canViewApplication(actor, app)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 20);
      if (limited && apps.length === 0) throw new ClientError("找不到業者", { status: 404, code: "NOT_FOUND" });
      return {
        organization: { id: org.id, organizationName: org.organizationName, taxId: org.taxId || null, contactName: org.contactName, contactPhone: org.contactPhone, contactEmail: org.contactEmail, address: org.address, createdAt: org.createdAt, updatedAt: org.updatedAt },
        accounts: state.data.users.filter((user) => user.organizationId === org.id && user.role === UserRole.APPLICANT).map((user) => ({ id: user.id, email: user.email, displayName: user.displayName, isActive: user.isActive, createdAt: user.createdAt })),
        applications: apps.map((app) => ({ id: app.id, applicationNo: app.applicationNo, categoryName: state.data.categories.find((item) => item.id === app.categoryId)?.name ?? "", status: app.status, updatedAt: app.updatedAt })),
        payments: state.platform.payments.filter((row) => row.organizationId === org.id).slice(0, 20).map((row) => ({ id: row.id, planName: row.planName, amount: row.amount, status: row.status ?? "PENDING", createdAt: row.createdAt ?? row.paidAt ?? org.createdAt })),
        contracts: state.platform.contracts.filter((row) => row.organizationId === org.id).slice(0, 20).map((row) => ({ id: row.id, contractNo: row.contractNo, title: row.title, status: row.status })),
        applicationsLimited: limited,
      };
    },
    async paymentDesk() {
      return paymentDesk(state.platform, requireActor(state), state.data);
    },
    async selectPlan(input) {
      const saved = selectPlan(state.platform, requireActor(state), state.data, input);
      await save();
      return saved;
    },
    async confirmReconciliation(input) {
      const saved = confirmReconciliation(state.platform, requireActor(state), state.data, input);
      await save();
      return saved;
    },
    async reviewPayment(input) {
      const saved = reviewPayment(state.platform, requireActor(state), state.data, input);
      await save();
      return saved;
    },
    async uploadPaymentReceipt(paymentId, file) {
      const saved = await uploadPaymentReceipt(state.platform, requireActor(state), state.data, paymentId, file);
      await save();
      return saved;
    },
    async paymentReceipt(paymentId) {
      return paymentReceipt(state.platform, requireActor(state), state.data, paymentId);
    },
    async markPaidPending(paymentId) {
      return markPaidPending(state.platform, requireActor(state), paymentId);
    },
    async uploadPlanImage(planId, file, caption) {
      const saved = await uploadPlanImage(state.platform, requireActor(state), state.data, planId, file, caption);
      await save();
      return saved;
    },
    async removePlanImage(planId, imageId) {
      const saved = removePlanImage(state.platform, requireActor(state), state.data, planId, imageId);
      await save();
      return saved;
    },
    async createPlan(input) {
      const saved = createPlan(state.platform, requireActor(state), state.data, input);
      await save();
      return saved;
    },
    async deletePlan(id) {
      const saved = deletePlan(state.platform, requireActor(state), state.data, id);
      await save();
      return saved;
    },
    async updatePlan(id, input) {
      const saved = updatePlan(state.platform, requireActor(state), state.data, id, input);
      await save();
      return saved;
    },
    async recordPayment(input) {
      const saved = recordPayment(state.platform, requireActor(state), state.data, input);
      await save();
      return saved;
    },
    async myPayments() {
      return myPayments(state.platform, requireActor(state), state.data);
    },
    async startCheckout(paymentId) {
      const saved = markPaidPending(state.platform, requireActor(state), paymentId);
      return { action: "https://payment.local/mock-paid-pending", fields: { paymentId: saved.id, status: saved.status } };
    },
    async importTemplate(type) {
      if (!hasFeature(state.platform, requireActor(state).id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const headers = type === "ORGANIZATIONS" ? ["organizationName", "taxId", "contactName", "contactPhone", "contactEmail", "address"] : ["taxId", "categoryCode", "siteName", "siteAddress", "applicationDescription", "sourceRecordKey"];
      return toCsv(headers, []);
    },
    async importPreview(type, csv) {
      if (!hasFeature(state.platform, requireActor(state).id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const parsed = rowsToObjects(parseCsv(csv));
      const rows = parsed.records.map((record, index) => {
        const messages: string[] = [];
        if (type === "ORGANIZATIONS" && !/^\d{8}$/.test(record.taxId ?? "")) messages.push("taxId 暫定需為 8 位數字");
        if (type === "APPLICATION_DRAFTS" && (!record.taxId || !record.categoryCode || !record.sourceRecordKey)) messages.push("必填欄位不足");
        return { rowNumber: index + 2, ok: messages.length === 0, messages, preview: record };
      });
      const batch = { id: crypto.randomUUID(), type, status: "PREVIEWED" as const, rows, records: parsed.records, ready: rows.every((row) => row.ok) && rows.length > 0, errorCount: rows.filter((row) => !row.ok).length, rowCount: rows.length };
      state.imports.push(batch);
      await save();
      return batch;
    },
    async importCommit(id, requestId) {
      if (!hasFeature(state.platform, requireActor(state).id, "users.manage")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const batch = state.imports.find((item) => item.id === id);
      if (!batch) throw new ClientError("找不到匯入批次", { status: 404 });
      if (batch.status === "COMMITTED" && batch.commitKey === requestId) return { committed: batch.committed };
      if (!batch.ready) throw new ClientError("預覽仍有錯誤，尚未寫入");
      const before = state.data.organizations.length + state.data.applications.length;
      try {
        if (batch.type === "ORGANIZATIONS") {
          for (const record of batch.records) {
            if (state.data.organizations.some((org) => org.taxId === record.taxId)) throw new Error("重複統編");
            const now = new Date().toISOString();
            state.data.organizations.push({ id: crypto.randomUUID(), organizationName: record.organizationName ?? "", taxId: record.taxId ?? "", contactName: record.contactName ?? "", contactPhone: record.contactPhone ?? "", contactEmail: record.contactEmail ?? "", address: record.address ?? "", createdAt: now, updatedAt: now });
          }
        } else {
          const pending: DemoDataset["applications"] = [];
          let nextSequence = state.sequence;
          for (const record of batch.records) {
            const organization = state.data.organizations.find((org) => org.taxId === record.taxId);
            const category = state.data.categories.find((item) => item.code === record.categoryCode);
            const version = state.data.formVersions.filter((item) => item.categoryId === category?.id).sort((a, b) => b.version - a.version)[0];
            const owner = state.data.users.find((user) => user.organizationId === organization?.id && user.role === UserRole.APPLICANT);
            if (!organization || !category || !version || !owner) throw new Error("找不到業者或類別");
            const duplicate = [...state.data.applications, ...pending].some((app) => app.sourceSystem === "CSV_IMPORT" && app.sourceRecordKey === record.sourceRecordKey);
            if (duplicate) throw new Error("重複來源鍵");
            const now = new Date().toISOString();
            const applicationNo = formatApplicationNo(taipeiYear(), nextSequence);
            nextSequence += 1;
            pending.push({
              id: crypto.randomUUID(),
              applicationNo,
              organizationId: organization.id,
              createdById: owner.id,
              categoryId: category.id,
              categoryFormVersionId: version.id,
              status: ApplicationStatus.DRAFT,
              resumeStatus: null,
              assignedToId: null,
        siteReviewerId: null,
        siteChecks: [],
              version: 1,
              organizationNameSnapshot: organization.organizationName,
              taxIdSnapshot: organization.taxId,
              contactNameSnapshot: organization.contactName,
              contactPhoneSnapshot: organization.contactPhone,
              contactEmailSnapshot: organization.contactEmail,
              organizationAddressSnapshot: organization.address,
              siteName: record.siteName || null,
              siteAddress: record.siteAddress || null,
              applicationDescription: record.applicationDescription || null,
              declarationAccepted: false,
              formData: {},
              sourceSystem: "CSV_IMPORT",
              sourceRecordKey: record.sourceRecordKey ?? null,
              submittedAt: null,
              decidedAt: null,
              createdAt: now,
              updatedAt: now,
            });
          }
          state.sequence = nextSequence;
          state.data.applications.unshift(...pending);
        }
        batch.status = "COMMITTED";
        batch.commitKey = requestId;
        batch.committed = state.data.organizations.length + state.data.applications.length - before;
        await save();
        return { committed: batch.committed };
      } catch {
        throw new ClientError("整批未匯入");
      }
    },
    async exportApplications() {
      const actor = requireActor(state);
      const rows = state.data.applications.filter((app) => canViewApplication(actor, app));
      return toCsv(["applicationNo", "status"], rows.map((app) => [app.applicationNo, app.status]));
    },
    async savedReports() {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "reports.export")) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
      return state.platform.reports.map(({ createdById: _createdById, ...report }) => report);
    },
    async saveReport(input, id) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "reports.export")) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
      const duplicate = state.platform.reports.find((report) => report.name === input.name && report.id !== id);
      if (duplicate) throw new ClientError("這個報表名稱已經用過");
      const now = new Date().toISOString();
      if (!id) {
        const created = { id: crypto.randomUUID(), name: input.name, selections: input.selections, chartKind: input.chartKind, chartField: input.chartField, version: 1, updatedAt: now, createdById: actor.id };
        state.platform.reports.unshift(created);
        await save();
        const { createdById: _createdById, ...report } = created;
        return report;
      }
      const current = state.platform.reports.find((report) => report.id === id);
      if (!current) throw new ClientError("找不到報表", { status: 404, code: "NOT_FOUND" });
      if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) throw new ClientError("這份報表已被其他人更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      current.name = input.name;
      current.selections = input.selections;
      current.chartKind = input.chartKind;
      current.chartField = input.chartField;
      current.version += 1;
      current.updatedAt = now;
      await save();
      const { createdById: _createdById, ...report } = current;
      return report;
    },
    async deleteReport(id) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "reports.export")) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
      const index = state.platform.reports.findIndex((report) => report.id === id);
      if (index < 0) throw new ClientError("找不到報表", { status: 404, code: "NOT_FOUND" });
      state.platform.reports.splice(index, 1);
      await save();
    },
    async exportReport(id) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "reports.export")) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
      const report = state.platform.reports.find((item) => item.id === id);
      if (!report) throw new ClientError("找不到報表", { status: 404, code: "NOT_FOUND" });
      return reportSectionsCsv(report.selections.map((selection) => {
        const fields = selection.fieldKeys.map((key) => reportFieldsFor(selection.source).find((field) => field.key === key)).filter((field) => field !== undefined);
        const rows = reportRows(state, actor, selection.source);
        return { title: sourceLabel(selection.source), headers: fields.map((field) => field.label), rows: rows.map((row) => fields.map((field) => row[field.key] ?? "")) };
      }));
    },
    async previewReport(input) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "reports.export")) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
      const selections = reportSelectionsSchema.parse(input.selections);
      return reportPreviewSchema.parse({
        sections: selections.map((selection) => {
          const fields = selection.fieldKeys.map((key) => reportFieldsFor(selection.source).find((field) => field.key === key)).filter((field) => field !== undefined);
          const rows = reportRows(state, actor, selection.source);
          return {
            source: selection.source,
            label: sourceLabel(selection.source),
            columns: fields.map((field) => ({ key: field.key, label: field.label })),
            rows: rows.slice(0, 100).map((row) => Object.fromEntries(fields.map((field) => [field.key, row[field.key] ?? ""]))),
            total: rows.length,
            groups: fields.map((field) => ({ fieldKey: field.key, label: field.label, points: countReportValues(rows, field.key) })),
          };
        }),
      });
    },
    async exportEnrollments(courseId) {
      requireActor(state);
      const rows = await services.courseEnrollments(courseId);
      return toCsv(["userName", "attendanceStatus", "attendedMinutes", "recognizedMinutes", "trainingCertificateNo", "trainingCertificateIssuedOn", "trainingCertificateValidUntil"], rows.map((row) => [row.userName, row.attendanceStatus, row.attendedMinutes, row.recognizedMinutes, row.trainingCertificateNo ?? "", row.trainingCertificateIssuedOn ?? "", row.trainingCertificateValidUntil ?? ""]));
    },
    async audit(query) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "audit.view")) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
      const cutoff = auditRetentionCutoff().toISOString();
      const kept = state.data.auditLogs.filter((log) => log.createdAt >= cutoff);
      if (kept.length !== state.data.auditLogs.length) {
        state.data.auditLogs = kept;
        await save();
      }
      const category = query?.category && query.category !== "ALL" ? query.category : "";
      const rows = kept
        .filter((log) => !category || auditCategoryOf(log.action) === category)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const page = query?.page ?? 1;
      const pageSize = 100;
      const items = rows.slice((page - 1) * pageSize, page * pageSize).map((log) => ({
        ...log,
        actorName: state.data.users.find((user) => user.id === log.actorId)?.displayName ?? null,
      }));
      return { items, meta: { page, pageSize, total: rows.length, totalPages: Math.max(1, Math.ceil(rows.length / pageSize)) } };
    },
    async publicSite() {
      return publicSite(state.platform, state.data.files);
    },
    async adminSite() {
      return adminSite(state.platform, requireActor(state), state.data.files);
    },
    async saveSite(slot, input) {
      const saved = saveSite(state.platform, requireActor(state), state.data.files, slot, input);
      await save();
      return saved;
    },
    async uploadCourseImage(id, file) {
      const actor = requireActor(state);
      if (actor.role === UserRole.APPLICANT) throw new ClientError("沒有課程管理權限", { status: 403 });
      const course = state.data.courses.find((item) => item.id === id);
      if (!course) throw new ClientError("找不到課程", { status: 404 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = detectFileSignature(bytes);
      if (!mime || mime === "application/pdf") throw new ClientError("圖片只接受 JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
      const stored = await rememberFile(state.data, actor.id, file.name || "image", mime, bytes);
      course.imageFileId = stored.id;
      course.version += 1;
      course.updatedAt = new Date().toISOString();
      await save();
      return courseDto(state, course);
    },
    async uploadCourseVideo(id, file, durationSeconds) {
      const actor = requireActor(state);
      if (actor.role === UserRole.APPLICANT) throw new ClientError("沒有課程管理權限", { status: 403 });
      const course = state.data.courses.find((item) => item.id === id);
      if (!course) throw new ClientError("找不到課程", { status: 404 });
      if ((course.delivery ?? "OFFLINE") !== "ONLINE") throw new ClientError("只有線上課程可以上傳影片");
      if (!Number.isInteger(durationSeconds) || durationSeconds < 1) throw new ClientError("無法讀取影片長度");
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = detectCourseVideo(bytes);
      if (!mime) throw new ClientError("課程影片只接受 MP4 或 WebM", { code: "UNSUPPORTED_FILE_TYPE" });
      const stored = await rememberFile(state.data, actor.id, file.name || "video", mime, bytes);
      course.videoFileId = stored.id;
      course.videoDurationSeconds = durationSeconds;
      course.version += 1;
      course.updatedAt = new Date().toISOString();
      await save();
      return courseDto(state, course);
    },
    async uploadCourseMaterial(id, file) {
      const actor = requireActor(state);
      if (actor.role === UserRole.APPLICANT) throw new ClientError("沒有課程管理權限", { status: 403 });
      const course = state.data.courses.find((item) => item.id === id);
      if (!course) throw new ClientError("找不到課程", { status: 404 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const mime = detectFileSignature(bytes);
      if (!mime) throw new ClientError("上課資料只接受 PDF、JPEG 或 PNG", { code: "UNSUPPORTED_FILE_TYPE" });
      const stored = await rememberFile(state.data, actor.id, file.name || "material", mime, bytes);
      course.materialFileId = stored.id;
      course.version += 1;
      course.updatedAt = new Date().toISOString();
      await save();
      return courseDto(state, course);
    },
    async downloadCourseMaterial(courseId) {
      const actor = requireActor(state);
      const course = state.data.courses.find((item) => item.id === courseId);
      const file = course?.materialFileId ? state.data.files.find((item) => item.id === course.materialFileId) : undefined;
      if (!course || !file) throw new ClientError("這門課還沒有上課資料", { status: 404 });
      const staff = actor.role !== UserRole.APPLICANT;
      const enrolled = state.data.enrollments.some((item) => item.courseId === courseId && item.userId === actor.id && item.status === EnrollmentStatus.CONFIRMED);
      if (!staff && !enrolled) throw new ClientError("報名後才能下載這門課的上課資料", { status: 403 });
      const binary = atob(file.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return { blob: new Blob([bytes], { type: file.mimeType }), name: file.originalName };
    },
    async startCourseQuiz(enrollmentId) {
      const actor = requireActor(state);
      assertMockServiceUnlocked(state.platform, actor);
      if (actor.role !== UserRole.APPLICANT) throw new ClientError("只有業者可參加測驗", { status: 403 });
      const enrollment = state.data.enrollments.find((item) => item.id === enrollmentId && item.userId === actor.id);
      const course = enrollment ? state.data.courses.find((item) => item.id === enrollment.courseId) : undefined;
      if (!enrollment || !course) throw new ClientError("找不到報名", { status: 404 });
      const quiz = courseQuizState({
        enrollmentStatus: enrollment.status,
        attendanceStatus: enrollment.attendanceStatus,
        delivery: course.delivery,
        watchedSeconds: enrollment.watchedSeconds ?? 0,
        videoDurationSeconds: course.videoDurationSeconds ?? 0,
        endsAtIso: course.endsAt,
        nowIso: new Date().toISOString(),
        quizPassedAt: enrollment.quizPassedAt ?? null,
        recognizedMinutes: enrollment.recognizedMinutes ?? 0,
      });
      if (quiz.quizPassed) throw new ClientError("這門課已通過測驗");
      if (!quiz.quizReady) throw new ClientError(quiz.quizBlockedReason);
      state.data.courseQuizAttempts ??= [];
      const active = state.data.courseQuizAttempts.find((item) => item.enrollmentId === enrollmentId && !item.submittedAt);
      const policy = state.data.trainingPolicy;
      const present = (ids: string[]) => ids.map((id) => state.data.basicQuestions.find((item) => item.id === id)).filter((item): item is NonNullable<typeof item> => Boolean(item)).map((item) => ({ id: item.id, prompt: item.prompt, options: item.options, sortOrder: item.sortOrder, isActive: true }));
      if (active) return { attemptId: active.id, drawCount: active.drawCount, passCount: active.passCountSnapshot, questions: present(active.drawnQuestionIds) };
      const bank = state.data.basicQuestions.filter((item) => item.isActive);
      if (bank.length < policy.quizDrawCount) throw new ClientError(`題庫至少需要 ${policy.quizDrawCount} 題才能抽題`);
      const drawn = drawRandomQuestions(bank, policy.quizDrawCount);
      const attempt = { id: crypto.randomUUID(), enrollmentId, userId: actor.id, correctCount: 0, drawCount: drawn.length, passCountSnapshot: policy.quizPassCount, passed: false, drawnQuestionIds: drawn.map((item) => item.id), answers: null, submittedAt: null, createdAt: new Date().toISOString() };
      state.data.courseQuizAttempts.push(attempt);
      await save();
      return { attemptId: attempt.id, drawCount: attempt.drawCount, passCount: attempt.passCountSnapshot, questions: present(attempt.drawnQuestionIds) };
    },
    async submitCourseQuiz(enrollmentId, input) {
      const actor = requireActor(state);
      if (actor.role !== UserRole.APPLICANT) throw new ClientError("只有業者可參加測驗", { status: 403 });
      const enrollment = state.data.enrollments.find((item) => item.id === enrollmentId && item.userId === actor.id);
      const course = enrollment ? state.data.courses.find((item) => item.id === enrollment.courseId) : undefined;
      if (!enrollment || !course) throw new ClientError("找不到報名", { status: 404 });
      if (enrollment.quizPassedAt) throw new ClientError("這門課已通過測驗");
      const attempt = (state.data.courseQuizAttempts ?? []).find((item) => item.id === input.attemptId && item.enrollmentId === enrollmentId && !item.submittedAt);
      if (!attempt) throw new ClientError("找不到進行中的測驗，請重新開始");
      if (input.answers.length !== attempt.drawnQuestionIds.length || !attempt.drawnQuestionIds.every((id) => input.answers.some((answer) => answer.questionId === id))) {
        throw new ClientError("請答完本次抽出的全部題目");
      }
      const questions = state.data.basicQuestions.filter((item) => attempt.drawnQuestionIds.includes(item.id));
      const scored = scoreBasicQuiz(questions.map((item) => ({ id: item.id, correctIndex: item.correctIndex, options: item.options })), input.answers);
      const passed = quizPassedByCount(scored.correct, attempt.passCountSnapshot);
      attempt.correctCount = scored.correct;
      attempt.passed = passed;
      attempt.answers = input.answers;
      attempt.submittedAt = new Date().toISOString();
      if (passed) {
        enrollment.quizPassedAt = attempt.submittedAt;
        enrollment.recognizedMinutes = course.durationMinutes;
        enrollment.version += 1;
      }
      await save();
      return { passed, correctCount: scored.correct, drawCount: attempt.drawCount, recognizedMinutes: passed ? course.durationMinutes : 0, record: learningOf(state, enrollment) };
    },
    async recordWatch(id, input) {
      const actor = requireActor(state);
      const enrollment = state.data.enrollments.find((item) => item.id === id && item.userId === actor.id);
      if (!enrollment) throw new ClientError("找不到報名", { status: 404 });
      if (enrollment.version !== input.expectedVersion) throw new ClientError("觀看進度已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      const course = state.data.courses.find((item) => item.id === enrollment.courseId)!;
      if ((course.delivery ?? "OFFLINE") !== "ONLINE") throw new ClientError("這不是線上課程");
      const now = new Date().toISOString();
      const watchedSeconds = acceptWatchProgress({
        currentSeconds: enrollment.watchedSeconds ?? 0,
        reportedSeconds: input.watchedSeconds,
        videoDurationSeconds: course.videoDurationSeconds ?? 0,
        lastReportedAt: enrollment.watchUpdatedAt ?? null,
        nowIso: now,
      });
      if (watchedSeconds !== (enrollment.watchedSeconds ?? 0)) {
        enrollment.watchedSeconds = watchedSeconds;
        enrollment.watchUpdatedAt = now;
        if (watchedSeconds >= onlinePassSeconds(course.videoDurationSeconds ?? 0)) {
          enrollment.attendanceStatus = AttendanceStatus.PRESENT;
          enrollment.attendedMinutes = Math.floor(watchedSeconds / 60);
        }
        enrollment.version += 1;
        await save();
      }
      return learningOf(state, enrollment);
    },
    async courseVideo(id) {
      const actor = requireActor(state);
      const enrollment = state.data.enrollments.find((item) => item.id === id);
      if (!enrollment) throw new ClientError("找不到課程影片", { status: 404 });
      const staff = actor.role !== UserRole.APPLICANT;
      if (!staff && enrollment.userId !== actor.id) throw new ClientError("找不到課程影片", { status: 404 });
      const course = state.data.courses.find((item) => item.id === enrollment.courseId);
      const file = course?.videoFileId ? state.data.files.find((item) => item.id === course.videoFileId) : undefined;
      if (!file) throw new ClientError("找不到課程影片", { status: 404 });
      const binary = atob(file.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
      return { blob: new Blob([bytes], { type: file.mimeType }), name: file.originalName };
    },
    async uploadSiteImage(slot, file) {
      const saved = await uploadSiteImage(state.platform, requireActor(state), state.data, slot, file);
      await save();
      return saved;
    },
    async adminEntries() {
      return adminEntries(state.platform, requireActor(state), state.data.files);
    },
    async uploadEntryImage(id, file) {
      const saved = await uploadEntryImage(state.platform, requireActor(state), state.data, id, file);
      await save();
      return saved;
    },
    async createEntry(input) {
      const saved = createEntry(state.platform, requireActor(state), input);
      await save();
      return saved;
    },
    async updateEntry(id, input) {
      const saved = updateEntry(state.platform, requireActor(state), id, input);
      await save();
      return saved;
    },
    async deleteEntry(id) {
      deleteEntry(state.platform, requireActor(state), id);
      await save();
    },
    async publicSitePages() {
      return publicSitePages(state.platform);
    },
    async adminSitePages() {
      return adminSitePages(state.platform, requireActor(state), state.data);
    },
    async createSitePage(input) {
      const saved = createSitePage(state.platform, requireActor(state), state.data, input);
      await save();
      return saved;
    },
    async updateSitePage(id, input) {
      const saved = updateSitePage(state.platform, requireActor(state), state.data, id, input);
      await save();
      return saved;
    },
    async publishSitePage(id, expectedVersion) {
      const saved = publishSitePage(state.platform, requireActor(state), state.data, id, { expectedVersion }, true);
      await save();
      return saved;
    },
    async unpublishSitePage(id, expectedVersion) {
      const saved = publishSitePage(state.platform, requireActor(state), state.data, id, { expectedVersion }, false);
      await save();
      return saved;
    },
    async deleteSitePage(id, expectedVersion) {
      deleteSitePage(state.platform, requireActor(state), state.data, id, { expectedVersion });
      await save();
    },
    async reorderSitePages(input) {
      const saved = reorderSitePages(state.platform, requireActor(state), state.data, input);
      await save();
      return saved;
    },
    async uploadSitePageImage() {
      requireActor(state);
      throw new ClientError("示範模式不能上傳頁面圖片，請貼圖片網址或從圖庫挑選", { status: 400, code: "VALIDATION_ERROR" });
    },
    async myContracts() {
      await scanRenewals();
      return myContracts(state.platform, requireActor(state));
    },
    async contract(id) {
      const row = contractOf(state.platform, requireActor(state), id);
      const body = ensureContractHtml(row.body);
      if (body !== row.body) row.body = body;
      return {
        ...row,
        body,
        fill: row.fill ?? null,
        hasSignature: Boolean(row.signatureFileId),
        hasFace: Boolean(row.faceFileId),
        hasPdf: Boolean(row.pdfFileId),
      };
    },
    async uploadSignedContract(id, input) {
      assertMockServiceUnlocked(state.platform, requireActor(state));
      const actor = requireActor(state);
      const saved = await uploadSignedContractPdf(state.platform, actor, state.data, id, input);
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "CONTRACT_SIGN", entityType: "ContractRecord", entityId: id, requestId: crypto.randomUUID(), safeChanges: { contractNo: saved.contractNo, status: "SIGNED", method: "upload_pdf" }, createdAt: new Date().toISOString() });
      await save();
      return saved;
    },
    async contractDocument(id) {
      return contractDocument(state.platform, requireActor(state), state.data, id);
    },
    async recordRenewal(id, input) {
      const saved = recordRenewal(state.platform, requireActor(state), id, input);
      await save();
      return { renewalApplicationNo: null, renewalApplicationId: null, renewalNote: null, ...saved };
    },
    async contractTemplates() {
      return listTemplates(state.platform, requireActor(state));
    },
    async createContractTemplate(input) {
      const saved = createTemplate(state.platform, requireActor(state), input);
      await save();
      return saved;
    },
    async createContractTemplateVersion(id, input) {
      const saved = createTemplateVersion(state.platform, requireActor(state), id, input);
      await save();
      return saved;
    },
    async saveContractTemplate(id, input) {
      const saved = saveTemplate(state.platform, requireActor(state), id, input);
      await save();
      return saved;
    },
    async issuableOrganizations() {
      return listIssuableOrganizations(state.platform, requireActor(state), state.data);
    },
    async adminContracts() {
      await scanRenewals();
      return adminContracts(state.platform, requireActor(state));
    },
    async operationSetting() {
      requireActor(state);
      return readOperationSetting(state.platform);
    },
    async systemConnection() {
      requireActor(state);
      return readSystemConnection(state.platform);
    },
    async saveSystemConnection(input) {
      const actor = requireActor(state);
      const saved = saveSystemConnection(state.platform, actor, input);
      await save();
      return saved;
    },
    async saveOperationSetting(input) {
      const actor = requireActor(state);
      const saved = saveOperationSetting(state.platform, actor, input);
      state.data.auditLogs.unshift({
        id: crypto.randomUUID(),
        actorId: actor.id,
        action: "OPERATION_SETTING_UPDATE",
        entityType: "OperationSetting",
        entityId: null,
        requestId: crypto.randomUUID(),
        safeChanges: { renewalReminderDays: saved.renewalReminderDays, certificateTermMonths: saved.certificateTermMonths, attachmentMaxBytes: saved.attachmentMaxBytes },
        createdAt: new Date().toISOString(),
      });
      await save();
      return saved;
    },
    async issueContract(input) {
      const actor = requireActor(state);
      const saved = issueContract(state.platform, actor, state.data, input);
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "CONTRACT_ISSUE", entityType: "ContractRecord", entityId: saved.id, requestId: crypto.randomUUID(), safeChanges: { contractNo: saved.contractNo }, createdAt: new Date().toISOString() });
      await save();
      return saved;
    },
    async reviseContract(id, input) {
      const actor = requireActor(state);
      const saved = reviseContract(state.platform, actor, state.data, id, input);
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "CONTRACT_REVISE", entityType: "ContractRecord", entityId: id, requestId: crypto.randomUUID(), safeChanges: { contractNo: saved.contractNo }, createdAt: new Date().toISOString() });
      await save();
      return saved;
    },
    async recallContract(id, input) {
      const actor = requireActor(state);
      const saved = recallContract(state.platform, actor, id, input.expectedVersion);
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "CONTRACT_RECALL", entityType: "ContractRecord", entityId: id, requestId: crypto.randomUUID(), safeChanges: { contractNo: saved.contractNo }, createdAt: new Date().toISOString() });
      await save();
      return saved;
    },
    async contractSeals() {
      return getContractSeals(state.platform, requireActor(state), state.data);
    },
    async uploadContractSeal(kind, file) {
      const saved = await uploadContractSeal(state.platform, requireActor(state), state.data, kind, file);
      await save();
      return saved;
    },
    async updateSealPositions(input) {
      const saved = updateSealPositions(state.platform, requireActor(state), state.data, input);
      await save();
      return saved;
    },
    async accessSettings() {
      return accessSettings(state.platform, requireActor(state), state.data.users);
    },
    async updateFeature(input) {
      updateFeature(state.platform, requireActor(state), state.data.users, input);
      await save();
    },
    async updateIntegration(input) {
      updateIntegration(state.platform, requireActor(state), input);
      await save();
    },
    async basicTrainingStatus() {
      assertMockServiceUnlocked(state.platform, requireActor(state));
      return desk().basicStatus();
    },
    async recordBasicModuleWatch(moduleId, input) {
      assertMockServiceUnlocked(state.platform, requireActor(state));
      const result = await desk().recordBasicModuleWatch(moduleId, input);
      await save();
      return result;
    },
    async startBasicQuiz() {
      assertMockServiceUnlocked(state.platform, requireActor(state));
      const result = await desk().startBasicQuiz();
      await save();
      return result;
    },
    async submitBasicQuiz(input) {
      assertMockServiceUnlocked(state.platform, requireActor(state));
      const result = await desk().submitBasicQuiz(input);
      await save();
      return result;
    },
    async downloadBasicModuleMaterial(moduleId) {
      return desk().downloadBasicModuleMaterial(moduleId);
    },
    async trainingPolicy() {
      return desk().trainingPolicy();
    },
    async saveTrainingPolicy(input) {
      const result = await desk().saveTrainingPolicy(input);
      await save();
      return result;
    },
    async adminBasicModules() {
      return desk().adminBasicModules();
    },
    async saveBasicModule(input, id) {
      const result = await desk().saveBasicModule(input, id);
      await save();
      return result;
    },
    async uploadBasicModuleMaterial(id, file) {
      const result = await desk().uploadBasicModuleMaterial(id, file);
      await save();
      return result;
    },
    async adminQuestionBank() {
      return desk().adminQuestionBank();
    },
    async replaceQuestionBank(input) {
      const result = await desk().replaceQuestionBank(input);
      await save();
      return result;
    },
    async saveQuestion(input, id) {
      const result = await desk().saveQuestion(input, id);
      await save();
      return result;
    },
    async deleteQuestion(id) {
      const result = await desk().deleteQuestion(id);
      await save();
      return result;
    },
    async uploadQuestionBank(file) {
      const result = await desk().uploadQuestionBank(file);
      await save();
      return result;
    },
    async myCompanyTrainingRequests() {
      return desk().myCompanyTrainingRequests();
    },
    async saveCompanyTrainingRequest(input, id) {
      const result = await desk().saveCompanyTrainingRequest(input, id);
      await save();
      return result;
    },
    async submitCompanyTrainingRequest(id, expectedVersion) {
      const result = await desk().submitCompanyTrainingRequest(id, expectedVersion);
      await save();
      return result;
    },
    async adminCompanyTrainingRequests() {
      return desk().adminCompanyTrainingRequests();
    },
    async reviewCompanyTrainingRequest(id, input) {
      const result = await desk().reviewCompanyTrainingRequest(id, input);
      await save();
      return result;
    },
    async registerTrainingCertificate(input) {
      const result = await desk().registerTrainingCertificate(input);
      await save();
      return result;
    },
    async trainingCertificates() {
      return desk().listTrainingCertificates();
    },
    async resetDemo() {
      state = blank();
      sessionStorage.removeItem("mf-demo-user");
      await save();
    },
    demoAccounts() {
      return [
        { email: "applicant01@example.test", label: "業者 applicant01" },
        { email: "officer.lin@example.test", label: "承辦人林示範" },
        { email: "admin@example.test", label: "管理員" },
      ];
    },
    async switchDemoUser(email) {
      const user = state.data.users.find((item) => item.email === email);
      if (!user) throw new ClientError("找不到展示帳號");
      sessionStorage.setItem("mf-demo-user", user.id);
      return publicUser(state, user);
    },
  };

  function desk() {
    const actor = requireActor(state);
    return trainingDesk(state.data, actor, hasFeature(state.platform, actor.id, "training.manage"));
  }

  function presentNotice(job: (typeof state.data.notificationJobs)[number], includeError: boolean) {
    const application = state.data.applications.find((item) => item.id === job.applicationId);
    return {
      id: job.id,
      type: job.type,
      subject: job.subject || "案件通知",
      body: job.body || "這是較早的通知紀錄，沒有留下信件本文。",
      status: job.status,
      applicationId: job.applicationId,
      applicationNo: application?.applicationNo ?? null,
      recipientEmail: job.recipientEmail,
      createdAt: job.createdAt,
      sentAt: job.sentAt,
      lastErrorCode: includeError ? job.lastErrorCode : null,
    };
  }

  function mailDrafts() {
    const now = new Date().toISOString();
    state.platform.mailTemplates ??= [];
    for (const item of DEFAULT_MAIL_TEMPLATES) {
      if (state.platform.mailTemplates.some((entry) => entry.key === item.key)) continue;
      state.platform.mailTemplates.push({ key: item.key, subject: item.subject, body: item.body, version: 1, updatedAt: now });
    }
    return state.platform.mailTemplates;
  }

  function queueNotice(app: (typeof state.data.applications)[number], action: ApplicationAction, toStatus: ApplicationStatus, publicComment: string | null, dedupeKey: string, now: string) {
    if (state.data.notificationJobs.some((item) => item.dedupeKey === dedupeKey)) return;
    const notice = customerNotice({ action, applicationNo: app.applicationNo, toStatus, publicComment, templates: mailDrafts() });
    const user = state.data.users.find((item) => item.id === app.createdById);
    state.data.notificationJobs.push({
      id: crypto.randomUUID(),
      dedupeKey,
      type: notice.type,
      subject: notice.subject,
      body: notice.body,
      recipientUserId: app.createdById,
      recipientEmail: user?.email ?? "",
      applicationId: app.id,
      status: "PENDING",
      attemptCount: 0,
      lastErrorCode: null,
      createdAt: now,
      sentAt: null,
    });
  }

  async function deliverPending() {
    const jobs = state.data.notificationJobs.filter((item) => item.status === "PENDING" && item.recipientEmail);
    if (!jobs.length) return;
    let ok = false;
    let localCatcher = false;
    try {
      const response = await fetch("/dev-mail", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: jobs.map((item) => ({ to: item.recipientEmail, subject: item.subject, text: item.body })) }),
      });
      const payload = await response.json() as { ok?: boolean; local?: boolean };
      ok = response.ok && payload.ok === true;
      localCatcher = ok && payload.local !== false;
    } catch {
      ok = false;
    }
    const now = new Date().toISOString();
    for (const job of jobs) {
      job.attemptCount += 1;
      job.status = ok ? (localCatcher ? "MOCKED" : "SENT") : "FAILED";
      job.sentAt = ok && !localCatcher ? now : null;
      job.lastErrorCode = ok ? (localCatcher ? "LOCAL_CATCHER" : null) : "SMTP_ERROR";
    }
    await save();
  }

  async function scanRenewals() {
    const reminderDays = state.platform.operationSetting?.renewalReminderDays ?? CONTRACT_RENEWAL_WINDOW_DAYS;
    const templates = mailDrafts();
    let added = false;
    for (const contract of state.platform.contracts) {
      if (contract.status !== "SIGNED" || !contract.signedAt || !isContractRenewalDue(contract.signedAt, new Date(), reminderDays)) continue;
      const letter = renewalNotice({
        contractNo: contract.contractNo,
        organizationName: contract.organizationName,
        daysLeft: daysUntilContractExpiry(contract.signedAt),
        reminderDays,
        templates,
      });
      const recipients = state.data.users.filter((user) => user.organizationId === contract.organizationId && user.role === UserRole.APPLICANT && user.isActive);
      for (const user of recipients) {
        const dedupeKey = `renewal:${contract.id}:${contract.signedAt}:${user.id}`;
        const existing = state.data.notificationJobs.find((item) => item.dedupeKey === dedupeKey);
        if (existing?.status === "SENT" || existing?.status === "MOCKED") continue;
        if (existing) {
          existing.status = "PENDING";
          added = true;
          continue;
        }
        state.data.notificationJobs.push({
          id: crypto.randomUUID(),
          dedupeKey,
          type: letter.type,
          subject: letter.subject,
          body: letter.body,
          recipientUserId: user.id,
          recipientEmail: user.email,
          applicationId: null,
          status: "PENDING",
          attemptCount: 0,
          lastErrorCode: null,
          createdAt: new Date().toISOString(),
          sentAt: null,
        });
        added = true;
      }
    }
    if (added) await deliverPending();
  }

  async function transition(id: string, expectedVersion: number, requestId: string, action: typeof ApplicationAction.SUBMIT | typeof ApplicationAction.RESUBMIT) {
    const actor = requireActor(state);
    const existing = state.data.events.find((event) => event.applicationId === id && event.requestId === requestId);
    if (existing) return toDetail(state, id, actor);
    const app = state.data.applications.find((item) => item.id === id);
    if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
    if (action === ApplicationAction.SUBMIT) assertCanApply(state.data, actor, state.platform);
    const decision = resolveTransition({ action, status: app.status, resumeStatus: app.resumeStatus, role: actor.role, isAssignee: app.assignedToId === actor.id, isSiteReviewer: app.siteReviewerId === actor.id, hasAssignee: Boolean(app.assignedToId) });
    if (!decision.ok) throw new ClientError(decision.message, { code: "INVALID_TRANSITION" });
    if (app.version !== expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
    const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId)!;
    const definition = parseCategoryDefinition(version.definition);
    if (version.configurationStatus !== "CONFIRMED") {
      /* 展示模式允許示範類別送件 */
    }
    const active = state.data.attachments.filter((item) => item.applicationId === id && !item.removedAt && !item.capturedOnSite);
    const issues = validateSubmit(content(app), definition, active.map((item) => item.requirementKey));
    if (issues.length) throw new ClientError("還不能送件", { fieldErrors: issues, code: "VALIDATION_ERROR" });
    const now = new Date().toISOString();
    const submissionId = crypto.randomUUID();
    state.data.submissions.push({ id: submissionId, applicationId: id, revision: state.data.submissions.filter((item) => item.applicationId === id).length + 1, submittedById: actor.id, submittedAt: now, formVersionId: version.id, payloadSnapshot: snapshotPayload(content(app), version.id), attachmentIdsSnapshot: active.map((item) => item.id) });
    state.data.events.push({ id: crypto.randomUUID(), applicationId: id, submissionId, actorId: actor.id, action, fromStatus: app.status, toStatus: decision.toStatus, publicComment: null, internalNote: null, requestId, requestHash: requestId, createdAt: now });
    state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action, entityType: "Application", entityId: id, requestId, safeChanges: { fromStatus: app.status, toStatus: decision.toStatus, revision: state.data.submissions.filter((item) => item.applicationId === id).length }, createdAt: now });
    app.status = decision.toStatus;
    app.resumeStatus = decision.nextResumeStatus;
    app.version += 1;
    app.submittedAt = app.submittedAt ?? now;
    app.updatedAt = now;
    await save();
    const revision = state.data.submissions.filter((item) => item.applicationId === id).length;
    queueNotice(app, action, decision.toStatus, null, `submission:${id}:${revision}`, now);
    await deliverPending();
    return toDetail(state, id, actor);
  }

  return services;
}

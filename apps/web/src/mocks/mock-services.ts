import {
  APP_NAME,
  ApplicationAction,
  ApplicationStatus,
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
  buildDemoDataset,
  buildLearningRecord,
  canCancelEnrollment,
  canEditApplicationContent,
  canEnroll,
  canViewApplication,
  commentRequirement,
  checkFieldReviews,
  reviewTargets,
  detectFileSignature,
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
  parseCsv,
  rowsToObjects,
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
  adminEntries,
  createEntry,
  deleteEntry,
  ensureAccountFeatures,
  ensureEditorial,
  grantAccountFeatures,
  hasFeature,
  issueContract,
  myContracts,
  publicSite,
  rememberFile,
  updateEntry,
  saveContract,
  saveSite,
  saveTemplate,
  signContract,
  templateOf,
  updateFeature,
  updateIntegration,
  uploadEntryImage,
  uploadSiteImage,
  voidContract,
  type PlatformState,
} from "./platform";

type State = {
  data: DemoDataset;
  digests: Record<string, string>;
  sequence: number;
  imports: Array<{ id: string; type: "ORGANIZATIONS" | "APPLICATION_DRAFTS"; status: string; rows: { rowNumber: number; ok: boolean; messages: string[]; preview: Record<string, string> }[]; records: Record<string, string>[]; ready: boolean; commitKey?: string; committed?: number }>;
  resetTokens: Array<{ token: string; userId: string; expiresAt: string; used: boolean }>;
  platform: PlatformState;
};

const KEY = "mf-demo-state-v1";

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
  if (!org || !category || !version) throw new ClientError("案件資料不完整", { status: 500 });
  const definition = parseCategoryDefinition(version.definition);
  const attachments = state.data.attachments
    .filter((item) => item.applicationId === app.id && !item.removedAt)
    .map((item) => {
      const file = state.data.files.find((entry) => entry.id === item.fileId)!;
      return { id: item.id, requirementKey: item.requirementKey, fileId: item.fileId, originalName: file.originalName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, createdAt: item.createdAt };
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
    youtubeUrl: course.youtubeUrl ?? "",
    imageUrl: courseImage(state, course),
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
  const learning = buildLearningRecord({
    enrollmentStatus: enrollment.status,
    attendanceStatus: enrollment.attendanceStatus,
    attendedMinutes: enrollment.attendedMinutes,
    requiredAttendanceMinutesSnapshot: enrollment.requiredAttendanceMinutesSnapshot,
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
    requiredAttendanceMinutesSnapshot: enrollment.requiredAttendanceMinutesSnapshot,
    completion: learning.completion,
    countsTowardTotal: learning.countsTowardTotal,
    attendedHoursLabel: minutesToHourLabel(enrollment.attendedMinutes),
    version: enrollment.version,
    enrolledAt: enrollment.enrolledAt,
    cancelledAt: enrollment.cancelledAt,
    startsAt: course.startsAt,
    endsAt: course.endsAt,
    location: course.location,
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

export async function createMockServices(): Promise<Services> {
  const digest = await sha256Hex(DEMO_PASSWORD);
  const blank = (): State => {
    const data = buildDemoDataset();
    return {
      data,
      digests: Object.fromEntries(data.users.map((user) => [user.id, digest])),
      sequence: 41,
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
  ensureAccountFeatures(state.platform, state.data.users);
  ensureEditorial(state.platform);
  for (const course of state.data.courses) {
    course.youtubeUrl ??= "";
    course.imageFileId ??= null;
  }
  const save = () => idbSet(state);

  const services: Services = {
    mode: "mock",
    async config() {
      return {
        appName: APP_NAME,
        dataMode: "mock",
        demoMode: true,
        maxFileBytes: FILE_POLICY.maxFileBytes,
        maxApplicationBytes: FILE_POLICY.maxApplicationBytes,
        allowedMimeTypes: [...FILE_POLICY.allowedMimeTypes],
        contactEmail: DEMO_CONTACT_EMAIL,
        contactNote: "展示模式使用模擬資料，不會寄出真實郵件。",
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
      });
    },
    async applications(query = {}) {
      const actor = requireActor(state);
      let rows = state.data.applications.filter((app) => canViewApplication(actor, app));
      if (query.status) rows = rows.filter((app) => app.status === query.status);
      if (query.categoryId) rows = rows.filter((app) => app.categoryId === query.categoryId);
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
    async application(id) {
      return toDetail(state, id, requireActor(state));
    },
    async createApplication(categoryId) {
      const actor = requireActor(state);
      if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ClientError("只有業者可以建立申請", { status: 403 });
      const org = state.data.organizations.find((item) => item.id === actor.organizationId)!;
      const versions = state.data.formVersions.filter((item) => item.categoryId === categoryId).sort((a, b) => b.version - a.version);
      const latest = versions[0];
      if (!latest) throw new ClientError("找不到申請類別", { status: 404 });
      const now = new Date().toISOString();
      const applicationNo = formatApplicationNo(taipeiYear(), state.sequence);
      state.sequence += 1;
      state.data.applications.unshift({
        id: crypto.randomUUID(),
        applicationNo,
        organizationId: org.id,
        createdById: actor.id,
        categoryId,
        categoryFormVersionId: latest.id,
        status: ApplicationStatus.DRAFT,
        resumeStatus: null,
        assignedToId: null,
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
      await save();
      return toDetail(state, id, actor);
    },
    async review(id, input) {
      const actor = requireActor(state);
      const existing = state.data.events.find((event) => event.applicationId === id && event.requestId === input.requestId);
      if (existing) return toDetail(state, id, actor);
      const app = state.data.applications.find((item) => item.id === id);
      if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
      const decision = resolveTransition({ action: input.action as ApplicationAction, status: app.status, resumeStatus: app.resumeStatus, role: actor.role, isAssignee: app.assignedToId === actor.id, hasAssignee: Boolean(app.assignedToId) });
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
      const now = new Date().toISOString();
      state.data.events.push({ id: crypto.randomUUID(), applicationId: id, submissionId: null, actorId: actor.id, action: input.action as ApplicationAction, fromStatus: app.status, toStatus: decision.toStatus, publicComment: publicComment ?? null, internalNote: input.internalNote ?? null, requestId: input.requestId, requestHash: input.requestId, createdAt: now });
      app.fieldReviews = reviews;
      app.status = decision.toStatus;
      app.resumeStatus = decision.nextResumeStatus;
      app.version += 1;
      app.updatedAt = now;
      if (decision.toStatus === ApplicationStatus.APPROVED || decision.toStatus === ApplicationStatus.REJECTED) app.decidedAt = now;
      state.data.notificationJobs.push({ id: crypto.randomUUID(), dedupeKey: `${input.action}:${id}:${input.requestId}`, type: input.action === "REQUEST_SUPPLEMENT" ? "SUPPLEMENT_REQUEST" : "DECISION_RESULT", recipientUserId: app.createdById, recipientEmail: state.data.users.find((user) => user.id === app.createdById)?.email ?? "", applicationId: id, status: "MOCKED", attemptCount: 1, lastErrorCode: "MOCK_MODE", createdAt: now, sentAt: null });
      await save();
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
      if (!definition.attachmentRequirements.some((item) => item.key === requirementKey)) throw new ClientError("此表單版本沒有這個附件項目");
      if (file.size > FILE_POLICY.maxFileBytes) throw new ClientError("檔案超過 10 MiB", { code: "FILE_TOO_LARGE" });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const signature = detectFileSignature(bytes);
      if (!signature || signature !== file.type) throw new ClientError("只接受 PDF、JPEG、PNG，且內容需與格式一致", { code: "UNSUPPORTED_FILE_TYPE" });
      const now = new Date().toISOString();
      const fileId = crypto.randomUUID();
      let binary = "";
      for (let index = 0; index < bytes.length; index += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
      }
      state.data.files.push({ id: fileId, uploadedById: actor.id, storageKey: `mock/${fileId}`, originalName: file.name, mimeType: signature, sizeBytes: file.size, sha256: await sha256Hex(bytes), contentBase64: btoa(binary), createdAt: now });
      state.data.attachments.filter((item) => item.applicationId === applicationId && item.requirementKey === requirementKey && !item.removedAt).forEach((item) => { item.removedAt = now; });
      state.data.attachments.push({ id: crypto.randomUUID(), applicationId, fileId, requirementKey, createdAt: now, removedAt: null });
      await save();
    },
    async removeAttachment(applicationId, attachmentId) {
      const actor = requireActor(state);
      const app = state.data.applications.find((item) => item.id === applicationId);
      if (!app || !canEditApplicationContent(actor, app)) throw new ClientError("找不到可編輯的案件", { status: 404 });
      const attachment = state.data.attachments.find((item) => item.id === attachmentId && item.applicationId === applicationId && !item.removedAt);
      if (!attachment) throw new ClientError("找不到附件", { status: 404 });
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
      const issues = validateCourseDraft(input, confirmed);
      if (issues.length) throw new ClientError("課程資料不正確", { fieldErrors: issues });
      const now = new Date().toISOString();
      if (!current) {
        state.data.courses.push({ id: crypto.randomUUID(), title: input.title, description: input.description, youtubeUrl: input.youtubeUrl, imageFileId: null, location: input.location, startsAt: input.startsAt, endsAt: input.endsAt, registrationOpensAt: input.registrationOpensAt, registrationClosesAt: input.registrationClosesAt, capacity: input.capacity, durationMinutes: input.durationMinutes, requiredAttendanceMinutes: input.requiredAttendanceMinutes, status: input.status, createdById: actor.id, version: 1, createdAt: now, updatedAt: now });
      } else {
        Object.assign(current, { title: input.title, description: input.description, youtubeUrl: input.youtubeUrl, location: input.location, startsAt: input.startsAt, endsAt: input.endsAt, registrationOpensAt: input.registrationOpensAt, registrationClosesAt: input.registrationClosesAt, capacity: input.capacity, durationMinutes: input.durationMinutes, requiredAttendanceMinutes: input.requiredAttendanceMinutes, status: input.status, version: current.version + 1, updatedAt: now });
      }
      await save();
      return courseDto(state, (current ?? state.data.courses.at(-1))!);
    },
    async enroll(courseId) {
      const actor = requireActor(state);
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
        Object.assign(existing, { status: EnrollmentStatus.CONFIRMED, cancelledAt: null, attendanceStatus: AttendanceStatus.NOT_RECORDED, attendedMinutes: 0, requiredAttendanceMinutesSnapshot: course.requiredAttendanceMinutes, version: existing.version + 1 });
      } else {
        state.data.enrollments.push({ id: crypto.randomUUID(), courseId, userId: actor.id, status: EnrollmentStatus.CONFIRMED, attendanceStatus: AttendanceStatus.NOT_RECORDED, attendedMinutes: 0, requiredAttendanceMinutesSnapshot: course.requiredAttendanceMinutes, attendanceRecordedById: null, attendanceRecordedAt: null, version: 1, enrolledAt: now, cancelledAt: null });
      }
      await save();
      const row = state.data.enrollments.find((item) => item.courseId === courseId && item.userId === actor.id)!;
      return learningOf(state, row);
    },
    async cancelEnrollment(id) {
      const actor = requireActor(state);
      const enrollment = state.data.enrollments.find((item) => item.id === id && item.userId === actor.id);
      if (!enrollment) throw new ClientError("找不到報名", { status: 404 });
      const course = state.data.courses.find((item) => item.id === enrollment.courseId)!;
      const decision = canCancelEnrollment({ enrollmentStatus: enrollment.status, registrationClosesAt: course.registrationClosesAt, nowIso: new Date().toISOString() });
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
    async certifications() {
      const actor = requireActor(state);
      return state.data.certifications
        .filter((item) => state.data.applications.find((app) => app.id === item.applicationId)?.organizationId === actor.organizationId || actor.role === UserRole.ADMIN)
        .map((item) => {
          const app = state.data.applications.find((entry) => entry.id === item.applicationId)!;
          const org = state.data.organizations.find((entry) => entry.id === app.organizationId)!;
          const validity = certificationValidity(item);
          return { id: item.id, applicationId: item.applicationId, applicationNo: app.applicationNo, organizationName: org.organizationName, certificateNo: item.certificateNo, issuedOnDate: item.issuedOnDate, validUntilDate: item.validUntilDate, isCurrent: validity.isCurrent, validityLabel: validity.label, registeredAt: item.registeredAt };
        });
    },
    async saveCertification(applicationId, input) {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "applications.decide")) throw new ClientError("這個帳號目前沒有此功能", { status: 403 });
      const issues = validateCertificationDates(input.issuedOnDate, input.validUntilDate);
      if (issues.length) throw new ClientError("證書日期不正確", { fieldErrors: issues });
      const app = state.data.applications.find((item) => item.id === applicationId);
      if (!app || app.status !== ApplicationStatus.APPROVED) throw new ClientError("只有已核定案件可以登錄證書", { code: "INVALID_TRANSITION" });
      const now = new Date().toISOString();
      const current = state.data.certifications.find((item) => item.applicationId === applicationId);
      if (current) Object.assign(current, input, { updatedAt: now });
      else state.data.certifications.push({ id: crypto.randomUUID(), applicationId, ...input, registeredById: actor.id, registeredAt: now, updatedAt: now });
      state.data.auditLogs.unshift({ id: crypto.randomUUID(), actorId: actor.id, action: "CERTIFICATION_SAVE", entityType: "Certification", entityId: applicationId, requestId: crypto.randomUUID(), safeChanges: { certificateNo: input.certificateNo }, createdAt: now });
      await save();
      return (await services.certifications()).find((item) => item.applicationId === applicationId)!;
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
      return toCsv(["userName", "attendanceStatus", "attendedMinutes"], rows.map((row) => [row.userName, row.attendanceStatus, row.attendedMinutes]));
    },
    async audit() {
      const actor = requireActor(state);
      if (!hasFeature(state.platform, actor.id, "audit.view")) throw new ClientError("這個帳號目前沒有此功能", { status: 403, code: "FORBIDDEN" });
      return state.data.auditLogs.map((log) => ({ ...log, actorName: state.data.users.find((user) => user.id === log.actorId)?.displayName ?? null }));
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
    async myContracts() {
      return myContracts(state.platform, requireActor(state));
    },
    async contract(id) {
      const row = contractOf(state.platform, requireActor(state), id);
      return { ...row, body: row.body };
    },
    async signContract(id, input) {
      const saved = await signContract(state.platform, requireActor(state), state.data, id, input);
      await save();
      return saved;
    },
    async contractDocument(id) {
      return contractDocument(state.platform, requireActor(state), state.data, id);
    },
    async contractTemplate() {
      return templateOf(state.platform, requireActor(state));
    },
    async saveContractTemplate(input) {
      const saved = saveTemplate(state.platform, requireActor(state), input);
      await save();
      return saved;
    },
    async adminContracts() {
      return adminContracts(state.platform, requireActor(state));
    },
    async issueContract(organizationId) {
      const saved = issueContract(state.platform, requireActor(state), state.data, organizationId);
      await save();
      return saved;
    },
    async saveContract(id, input) {
      const saved = saveContract(state.platform, requireActor(state), id, input);
      await save();
      return saved;
    },
    async voidContract(id, expectedVersion) {
      const saved = voidContract(state.platform, requireActor(state), id, expectedVersion);
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

  async function transition(id: string, expectedVersion: number, requestId: string, action: typeof ApplicationAction.SUBMIT | typeof ApplicationAction.RESUBMIT) {
    const actor = requireActor(state);
    const existing = state.data.events.find((event) => event.applicationId === id && event.requestId === requestId);
    if (existing) return toDetail(state, id, actor);
    const app = state.data.applications.find((item) => item.id === id);
    if (!app || !canViewApplication(actor, app)) throw new ClientError("找不到案件", { status: 404 });
    const decision = resolveTransition({ action, status: app.status, resumeStatus: app.resumeStatus, role: actor.role, isAssignee: app.assignedToId === actor.id, hasAssignee: Boolean(app.assignedToId) });
    if (!decision.ok) throw new ClientError(decision.message, { code: "INVALID_TRANSITION" });
    if (app.version !== expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
    const version = state.data.formVersions.find((item) => item.id === app.categoryFormVersionId)!;
    const definition = parseCategoryDefinition(version.definition);
    if (version.configurationStatus !== "CONFIRMED") {
      /* 展示模式允許示範類別送件 */
    }
    const active = state.data.attachments.filter((item) => item.applicationId === id && !item.removedAt);
    const issues = validateSubmit(content(app), definition, active.map((item) => item.requirementKey));
    if (issues.length) throw new ClientError("還不能送件", { fieldErrors: issues, code: "VALIDATION_ERROR" });
    const now = new Date().toISOString();
    const submissionId = crypto.randomUUID();
    state.data.submissions.push({ id: submissionId, applicationId: id, revision: state.data.submissions.filter((item) => item.applicationId === id).length + 1, submittedById: actor.id, submittedAt: now, formVersionId: version.id, payloadSnapshot: snapshotPayload(content(app), version.id), attachmentIdsSnapshot: active.map((item) => item.id) });
    state.data.events.push({ id: crypto.randomUUID(), applicationId: id, submissionId, actorId: actor.id, action, fromStatus: app.status, toStatus: decision.toStatus, publicComment: null, internalNote: null, requestId, requestHash: requestId, createdAt: now });
    app.status = decision.toStatus;
    app.resumeStatus = decision.nextResumeStatus;
    app.version += 1;
    app.submittedAt = app.submittedAt ?? now;
    app.updatedAt = now;
    state.data.notificationJobs.push({ id: crypto.randomUUID(), dedupeKey: `${action}:${id}:${requestId}`, type: "SUBMISSION_CONFIRMATION", recipientUserId: actor.id, recipientEmail: actor.email, applicationId: id, status: "MOCKED", attemptCount: 1, lastErrorCode: "MOCK_MODE", createdAt: now, sentAt: null });
    await save();
    return toDetail(state, id, actor);
  }

  return services;
}

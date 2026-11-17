import {
  CompanyTrainingRequestStatus,
  CourseDelivery,
  UserRole,
  buildLearningRecord,
  canStartVerificationApplication,
  paintBasicCertificate,
  pngPagesToPdf,
  requiredModulesComplete,
  scoreBasicQuiz,
  quizPassed,
  validateCompanyTrainingRequest,
  validateTrainingPolicy,
  nextBasicCertificateNo,
  DEFAULT_TRAINING_POLICY,
  type DemoDataset,
  basicTrainingModuleWriteSchema,
  companyTrainingRequestWriteSchema,
  companyTrainingReviewSchema,
  trainingCertificateWriteSchema,
  trainingPolicyWriteSchema,
  basicQuizSubmitSchema,
} from "@mf/contracts";
import { ClientError } from "../services/types";
import { ZodError } from "zod";

type Data = DemoDataset;
type Actor = DemoDataset["users"][number];

function policyOf(data: Data) {
  if (!data.trainingPolicy) {
    data.trainingPolicy = {
      id: crypto.randomUUID(),
      ...DEFAULT_TRAINING_POLICY,
      updatedById: null,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  data.basicModules ??= [];
  data.basicQuestions ??= [];
  data.basicProgress ??= [];
  data.basicAttempts ??= [];
  data.userBasicTrainings ??= [];
  data.companyTrainingRequests ??= [];
  data.trainingCertificates ??= [];
  return data.trainingPolicy;
}

function presentPolicy(data: Data) {
  const policy = policyOf(data);
  return {
    id: policy.id,
    requireBasicBeforeApply: policy.requireBasicBeforeApply,
    quizPassPercent: policy.quizPassPercent,
    privateRequestMinHeadcount: policy.privateRequestMinHeadcount,
    version: policy.version,
    updatedAt: policy.updatedAt,
  };
}

function moduleDto(data: Data, module: Data["basicModules"][number], actor: Actor | null, includeAnswers: boolean) {
  const questions = data.basicQuestions
    .filter((item) => item.moduleId === module.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => ({
      id: item.id,
      moduleId: item.moduleId,
      prompt: item.prompt,
      options: item.options,
      sortOrder: item.sortOrder,
      ...(includeAnswers ? { correctIndex: item.correctIndex } : {}),
    }));
  const completed = actor ? data.basicProgress.some((item) => item.userId === actor.id && item.moduleId === module.id) : false;
  return {
    id: module.id,
    title: module.title,
    body: module.body,
    sortOrder: module.sortOrder,
    isRequired: module.isRequired,
    isActive: module.isActive,
    hasVideo: Boolean(module.videoFileId),
    version: module.version,
    questions,
    completed,
  };
}

function basicStatus(data: Data, actor: Actor) {
  const policy = presentPolicy(data);
  const modules = data.basicModules
    .filter((item) => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => moduleDto(data, item, actor, false));
  const requiredIds = modules.filter((item) => item.isRequired).map((item) => item.id);
  const completedIds = modules.filter((item) => item.completed).map((item) => item.id);
  const requiredComplete = requiredModulesComplete({ requiredModuleIds: requiredIds, completedModuleIds: completedIds });
  const record = data.userBasicTrainings.find((item) => item.userId === actor.id);
  const last = [...data.basicAttempts].filter((item) => item.userId === actor.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return {
    policy,
    modules,
    requiredComplete,
    passed: Boolean(record?.passedAt),
    passedAt: record?.passedAt ?? null,
    certificateNo: record?.certificateNo ?? null,
    hasCertificate: Boolean(record?.certificateFileId),
    lastScorePercent: last?.scorePercent ?? null,
    canTakeQuiz: requiredComplete && !record?.passedAt,
  };
}

async function renderBasicPdf(input: { certificateNo: string; holderName: string; organizationName: string; passedAtLabel: string }) {
  const font = new FontFace("NotoSansTC", "url(/fonts/NotoSansTC-Subset.otf)");
  await font.load();
  document.fonts.add(font);
  const width = 1240;
  const height = 1754;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new ClientError("無法產生基礎課證書");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#1a1916";
  paintBasicCertificate(
    {
      fillText(text, x, y, size) {
        context.font = `${size}px NotoSansTC`;
        context.fillText(text, x, y);
      },
    },
    { title: "基礎教育訓練結業證明（示範）", certificateNo: input.certificateNo, holderName: input.holderName, organizationName: input.organizationName, passedAtLabel: input.passedAtLabel },
  );
  const url = canvas.toDataURL("image/png");
  const png = Uint8Array.from(atob(url.split(",")[1] ?? ""), (char) => char.charCodeAt(0));
  return pngPagesToPdf([png]);
}

function rememberPdf(data: Data, actorId: string, name: string, bytes: Uint8Array) {
  const id = crypto.randomUUID();
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  data.files.push({
    id,
    uploadedById: actorId,
    storageKey: `basic-certificates/${id}.pdf`,
    originalName: name,
    mimeType: "application/pdf",
    sizeBytes: bytes.byteLength,
    sha256: "mock",
    contentBase64: btoa(binary),
    createdAt: new Date().toISOString(),
  });
  return id;
}

function assertManage(actor: Actor) {
  if (actor.role === UserRole.APPLICANT) throw new ClientError("沒有權限", { status: 403 });
}

function presentCompanyRequest(data: Data, row: Data["companyTrainingRequests"][number]) {
  const org = data.organizations.find((item) => item.id === row.organizationId);
  const user = data.users.find((item) => item.id === row.requestedById);
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: org?.organizationName ?? "",
    requestedById: row.requestedById,
    requestedByName: user?.displayName ?? "",
    headcount: row.headcount,
    preferredStartsOn: row.preferredStartsOn,
    preferredEndsOn: row.preferredEndsOn,
    delivery: row.delivery,
    location: row.location,
    note: row.note,
    status: row.status,
    adminNote: row.adminNote,
    courseId: row.courseId,
    version: row.version,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function ensureTrainingData(data: Data) {
  policyOf(data);
  if (data.basicModules.length === 0) {
    const now = new Date().toISOString();
    const moduleA = crypto.randomUUID();
    const moduleB = crypto.randomUUID();
    data.basicModules.push(
      { id: moduleA, title: "穆斯林友善與 Halal 基礎概念（示範）", body: "示範設定。請完整閱讀後再標示已讀。", sortOrder: 1, isRequired: true, isActive: true, videoFileId: null, updatedById: null, version: 1, createdAt: now, updatedAt: now },
      { id: moduleB, title: "申請與現場複審流程概要（示範）", body: "示範設定。說明送件與複審分工。", sortOrder: 2, isRequired: true, isActive: true, videoFileId: null, updatedById: null, version: 1, createdAt: now, updatedAt: now },
    );
    data.basicQuestions.push(
      { id: crypto.randomUUID(), moduleId: moduleA, prompt: "示範題：酒精類飲料應如何處理？", options: ["可並陳", "應避免或以明確方式區隔", "只在大廳販售", "沒有限制"], correctIndex: 1, sortOrder: 1, createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), moduleId: moduleA, prompt: "示範題：肉品若要符合 Halal，通常需要什麼？", options: ["只要新鮮", "Halal 證書與可追溯採購證明", "進口即可", "口頭保證"], correctIndex: 1, sortOrder: 2, createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), moduleId: moduleB, prompt: "示範題：現場複審主要核對什麼？", options: ["只看合約", "業者送件附件，必要時可加拍現場存證", "只看社群", "只看統編"], correctIndex: 1, sortOrder: 1, createdAt: now, updatedAt: now },
    );
  }
}

export function assertCanApply(data: Data, actor: Actor) {
  const policy = policyOf(data);
  const passed = Boolean(data.userBasicTrainings.find((item) => item.userId === actor.id)?.passedAt);
  const gate = canStartVerificationApplication({ requireBasicBeforeApply: policy.requireBasicBeforeApply, basicPassed: passed });
  if (!gate.ok) throw new ClientError(gate.message, { status: 403, code: "BASIC_TRAINING_REQUIRED" });
}

export function trainingDesk(data: Data, actor: Actor, canManageTraining: boolean) {
  ensureTrainingData(data);
  const canManage = actor.role !== UserRole.APPLICANT && (actor.role === UserRole.ADMIN || canManageTraining);

  return {
    async basicStatus() {
      return basicStatus(data, actor);
    },
    async completeBasicModule(moduleId: string) {
      if (actor.role !== UserRole.APPLICANT) throw new ClientError("只有業者可完成基礎課閱讀", { status: 403 });
      const module = data.basicModules.find((item) => item.id === moduleId && item.isActive);
      if (!module) throw new ClientError("找不到模組", { status: 404 });
      if (!data.basicProgress.some((item) => item.userId === actor.id && item.moduleId === moduleId)) {
        data.basicProgress.push({ id: crypto.randomUUID(), userId: actor.id, moduleId, completedAt: new Date().toISOString() });
      }
      return basicStatus(data, actor);
    },
    async submitBasicQuiz(input: unknown) {
      if (actor.role !== UserRole.APPLICANT) throw new ClientError("只有業者可參加測驗", { status: 403 });
      const parsed = basicQuizSubmitSchema.parse(input);
      const status = basicStatus(data, actor);
      if (status.passed) throw new ClientError("已通過基礎教育訓練");
      if (!status.canTakeQuiz) throw new ClientError("請先讀完所有必做模組");
      const questions = data.basicQuestions.filter((item) => status.modules.some((module) => module.id === item.moduleId && module.isActive));
      const scored = scoreBasicQuiz(questions, parsed.answers);
      const passed = quizPassed(scored.scorePercent, status.policy.quizPassPercent);
      const now = new Date().toISOString();
      data.basicAttempts.push({
        id: crypto.randomUUID(),
        userId: actor.id,
        scorePercent: scored.scorePercent,
        passed,
        answers: parsed.answers,
        quizPassPercentSnapshot: status.policy.quizPassPercent,
        createdAt: now,
      });
      if (passed) {
        const org = data.organizations.find((item) => item.id === actor.organizationId);
        const certificateNo = nextBasicCertificateNo(data.userBasicTrainings.filter((item) => item.certificateNo).length + 1);
        const passedAtLabel = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(new Date(now));
        const pdf = await renderBasicPdf({
          certificateNo,
          holderName: actor.displayName,
          organizationName: org?.organizationName ?? "",
          passedAtLabel,
        });
        const fileId = rememberPdf(data, actor.id, `${certificateNo}.pdf`, pdf);
        const existing = data.userBasicTrainings.find((item) => item.userId === actor.id);
        if (existing) {
          existing.passedAt = now;
          existing.certificateNo = certificateNo;
          existing.certificateFileId = fileId;
          existing.updatedAt = now;
        } else {
          data.userBasicTrainings.push({
            id: crypto.randomUUID(),
            userId: actor.id,
            passedAt: now,
            certificateNo,
            certificateFileId: fileId,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      return { ...basicStatus(data, actor), justPassed: passed, scorePercent: scored.scorePercent };
    },
    async downloadBasicCertificate() {
      const record = data.userBasicTrainings.find((item) => item.userId === actor.id);
      if (!record?.certificateFileId) throw new ClientError("還沒有基礎課證書", { status: 404 });
      const file = data.files.find((item) => item.id === record.certificateFileId);
      if (!file) throw new ClientError("找不到證書檔", { status: 404 });
      const bytes = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
      return { blob: new Blob([bytes], { type: "application/pdf" }), name: file.originalName };
    },
    async trainingPolicy() {
      return presentPolicy(data);
    },
    async saveTrainingPolicy(input: unknown) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const parsed = trainingPolicyWriteSchema.parse(input);
      const policy = policyOf(data);
      if (policy.version !== parsed.expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      const issues = validateTrainingPolicy(parsed);
      if (issues[0]) throw new ClientError(issues[0].message, { fieldErrors: issues });
      policy.requireBasicBeforeApply = parsed.requireBasicBeforeApply;
      policy.quizPassPercent = parsed.quizPassPercent;
      policy.privateRequestMinHeadcount = parsed.privateRequestMinHeadcount;
      policy.updatedById = actor.id;
      policy.version += 1;
      policy.updatedAt = new Date().toISOString();
      return presentPolicy(data);
    },
    async adminBasicModules() {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      return data.basicModules.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => moduleDto(data, item, null, true));
    },
    async saveBasicModule(input: unknown, id?: string) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const parsed = basicTrainingModuleWriteSchema.parse(input);
      const now = new Date().toISOString();
      if (id) {
        const current = data.basicModules.find((item) => item.id === id);
        if (!current) throw new ClientError("找不到模組", { status: 404 });
        if (parsed.expectedVersion != null && current.version !== parsed.expectedVersion) {
          throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
        }
        current.title = parsed.title;
        current.body = parsed.body;
        current.sortOrder = parsed.sortOrder;
        current.isRequired = parsed.isRequired;
        current.isActive = parsed.isActive;
        current.updatedById = actor.id;
        current.version += 1;
        current.updatedAt = now;
        data.basicQuestions = data.basicQuestions.filter((item) => item.moduleId !== id);
        for (const [index, question] of parsed.questions.entries()) {
          data.basicQuestions.push({
            id: question.id ?? crypto.randomUUID(),
            moduleId: id,
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            sortOrder: question.sortOrder || index + 1,
            createdAt: now,
            updatedAt: now,
          });
        }
        return moduleDto(data, current, null, true);
      }
      const moduleId = crypto.randomUUID();
      const created = {
        id: moduleId,
        title: parsed.title,
        body: parsed.body,
        sortOrder: parsed.sortOrder,
        isRequired: parsed.isRequired,
        isActive: parsed.isActive,
        videoFileId: null,
        updatedById: actor.id,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      data.basicModules.push(created);
      for (const [index, question] of parsed.questions.entries()) {
        data.basicQuestions.push({
          id: crypto.randomUUID(),
          moduleId,
          prompt: question.prompt,
          options: question.options,
          correctIndex: question.correctIndex,
          sortOrder: question.sortOrder || index + 1,
          createdAt: now,
          updatedAt: now,
        });
      }
      return moduleDto(data, created, null, true);
    },
    async myCompanyTrainingRequests() {
      if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ClientError("只有業者可查看", { status: 403 });
      return data.companyTrainingRequests
        .filter((item) => item.organizationId === actor.organizationId)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((item) => presentCompanyRequest(data, item));
    },
    async saveCompanyTrainingRequest(input: unknown, id?: string) {
      if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ClientError("只有業者可申請專班", { status: 403 });
      const parsed = companyTrainingRequestWriteSchema.parse(input);
      const policy = policyOf(data);
      const issues = validateCompanyTrainingRequest({ ...parsed, minHeadcount: 1, note: parsed.note });
      if (issues[0]) throw new ClientError(issues[0].message, { fieldErrors: issues });
      const now = new Date().toISOString();
      if (id) {
        const current = data.companyTrainingRequests.find((item) => item.id === id && item.organizationId === actor.organizationId);
        if (!current) throw new ClientError("找不到申請", { status: 404 });
        if (current.status !== CompanyTrainingRequestStatus.DRAFT && current.status !== CompanyTrainingRequestStatus.REJECTED) {
          throw new ClientError("只有草稿或未通過的申請可修改");
        }
        if (parsed.expectedVersion != null && current.version !== parsed.expectedVersion) {
          throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
        }
        Object.assign(current, {
          headcount: parsed.headcount,
          preferredStartsOn: parsed.preferredStartsOn,
          preferredEndsOn: parsed.preferredEndsOn,
          delivery: parsed.delivery,
          location: parsed.delivery === CourseDelivery.ONLINE ? "" : parsed.location,
          note: parsed.note,
          status: CompanyTrainingRequestStatus.DRAFT,
          adminNote: "",
          reviewedById: null,
          reviewedAt: null,
          version: current.version + 1,
          updatedAt: now,
        });
        return presentCompanyRequest(data, current);
      }
      const created = {
        id: crypto.randomUUID(),
        organizationId: actor.organizationId,
        requestedById: actor.id,
        headcount: parsed.headcount,
        preferredStartsOn: parsed.preferredStartsOn,
        preferredEndsOn: parsed.preferredEndsOn,
        delivery: parsed.delivery,
        location: parsed.delivery === CourseDelivery.ONLINE ? "" : parsed.location,
        note: parsed.note,
        status: CompanyTrainingRequestStatus.DRAFT,
        adminNote: "",
        reviewedById: null,
        reviewedAt: null,
        courseId: null,
        version: 1,
        submittedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      data.companyTrainingRequests.unshift(created);
      return presentCompanyRequest(data, created);
    },
    async submitCompanyTrainingRequest(id: string, expectedVersion: number) {
      if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ClientError("只有業者可送出", { status: 403 });
      const current = data.companyTrainingRequests.find((item) => item.id === id && item.organizationId === actor.organizationId);
      if (!current) throw new ClientError("找不到申請", { status: 404 });
      if (current.version !== expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      if (current.status !== CompanyTrainingRequestStatus.DRAFT && current.status !== CompanyTrainingRequestStatus.REJECTED) {
        throw new ClientError("目前狀態不能送出");
      }
      const policy = policyOf(data);
      const issues = validateCompanyTrainingRequest({
        headcount: current.headcount,
        minHeadcount: policy.privateRequestMinHeadcount,
        preferredStartsOn: current.preferredStartsOn,
        preferredEndsOn: current.preferredEndsOn,
        delivery: current.delivery,
        location: current.location,
        note: current.note,
      });
      if (issues[0]) throw new ClientError(issues[0].message, { fieldErrors: issues });
      const now = new Date().toISOString();
      current.status = CompanyTrainingRequestStatus.SUBMITTED;
      current.submittedAt = now;
      current.version += 1;
      current.updatedAt = now;
      return presentCompanyRequest(data, current);
    },
    async adminCompanyTrainingRequests() {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      return data.companyTrainingRequests
        .slice()
        .sort((a, b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt))
        .map((item) => presentCompanyRequest(data, item));
    },
    async reviewCompanyTrainingRequest(id: string, input: unknown) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const parsed = companyTrainingReviewSchema.parse(input);
      const current = data.companyTrainingRequests.find((item) => item.id === id);
      if (!current) throw new ClientError("找不到申請", { status: 404 });
      if (current.version !== parsed.expectedVersion) throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
      if (current.status !== CompanyTrainingRequestStatus.SUBMITTED) throw new ClientError("只有待審核的申請可審");
      const now = new Date().toISOString();
      current.status = parsed.action === "APPROVE" ? CompanyTrainingRequestStatus.APPROVED : CompanyTrainingRequestStatus.REJECTED;
      current.adminNote = parsed.adminNote;
      current.courseId = parsed.courseId ?? null;
      current.reviewedById = actor.id;
      current.reviewedAt = now;
      current.version += 1;
      current.updatedAt = now;
      return presentCompanyRequest(data, current);
    },
    async registerTrainingCertificate(input: unknown) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const parsed = trainingCertificateWriteSchema.parse(input);
      if (parsed.validUntilDate < parsed.issuedOnDate) throw new ClientError("到期日不可早於核發日");
      const enrollment = data.enrollments.find((item) => item.id === parsed.enrollmentId);
      if (!enrollment) throw new ClientError("找不到報名", { status: 404 });
      const course = data.courses.find((item) => item.id === enrollment.courseId);
      if (!course) throw new ClientError("找不到課程", { status: 404 });
      const learning = buildLearningRecord({
        enrollmentStatus: enrollment.status,
        attendanceStatus: enrollment.attendanceStatus,
        attendedMinutes: enrollment.attendedMinutes,
        requiredAttendanceMinutesSnapshot: enrollment.requiredAttendanceMinutesSnapshot,
        delivery: course.delivery,
        watchedSeconds: enrollment.watchedSeconds,
        videoDurationSeconds: course.videoDurationSeconds,
      });
      if (learning.completion !== "COMPLETED") throw new ClientError("僅完課報名可登錄訓練證書");
      if (data.trainingCertificates.some((item) => item.enrollmentId === parsed.enrollmentId)) {
        throw new ClientError("這筆報名已有訓練證書");
      }
      if (data.trainingCertificates.some((item) => item.certificateNo === parsed.certificateNo)) {
        throw new ClientError("證書編號已存在");
      }
      const now = new Date().toISOString();
      const created = {
        id: crypto.randomUUID(),
        enrollmentId: parsed.enrollmentId,
        certificateNo: parsed.certificateNo,
        issuedOnDate: parsed.issuedOnDate,
        validUntilDate: parsed.validUntilDate,
        registeredById: actor.id,
        registeredAt: now,
        updatedAt: now,
      };
      data.trainingCertificates.push(created);
      const user = data.users.find((item) => item.id === enrollment.userId);
      return {
        id: created.id,
        enrollmentId: created.enrollmentId,
        courseId: enrollment.courseId,
        courseTitle: course?.title ?? "",
        userId: enrollment.userId,
        userName: user?.displayName ?? "",
        certificateNo: created.certificateNo,
        issuedOnDate: created.issuedOnDate,
        validUntilDate: created.validUntilDate,
        registeredAt: created.registeredAt,
      };
    },
    trainingCertificateFor(enrollmentId: string) {
      return data.trainingCertificates.find((item) => item.enrollmentId === enrollmentId) ?? null;
    },
  };
}

export function rejectZod(error: unknown): never {
  if (error instanceof ZodError) throw new ClientError(error.issues[0]?.message ?? "內容不正確", { status: 400, code: "VALIDATION_ERROR" });
  throw error;
}

void assertManage;

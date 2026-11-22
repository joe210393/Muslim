import {
  CompanyTrainingRequestStatus,
  CourseDelivery,
  UserRole,
  buildLearningRecord,
  canStartVerificationApplication,
  requiredModulesComplete,
  scoreBasicQuiz,
  quizPassedByCount,
  validateCompanyTrainingRequest,
  validateTrainingPolicy,
  drawRandomQuestions,
  decodeUploadedText,
  parseQuestionBankUpload,
  DEFAULT_TRAINING_POLICY,
  acceptWatchProgress,
  type DemoDataset,
  basicTrainingModuleWriteSchema,
  basicQuestionBankReplaceSchema,
  basicQuestionWriteSchema,
  basicWatchPassSeconds,
  basicWatchProgressSchema,
  canCompleteBasicWatch,
  companyTrainingRequestWriteSchema,
  companyTrainingReviewSchema,
  trainingCertificateWriteSchema,
  trainingPolicyWriteSchema,
  basicQuizSubmitSchema,
  youtubeVideoId,
} from "@mf/contracts";
import { ClientError } from "../services/types";
import { ZodError } from "zod";

type Data = DemoDataset;
type Actor = DemoDataset["users"][number];

function policyOf(data: Data) {
  migrateTrainingShape(data);
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

function migrateTrainingShape(data: Data) {
  const policy = data.trainingPolicy as (Data["trainingPolicy"] & { quizPassPercent?: number }) | undefined;
  if (policy && ("quizPassPercent" in policy || policy.quizDrawCount == null)) {
    const percent = policy.quizPassPercent ?? 80;
    policy.quizDrawCount = policy.quizDrawCount ?? 5;
    policy.quizPassCount = policy.quizPassCount ?? Math.max(1, Math.ceil((percent / 100) * policy.quizDrawCount));
    delete policy.quizPassPercent;
  }
  if (policy) {
    const bankSize = (data.basicQuestions ?? []).filter((item) => item.isActive !== false).length;
    if (bankSize > 0 && policy.quizDrawCount > bankSize) {
      policy.quizDrawCount = bankSize;
      policy.quizPassCount = Math.min(policy.quizPassCount, policy.quizDrawCount);
    }
  }
  for (const module of data.basicModules ?? []) {
    const legacy = module as Data["basicModules"][number] & { body?: string; videoFileId?: string | null };
    if (legacy.description == null && legacy.body != null) legacy.description = legacy.body;
    if (legacy.youtubeUrl == null) legacy.youtubeUrl = "";
    const withMinutes = legacy as typeof legacy & { requiredWatchMinutes?: number };
    if (legacy.requiredWatchPercent == null) {
      legacy.requiredWatchPercent = withMinutes.requiredWatchMinutes != null ? 80 : 80;
    }
    delete withMinutes.requiredWatchMinutes;
    if (legacy.materialFileId === undefined) legacy.materialFileId = null;
    delete legacy.body;
    delete legacy.videoFileId;
  }
  for (const row of data.basicProgress ?? []) {
    const legacy = row as Data["basicProgress"][number] & { completedAt?: string | null };
    if (legacy.watchedSeconds == null) legacy.watchedSeconds = 0;
    if (legacy.videoDurationSeconds == null) legacy.videoDurationSeconds = 0;
    if (legacy.watchUpdatedAt === undefined) legacy.watchUpdatedAt = legacy.completedAt ?? null;
    if (legacy.createdAt == null) legacy.createdAt = legacy.completedAt ?? new Date().toISOString();
    if (legacy.updatedAt == null) legacy.updatedAt = legacy.completedAt ?? legacy.createdAt;
  }
  for (const question of data.basicQuestions ?? []) {
    const legacy = question as Data["basicQuestions"][number] & { moduleId?: string };
    if (legacy.isActive == null) legacy.isActive = true;
    delete legacy.moduleId;
  }
  for (const attempt of data.basicAttempts ?? []) {
    const legacy = attempt as Data["basicAttempts"][number] & { quizPassPercentSnapshot?: number };
    if (legacy.drawCount == null) legacy.drawCount = Array.isArray(legacy.answers) ? legacy.answers.length : 0;
    if (legacy.correctCount == null) {
      legacy.correctCount = legacy.drawCount ? Math.round((legacy.scorePercent * legacy.drawCount) / 100) : 0;
    }
    if (legacy.passCountSnapshot == null) legacy.passCountSnapshot = legacy.quizPassPercentSnapshot ?? 4;
    if (legacy.drawnQuestionIds == null) legacy.drawnQuestionIds = Array.isArray(legacy.answers) ? legacy.answers.map((item) => item.questionId) : [];
    if (legacy.submittedAt === undefined) legacy.submittedAt = legacy.createdAt;
    delete legacy.quizPassPercentSnapshot;
  }
}

function presentPolicy(data: Data) {
  const policy = policyOf(data);
  return {
    id: policy.id,
    requireBasicBeforeApply: policy.requireBasicBeforeApply,
    quizDrawCount: policy.quizDrawCount,
    quizPassCount: policy.quizPassCount,
    privateRequestMinHeadcount: policy.privateRequestMinHeadcount,
    version: policy.version,
    updatedAt: policy.updatedAt,
  };
}

function moduleDto(data: Data, module: Data["basicModules"][number], actor: Actor | null) {
  const progress = actor ? data.basicProgress.find((item) => item.userId === actor.id && item.moduleId === module.id) : undefined;
  const videoDurationSeconds = progress?.videoDurationSeconds ?? 0;
  const requiredRaw = basicWatchPassSeconds(videoDurationSeconds, module.requiredWatchPercent);
  const requiredWatchSeconds = Number.isFinite(requiredRaw) ? requiredRaw : null;
  const watchedSeconds = progress?.watchedSeconds ?? 0;
  const completed = Boolean(progress?.completedAt)
    || canCompleteBasicWatch(videoDurationSeconds, watchedSeconds, module.requiredWatchPercent);
  const material = module.materialFileId ? data.files.find((item) => item.id === module.materialFileId) : null;
  return {
    id: module.id,
    title: module.title,
    description: module.description,
    youtubeUrl: module.youtubeUrl,
    requiredWatchPercent: module.requiredWatchPercent,
    requiredWatchSeconds,
    sortOrder: module.sortOrder,
    isRequired: module.isRequired,
    isActive: module.isActive,
    hasMaterial: Boolean(module.materialFileId),
    materialFileId: module.materialFileId,
    materialName: material?.originalName ?? null,
    version: module.version,
    watchedSeconds,
    videoDurationSeconds,
    completed,
  };
}

function questionDto(item: Data["basicQuestions"][number], includeAnswers: boolean) {
  return {
    id: item.id,
    prompt: item.prompt,
    options: item.options,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    ...(includeAnswers ? { correctIndex: item.correctIndex } : {}),
  };
}

function activeAttempt(data: Data, actor: Actor) {
  const attempt = [...data.basicAttempts]
    .filter((item) => item.userId === actor.id && item.submittedAt == null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!attempt) return null;
  const byId = new Map(data.basicQuestions.map((item) => [item.id, item]));
  return {
    attemptId: attempt.id,
    drawCount: attempt.drawCount,
    passCount: attempt.passCountSnapshot,
    questions: attempt.drawnQuestionIds.map((id) => byId.get(id)).filter(Boolean).map((item) => questionDto(item!, false)),
  };
}

function basicStatus(data: Data, actor: Actor) {
  const policy = presentPolicy(data);
  const modules = data.basicModules
    .filter((item) => item.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((item) => moduleDto(data, item, actor));
  const requiredIds = modules.filter((item) => item.isRequired).map((item) => item.id);
  const completedIds = modules.filter((item) => item.completed).map((item) => item.id);
  const requiredComplete = requiredModulesComplete({ requiredModuleIds: requiredIds, completedModuleIds: completedIds });
  const record = data.userBasicTrainings.find((item) => item.userId === actor.id);
  const last = [...data.basicAttempts]
    .filter((item) => item.userId === actor.id && item.submittedAt != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const bankCount = data.basicQuestions.filter((item) => item.isActive).length;
  return {
    policy,
    modules,
    questionBankCount: bankCount,
    requiredComplete,
    passed: Boolean(record?.passedAt),
    passedAt: record?.passedAt ?? null,
    certificateNo: null,
    hasCertificate: false,
    lastCorrectCount: last?.correctCount ?? null,
    lastDrawCount: last?.drawCount ?? null,
    lastScorePercent: last?.scorePercent ?? null,
    canTakeQuiz: requiredComplete && !record?.passedAt && bankCount >= policy.quizDrawCount,
    activeAttempt: activeAttempt(data, actor),
  };
}

function rememberFile(data: Data, actorId: string, name: string, mimeType: string, bytes: Uint8Array, folder: string) {
  const id = crypto.randomUUID();
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  data.files.push({
    id,
    uploadedById: actorId,
    storageKey: `${folder}/${id}`,
    originalName: name,
    mimeType,
    sizeBytes: bytes.byteLength,
    sha256: "mock",
    contentBase64: btoa(binary),
    createdAt: new Date().toISOString(),
  });
  return id;
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
    data.basicModules.push(
      { id: crypto.randomUUID(), title: "基礎課1：穆斯林友善與 Halal 基礎概念（示範）", description: "示範設定。請播放影片，達設定百分比後由系統標示完成。", youtubeUrl: "", requiredWatchPercent: 80, sortOrder: 1, isRequired: true, isActive: true, materialFileId: null, updatedById: null, version: 1, createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), title: "基礎課2：申請與現場複審流程概要（示範）", description: "示範設定。說明送件與複審分工。", youtubeUrl: "", requiredWatchPercent: 80, sortOrder: 2, isRequired: true, isActive: true, materialFileId: null, updatedById: null, version: 1, createdAt: now, updatedAt: now },
    );
  }
  if (data.basicQuestions.length === 0) {
    const now = new Date().toISOString();
    data.basicQuestions.push(
      { id: crypto.randomUUID(), prompt: "示範題：酒精類飲料應如何處理？", options: ["可並陳", "應避免或以明確方式區隔", "只在大廳販售", "沒有限制"], correctIndex: 1, sortOrder: 1, isActive: true, createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), prompt: "示範題：肉品若要符合 Halal，通常需要什麼？", options: ["只要新鮮", "Halal 證書與可追溯採購證明", "進口即可", "口頭保證"], correctIndex: 1, sortOrder: 2, isActive: true, createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), prompt: "示範題：現場複審主要核對什麼？", options: ["只看合約", "業者送件附件，必要時可加拍現場存證", "只看社群", "只看統編"], correctIndex: 1, sortOrder: 3, isActive: true, createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), prompt: "示範題：驗證申請前通常需要先完成什麼？", options: ["廣告投放", "基礎教育訓練內容與測驗", "只填統編", "現場拍照即可"], correctIndex: 1, sortOrder: 4, isActive: true, createdAt: now, updatedAt: now },
      { id: crypto.randomUUID(), prompt: "示範題：Halal 相關證明文件建議如何保存？", options: ["口頭告知即可", "妥善保存並可供查核", "只放社群", "不必保存"], correctIndex: 1, sortOrder: 5, isActive: true, createdAt: now, updatedAt: now },
    );
  }
}

export function assertCanApply(data: Data, actor: Actor, platform?: { payments?: Array<{ organizationId: string; status?: string }> }) {
  if (platform && actor.organizationId) {
    const unlocked = (platform.payments ?? []).some((item) => item.organizationId === actor.organizationId && item.status === "PAID");
    if (!unlocked) throw new ClientError("請先完成方案付款與核帳後，才能建立驗證申請", { status: 403, code: "FORBIDDEN" });
  }
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
    async recordBasicModuleWatch(moduleId: string, input: unknown) {
      if (actor.role !== UserRole.APPLICANT) throw new ClientError("只有業者可累計基礎課觀看", { status: 403 });
      const parsed = basicWatchProgressSchema.parse(input);
      const module = data.basicModules.find((item) => item.id === moduleId && item.isActive);
      if (!module) throw new ClientError("找不到基礎課", { status: 404 });
      if (!module.youtubeUrl.trim()) throw new ClientError("此基礎課尚未設定影片，無法累計觀看");
      const existing = data.basicProgress.find((item) => item.userId === actor.id && item.moduleId === moduleId);
      if (existing?.completedAt) return basicStatus(data, actor);
      const now = new Date().toISOString();
      const durationSeconds = Math.max(existing?.videoDurationSeconds ?? 0, parsed.videoDurationSeconds);
      const accepted = acceptWatchProgress({
        currentSeconds: existing?.watchedSeconds ?? 0,
        reportedSeconds: parsed.watchedSeconds,
        videoDurationSeconds: durationSeconds,
        lastReportedAt: existing?.watchUpdatedAt ?? null,
        nowIso: now,
      });
      const completed = canCompleteBasicWatch(durationSeconds, accepted, module.requiredWatchPercent);
      if (existing) {
        existing.watchedSeconds = accepted;
        existing.videoDurationSeconds = durationSeconds;
        existing.watchUpdatedAt = now;
        existing.updatedAt = now;
        if (completed) existing.completedAt = now;
      } else {
        data.basicProgress.push({
          id: crypto.randomUUID(),
          userId: actor.id,
          moduleId,
          watchedSeconds: accepted,
          videoDurationSeconds: durationSeconds,
          watchUpdatedAt: now,
          completedAt: completed ? now : null,
          createdAt: now,
          updatedAt: now,
        });
      }
      return basicStatus(data, actor);
    },
    async startBasicQuiz() {
      if (actor.role !== UserRole.APPLICANT) throw new ClientError("只有業者可參加測驗", { status: 403 });
      const status = basicStatus(data, actor);
      if (status.passed) throw new ClientError("已通過基礎教育訓練");
      if (status.activeAttempt) return status.activeAttempt;
      if (!status.canTakeQuiz) throw new ClientError("請先讀完所有必做基礎課，並確認題庫足夠");
      const policy = policyOf(data);
      const bank = data.basicQuestions.filter((item) => item.isActive);
      if (bank.length < policy.quizDrawCount) throw new ClientError(`題庫至少需要 ${policy.quizDrawCount} 題才能抽題`);
      const drawn = drawRandomQuestions(bank, policy.quizDrawCount);
      const now = new Date().toISOString();
      const attempt = {
        id: crypto.randomUUID(),
        userId: actor.id,
        scorePercent: 0,
        correctCount: 0,
        drawCount: drawn.length,
        passCountSnapshot: policy.quizPassCount,
        passed: false,
        drawnQuestionIds: drawn.map((item) => item.id),
        answers: null,
        submittedAt: null,
        createdAt: now,
      };
      data.basicAttempts.push(attempt);
      return {
        attemptId: attempt.id,
        drawCount: attempt.drawCount,
        passCount: attempt.passCountSnapshot,
        questions: drawn.map((item) => questionDto(item, false)),
      };
    },
    async submitBasicQuiz(input: unknown) {
      if (actor.role !== UserRole.APPLICANT) throw new ClientError("只有業者可參加測驗", { status: 403 });
      const parsed = basicQuizSubmitSchema.parse(input);
      const status = basicStatus(data, actor);
      if (status.passed) throw new ClientError("已通過基礎教育訓練");
      const attempt = data.basicAttempts.find((item) => item.id === parsed.attemptId && item.userId === actor.id && item.submittedAt == null);
      if (!attempt) throw new ClientError("找不到進行中的測驗，請重新開始");
      if (parsed.answers.length !== attempt.drawnQuestionIds.length || !attempt.drawnQuestionIds.every((id) => parsed.answers.some((answer) => answer.questionId === id))) {
        throw new ClientError("請答完本次抽出的全部題目");
      }
      const questions = data.basicQuestions.filter((item) => attempt.drawnQuestionIds.includes(item.id));
      const scored = scoreBasicQuiz(questions, parsed.answers);
      const passed = quizPassedByCount(scored.correct, attempt.passCountSnapshot);
      const now = new Date().toISOString();
      attempt.scorePercent = scored.scorePercent;
      attempt.correctCount = scored.correct;
      attempt.passed = passed;
      attempt.answers = parsed.answers;
      attempt.submittedAt = now;
      if (passed) {
        const existing = data.userBasicTrainings.find((item) => item.userId === actor.id);
        if (existing) {
          existing.passedAt = now;
          existing.updatedAt = now;
        } else {
          data.userBasicTrainings.push({
            id: crypto.randomUUID(),
            userId: actor.id,
            passedAt: now,
            certificateNo: null,
            certificateFileId: null,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      return { ...basicStatus(data, actor), justPassed: passed, scorePercent: scored.scorePercent, correctCount: scored.correct, drawCount: scored.total };
    },
    async downloadBasicModuleMaterial(moduleId: string) {
      const module = data.basicModules.find((item) => item.id === moduleId);
      if (!module?.materialFileId) throw new ClientError("這門基礎課還沒有教材", { status: 404 });
      if (actor.role === UserRole.APPLICANT && !module.isActive) throw new ClientError("找不到基礎課", { status: 404 });
      const file = data.files.find((item) => item.id === module.materialFileId);
      if (!file) throw new ClientError("找不到教材檔", { status: 404 });
      const bytes = Uint8Array.from(atob(file.contentBase64), (char) => char.charCodeAt(0));
      return { blob: new Blob([bytes], { type: file.mimeType }), name: file.originalName };
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
      const bankCount = data.basicQuestions.filter((item) => item.isActive).length;
      if (parsed.quizDrawCount > bankCount) throw new ClientError(`抽題數不可大於目前題庫（${bankCount} 題）`);
      policy.requireBasicBeforeApply = parsed.requireBasicBeforeApply;
      policy.quizDrawCount = parsed.quizDrawCount;
      policy.quizPassCount = parsed.quizPassCount;
      policy.privateRequestMinHeadcount = parsed.privateRequestMinHeadcount;
      policy.updatedById = actor.id;
      policy.version += 1;
      policy.updatedAt = new Date().toISOString();
      return presentPolicy(data);
    },
    async adminBasicModules() {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      return data.basicModules.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => moduleDto(data, item, null));
    },
    async saveBasicModule(input: unknown, id?: string) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const parsed = basicTrainingModuleWriteSchema.parse(input);
      if (parsed.youtubeUrl && !youtubeVideoId(parsed.youtubeUrl)) throw new ClientError("請貼 YouTube 影片連結");
      const now = new Date().toISOString();
      if (id) {
        const current = data.basicModules.find((item) => item.id === id);
        if (!current) throw new ClientError("找不到基礎課", { status: 404 });
        if (parsed.expectedVersion != null && current.version !== parsed.expectedVersion) {
          throw new ClientError("資料已被更新，請重新載入", { status: 409, code: "VERSION_CONFLICT" });
        }
        current.title = parsed.title;
        current.description = parsed.description;
        current.youtubeUrl = parsed.youtubeUrl;
        current.requiredWatchPercent = parsed.requiredWatchPercent;
        current.sortOrder = parsed.sortOrder;
        current.isRequired = parsed.isRequired;
        current.isActive = parsed.isActive;
        current.updatedById = actor.id;
        current.version += 1;
        current.updatedAt = now;
        return moduleDto(data, current, null);
      }
      const created = {
        id: crypto.randomUUID(),
        title: parsed.title,
        description: parsed.description,
        youtubeUrl: parsed.youtubeUrl,
        requiredWatchPercent: parsed.requiredWatchPercent,
        sortOrder: parsed.sortOrder,
        isRequired: parsed.isRequired,
        isActive: parsed.isActive,
        materialFileId: null,
        updatedById: actor.id,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      data.basicModules.push(created);
      return moduleDto(data, created, null);
    },
    async uploadBasicModuleMaterial(id: string, file: File) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const current = data.basicModules.find((item) => item.id === id);
      if (!current) throw new ClientError("找不到基礎課", { status: 404 });
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileId = rememberFile(data, actor.id, file.name, file.type || "application/octet-stream", bytes, "basic-materials");
      current.materialFileId = fileId;
      current.updatedById = actor.id;
      current.version += 1;
      current.updatedAt = new Date().toISOString();
      return moduleDto(data, current, null);
    },
    async adminQuestionBank() {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      return data.basicQuestions.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => questionDto(item, true));
    },
    async replaceQuestionBank(input: unknown) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const parsed = basicQuestionBankReplaceSchema.parse(input);
      const now = new Date().toISOString();
      data.basicQuestions = parsed.questions.map((question, index) => ({
        id: crypto.randomUUID(),
        prompt: question.prompt,
        options: question.options,
        correctIndex: question.correctIndex,
        sortOrder: index + 1,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }));
      return data.basicQuestions.map((item) => questionDto(item, true));
    },
    async uploadQuestionBank(file: File) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const raw = decodeUploadedText(new Uint8Array(await file.arrayBuffer()));
      const parsed = parseQuestionBankUpload(raw);
      if (parsed.error) throw new ClientError(parsed.error);
      return this.replaceQuestionBank({ questions: parsed.rows });
    },
    async saveQuestion(input: unknown, id?: string) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      const parsed = basicQuestionWriteSchema.parse(input);
      if (parsed.correctIndex >= parsed.options.length) throw new ClientError("正解索引超出選項範圍");
      const now = new Date().toISOString();
      if (id) {
        const current = data.basicQuestions.find((item) => item.id === id);
        if (!current) throw new ClientError("找不到題目", { status: 404 });
        current.prompt = parsed.prompt;
        current.options = parsed.options;
        current.correctIndex = parsed.correctIndex;
        current.sortOrder = parsed.sortOrder ?? current.sortOrder;
        current.isActive = parsed.isActive;
        current.updatedAt = now;
      } else {
        const last = [...data.basicQuestions].sort((a, b) => b.sortOrder - a.sortOrder)[0];
        data.basicQuestions.push({
          id: crypto.randomUUID(),
          prompt: parsed.prompt,
          options: parsed.options,
          correctIndex: parsed.correctIndex,
          sortOrder: parsed.sortOrder ?? ((last?.sortOrder ?? 0) + 1),
          isActive: parsed.isActive,
          createdAt: now,
          updatedAt: now,
        });
      }
      return data.basicQuestions.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => questionDto(item, true));
    },
    async deleteQuestion(id: string) {
      if (!canManage) throw new ClientError("沒有權限", { status: 403 });
      if (!data.basicQuestions.some((item) => item.id === id)) throw new ClientError("找不到題目", { status: 404 });
      data.basicQuestions = data.basicQuestions.filter((item) => item.id !== id);
      return data.basicQuestions.sort((a, b) => a.sortOrder - b.sortOrder).map((item) => questionDto(item, true));
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

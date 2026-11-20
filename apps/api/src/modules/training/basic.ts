import {
  CompanyTrainingRequestStatus,
  CourseDelivery,
  DEFAULT_TRAINING_POLICY,
  ErrorCodes,
  UserRole,
  acceptWatchProgress,
  basicQuestionBankReplaceSchema,
  basicQuestionWriteSchema,
  basicQuizSubmitSchema,
  basicTrainingModuleWriteSchema,
  basicWatchPassSeconds,
  basicWatchProgressSchema,
  buildLearningRecord,
  canStartVerificationApplication,
  companyTrainingRequestWriteSchema,
  companyTrainingReviewSchema,
  drawRandomQuestions,
  parseQuestionBankUpload,
  quizPassedByCount,
  requiredModulesComplete,
  scoreBasicQuiz,
  trainingCertificateWriteSchema,
  trainingPolicyWriteSchema,
  validateCompanyTrainingRequest,
  validateTrainingPolicy,
  youtubeVideoId,
} from "@mf/contracts";
import { prisma, Prisma } from "@mf/db/server";
import { randomUUID } from "node:crypto";
import { ApiError } from "../../lib/errors";
import { fieldFailure } from "../../lib/http";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature } from "../platform/access";
import { sha256Hex } from "@mf/contracts";

async function ensurePolicy() {
  const existing = await prisma.trainingPolicy.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.trainingPolicy.create({
    data: {
      requireBasicBeforeApply: DEFAULT_TRAINING_POLICY.requireBasicBeforeApply,
      quizDrawCount: DEFAULT_TRAINING_POLICY.quizDrawCount,
      quizPassCount: DEFAULT_TRAINING_POLICY.quizPassCount,
      privateRequestMinHeadcount: DEFAULT_TRAINING_POLICY.privateRequestMinHeadcount,
    },
  });
}

function presentPolicy(row: Awaited<ReturnType<typeof ensurePolicy>>) {
  return {
    id: row.id,
    requireBasicBeforeApply: row.requireBasicBeforeApply,
    quizDrawCount: row.quizDrawCount,
    quizPassCount: row.quizPassCount,
    privateRequestMinHeadcount: row.privateRequestMinHeadcount,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function assertBasicTrainingGate(actor: SessionActor) {
  if (actor.role !== UserRole.APPLICANT) return;
  const policy = await ensurePolicy();
  const record = await prisma.userBasicTraining.findUnique({ where: { userId: actor.id } });
  const gate = canStartVerificationApplication({
    requireBasicBeforeApply: policy.requireBasicBeforeApply,
    basicPassed: Boolean(record?.passedAt),
  });
  if (!gate.ok) throw new ApiError(403, ErrorCodes.BASIC_TRAINING_REQUIRED, gate.message);
}

async function moduleRows(includeInactive: boolean) {
  return prisma.basicTrainingModule.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: { material: true },
    orderBy: { sortOrder: "asc" },
  });
}

function presentModule(
  row: Awaited<ReturnType<typeof moduleRows>>[number],
  progress?: { watchedSeconds: number; videoDurationSeconds: number; completedAt: Date | null } | null,
) {
  const videoDurationSeconds = progress?.videoDurationSeconds ?? 0;
  const requiredWatchSeconds = videoDurationSeconds > 0
    ? basicWatchPassSeconds(videoDurationSeconds, row.requiredWatchPercent)
    : null;
  const watchedSeconds = progress?.watchedSeconds ?? 0;
  const completed = Boolean(progress?.completedAt)
    || (requiredWatchSeconds != null && Number.isFinite(requiredWatchSeconds) && watchedSeconds >= requiredWatchSeconds);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    youtubeUrl: row.youtubeUrl,
    requiredWatchPercent: row.requiredWatchPercent,
    requiredWatchSeconds,
    sortOrder: row.sortOrder,
    isRequired: row.isRequired,
    isActive: row.isActive,
    hasMaterial: Boolean(row.materialFileId),
    materialFileId: row.materialFileId,
    materialName: row.material?.originalName ?? null,
    version: row.version,
    watchedSeconds,
    videoDurationSeconds,
    completed,
  };
}

function presentQuestion(row: { id: string; prompt: string; options: Prisma.JsonValue; sortOrder: number; isActive?: boolean; correctIndex?: number }, includeAnswers: boolean) {
  return {
    id: row.id,
    prompt: row.prompt,
    options: row.options as string[],
    sortOrder: row.sortOrder,
    isActive: row.isActive ?? true,
    ...(includeAnswers && row.correctIndex != null ? { correctIndex: row.correctIndex } : {}),
  };
}

async function activeAttemptFor(userId: string) {
  return prisma.basicTrainingAttempt.findFirst({
    where: { userId, submittedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

async function presentActiveAttempt(userId: string) {
  const attempt = await activeAttemptFor(userId);
  if (!attempt) return null;
  const ids = attempt.drawnQuestionIds as string[];
  const rows = await prisma.basicTrainingQuestion.findMany({ where: { id: { in: ids } } });
  const byId = new Map(rows.map((item) => [item.id, item]));
  return {
    attemptId: attempt.id,
    drawCount: attempt.drawCount,
    passCount: attempt.passCountSnapshot,
    questions: ids.map((id) => byId.get(id)).filter(Boolean).map((item) => presentQuestion(item!, false)),
  };
}

export async function basicStatus(actor: SessionActor) {
  const policy = presentPolicy(await ensurePolicy());
  const modules = await moduleRows(false);
  const progress = await prisma.basicTrainingProgress.findMany({ where: { userId: actor.id } });
  const progressByModule = new Map(progress.map((item) => [item.moduleId, item]));
  const presented = modules.map((item) => presentModule(item, progressByModule.get(item.id) ?? null));
  const requiredIds = presented.filter((item) => item.isRequired).map((item) => item.id);
  const completedIds = presented.filter((item) => item.completed).map((item) => item.id);
  const record = await prisma.userBasicTraining.findUnique({ where: { userId: actor.id } });
  const last = await prisma.basicTrainingAttempt.findFirst({
    where: { userId: actor.id, submittedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  const bankCount = await prisma.basicTrainingQuestion.count({ where: { isActive: true } });
  const requiredComplete = requiredModulesComplete({ requiredModuleIds: requiredIds, completedModuleIds: completedIds });
  const activeAttempt = await presentActiveAttempt(actor.id);
  return {
    policy,
    modules: presented,
    questionBankCount: bankCount,
    requiredComplete,
    passed: Boolean(record?.passedAt),
    passedAt: record?.passedAt?.toISOString() ?? null,
    certificateNo: null,
    hasCertificate: false,
    lastCorrectCount: last?.correctCount ?? null,
    lastDrawCount: last?.drawCount ?? null,
    lastScorePercent: last?.scorePercent ?? null,
    canTakeQuiz: requiredComplete && !record?.passedAt && bankCount >= policy.quizDrawCount,
    activeAttempt,
  };
}

export async function recordModuleWatch(actor: SessionActor, moduleId: string, body: unknown) {
  if (actor.role !== UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可累計基礎課觀看");
  const input = basicWatchProgressSchema.parse(body);
  const module = await prisma.basicTrainingModule.findFirst({ where: { id: moduleId, isActive: true }, include: { material: true } });
  if (!module) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到基礎課");
  if (!module.youtubeUrl.trim()) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此基礎課尚未設定影片，無法累計觀看");
  const requiredSeconds = basicWatchPassSeconds(input.videoDurationSeconds, module.requiredWatchPercent);
  const existing = await prisma.basicTrainingProgress.findUnique({ where: { userId_moduleId: { userId: actor.id, moduleId } } });
  if (existing?.completedAt) return basicStatus(actor);
  const now = new Date();
  const accepted = acceptWatchProgress({
    currentSeconds: existing?.watchedSeconds ?? 0,
    reportedSeconds: input.watchedSeconds,
    videoDurationSeconds: input.videoDurationSeconds,
    lastReportedAt: existing?.watchUpdatedAt?.toISOString() ?? null,
    nowIso: now.toISOString(),
  });
  const completed = accepted >= requiredSeconds;
  await prisma.basicTrainingProgress.upsert({
    where: { userId_moduleId: { userId: actor.id, moduleId } },
    create: {
      userId: actor.id,
      moduleId,
      watchedSeconds: accepted,
      videoDurationSeconds: input.videoDurationSeconds,
      watchUpdatedAt: now,
      completedAt: completed ? now : null,
    },
    update: {
      watchedSeconds: accepted,
      videoDurationSeconds: input.videoDurationSeconds,
      watchUpdatedAt: now,
      ...(completed ? { completedAt: now } : {}),
    },
  });
  return basicStatus(actor);
}

export async function startQuiz(actor: SessionActor) {
  if (actor.role !== UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可參加測驗");
  const status = await basicStatus(actor);
  if (status.passed) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "已通過基礎教育訓練");
  if (!status.canTakeQuiz && !status.activeAttempt) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請先讀完所有必做基礎課，並確認題庫足夠");
  if (status.activeAttempt) return status.activeAttempt;
  const policy = await ensurePolicy();
  const bank = await prisma.basicTrainingQuestion.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  if (bank.length < policy.quizDrawCount) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `題庫至少需要 ${policy.quizDrawCount} 題才能抽題`);
  }
  const drawn = drawRandomQuestions(bank, policy.quizDrawCount);
  const attempt = await prisma.basicTrainingAttempt.create({
    data: {
      userId: actor.id,
      scorePercent: 0,
      correctCount: 0,
      drawCount: drawn.length,
      passCountSnapshot: policy.quizPassCount,
      passed: false,
      drawnQuestionIds: drawn.map((item) => item.id),
      answers: Prisma.DbNull,
      submittedAt: null,
    },
  });
  return {
    attemptId: attempt.id,
    drawCount: attempt.drawCount,
    passCount: attempt.passCountSnapshot,
    questions: drawn.map((item) => presentQuestion(item, false)),
  };
}

export async function submitQuiz(actor: SessionActor, body: unknown) {
  if (actor.role !== UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可參加測驗");
  const input = basicQuizSubmitSchema.parse(body);
  const status = await basicStatus(actor);
  if (status.passed) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "已通過基礎教育訓練");
  const attempt = await prisma.basicTrainingAttempt.findFirst({
    where: { id: input.attemptId, userId: actor.id, submittedAt: null },
  });
  if (!attempt) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "找不到進行中的測驗，請重新開始");
  const drawnIds = attempt.drawnQuestionIds as string[];
  if (input.answers.length !== drawnIds.length || !drawnIds.every((id) => input.answers.some((answer) => answer.questionId === id))) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請答完本次抽出的全部題目");
  }
  const rows = await prisma.basicTrainingQuestion.findMany({ where: { id: { in: drawnIds } } });
  const scored = scoreBasicQuiz(
    rows.map((item) => ({ id: item.id, correctIndex: item.correctIndex, options: item.options as string[] })),
    input.answers,
  );
  const passed = quizPassedByCount(scored.correct, attempt.passCountSnapshot);
  const now = new Date();
  await prisma.basicTrainingAttempt.update({
    where: { id: attempt.id },
    data: {
      scorePercent: scored.scorePercent,
      correctCount: scored.correct,
      passed,
      answers: input.answers as Prisma.InputJsonValue,
      submittedAt: now,
    },
  });
  if (passed) {
    // 基礎教育訓練只標記完成，不發證書；證書僅線上／線下課與專班人工登錄。
    await prisma.userBasicTraining.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, passedAt: now },
      update: { passedAt: now },
    });
  }
  return {
    ...(await basicStatus(actor)),
    justPassed: passed,
    scorePercent: scored.scorePercent,
    correctCount: scored.correct,
    drawCount: scored.total,
  };
}

export async function getPolicy() {
  return presentPolicy(await ensurePolicy());
}

export async function savePolicy(actor: SessionActor, body: unknown) {
  await assertFeature(actor, "training.manage");
  const input = trainingPolicyWriteSchema.parse(body);
  const issues = validateTrainingPolicy(input);
  if (issues[0]) fieldFailure(issues);
  const current = await ensurePolicy();
  if (current.version !== input.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
  const bankCount = await prisma.basicTrainingQuestion.count({ where: { isActive: true } });
  if (input.quizDrawCount > bankCount) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `抽題數不可大於目前題庫（${bankCount} 題）`);
  }
  const updated = await prisma.trainingPolicy.update({
    where: { id: current.id },
    data: {
      requireBasicBeforeApply: input.requireBasicBeforeApply,
      quizDrawCount: input.quizDrawCount,
      quizPassCount: input.quizPassCount,
      privateRequestMinHeadcount: input.privateRequestMinHeadcount,
      updatedById: actor.id,
      version: { increment: 1 },
    },
  });
  return presentPolicy(updated);
}

export async function adminModules(actor: SessionActor) {
  await assertFeature(actor, "training.manage");
  const rows = await moduleRows(true);
  return rows.map((item) => presentModule(item, null));
}

export async function saveModule(actor: SessionActor, body: unknown, id?: string) {
  await assertFeature(actor, "training.manage");
  const input = basicTrainingModuleWriteSchema.parse(body);
  if (input.youtubeUrl && !youtubeVideoId(input.youtubeUrl)) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請貼 YouTube 影片連結");
  }
  if (id) {
    const current = await prisma.basicTrainingModule.findUnique({ where: { id }, include: { material: true } });
    if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到基礎課");
    if (input.expectedVersion != null && current.version !== input.expectedVersion) {
      throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    }
    const updated = await prisma.basicTrainingModule.update({
      where: { id },
      data: {
        title: input.title,
        description: input.description,
        youtubeUrl: input.youtubeUrl,
        requiredWatchPercent: input.requiredWatchPercent,
        sortOrder: input.sortOrder,
        isRequired: input.isRequired,
        isActive: input.isActive,
        updatedById: actor.id,
        version: { increment: 1 },
      },
      include: { material: true },
    });
    return presentModule(updated, null);
  }
  const created = await prisma.basicTrainingModule.create({
    data: {
      title: input.title,
      description: input.description,
      youtubeUrl: input.youtubeUrl,
      requiredWatchPercent: input.requiredWatchPercent,
      sortOrder: input.sortOrder,
      isRequired: input.isRequired,
      isActive: input.isActive,
      updatedById: actor.id,
    },
    include: { material: true },
  });
  return presentModule(created, null);
}

export async function uploadModuleMaterial(
  actor: SessionActor,
  storage: StorageAdapter,
  id: string,
  file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
) {
  await assertFeature(actor, "training.manage");
  const current = await prisma.basicTrainingModule.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到基礎課");
  const fileId = randomUUID();
  const storageKey = `basic-materials/${fileId}-${file.originalname}`;
  await storage.save(storageKey, file.buffer);
  await prisma.fileObject.create({
    data: {
      id: fileId,
      uploadedById: actor.id,
      storageKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256: await sha256Hex(file.buffer),
    },
  });
  const updated = await prisma.basicTrainingModule.update({
    where: { id },
    data: { materialFileId: fileId, updatedById: actor.id, version: { increment: 1 } },
    include: { material: true },
  });
  return presentModule(updated, null);
}

export async function downloadModuleMaterial(actor: SessionActor, storage: StorageAdapter, moduleId: string) {
  const module = await prisma.basicTrainingModule.findFirst({
    where: { id: moduleId, ...(actor.role === UserRole.APPLICANT ? { isActive: true } : {}) },
    include: { material: true },
  });
  if (!module?.material) throw new ApiError(404, ErrorCodes.NOT_FOUND, "這門基礎課還沒有教材");
  if (actor.role === UserRole.APPLICANT || actor.role === UserRole.ADMIN || actor.role === UserRole.CASE_OFFICER) {
    const bytes = await storage.read(module.material.storageKey);
    return { bytes, mimeType: module.material.mimeType, name: module.material.originalName };
  }
  throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有權限");
}

export async function adminQuestionBank(actor: SessionActor) {
  await assertFeature(actor, "training.manage");
  const rows = await prisma.basicTrainingQuestion.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((item) => presentQuestion({ ...item, correctIndex: item.correctIndex }, true));
}

export async function replaceQuestionBank(actor: SessionActor, body: unknown) {
  await assertFeature(actor, "training.manage");
  const input = basicQuestionBankReplaceSchema.parse(body);
  await prisma.$transaction(async (tx) => {
    await tx.basicTrainingQuestion.deleteMany({});
    for (const [index, question] of input.questions.entries()) {
      await tx.basicTrainingQuestion.create({
        data: {
          prompt: question.prompt,
          options: question.options,
          correctIndex: question.correctIndex,
          sortOrder: index + 1,
          isActive: true,
        },
      });
    }
  });
  const policy = await ensurePolicy();
  if (input.questions.length < policy.quizDrawCount) {
    // allow upload smaller bank; policy save will block oversized draw later
  }
  return adminQuestionBank(actor);
}

export async function replaceQuestionBankFromText(actor: SessionActor, raw: string) {
  const parsed = parseQuestionBankUpload(raw);
  if (parsed.error) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, parsed.error);
  return replaceQuestionBank(actor, { questions: parsed.rows });
}

export async function saveQuestion(actor: SessionActor, body: unknown, id?: string) {
  await assertFeature(actor, "training.manage");
  const input = basicQuestionWriteSchema.parse(body);
  if (input.correctIndex >= input.options.length) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "正解索引超出選項範圍");
  }
  if (id) {
    const current = await prisma.basicTrainingQuestion.findUnique({ where: { id } });
    if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到題目");
    await prisma.basicTrainingQuestion.update({
      where: { id },
      data: {
        prompt: input.prompt,
        options: input.options,
        correctIndex: input.correctIndex,
        sortOrder: input.sortOrder ?? current.sortOrder,
        isActive: input.isActive,
      },
    });
  } else {
    const last = await prisma.basicTrainingQuestion.findFirst({ orderBy: { sortOrder: "desc" } });
    await prisma.basicTrainingQuestion.create({
      data: {
        prompt: input.prompt,
        options: input.options,
        correctIndex: input.correctIndex,
        sortOrder: input.sortOrder ?? ((last?.sortOrder ?? 0) + 1),
        isActive: input.isActive,
      },
    });
  }
  return adminQuestionBank(actor);
}

export async function deleteQuestion(actor: SessionActor, id: string) {
  await assertFeature(actor, "training.manage");
  const current = await prisma.basicTrainingQuestion.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到題目");
  await prisma.basicTrainingQuestion.delete({ where: { id } });
  return adminQuestionBank(actor);
}

function presentCompany(row: {
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
  courseId: string | null;
  version: number;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organization: { organizationName: string };
  requestedBy: { displayName: string };
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization.organizationName,
    requestedById: row.requestedById,
    requestedByName: row.requestedBy.displayName,
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
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function myCompanyRequests(actor: SessionActor) {
  if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可查看");
  const rows = await prisma.companyTrainingRequest.findMany({
    where: { organizationId: actor.organizationId },
    include: { organization: true, requestedBy: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(presentCompany);
}

export async function saveCompanyRequest(actor: SessionActor, body: unknown, id?: string) {
  if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可申請專班");
  const input = companyTrainingRequestWriteSchema.parse(body);
  const issues = validateCompanyTrainingRequest({ ...input, minHeadcount: 1, note: input.note });
  if (issues[0]) fieldFailure(issues);
  if (id) {
    const current = await prisma.companyTrainingRequest.findFirst({ where: { id, organizationId: actor.organizationId }, include: { organization: true, requestedBy: true } });
    if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到申請");
    if (current.status !== CompanyTrainingRequestStatus.DRAFT && current.status !== CompanyTrainingRequestStatus.REJECTED) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "只有草稿或未通過的申請可修改");
    }
    if (input.expectedVersion != null && current.version !== input.expectedVersion) {
      throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    }
    const updated = await prisma.companyTrainingRequest.update({
      where: { id },
      data: {
        headcount: input.headcount,
        preferredStartsOn: input.preferredStartsOn,
        preferredEndsOn: input.preferredEndsOn,
        delivery: input.delivery,
        location: input.delivery === CourseDelivery.ONLINE ? "" : input.location,
        note: input.note,
        status: CompanyTrainingRequestStatus.DRAFT,
        adminNote: "",
        reviewedById: null,
        reviewedAt: null,
        version: { increment: 1 },
      },
      include: { organization: true, requestedBy: true },
    });
    return presentCompany(updated);
  }
  const created = await prisma.companyTrainingRequest.create({
    data: {
      organizationId: actor.organizationId,
      requestedById: actor.id,
      headcount: input.headcount,
      preferredStartsOn: input.preferredStartsOn,
      preferredEndsOn: input.preferredEndsOn,
      delivery: input.delivery,
      location: input.delivery === CourseDelivery.ONLINE ? "" : input.location,
      note: input.note,
    },
    include: { organization: true, requestedBy: true },
  });
  return presentCompany(created);
}

export async function submitCompanyRequest(actor: SessionActor, id: string, expectedVersion: number) {
  if (actor.role !== UserRole.APPLICANT || !actor.organizationId) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可送出");
  const current = await prisma.companyTrainingRequest.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到申請");
  if (current.version !== expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
  if (current.status !== CompanyTrainingRequestStatus.DRAFT && current.status !== CompanyTrainingRequestStatus.REJECTED) {
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "目前狀態不能送出");
  }
  const policy = await ensurePolicy();
  const issues = validateCompanyTrainingRequest({
    headcount: current.headcount,
    minHeadcount: policy.privateRequestMinHeadcount,
    preferredStartsOn: current.preferredStartsOn,
    preferredEndsOn: current.preferredEndsOn,
    delivery: current.delivery,
    location: current.location,
    note: current.note,
  });
  if (issues[0]) fieldFailure(issues);
  const updated = await prisma.companyTrainingRequest.update({
    where: { id },
    data: { status: CompanyTrainingRequestStatus.SUBMITTED, submittedAt: new Date(), version: { increment: 1 } },
    include: { organization: true, requestedBy: true },
  });
  return presentCompany(updated);
}

export async function adminCompanyRequests(actor: SessionActor) {
  await assertFeature(actor, "training.manage");
  const rows = await prisma.companyTrainingRequest.findMany({
    include: { organization: true, requestedBy: true },
    orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
  });
  return rows.map(presentCompany);
}

export async function reviewCompanyRequest(actor: SessionActor, id: string, body: unknown) {
  await assertFeature(actor, "training.manage");
  const input = companyTrainingReviewSchema.parse(body);
  const current = await prisma.companyTrainingRequest.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到申請");
  if (current.version !== input.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
  if (current.status !== CompanyTrainingRequestStatus.SUBMITTED) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "只有待審核的申請可審");
  const updated = await prisma.companyTrainingRequest.update({
    where: { id },
    data: {
      status: input.action === "APPROVE" ? CompanyTrainingRequestStatus.APPROVED : CompanyTrainingRequestStatus.REJECTED,
      adminNote: input.adminNote,
      courseId: input.courseId ?? null,
      reviewedById: actor.id,
      reviewedAt: new Date(),
      version: { increment: 1 },
    },
    include: { organization: true, requestedBy: true },
  });
  return presentCompany(updated);
}

export async function registerCertificate(actor: SessionActor, body: unknown) {
  await assertFeature(actor, "training.manage");
  const input = trainingCertificateWriteSchema.parse(body);
  if (input.validUntilDate < input.issuedOnDate) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "到期日不可早於核發日");
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: input.enrollmentId },
    include: { course: true, user: true, trainingCertificate: true },
  });
  if (!enrollment) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到報名");
  if (enrollment.trainingCertificate) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這筆報名已有訓練證書");
  const learning = buildLearningRecord({
    enrollmentStatus: enrollment.status,
    attendanceStatus: enrollment.attendanceStatus,
    attendedMinutes: enrollment.attendedMinutes,
    requiredAttendanceMinutesSnapshot: enrollment.requiredAttendanceMinutesSnapshot,
    delivery: enrollment.course.delivery,
    watchedSeconds: enrollment.watchedSeconds,
    videoDurationSeconds: enrollment.course.videoDurationSeconds,
  });
  if (learning.completion !== "COMPLETED") throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "僅完課報名可登錄訓練證書");
  const created = await prisma.trainingCertificate.create({
    data: {
      enrollmentId: input.enrollmentId,
      certificateNo: input.certificateNo,
      issuedOnDate: input.issuedOnDate,
      validUntilDate: input.validUntilDate,
      registeredById: actor.id,
    },
  });
  return {
    id: created.id,
    enrollmentId: created.enrollmentId,
    courseId: enrollment.courseId,
    courseTitle: enrollment.course.title,
    userId: enrollment.userId,
    userName: enrollment.user.displayName,
    certificateNo: created.certificateNo,
    issuedOnDate: created.issuedOnDate,
    validUntilDate: created.validUntilDate,
    registeredAt: created.registeredAt.toISOString(),
  };
}

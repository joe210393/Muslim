import {
  CompanyTrainingRequestStatus,
  CourseDelivery,
  DEFAULT_TRAINING_POLICY,
  ErrorCodes,
  UserRole,
  basicQuizSubmitSchema,
  basicTrainingModuleWriteSchema,
  buildLearningRecord,
  canStartVerificationApplication,
  companyTrainingRequestWriteSchema,
  companyTrainingReviewSchema,
  nextBasicCertificateNo,
  paintBasicCertificate,
  pngPagesToPdf,
  quizPassed,
  requiredModulesComplete,
  scoreBasicQuiz,
  trainingCertificateWriteSchema,
  trainingPolicyWriteSchema,
  validateCompanyTrainingRequest,
  validateTrainingPolicy,
} from "@mf/contracts";
import { prisma, type Prisma } from "@mf/db/server";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { ApiError } from "../../lib/errors";
import { fieldFailure } from "../../lib/http";
import type { SessionActor } from "../../middleware/auth";
import type { StorageAdapter } from "../../storage/storage";
import { assertFeature } from "../platform/access";
import { sha256Hex } from "@mf/contracts";

let fontReady = false;
function ensureFont(repoRoot: string) {
  if (fontReady) return;
  GlobalFonts.registerFromPath(path.join(repoRoot, "apps/web/public/fonts/NotoSansTC-Subset.otf"), "NotoSansTC");
  fontReady = true;
}

async function ensurePolicy() {
  const existing = await prisma.trainingPolicy.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.trainingPolicy.create({
    data: {
      requireBasicBeforeApply: DEFAULT_TRAINING_POLICY.requireBasicBeforeApply,
      quizPassPercent: DEFAULT_TRAINING_POLICY.quizPassPercent,
      privateRequestMinHeadcount: DEFAULT_TRAINING_POLICY.privateRequestMinHeadcount,
    },
  });
}

function presentPolicy(row: Awaited<ReturnType<typeof ensurePolicy>>) {
  return {
    id: row.id,
    requireBasicBeforeApply: row.requireBasicBeforeApply,
    quizPassPercent: row.quizPassPercent,
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
    include: { questions: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
}

function presentModule(row: Awaited<ReturnType<typeof moduleRows>>[number], completed: boolean, includeAnswers: boolean) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    sortOrder: row.sortOrder,
    isRequired: row.isRequired,
    isActive: row.isActive,
    hasVideo: Boolean(row.videoFileId),
    version: row.version,
    completed,
    questions: row.questions.map((question) => ({
      id: question.id,
      moduleId: question.moduleId,
      prompt: question.prompt,
      options: question.options as string[],
      sortOrder: question.sortOrder,
      ...(includeAnswers ? { correctIndex: question.correctIndex } : {}),
    })),
  };
}

export async function basicStatus(actor: SessionActor) {
  const policy = presentPolicy(await ensurePolicy());
  const modules = await moduleRows(false);
  const progress = await prisma.basicTrainingProgress.findMany({ where: { userId: actor.id } });
  const done = new Set(progress.map((item) => item.moduleId));
  const presented = modules.map((item) => presentModule(item, done.has(item.id), false));
  const requiredIds = presented.filter((item) => item.isRequired).map((item) => item.id);
  const record = await prisma.userBasicTraining.findUnique({ where: { userId: actor.id } });
  const last = await prisma.basicTrainingAttempt.findFirst({ where: { userId: actor.id }, orderBy: { createdAt: "desc" } });
  const requiredComplete = requiredModulesComplete({ requiredModuleIds: requiredIds, completedModuleIds: [...done] });
  return {
    policy,
    modules: presented,
    requiredComplete,
    passed: Boolean(record?.passedAt),
    passedAt: record?.passedAt?.toISOString() ?? null,
    certificateNo: record?.certificateNo ?? null,
    hasCertificate: Boolean(record?.certificateFileId),
    lastScorePercent: last?.scorePercent ?? null,
    canTakeQuiz: requiredComplete && !record?.passedAt,
  };
}

export async function completeModule(actor: SessionActor, moduleId: string) {
  if (actor.role !== UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可完成基礎課閱讀");
  const module = await prisma.basicTrainingModule.findFirst({ where: { id: moduleId, isActive: true } });
  if (!module) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到模組");
  await prisma.basicTrainingProgress.upsert({
    where: { userId_moduleId: { userId: actor.id, moduleId } },
    create: { userId: actor.id, moduleId },
    update: {},
  });
  return basicStatus(actor);
}

async function renderBasicPdf(repoRoot: string, input: { certificateNo: string; holderName: string; organizationName: string; passedAtLabel: string }) {
  ensureFont(repoRoot);
  const width = 1240;
  const height = 1754;
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
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
    { title: "基礎教育訓練結業證明（示範）", ...input },
  );
  return pngPagesToPdf([canvas.toBuffer("image/png")]);
}

export async function submitQuiz(actor: SessionActor, storage: StorageAdapter, repoRoot: string, body: unknown) {
  if (actor.role !== UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可參加測驗");
  const input = basicQuizSubmitSchema.parse(body);
  const status = await basicStatus(actor);
  if (status.passed) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "已通過基礎教育訓練");
  if (!status.canTakeQuiz) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請先讀完所有必做模組");
  const rows = await prisma.basicTrainingQuestion.findMany({ where: { module: { isActive: true } } });
  const scored = scoreBasicQuiz(rows.map((item) => ({ id: item.id, correctIndex: item.correctIndex, options: item.options as string[] })), input.answers);
  const passed = quizPassed(scored.scorePercent, status.policy.quizPassPercent);
  await prisma.basicTrainingAttempt.create({
    data: {
      userId: actor.id,
      scorePercent: scored.scorePercent,
      passed,
      answers: input.answers as Prisma.InputJsonValue,
      quizPassPercentSnapshot: status.policy.quizPassPercent,
    },
  });
  if (passed) {
    const count = await prisma.userBasicTraining.count({ where: { certificateNo: { not: null } } });
    const certificateNo = nextBasicCertificateNo(count + 1);
    const now = new Date();
    const org = actor.organizationId ? await prisma.organization.findUnique({ where: { id: actor.organizationId } }) : null;
    const passedAtLabel = new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", dateStyle: "medium", timeStyle: "short" }).format(now);
    const pdf = await renderBasicPdf(repoRoot, {
      certificateNo,
      holderName: actor.displayName,
      organizationName: org?.organizationName ?? "",
      passedAtLabel,
    });
    const fileId = randomUUID();
    const storageKey = `basic-certificates/${fileId}.pdf`;
    await storage.save(storageKey, pdf);
    await prisma.fileObject.create({
      data: {
        id: fileId,
        uploadedById: actor.id,
        storageKey,
        originalName: `${certificateNo}.pdf`,
        mimeType: "application/pdf",
        sizeBytes: pdf.byteLength,
        sha256: await sha256Hex(pdf),
      },
    });
    await prisma.userBasicTraining.upsert({
      where: { userId: actor.id },
      create: { userId: actor.id, passedAt: now, certificateNo, certificateFileId: fileId },
      update: { passedAt: now, certificateNo, certificateFileId: fileId },
    });
  }
  return { ...(await basicStatus(actor)), justPassed: passed, scorePercent: scored.scorePercent };
}

export async function downloadBasicCertificate(actor: SessionActor, storage: StorageAdapter) {
  const record = await prisma.userBasicTraining.findUnique({ where: { userId: actor.id } });
  if (!record?.certificateFileId) throw new ApiError(404, ErrorCodes.NOT_FOUND, "還沒有基礎課證書");
  const file = await prisma.fileObject.findUnique({ where: { id: record.certificateFileId } });
  if (!file) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到證書檔");
  const bytes = await storage.read(file.storageKey);
  return { bytes, mimeType: file.mimeType, name: file.originalName };
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
  const updated = await prisma.trainingPolicy.update({
    where: { id: current.id },
    data: {
      requireBasicBeforeApply: input.requireBasicBeforeApply,
      quizPassPercent: input.quizPassPercent,
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
  return rows.map((item) => presentModule(item, false, true));
}

export async function saveModule(actor: SessionActor, body: unknown, id?: string) {
  await assertFeature(actor, "training.manage");
  const input = basicTrainingModuleWriteSchema.parse(body);
  if (id) {
    const current = await prisma.basicTrainingModule.findUnique({ where: { id } });
    if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到模組");
    if (input.expectedVersion != null && current.version !== input.expectedVersion) {
      throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    }
    await prisma.$transaction(async (tx) => {
      await tx.basicTrainingModule.update({
        where: { id },
        data: {
          title: input.title,
          body: input.body,
          sortOrder: input.sortOrder,
          isRequired: input.isRequired,
          isActive: input.isActive,
          updatedById: actor.id,
          version: { increment: 1 },
        },
      });
      await tx.basicTrainingQuestion.deleteMany({ where: { moduleId: id } });
      for (const [index, question] of input.questions.entries()) {
        await tx.basicTrainingQuestion.create({
          data: {
            moduleId: id,
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            sortOrder: question.sortOrder || index + 1,
          },
        });
      }
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const created = await tx.basicTrainingModule.create({
        data: {
          title: input.title,
          body: input.body,
          sortOrder: input.sortOrder,
          isRequired: input.isRequired,
          isActive: input.isActive,
          updatedById: actor.id,
        },
      });
      for (const [index, question] of input.questions.entries()) {
        await tx.basicTrainingQuestion.create({
          data: {
            moduleId: created.id,
            prompt: question.prompt,
            options: question.options,
            correctIndex: question.correctIndex,
            sortOrder: question.sortOrder || index + 1,
          },
        });
      }
    });
  }
  return adminModules(actor).then((rows) => rows.find((item) => item.title === input.title) ?? rows[0]!);
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

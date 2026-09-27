import {
  ApplicationAction,
  ApplicationStatus,
  ConfigurationStatus,
  ErrorCodes,
  UserRole,
  canEditApplicationContent,
  canViewApplication,
  commentRequirement,
  formatApplicationNo,
  pageMeta,
  parseCategoryDefinition,
  resolveTransition,
  sha256Hex,
  snapshotPayload,
  taipeiYear,
  validateDraft,
  validateSubmit,
  type ApplicationPatch,
} from "@mf/contracts";
import { prisma, type Prisma } from "@mf/db/server";
import type { Env } from "../../config/env";
import { ApiError } from "../../lib/errors";
import { fieldFailure } from "../../lib/http";
import type { SessionActor as Actor } from "../../middleware/auth";
import { deliverNotification } from "../notifications/mailer";

type Tx = Prisma.TransactionClient;

const listInclude = { organization: true, category: true, assignedTo: true } satisfies Prisma.ApplicationInclude;

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asFormData(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === null || typeof item === "string" || typeof item === "number" || typeof item === "boolean") result[key] = item;
  }
  return result;
}

function contentOf(app: {
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
  formData: unknown;
}) {
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
    formData: asFormData(app.formData),
  };
}

export function toListItem(app: Prisma.ApplicationGetPayload<{ include: typeof listInclude }>) {
  return {
    id: app.id,
    applicationNo: app.applicationNo,
    organizationId: app.organizationId,
    organizationName: app.organization.organizationName,
    categoryId: app.categoryId,
    categoryCode: app.category.code,
    categoryName: app.category.name,
    status: app.status,
    assignedToId: app.assignedToId,
    assignedToName: app.assignedTo?.displayName ?? null,
    version: app.version,
    submittedAt: iso(app.submittedAt),
    updatedAt: app.updatedAt.toISOString(),
    createdAt: app.createdAt.toISOString(),
  };
}

async function nextApplicationNo(tx: Tx): Promise<string> {
  const rows = await tx.$queryRawUnsafe<Array<{ nextval: number }>>(`SELECT nextval('application_no_seq')::int AS nextval`);
  const sequence = rows[0]?.nextval;
  if (!sequence) throw new Error("無法取得案件編號");
  return formatApplicationNo(taipeiYear(), sequence);
}

function scopeWhere(actor: Actor): Prisma.ApplicationWhereInput {
  if (actor.role === UserRole.ADMIN) return {};
  if (actor.role === UserRole.APPLICANT) return { organizationId: actor.organizationId ?? "00000000-0000-0000-0000-000000000000" };
  return { assignedToId: actor.id };
}

export async function listApplications(actor: Actor, query: { q?: string; status?: string; categoryId?: string; assignedToId?: string; page: number; pageSize: number }) {
  const where: Prisma.ApplicationWhereInput = { ...scopeWhere(actor) };
  if (query.status) where.status = query.status as never;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (actor.role === UserRole.ADMIN && query.assignedToId) where.assignedToId = query.assignedToId;
  if (query.q) {
    where.OR = [
      { applicationNo: { contains: query.q, mode: "insensitive" } },
      { organization: { organizationName: { contains: query.q, mode: "insensitive" } } },
    ];
  }
  const [total, rows] = await prisma.$transaction([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      include: listInclude,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { items: rows.map(toListItem), meta: pageMeta(query.page, query.pageSize, total) };
}

export async function getApplication(actor: Actor, id: string) {
  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      ...listInclude,
      categoryFormVersion: true,
      attachments: { where: { removedAt: null }, include: { file: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!app || !canViewApplication(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
  const definition = parseCategoryDefinition(app.categoryFormVersion.definition);
  return {
    ...toListItem(app),
    ...contentOf(app),
    categoryFormVersionId: app.categoryFormVersionId,
    formVersion: app.categoryFormVersion.version,
    configurationStatus: app.categoryFormVersion.configurationStatus,
    definition,
    resumeStatus: app.resumeStatus,
    createdById: app.createdById,
    sourceSystem: app.sourceSystem,
    sourceRecordKey: app.sourceRecordKey,
    decidedAt: iso(app.decidedAt),
    attachments: app.attachments.map((item) => ({
      id: item.id,
      requirementKey: item.requirementKey,
      fileId: item.fileId,
      originalName: item.file.originalName,
      mimeType: item.file.mimeType,
      sizeBytes: item.file.sizeBytes,
      createdAt: item.createdAt.toISOString(),
    })),
  };
}

export async function createDraft(actor: Actor, categoryId: string) {
  if (actor.role !== UserRole.APPLICANT || !actor.organizationId) {
    throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有業者可以建立申請");
  }
  const [category, organization] = await Promise.all([
    prisma.applicationCategory.findUnique({
      where: { id: categoryId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    }),
    prisma.organization.findUnique({ where: { id: actor.organizationId } }),
  ]);
  const version = category?.versions[0];
  if (!category || !category.isActive || !version) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到申請類別");
  if (!organization) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者資料");
  const created = await prisma.$transaction(async (tx) => {
    const applicationNo = await nextApplicationNo(tx);
    return tx.application.create({
      data: {
        applicationNo,
        organizationId: organization.id,
        createdById: actor.id,
        categoryId: category.id,
        categoryFormVersionId: version.id,
        status: ApplicationStatus.DRAFT,
        organizationNameSnapshot: organization.organizationName,
        taxIdSnapshot: organization.taxId,
        contactNameSnapshot: organization.contactName,
        contactPhoneSnapshot: organization.contactPhone,
        contactEmailSnapshot: organization.contactEmail,
        organizationAddressSnapshot: organization.address,
        declarationAccepted: false,
        formData: {},
      },
      include: listInclude,
    });
  });
  return getApplication(actor, created.id);
}

export async function updateDraft(actor: Actor, id: string, patch: ApplicationPatch) {
  return prisma.$transaction(async (tx) => {
    const app = await tx.application.findUnique({ where: { id }, include: { categoryFormVersion: true, attachments: true } });
    if (!app || !canViewApplication(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
    if (!canEditApplicationContent(actor, app)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "目前狀態不能修改申請內容");
    if (app.version !== patch.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    let categoryFormVersionId = app.categoryFormVersionId;
    let definition = parseCategoryDefinition(app.categoryFormVersion.definition);
    let formData = patch.formData ?? asFormData(app.formData);
    if (patch.categoryId && patch.categoryId !== app.categoryId) {
      if (app.status !== ApplicationStatus.DRAFT) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "送件後不能變更類別");
      const category = await tx.applicationCategory.findUnique({
        where: { id: patch.categoryId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
      });
      const version = category?.versions[0];
      if (!category || !version) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到申請類別");
      categoryFormVersionId = version.id;
      definition = parseCategoryDefinition(version.definition);
      const allowed = new Set(definition.fields.map((field) => field.key));
      formData = Object.fromEntries(Object.entries(formData).filter(([key]) => allowed.has(key)));
      const allowedFiles = new Set(definition.attachmentRequirements.map((item) => item.key));
      await tx.applicationAttachment.updateMany({
        where: { applicationId: id, removedAt: null, requirementKey: { notIn: [...allowedFiles] } },
        data: { removedAt: new Date() },
      });
    }
    const next = {
      ...contentOf(app),
      ...(patch.organizationName !== undefined ? { organizationName: patch.organizationName } : {}),
      ...(patch.taxId !== undefined ? { taxId: patch.taxId } : {}),
      ...(patch.contactName !== undefined ? { contactName: patch.contactName } : {}),
      ...(patch.contactPhone !== undefined ? { contactPhone: patch.contactPhone } : {}),
      ...(patch.contactEmail !== undefined ? { contactEmail: patch.contactEmail } : {}),
      ...(patch.organizationAddress !== undefined ? { organizationAddress: patch.organizationAddress } : {}),
      ...(patch.siteName !== undefined ? { siteName: patch.siteName } : {}),
      ...(patch.siteAddress !== undefined ? { siteAddress: patch.siteAddress } : {}),
      ...(patch.applicationDescription !== undefined ? { applicationDescription: patch.applicationDescription } : {}),
      ...(patch.declarationAccepted !== undefined ? { declarationAccepted: patch.declarationAccepted } : {}),
      formData,
    };
    const issues = validateDraft(next, definition);
    if (issues.length) fieldFailure(issues);
    const updated = await tx.application.updateMany({
      where: { id, version: patch.expectedVersion },
      data: {
        categoryId: patch.categoryId ?? app.categoryId,
        categoryFormVersionId,
        organizationNameSnapshot: next.organizationName,
        taxIdSnapshot: next.taxId,
        contactNameSnapshot: next.contactName,
        contactPhoneSnapshot: next.contactPhone,
        contactEmailSnapshot: next.contactEmail,
        organizationAddressSnapshot: next.organizationAddress,
        siteName: next.siteName,
        siteAddress: next.siteAddress,
        applicationDescription: next.applicationDescription,
        declarationAccepted: next.declarationAccepted,
        formData: next.formData,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    return { version: app.version + 1, updatedAt: new Date().toISOString() };
  });
}

async function writeSubmission(env: Env, actor: Actor, id: string, action: typeof ApplicationAction.SUBMIT | typeof ApplicationAction.RESUBMIT, expectedVersion: number, requestId: string) {
  const requestHash = await sha256Hex(JSON.stringify({ action, expectedVersion, id }));
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.applicationEvent.findUnique({ where: { applicationId_requestId: { applicationId: id, requestId } } });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ApiError(409, ErrorCodes.VALIDATION_ERROR, "相同 requestId 的內容不一致");
      return { replay: true as const, jobId: null, email: null };
    }
    const app = await tx.application.findUnique({
      where: { id },
      include: { categoryFormVersion: true, attachments: { where: { removedAt: null } }, createdBy: true },
    });
    if (!app || !canViewApplication(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
    const transition = resolveTransition({
      action,
      status: app.status,
      resumeStatus: app.resumeStatus,
      role: actor.role,
      isAssignee: app.assignedToId === actor.id,
      hasAssignee: Boolean(app.assignedToId),
    });
    if (!transition.ok) throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, transition.message);
    if (app.version !== expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    const definition = parseCategoryDefinition(app.categoryFormVersion.definition);
    if (app.categoryFormVersion.configurationStatus !== ConfigurationStatus.CONFIRMED && !env.DEMO_MODE) {
      throw new ApiError(409, ErrorCodes.CATEGORY_NOT_CONFIRMED, "此類別仍是示範或未確認設定，正式環境不能送件");
    }
    const content = contentOf(app);
    const issues = validateSubmit(content, definition, app.attachments.map((item) => item.requirementKey));
    if (issues.length) fieldFailure(issues);
    const revision = (await tx.applicationSubmission.count({ where: { applicationId: id } })) + 1;
    const changed = await tx.application.updateMany({
      where: { id, version: expectedVersion, status: app.status },
      data: {
        status: transition.toStatus,
        resumeStatus: transition.nextResumeStatus,
        version: { increment: 1 },
        submittedAt: app.submittedAt ?? new Date(),
      },
    });
    if (changed.count !== 1) {
      const raced = await tx.applicationEvent.findUnique({ where: { applicationId_requestId: { applicationId: id, requestId } } });
      if (raced?.requestHash === requestHash) return { replay: true as const, jobId: null, email: null };
      throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    }
    const submission = await tx.applicationSubmission.create({
      data: {
        applicationId: id,
        revision,
        submittedById: actor.id,
        submittedAt: new Date(),
        formVersionId: app.categoryFormVersionId,
        payloadSnapshot: snapshotPayload(content, app.categoryFormVersionId) as Prisma.InputJsonValue,
        attachmentIdsSnapshot: app.attachments.map((item) => item.id),
      },
    });
    await tx.applicationEvent.create({
      data: {
        applicationId: id,
        submissionId: submission.id,
        actorId: actor.id,
        action,
        fromStatus: app.status,
        toStatus: transition.toStatus,
        requestId,
        requestHash,
      },
    });
    const job = await tx.notificationJob.create({
      data: {
        dedupeKey: `submission:${id}:${revision}`,
        type: "SUBMISSION_CONFIRMATION",
        recipientUserId: actor.id,
        recipientEmail: actor.email,
        applicationId: id,
        status: "PENDING",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action,
        entityType: "Application",
        entityId: id,
        requestId,
        safeChanges: { fromStatus: app.status, toStatus: transition.toStatus, revision },
      },
    });
    return { replay: false as const, jobId: job.id, email: actor.email };
  });
  if (result.jobId) await deliverNotification(env, result.jobId, `案件已更新，請登入查看。`);
  return getApplication(actor, id);
}

export function submitApplication(env: Env, actor: Actor, id: string, expectedVersion: number, requestId: string) {
  return writeSubmission(env, actor, id, ApplicationAction.SUBMIT, expectedVersion, requestId);
}

export function resubmitApplication(env: Env, actor: Actor, id: string, expectedVersion: number, requestId: string) {
  return writeSubmission(env, actor, id, ApplicationAction.RESUBMIT, expectedVersion, requestId);
}

export async function listEvents(actor: Actor, id: string) {
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app || !canViewApplication(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
  const events = await prisma.applicationEvent.findMany({
    where: { applicationId: id },
    include: { actor: true },
    orderBy: { createdAt: "asc" },
  });
  const showInternal = actor.role !== UserRole.APPLICANT;
  return events.map((event) => ({
    id: event.id,
    action: event.action,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    publicComment: event.publicComment,
    internalNote: showInternal ? event.internalNote : null,
    actorId: event.actorId,
    actorName: event.actor.displayName,
    createdAt: event.createdAt.toISOString(),
  }));
}

export async function listSubmissions(actor: Actor, id: string) {
  const app = await prisma.application.findUnique({ where: { id } });
  if (!app || !canViewApplication(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
  const rows = await prisma.applicationSubmission.findMany({ where: { applicationId: id }, orderBy: { revision: "asc" } });
  return rows.map((row) => ({
    id: row.id,
    revision: row.revision,
    submittedAt: row.submittedAt.toISOString(),
    formVersionId: row.formVersionId,
    payloadSnapshot: row.payloadSnapshot as Record<string, unknown>,
    attachmentIdsSnapshot: Array.isArray(row.attachmentIdsSnapshot) ? row.attachmentIdsSnapshot.map(String) : [],
  }));
}

export async function assignApplication(actor: Actor, id: string, assignedToId: string, expectedVersion: number, requestId: string) {
  if (actor.role !== UserRole.ADMIN) throw new ApiError(403, ErrorCodes.FORBIDDEN, "只有管理員可以派案");
  const requestHash = await sha256Hex(JSON.stringify({ action: "ASSIGN", assignedToId, expectedVersion }));
  await prisma.$transaction(async (tx) => {
    const existing = await tx.applicationEvent.findUnique({ where: { applicationId_requestId: { applicationId: id, requestId } } });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ApiError(409, ErrorCodes.VALIDATION_ERROR, "相同 requestId 的內容不一致");
      return;
    }
    const assignee = await tx.user.findUnique({ where: { id: assignedToId } });
    if (!assignee || !assignee.isActive || (assignee.role !== UserRole.CASE_OFFICER && assignee.role !== UserRole.ADMIN)) {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "承辦人必須是啟用中的承辦或管理員");
    }
    const app = await tx.application.findUnique({ where: { id } });
    if (!app) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
    if (app.status === ApplicationStatus.DRAFT) throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, "草稿尚未送件，不能派案");
    const changed = await tx.application.updateMany({
      where: { id, version: expectedVersion },
      data: { assignedToId, version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    await tx.applicationEvent.create({
      data: {
        applicationId: id,
        actorId: actor.id,
        action: ApplicationAction.ASSIGN,
        fromStatus: app.status,
        toStatus: app.status,
        publicComment: `已指派承辦：${assignee.displayName}`,
        requestId,
        requestHash,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ASSIGN",
        entityType: "Application",
        entityId: id,
        requestId,
        safeChanges: { assignedToId },
      },
    });
  });
  return getApplication(actor, id);
}

export async function reviewApplication(
  env: Env,
  actor: Actor,
  id: string,
  input: { action: string; expectedVersion: number; requestId: string; publicComment?: string; internalNote?: string },
) {
  const action = input.action as ApplicationAction;
  const requestHash = await sha256Hex(JSON.stringify(input));
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.applicationEvent.findUnique({ where: { applicationId_requestId: { applicationId: id, requestId: input.requestId } } });
    if (existing) {
      if (existing.requestHash !== requestHash) throw new ApiError(409, ErrorCodes.VALIDATION_ERROR, "相同 requestId 的內容不一致");
      return { jobId: null as string | null };
    }
    const app = await tx.application.findUnique({ where: { id }, include: { createdBy: true } });
    if (!app || !canViewApplication(actor, app)) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
    const transition = resolveTransition({
      action,
      status: app.status,
      resumeStatus: app.resumeStatus,
      role: actor.role,
      isAssignee: app.assignedToId === actor.id,
      hasAssignee: Boolean(app.assignedToId),
    });
    if (!transition.ok) throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, transition.message);
    const requirement = commentRequirement(action);
    if (requirement === "public" && !input.publicComment?.trim()) fieldFailure([{ path: "publicComment", message: "請填寫公開意見" }]);
    if (requirement === "review" && !input.publicComment?.trim() && !input.internalNote?.trim()) {
      fieldFailure([{ path: "publicComment", message: "請填寫審查意見" }]);
    }
    const changed = await tx.application.updateMany({
      where: { id, version: input.expectedVersion, status: app.status },
      data: {
        status: transition.toStatus,
        resumeStatus: transition.nextResumeStatus,
        version: { increment: 1 },
        decidedAt: transition.toStatus === ApplicationStatus.APPROVED || transition.toStatus === ApplicationStatus.REJECTED ? new Date() : app.decidedAt,
      },
    });
    if (changed.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "資料已被更新，請重新載入");
    await tx.applicationEvent.create({
      data: {
        applicationId: id,
        actorId: actor.id,
        action,
        fromStatus: app.status,
        toStatus: transition.toStatus,
        publicComment: input.publicComment?.trim() || null,
        internalNote: input.internalNote?.trim() || null,
        requestId: input.requestId,
        requestHash,
      },
    });
    let jobId: string | null = null;
    const notify =
      action === ApplicationAction.REQUEST_SUPPLEMENT ||
      action === ApplicationAction.APPROVE ||
      action === ApplicationAction.REJECT;
    if (notify) {
      const job = await tx.notificationJob.create({
        data: {
          dedupeKey: `${action}:${id}:${input.requestId}`,
          type: action === ApplicationAction.REQUEST_SUPPLEMENT ? "SUPPLEMENT_REQUEST" : "DECISION_RESULT",
          recipientUserId: app.createdById,
          recipientEmail: app.createdBy.email,
          applicationId: id,
          status: "PENDING",
        },
      });
      jobId = job.id;
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action,
        entityType: "Application",
        entityId: id,
        requestId: input.requestId,
        safeChanges: { fromStatus: app.status, toStatus: transition.toStatus },
      },
    });
    return { jobId };
  });
  if (result.jobId) await deliverNotification(env, result.jobId, "請登入系統查看案件，信件失敗不影響審核結果。");
  return getApplication(actor, id);
}

export type { Actor };

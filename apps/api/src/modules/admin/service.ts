import {
  ApplicationStatus,
  CourseStatus,
  ErrorCodes,
  ImportBatchStatus,
  ImportBatchType,
  UserRole,
  certificationValidity,
  pageMeta,
  parseCsv,
  rowsToObjects,
  toCsv,
  validateCertificationDates,
  validateDraft,
  parseCategoryDefinition,
  formatApplicationNo,
  sha256Hex,
  taipeiYear,
  type DashboardCounts,
} from "@mf/contracts";
import { prisma } from "@mf/db/server";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { ApiError } from "../../lib/errors";
import { fieldFailure } from "../../lib/http";
import type { SessionActor } from "../../middleware/auth";

async function countStatus(where: { organizationId?: string; assignedToId?: string }) {
  const grouped = await prisma.application.groupBy({ by: ["status"], where, _count: { _all: true } });
  const map = new Map(grouped.map((item) => [item.status, item._count._all]));
  const pick = (status: ApplicationStatus) => map.get(status) ?? 0;
  const upcomingRows = await prisma.course.findMany({
    where: { status: CourseStatus.PUBLISHED, startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
    take: 3,
  });
  const counts: DashboardCounts = {
    draft: pick(ApplicationStatus.DRAFT),
    submitted: pick(ApplicationStatus.SUBMITTED),
    initialReview: pick(ApplicationStatus.INITIAL_REVIEW),
    secondReview: pick(ApplicationStatus.SECOND_REVIEW),
    finalReview: pick(ApplicationStatus.FINAL_REVIEW),
    needSupplement: pick(ApplicationStatus.NEED_SUPPLEMENT),
    approved: pick(ApplicationStatus.APPROVED),
    rejected: pick(ApplicationStatus.REJECTED),
    upcomingCourses: await prisma.course.count({ where: { status: CourseStatus.PUBLISHED, startsAt: { gt: new Date() } } }),
    upcoming: upcomingRows.map((course) => ({
      id: course.id,
      title: course.title,
      startsAt: course.startsAt.toISOString(),
      location: course.location,
    })),
  };
  return counts;
}

export function summaryFor(actor: SessionActor) {
  if (actor.role === UserRole.APPLICANT) return countStatus({ organizationId: actor.organizationId ?? undefined });
  if (actor.role === UserRole.CASE_OFFICER) return countStatus({ assignedToId: actor.id });
  return countStatus({});
}

export async function listUsers(query: string | undefined, page: number, pageSize: number) {
  const where = query
    ? { OR: [{ email: { contains: query, mode: "insensitive" as const } }, { displayName: { contains: query, mode: "insensitive" as const } }] }
    : {};
  const [total, rows] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, include: { organization: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return {
    items: rows.map((user) => ({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: user.organization?.organizationName ?? null,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
    })),
    meta: pageMeta(page, pageSize, total),
  };
}

export async function createStaff(actor: SessionActor, input: { email: string; displayName: string; password: string; role: "CASE_OFFICER" | "ADMIN" }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "Email 已存在");
  const user = await prisma.user.create({
    data: { email, displayName: input.displayName, passwordHash: await bcrypt.hash(input.password, 10), role: input.role },
  });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "USER_CREATE", entityType: "User", entityId: user.id, requestId: user.id, safeChanges: { role: user.role, email } },
  });
  return { id: user.id, email: user.email, role: user.role };
}

export async function updateStaff(actor: SessionActor, id: string, input: { displayName?: string; role?: "CASE_OFFICER" | "ADMIN"; isActive?: boolean }) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.role === UserRole.APPLICANT) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到內部帳號");
  const nextRole = input.role ?? user.role;
  const nextActive = input.isActive ?? user.isActive;
  if (user.role === UserRole.ADMIN && user.isActive && (nextRole !== UserRole.ADMIN || !nextActive)) {
    const others = await prisma.user.count({ where: { role: UserRole.ADMIN, isActive: true, id: { not: user.id } } });
    if (others === 0) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "不能停用或調降最後一位管理員");
  }
  const updated = await prisma.user.update({
    where: { id },
    data: { displayName: input.displayName ?? user.displayName, role: nextRole, isActive: nextActive },
  });
  if (!updated.isActive) await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "USER_UPDATE", entityType: "User", entityId: id, requestId: id, safeChanges: { role: updated.role, isActive: updated.isActive } },
  });
  return { id: updated.id, isActive: updated.isActive, role: updated.role };
}

export async function listOrganizations(query: string | undefined, page: number, pageSize: number) {
  const where = query
    ? { OR: [{ organizationName: { contains: query, mode: "insensitive" as const } }, { taxId: { contains: query } }] }
    : {};
  const [total, rows] = await prisma.$transaction([
    prisma.organization.count({ where }),
    prisma.organization.findMany({ where, orderBy: { organizationName: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return {
    items: rows.map((org) => ({ ...org, createdAt: org.createdAt.toISOString(), updatedAt: org.updatedAt.toISOString() })),
    meta: pageMeta(page, pageSize, total),
  };
}

export async function upsertCertification(actor: SessionActor, applicationId: string, input: { certificateNo: string; issuedOnDate: string; validUntilDate: string }) {
  const issues = validateCertificationDates(input.issuedOnDate, input.validUntilDate);
  if (issues.length) fieldFailure(issues);
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { organization: true } });
  if (!app) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到案件");
  if (app.status !== ApplicationStatus.APPROVED) throw new ApiError(409, ErrorCodes.INVALID_TRANSITION, "只有已核定案件可以登錄證書");
  const saved = await prisma.certification.upsert({
    where: { applicationId },
    create: { ...input, applicationId, registeredById: actor.id },
    update: { ...input, registeredById: actor.id },
  });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "CERTIFICATION_SAVE", entityType: "Certification", entityId: saved.id, requestId: saved.id, safeChanges: { certificateNo: saved.certificateNo, validUntilDate: saved.validUntilDate } },
  });
  const validity = certificationValidity(saved);
  return {
    id: saved.id,
    applicationId,
    applicationNo: app.applicationNo,
    organizationName: app.organization.organizationName,
    certificateNo: saved.certificateNo,
    issuedOnDate: saved.issuedOnDate,
    validUntilDate: saved.validUntilDate,
    isCurrent: validity.isCurrent,
    validityLabel: validity.label,
    registeredAt: saved.registeredAt.toISOString(),
  };
}

export async function myCertifications(actor: SessionActor) {
  const rows = await prisma.certification.findMany({
    where: { application: { organizationId: actor.organizationId ?? "00000000-0000-0000-0000-000000000000" } },
    include: { application: { include: { organization: true } } },
    orderBy: { registeredAt: "desc" },
  });
  return rows.map((row) => {
    const validity = certificationValidity(row);
    return {
      id: row.id,
      applicationId: row.applicationId,
      applicationNo: row.application.applicationNo,
      organizationName: row.application.organization.organizationName,
      certificateNo: row.certificateNo,
      issuedOnDate: row.issuedOnDate,
      validUntilDate: row.validUntilDate,
      isCurrent: validity.isCurrent,
      validityLabel: validity.label,
      registeredAt: row.registeredAt.toISOString(),
    };
  });
}

const orgHeaders = ["organizationName", "taxId", "contactName", "contactPhone", "contactEmail", "address"];
const draftHeaders = ["taxId", "categoryCode", "siteName", "siteAddress", "applicationDescription", "sourceRecordKey"];

export function importTemplate(type: "ORGANIZATIONS" | "APPLICATION_DRAFTS") {
  return toCsv(type === "ORGANIZATIONS" ? orgHeaders : draftHeaders, []);
}

export async function previewImport(actor: SessionActor, type: ImportBatchType, csvText: string) {
  const digest = createHash("sha256").update(csvText).digest("hex");
  const { headers, records } = rowsToObjects(parseCsv(csvText));
  const expected = type === ImportBatchType.ORGANIZATIONS ? orgHeaders : draftHeaders;
  const rows = [];
  for (const [index, record] of records.entries()) {
    const messages: string[] = [];
    if (expected.some((header) => !headers.includes(header))) messages.push(`標題需包含：${expected.join(", ")}`);
    if (type === ImportBatchType.ORGANIZATIONS) {
      if (!/^\d{8}$/.test(record.taxId ?? "")) messages.push("taxId 暫定需為 8 位數字");
      if (!record.organizationName) messages.push("organizationName 必填");
    } else if (!record.taxId || !record.categoryCode || !record.sourceRecordKey) {
      messages.push("taxId、categoryCode、sourceRecordKey 必填");
    }
    rows.push({ rowNumber: index + 2, ok: messages.length === 0, messages, preview: record });
  }
  const batch = await prisma.importBatch.create({
    data: {
      type,
      fileDigest: digest,
      createdById: actor.id,
      status: ImportBatchStatus.PREVIEWED,
      rowCount: records.length,
      resultSummary: { rows, records, ready: rows.every((row) => row.ok) && records.length > 0 },
    },
  });
  return { id: batch.id, type, status: batch.status, rowCount: records.length, errorCount: rows.filter((row) => !row.ok).length, rows };
}

export async function commitImport(actor: SessionActor, id: string, requestId: string) {
  const existing = await prisma.importBatch.findUnique({ where: { id } });
  if (!existing || existing.createdById !== actor.id) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到匯入批次");
  if (existing.status === ImportBatchStatus.COMMITTED && existing.commitKey === requestId) {
    return existing.resultSummary;
  }
  if (existing.status === ImportBatchStatus.COMMITTED) throw new ApiError(409, ErrorCodes.VALIDATION_ERROR, "此批次已匯入");
  const summary = existing.resultSummary as { ready?: boolean; records?: Record<string, string>[] };
  if (!summary.ready || !summary.records) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "預覽仍有錯誤，尚未寫入");
  try {
    await prisma.$transaction(async (tx) => {
      if (existing.type === ImportBatchType.ORGANIZATIONS) {
        for (const record of summary.records ?? []) {
          await tx.organization.create({
            data: {
              organizationName: record.organizationName ?? "",
              taxId: record.taxId,
              contactName: record.contactName || null,
              contactPhone: record.contactPhone || null,
              contactEmail: record.contactEmail || null,
              address: record.address || null,
            },
          });
        }
      } else {
        for (const record of summary.records ?? []) {
          const organization = await tx.organization.findUnique({ where: { taxId: record.taxId ?? "" } });
          const category = await tx.applicationCategory.findUnique({
            where: { code: record.categoryCode ?? "" },
            include: { versions: { orderBy: { version: "desc" }, take: 1 } },
          });
          const version = category?.versions[0];
          if (!organization || !version) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, `找不到業者或類別：${record.taxId} / ${record.categoryCode}`);
          const owner = await tx.user.findFirst({ where: { organizationId: organization.id, role: UserRole.APPLICANT } });
          if (!owner) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "此業者尚無申請人帳號，不能建立草稿");
          const rows = await tx.$queryRawUnsafe<Array<{ nextval: number }>>(`SELECT nextval('application_no_seq')::int AS nextval`);
          const definition = parseCategoryDefinition(version.definition);
          const content = {
            organizationName: organization.organizationName,
            taxId: organization.taxId,
            contactName: organization.contactName,
            contactPhone: organization.contactPhone,
            contactEmail: organization.contactEmail,
            organizationAddress: organization.address,
            siteName: record.siteName || null,
            siteAddress: record.siteAddress || null,
            applicationDescription: record.applicationDescription || null,
            declarationAccepted: false,
            formData: {},
          };
          const issues = validateDraft(content, definition);
          if (issues.length) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, issues.map((issue) => issue.message).join("；"));
          await tx.application.create({
            data: {
              applicationNo: formatApplicationNo(taipeiYear(), rows[0]?.nextval ?? 0),
              organizationId: organization.id,
              createdById: owner.id,
              categoryId: category.id,
              categoryFormVersionId: version.id,
              status: ApplicationStatus.DRAFT,
              organizationNameSnapshot: content.organizationName,
              taxIdSnapshot: content.taxId,
              contactNameSnapshot: content.contactName,
              contactPhoneSnapshot: content.contactPhone,
              contactEmailSnapshot: content.contactEmail,
              organizationAddressSnapshot: content.organizationAddress,
              siteName: content.siteName,
              siteAddress: content.siteAddress,
              applicationDescription: content.applicationDescription,
              sourceSystem: "CSV_IMPORT",
              sourceRecordKey: record.sourceRecordKey,
              formData: {},
            },
          });
        }
      }
      await tx.importBatch.update({
        where: { id },
        data: { status: ImportBatchStatus.COMMITTED, commitKey: requestId, resultSummary: { ...summary, committed: summary.records?.length ?? 0 } },
      });
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "整批未匯入。請確認統編、類別與 sourceRecordKey 沒有重複。");
  }
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "IMPORT_COMMIT", entityType: "ImportBatch", entityId: id, requestId, safeChanges: { type: existing.type, rowCount: existing.rowCount } },
  });
  const saved = await prisma.importBatch.findUnique({ where: { id } });
  return saved?.resultSummary ?? { committed: 0 };
}

export async function exportApplications(actor: SessionActor) {
  const where = actor.role === UserRole.ADMIN ? {} : { assignedToId: actor.id };
  const rows = await prisma.application.findMany({ where, include: { organization: true, category: true }, orderBy: { applicationNo: "asc" }, take: 5000 });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "EXPORT_APPLICATIONS", entityType: "Application", requestId: await sha256Hex(`${actor.id}:${rows.length}`), safeChanges: { count: rows.length } },
  });
  return toCsv(
    ["applicationNo", "organizationName", "taxId", "categoryCode", "status", "submittedAt"],
    rows.map((row) => [row.applicationNo, row.organization.organizationName, row.taxIdSnapshot ?? "", row.category.code, row.status, row.submittedAt?.toISOString() ?? ""]),
  );
}

export async function listAudit(page: number, pageSize: number) {
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({ include: { actor: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return {
    items: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorName: row.actor?.displayName ?? null,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      requestId: row.requestId,
      safeChanges: (row.safeChanges ?? {}) as Record<string, unknown>,
      createdAt: row.createdAt.toISOString(),
    })),
    meta: pageMeta(page, pageSize, total),
  };
}

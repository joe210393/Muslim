import {
  ErrorCodes,
  UserRole,
  applicationStatusLabels,
  attendanceStatusLabels,
  contractStatusLabels,
  enrollmentStatusLabels,
  countReportValues,
  reportFieldsFor,
  reportPreviewSchema,
  reportSelectionsSchema,
  savedReportSchema,
  reportSectionsCsv,
  sourceLabel,
  type ReportPreview,
  type ReportSelection,
  type ReportSource,
  type SavedReport,
  type SavedReportWrite,
} from "@mf/contracts";
import { Prisma, prisma } from "@mf/db/server";
import { ApiError } from "../../lib/errors";
import type { SessionActor } from "../../middleware/auth";
import { officerCaseWhere } from "../applications/service";

function text(value: string | null | undefined) {
  return value ?? "";
}

function when(value: Date | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(value);
}

function named<T extends string>(map: Record<T, { label: string }>, value: T | null | undefined) {
  if (!value) return "";
  return map[value]?.label ?? value;
}

function present(report: { id: string; name: string; selections: Prisma.JsonValue; chartKind: string; chartField: string; version: number; updatedAt: Date }): SavedReport {
  return savedReportSchema.parse({
    id: report.id,
    name: report.name,
    selections: report.selections,
    chartKind: report.chartKind,
    chartField: report.chartField,
    version: report.version,
    updatedAt: report.updatedAt.toISOString(),
  });
}

export async function listReports(): Promise<SavedReport[]> {
  const rows = await prisma.savedReport.findMany({ orderBy: { updatedAt: "desc" } });
  return rows.map(present);
}

export async function saveReport(actor: SessionActor, input: SavedReportWrite, id?: string): Promise<SavedReport> {
  try {
    if (!id) {
      const created = await prisma.savedReport.create({
        data: { name: input.name, selections: input.selections, chartKind: input.chartKind, chartField: input.chartField, createdById: actor.id },
      });
      await prisma.auditLog.create({
        data: { actorId: actor.id, action: "REPORT_CREATE", entityType: "SavedReport", entityId: created.id, requestId: created.id, safeChanges: { name: created.name, selections: created.selections, chartKind: created.chartKind } },
      });
      return present(created);
    }
    const current = await prisma.savedReport.findUnique({ where: { id } });
    if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到報表");
    if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
      throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "這份報表已被其他人更新，請重新載入");
    }
    const updated = await prisma.savedReport.update({
      where: { id },
      data: { name: input.name, selections: input.selections, chartKind: input.chartKind, chartField: input.chartField, version: { increment: 1 } },
    });
    await prisma.auditLog.create({
      data: { actorId: actor.id, action: "REPORT_UPDATE", entityType: "SavedReport", entityId: updated.id, requestId: updated.id, safeChanges: { name: updated.name, selections: updated.selections, chartKind: updated.chartKind } },
    });
    return present(updated);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "這個報表名稱已經用過");
    }
    throw error;
  }
}

export async function deleteReport(actor: SessionActor, id: string) {
  const current = await prisma.savedReport.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到報表");
  await prisma.savedReport.delete({ where: { id } });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "REPORT_DELETE", entityType: "SavedReport", entityId: id, requestId: id, safeChanges: { name: current.name } },
  });
}

async function rowsFor(actor: SessionActor, source: ReportSource): Promise<Array<Record<string, string>>> {
  if (source === "APPLICATION") {
    const rows = await prisma.application.findMany({
      where: actor.role === UserRole.ADMIN ? {} : officerCaseWhere(actor.id),
      include: { category: true, organization: true, assignedTo: true },
      orderBy: { applicationNo: "asc" },
      take: 5000,
    });
    return rows.map((row) => ({
      applicationNo: row.applicationNo,
      status: named(applicationStatusLabels, row.status),
      categoryName: row.category.name,
      organizationName: text(row.organizationNameSnapshot ?? row.organization.organizationName),
      taxId: text(row.taxIdSnapshot ?? row.organization.taxId),
      contactName: text(row.contactNameSnapshot ?? row.organization.contactName),
      contactPhone: text(row.contactPhoneSnapshot ?? row.organization.contactPhone),
      contactEmail: text(row.contactEmailSnapshot ?? row.organization.contactEmail),
      organizationAddress: text(row.organizationAddressSnapshot ?? row.organization.address),
      siteName: text(row.siteName),
      siteAddress: text(row.siteAddress),
      applicationDescription: text(row.applicationDescription),
      assignedToName: text(row.assignedTo?.displayName),
      submittedAt: when(row.submittedAt),
      decidedAt: when(row.decidedAt),
      createdAt: when(row.createdAt),
    }));
  }
  if (source === "ORGANIZATION") {
    const rows = await prisma.organization.findMany({ orderBy: { organizationName: "asc" }, take: 5000 });
    return rows.map((row) => ({
      organizationName: row.organizationName,
      taxId: text(row.taxId),
      contactName: text(row.contactName),
      contactPhone: text(row.contactPhone),
      contactEmail: text(row.contactEmail),
      address: text(row.address),
    }));
  }
  if (source === "ENROLLMENT") {
    const rows = await prisma.enrollment.findMany({
      include: { course: true, user: { include: { organization: true } } },
      orderBy: { enrolledAt: "desc" },
      take: 5000,
    });
    return rows.map((row) => ({
      courseTitle: row.course.title,
      courseStartsAt: when(row.course.startsAt),
      location: text(row.course.location),
      userName: row.user.displayName,
      userEmail: row.user.email,
      organizationName: text(row.user.organization?.organizationName),
      enrollmentStatus: named(enrollmentStatusLabels, row.status),
      attendanceStatus: named(attendanceStatusLabels, row.attendanceStatus),
      attendedMinutes: row.attendedMinutes === null ? "" : String(row.attendedMinutes),
    }));
  }
  const rows = await prisma.contractRecord.findMany({
    include: { organization: true },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });
  return rows.map((row) => ({
    contractNo: row.contractNo,
    organizationName: row.organization.organizationName,
    title: row.title,
    status: named(contractStatusLabels, row.status),
    signerName: text(row.signerName),
    signerTitle: text(row.signerTitle),
    signedAt: when(row.signedAt),
    createdAt: when(row.createdAt),
  }));
}

const PREVIEW_ROWS = 100;

function sectionOf(selection: ReportSelection, rows: Array<Record<string, string>>) {
  const fields = selection.fieldKeys
    .map((key) => reportFieldsFor(selection.source).find((field) => field.key === key))
    .filter((field) => field !== undefined);
  return {
    source: selection.source,
    label: sourceLabel(selection.source),
    columns: fields.map((field) => ({ key: field.key, label: field.label })),
    rows: rows.slice(0, PREVIEW_ROWS).map((row) => Object.fromEntries(fields.map((field) => [field.key, row[field.key] ?? ""]))),
    total: rows.length,
    groups: fields.map((field) => ({ fieldKey: field.key, label: field.label, points: countReportValues(rows, field.key) })),
  };
}

export async function previewReport(actor: SessionActor, selections: ReportSelection[]): Promise<ReportPreview> {
  const parsed = reportSelectionsSchema.parse(selections);
  const sections = [];
  for (const selection of parsed) {
    sections.push(sectionOf(selection, await rowsFor(actor, selection.source)));
  }
  return reportPreviewSchema.parse({ sections });
}

export async function exportReport(actor: SessionActor, id: string) {
  const report = await prisma.savedReport.findUnique({ where: { id } });
  if (!report) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到報表");
  const stored = present(report);
  const blocks = [];
  for (const selection of stored.selections) {
    const fields = selection.fieldKeys
      .map((key) => reportFieldsFor(selection.source).find((field) => field.key === key))
      .filter((field) => field !== undefined);
    const rows = await rowsFor(actor, selection.source);
    blocks.push({
      title: sourceLabel(selection.source),
      headers: fields.map((field) => field.label),
      rows: rows.map((row) => fields.map((field) => row[field.key] ?? "")),
    });
  }
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "REPORT_EXPORT", entityType: "SavedReport", entityId: report.id, requestId: report.id, safeChanges: { name: report.name, sections: blocks.length } },
  });
  return reportSectionsCsv(blocks);
}

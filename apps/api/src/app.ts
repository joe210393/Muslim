import {
  APP_NAME,
  COURSE_VIDEO_MAX_BYTES,
  DEMO_CONTACT_EMAIL,
  FILE_POLICY,
  ErrorCodes,
  UserRole,
  applicationListQuerySchema,
  applicationPatchSchema,
  assignApplicationSchema,
  attendancePatchSchema,
  watchProgressSchema,
  certificationWriteSchema,
  changePasswordRequestSchema,
  courseWriteSchema,
  createApplicationSchema,
  createStaffUserSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  organizationPatchSchema,
  paginationQuerySchema,
  auditListQuerySchema,
  registerRequestSchema,
  resetPasswordRequestSchema,
  reviewActionSchema,
  saveFieldReviewsSchema,
  submitApplicationSchema,
  updateStaffUserSchema,
  parseCategoryDefinition,
  siteContentWriteSchema,
  contractTemplateCreateSchema,
  contractTemplateWriteSchema,
  issueContractSchema,
  contractRenewalSchema,
  signContractFieldsSchema,
  featureToggleSchema,
  integrationWriteSchema,
  contentSlotSchema,
  savedReportWriteSchema,
  reportPreviewRequestSchema,
  servicePlanWriteSchema,
  servicePlanUpdateSchema,
  paymentRecordWriteSchema,
} from "@mf/contracts";
import { getEnv, repoRoot } from "./config/env";
import { prisma } from "@mf/db/server";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import multer from "multer";
import path from "node:path";
import { z } from "zod";
import { ApiError } from "./lib/errors";
import { errorMiddleware, ok, route } from "./lib/http";
import { csrfGuard, isStaff, loadActor, requireActor, requireRoles } from "./middleware/auth";
import * as admin from "./modules/admin/service";
import * as applications from "./modules/applications/service";
import * as auth from "./modules/auth/service";
import * as files from "./modules/files/service";
import * as training from "./modules/training/service";
import * as access from "./modules/platform/access";
import * as siteContent from "./modules/platform/content";
import * as contracts from "./modules/platform/contracts";
import * as reports from "./modules/reports/service";
import * as payments from "./modules/payments/service";
import { createStorage } from "./storage/storage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: FILE_POLICY.maxFileBytes } });
const uploadVideo = multer({ storage: multer.memoryStorage(), limits: { fileSize: COURSE_VIDEO_MAX_BYTES } });

export function createApp() {
  const env = getEnv();
  const storage = createStorage(path.resolve(repoRoot(), env.UPLOAD_ROOT));
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: env.APP_ENV === "production" ? env.APP_BASE_URL : env.WEB_DEV_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use((req, res, next) => {
    const requestId = req.header("x-request-id") ?? crypto.randomUUID();
    Object.assign(req, { requestId });
    res.setHeader("x-request-id", requestId);
    next();
  });

  app.get("/health/live", (_req, res) => res.json({ ok: true }));
  app.get("/health/ready", route(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  }));

  const api = express.Router();
  api.use(csrfGuard);

  api.get("/public-config", route(async (req, res) => {
    ok(res, req, {
      appName: APP_NAME,
      dataMode: "api" as const,
      demoMode: env.DEMO_MODE,
      maxFileBytes: FILE_POLICY.maxFileBytes,
      maxApplicationBytes: FILE_POLICY.maxApplicationBytes,
      allowedMimeTypes: [...FILE_POLICY.allowedMimeTypes],
      contactEmail: DEMO_CONTACT_EMAIL,
      contactNote: "聯絡資訊為占位，正式窗口待確認。",
    });
  }));

  api.get("/auth/csrf", route(async (req, res) => ok(res, req, { csrfToken: auth.setCsrfCookie(res, env) })));
  api.post("/auth/register", route(async (req, res) => ok(res, req, await auth.register(env, res, registerRequestSchema.parse(req.body), req.ip ?? "local"))));
  api.post("/auth/login", route(async (req, res) => ok(res, req, await auth.login(env, res, loginRequestSchema.parse(req.body), req.ip ?? "local"))));
  api.post("/auth/logout", route(async (req, res) => {
    await auth.logout(res, req.cookies?.mf_session);
    ok(res, req, { message: "已登出" });
  }));
  api.get("/auth/me", route(async (req, res) => {
    const actor = await loadActor(req);
    ok(res, req, actor ? await auth.publicUser(actor) : null);
  }));
  api.post("/auth/forgot-password", route(async (req, res) => ok(res, req, await auth.forgotPassword(env, forgotPasswordRequestSchema.parse(req.body), req.ip ?? "local"))));
  api.post("/auth/reset-password", route(async (req, res) => ok(res, req, await auth.resetPassword(resetPasswordRequestSchema.parse(req.body)))));
  api.post("/auth/change-password", route(async (req, res) => ok(res, req, await auth.changePassword(await requireActor(req), changePasswordRequestSchema.parse(req.body)))));

  api.get("/organizations/me", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!actor.organizationId) throw new ApiError(404, ErrorCodes.NOT_FOUND, "此帳號沒有業者資料");
    const org = await prisma.organization.findUnique({ where: { id: actor.organizationId } });
    if (!org) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者資料");
    ok(res, req, { id: org.id, organizationName: org.organizationName, taxId: org.taxId, contactName: org.contactName, contactPhone: org.contactPhone, contactEmail: org.contactEmail, address: org.address, updatedAt: org.updatedAt.toISOString() });
  }));
  api.patch("/organizations/me", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.APPLICANT]);
    if (!actor.organizationId) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者資料");
    const patch = organizationPatchSchema.parse(req.body);
    const org = await prisma.organization.update({ where: { id: actor.organizationId }, data: patch });
    await prisma.auditLog.create({ data: { actorId: actor.id, action: "ORGANIZATION_UPDATE", entityType: "Organization", entityId: org.id, requestId: crypto.randomUUID(), safeChanges: { fields: Object.keys(patch) } } });
    ok(res, req, { id: org.id, organizationName: org.organizationName, taxId: org.taxId, contactName: org.contactName, contactPhone: org.contactPhone, contactEmail: org.contactEmail, address: org.address, updatedAt: org.updatedAt.toISOString() });
  }));

  api.get("/application-categories", route(async (req, res) => {
    const categories = await prisma.applicationCategory.findMany({ where: { isActive: true }, include: { versions: { orderBy: { version: "desc" }, take: 1 } }, orderBy: { displayOrder: "asc" } });
    ok(res, req, categories.flatMap((category) => {
      const version = category.versions[0];
      if (!version) return [];
      return [{
        id: category.id,
        code: category.code,
        name: category.name,
        description: category.description,
        isActive: category.isActive,
        displayOrder: category.displayOrder,
        latestVersion: { id: version.id, version: version.version, configurationStatus: version.configurationStatus, definition: parseCategoryDefinition(version.definition) },
      }];
    }));
  }));

  api.get("/applications", route(async (req, res) => {
    const actor = await requireActor(req);
    const query = applicationListQuerySchema.parse(req.query);
    const result = await applications.listApplications(actor, query);
    ok(res, req, result.items, result.meta);
  }));
  api.post("/applications", route(async (req, res) => {
    const actor = await requireActor(req);
    await access.assertFeature(actor, "applications.create");
    ok(res, req, await applications.createDraft(actor, createApplicationSchema.parse(req.body).categoryId));
  }));
  api.get("/applications/:id/events", route(async (req, res) => ok(res, req, await applications.listEvents(await requireActor(req), String(req.params.id)))));
  api.get("/applications/:id/submissions", route(async (req, res) => ok(res, req, await applications.listSubmissions(await requireActor(req), String(req.params.id)))));
  api.post("/applications/:id/submit", route(async (req, res) => {
    const actor = await requireActor(req);
    await access.assertFeature(actor, "applications.create");
    const body = submitApplicationSchema.parse(req.body);
    ok(res, req, await applications.submitApplication(env, actor, String(req.params.id), body.expectedVersion, body.requestId));
  }));
  api.post("/applications/:id/resubmit", route(async (req, res) => {
    const actor = await requireActor(req);
    await access.assertFeature(actor, "applications.create");
    const body = submitApplicationSchema.parse(req.body);
    ok(res, req, await applications.resubmitApplication(env, actor, String(req.params.id), body.expectedVersion, body.requestId));
  }));
  api.post("/applications/:id/attachments", upload.single("file"), route(async (req, res) => {
    if (!req.file) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請選擇檔案");
    const requirementKey = String(req.body.requirementKey ?? "");
    ok(res, req, await files.addAttachment(await requireActor(req), storage, String(req.params.id), requirementKey, req.file));
  }));
  api.delete("/applications/:id/attachments/:attachmentId", route(async (req, res) => {
    ok(res, req, await files.removeAttachment(await requireActor(req), String(req.params.id), String(req.params.attachmentId)));
  }));
  api.get("/applications/:id", route(async (req, res) => ok(res, req, await applications.getApplication(await requireActor(req), String(req.params.id)))));
  api.patch("/applications/:id", route(async (req, res) => {
    const saved = await applications.updateDraft(await requireActor(req), String(req.params.id), applicationPatchSchema.parse(req.body));
    ok(res, req, saved);
  }));

  api.get("/files/:fileId/download", route(async (req, res) => {
    const file = await files.readAuthorizedFile(await requireActor(req), storage, String(req.params.fileId));
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.originalName)}"`);
    res.send(Buffer.from(file.bytes));
  }));

  api.get("/courses", route(async (req, res) => ok(res, req, await training.listCourses("public"))));
  api.get("/courses/:id", route(async (req, res) => ok(res, req, await training.getCourse(null, String(req.params.id)))));
  api.post("/courses/:id/enrollments", route(async (req, res) => ok(res, req, await training.enroll(await requireActor(req), String(req.params.id)))));
  api.post("/enrollments/:id/cancel", route(async (req, res) => ok(res, req, await training.cancelEnrollment(await requireActor(req), String(req.params.id)))));
  api.post("/enrollments/:id/watch", route(async (req, res) => ok(res, req, await training.recordWatch(await requireActor(req), String(req.params.id), watchProgressSchema.parse(req.body)))));
  api.get("/enrollments/:id/video", route(async (req, res) => {
    const file = await training.readCourseVideo(await requireActor(req), storage, String(req.params.id));
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.name)}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(Buffer.from(file.bytes));
  }));
  api.get("/enrollments/mine", route(async (req, res) => ok(res, req, await training.myEnrollments(await requireActor(req)))));
  api.get("/learning-records/mine", route(async (req, res) => ok(res, req, await training.myEnrollments(await requireActor(req)))));
  api.get("/certifications/mine", route(async (req, res) => ok(res, req, await admin.myCertifications(await requireActor(req)))));
  api.get("/portal/summary", route(async (req, res) => ok(res, req, await admin.summaryFor(await requireActor(req)))));

  api.get("/admin/summary", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    ok(res, req, await admin.summaryFor(actor));
  }));
  api.get("/admin/reports", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "reports.export");
    ok(res, req, await reports.listReports());
  }));
  api.post("/admin/reports/preview", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "reports.export");
    ok(res, req, await reports.previewReport(actor, reportPreviewRequestSchema.parse(req.body).selections));
  }));
  api.post("/admin/reports", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "reports.export");
    ok(res, req, await reports.saveReport(actor, savedReportWriteSchema.parse(req.body)));
  }));
  api.patch("/admin/reports/:id", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "reports.export");
    ok(res, req, await reports.saveReport(actor, savedReportWriteSchema.parse(req.body), z.string().uuid().parse(req.params.id)));
  }));
  api.delete("/admin/reports/:id", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "reports.export");
    await reports.deleteReport(actor, z.string().uuid().parse(req.params.id));
    ok(res, req, { message: "已刪除" });
  }));
  api.get("/admin/reports/:id/export", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "reports.export");
    res.type("text/csv; charset=utf-8").send(await reports.exportReport(actor, z.string().uuid().parse(req.params.id)));
  }));
  api.get("/admin/applications/export", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "reports.export");
    res.type("text/csv").send(await admin.exportApplications(actor));
  }));
  api.get("/admin/applications", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    const result = await applications.listApplications(actor, applicationListQuerySchema.parse(req.query));
    ok(res, req, result.items, result.meta);
  }));
  api.get("/admin/applications/:id", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    ok(res, req, await applications.getApplication(actor, String(req.params.id)));
  }));
  api.post("/admin/applications/:id/assign", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "applications.decide");
    const body = assignApplicationSchema.parse(req.body);
    ok(res, req, await applications.assignApplication(actor, String(req.params.id), body.assignedToId, body.expectedVersion, body.requestId));
  }));
  api.post("/admin/applications/:id/actions", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有審查權限");
    await access.assertFeature(actor, "applications.review");
    ok(res, req, await applications.reviewApplication(env, actor, String(req.params.id), reviewActionSchema.parse(req.body)));
  }));
  api.put("/admin/applications/:id/field-reviews", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有審查權限");
    await access.assertFeature(actor, "applications.review");
    const body = saveFieldReviewsSchema.parse(req.body);
    ok(res, req, await applications.saveFieldReviews(actor, String(req.params.id), body.expectedVersion, body.fieldReviews));
  }));
  api.post("/admin/applications/:id/certification", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "applications.decide");
    ok(res, req, await admin.upsertCertification(actor, String(req.params.id), certificationWriteSchema.parse(req.body)));
  }));
  api.patch("/admin/applications/:id/certification", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "applications.decide");
    ok(res, req, await admin.upsertCertification(actor, String(req.params.id), certificationWriteSchema.parse(req.body)));
  }));

  api.get("/admin/courses", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "training.manage");
    ok(res, req, await training.listCourses("manage"));
  }));
  api.post("/admin/courses", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "training.manage");
    ok(res, req, await training.saveCourse(actor, courseWriteSchema.parse(req.body)));
  }));
  api.get("/admin/courses/:id", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "training.manage");
    ok(res, req, await training.getCourse(actor, String(req.params.id)));
  }));
  api.patch("/admin/courses/:id", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "training.manage");
    ok(res, req, await training.saveCourse(actor, courseWriteSchema.parse(req.body), String(req.params.id)));
  }));
  api.post("/admin/courses/:id/video", uploadVideo.single("file"), route(async (req, res) => {
    if (!req.file) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請選擇影片");
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "training.manage");
    const durationSeconds = Number(req.body?.durationSeconds);
    ok(res, req, await training.uploadCourseVideo(actor, storage, String(req.params.id), req.file, durationSeconds));
  }));
  api.post("/admin/courses/:id/image", upload.single("file"), route(async (req, res) => {
    if (!req.file) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請選擇圖片");
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "training.manage");
    ok(res, req, await training.uploadCourseImage(actor, storage, String(req.params.id), req.file));
  }));
  api.get("/admin/courses/:id/enrollments/export", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "reports.export");
    const result = await training.courseEnrollments(actor, String(req.params.id), 1, 50);
    const { toCsv } = await import("@mf/contracts");
    res.type("text/csv").send(toCsv(["userName", "userEmail", "status", "attendanceStatus", "attendedMinutes", "completion"], result.items.map((item) => [item.userName, item.userEmail, item.status, item.attendanceStatus, item.attendedMinutes, item.completion])));
  }));
  api.get("/admin/courses/:id/enrollments", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "training.manage");
    const query = paginationQuerySchema.parse(req.query);
    const result = await training.courseEnrollments(actor, String(req.params.id), query.page, query.pageSize);
    ok(res, req, result.items, result.meta);
  }));
  api.patch("/admin/enrollments/:id/attendance", route(async (req, res) => {
    const actor = await requireActor(req);
    requireRoles(actor, [UserRole.ADMIN, UserRole.CASE_OFFICER]);
    await access.assertFeature(actor, "training.manage");
    ok(res, req, await training.updateAttendance(actor, String(req.params.id), attendancePatchSchema.parse(req.body)));
  }));

  api.get("/admin/users", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "users.manage");
    const query = paginationQuerySchema.parse(req.query);
    const result = await admin.listUsers(typeof req.query.q === "string" ? req.query.q : undefined, query.page, query.pageSize);
    ok(res, req, result.items, result.meta);
  }));
  api.post("/admin/users", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "users.manage");
    ok(res, req, await admin.createStaff(actor, createStaffUserSchema.parse(req.body)));
  }));
  api.patch("/admin/users/:id", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "users.manage");
    ok(res, req, await admin.updateStaff(actor, String(req.params.id), updateStaffUserSchema.parse(req.body)));
  }));
  api.get("/admin/organizations", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "users.manage");
    const query = paginationQuerySchema.parse(req.query);
    const result = await admin.listOrganizations(typeof req.query.q === "string" ? req.query.q : undefined, query.page, query.pageSize);
    ok(res, req, result.items, result.meta);
  }));
  api.get("/admin/organizations/:id", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "users.manage");
    const org = await prisma.organization.findUnique({ where: { id: String(req.params.id) } });
    if (!org) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到業者");
    ok(res, req, { ...org, createdAt: org.createdAt.toISOString(), updatedAt: org.updatedAt.toISOString() });
  }));
  api.get("/admin/imports/template/:type", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "users.manage");
    const type = req.params.type === "APPLICATION_DRAFTS" ? "APPLICATION_DRAFTS" : "ORGANIZATIONS";
    res.type("text/csv").send(admin.importTemplate(type));
  }));
  api.post("/admin/imports/preview", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "users.manage");
    const type = req.body?.type === "APPLICATION_DRAFTS" ? "APPLICATION_DRAFTS" : "ORGANIZATIONS";
    ok(res, req, await admin.previewImport(actor, type, String(req.body?.csv ?? "")));
  }));
  api.post("/admin/imports/:id/commit", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "users.manage");
    const body = z.object({ requestId: z.string().uuid() }).parse(req.body);
    ok(res, req, await admin.commitImport(actor, String(req.params.id), body.requestId));
  }));
  api.get("/admin/audit-logs", route(async (req, res) => {
    const actor = await requireActor(req);
    if (!isStaff(actor.role)) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    await access.assertFeature(actor, "audit.view");
    const query = auditListQuerySchema.parse(req.query);
    const result = await admin.listAudit(query.page, query.pageSize, query.category);
    ok(res, req, result.items, result.meta);
  }));
  api.get("/site-content", route(async (req, res) => ok(res, req, await siteContent.publicSite())));
  api.get("/media/:fileId", route(async (req, res) => {
    const file = await siteContent.readSiteImage(await loadActor(req), storage, String(req.params.fileId));
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.send(Buffer.from(file.bytes));
  }));
  api.get("/site-content/media/:fileId", route(async (req, res) => {
    const file = await siteContent.readSiteImage(await loadActor(req), storage, String(req.params.fileId));
    res.setHeader("Content-Type", file.mimeType);
    res.setHeader("Cache-Control", "private, max-age=60");
    res.send(Buffer.from(file.bytes));
  }));
  api.get("/admin/site-content", route(async (req, res) => ok(res, req, await siteContent.adminSite(await requireActor(req)))));
  api.patch("/admin/site-content/:slot", route(async (req, res) => {
    const slot = contentSlotSchema.parse(req.params.slot);
    ok(res, req, await siteContent.updateSite(await requireActor(req), slot, siteContentWriteSchema.parse(req.body)));
  }));
  api.post("/admin/site-content/:slot/image", upload.single("file"), route(async (req, res) => {
    if (!req.file) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請選擇圖片");
    const slot = contentSlotSchema.parse(req.params.slot);
    ok(res, req, await siteContent.uploadSiteImage(await requireActor(req), storage, slot, req.file));
  }));
  api.get("/admin/editorial", route(async (req, res) => ok(res, req, await siteContent.adminEntries(await requireActor(req)))));
  api.post("/admin/editorial", route(async (req, res) => ok(res, req, await siteContent.createEntry(await requireActor(req), req.body))));
  api.patch("/admin/editorial/:id", route(async (req, res) => ok(res, req, await siteContent.updateEntry(await requireActor(req), String(req.params.id), req.body))));
  api.delete("/admin/editorial/:id", route(async (req, res) => ok(res, req, await siteContent.deleteEntry(await requireActor(req), String(req.params.id)))));
  api.post("/admin/editorial/:id/image", upload.single("file"), route(async (req, res) => {
    if (!req.file) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請選擇圖片");
    ok(res, req, await siteContent.uploadEntryImage(await requireActor(req), storage, String(req.params.id), req.file));
  }));

  api.get("/contracts/mine", route(async (req, res) => ok(res, req, await contracts.listMyContracts(await requireActor(req)))));
  api.get("/contracts/:id/document", route(async (req, res) => {
    const file = await contracts.readContractPdf(await requireActor(req), storage, String(req.params.id));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(file.name)}"`);
    res.send(Buffer.from(file.bytes));
  }));
  api.get("/contracts/:id/signature", route(async (req, res) => {
    const file = await contracts.readContractCapture(await requireActor(req), storage, String(req.params.id), "signature");
    res.setHeader("Content-Type", file.mimeType);
    res.send(Buffer.from(file.bytes));
  }));
  api.get("/contracts/:id/face", route(async (req, res) => {
    const file = await contracts.readContractCapture(await requireActor(req), storage, String(req.params.id), "face");
    res.setHeader("Content-Type", file.mimeType);
    res.send(Buffer.from(file.bytes));
  }));
  api.get("/contracts/:id", route(async (req, res) => ok(res, req, await contracts.getContract(await requireActor(req), String(req.params.id)))));
  api.post("/contracts/:id/renewal", route(async (req, res) => ok(res, req, await contracts.recordRenewal(await requireActor(req), String(req.params.id), contractRenewalSchema.parse(req.body)))));
  api.post("/contracts/:id/sign", upload.fields([{ name: "face", maxCount: 1 }, { name: "signature", maxCount: 1 }]), route(async (req, res) => {
    const uploaded = req.files as { face?: Express.Multer.File[]; signature?: Express.Multer.File[] } | undefined;
    const face = uploaded?.face?.[0];
    const signature = uploaded?.signature?.[0];
    if (!face || !signature) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, "請拍攝人像並手寫簽名");
    const fields = signContractFieldsSchema.parse(req.body);
    ok(res, req, await contracts.signContract(await requireActor(req), storage, repoRoot(), String(req.params.id), fields, face, signature));
  }));

  api.get("/admin/contract-templates", route(async (req, res) => ok(res, req, await contracts.listTemplates(await requireActor(req)))));
  api.post("/admin/contract-templates", route(async (req, res) => ok(res, req, await contracts.createTemplate(await requireActor(req), contractTemplateCreateSchema.parse(req.body)))));
  api.post("/admin/contract-templates/:id/versions", route(async (req, res) => ok(res, req, await contracts.createTemplateVersion(await requireActor(req), String(req.params.id), contractTemplateCreateSchema.parse(req.body)))));
  api.patch("/admin/contract-templates/:id", route(async (req, res) => ok(res, req, await contracts.saveTemplate(await requireActor(req), String(req.params.id), contractTemplateWriteSchema.parse(req.body)))));
  api.get("/admin/contracts", route(async (req, res) => ok(res, req, await contracts.listAdminContracts(await requireActor(req)))));
  api.post("/admin/contracts", route(async (req, res) => {
    const input = issueContractSchema.parse(req.body);
    ok(res, req, await contracts.issueContract(await requireActor(req), input.organizationId, input.templateId));
  }));
  api.get("/admin/contracts/:id", route(async (req, res) => ok(res, req, await contracts.getContract(await requireActor(req), String(req.params.id)))));

  api.post("/payments/checkout", route(async (req, res) => {
    const actor = await requireActor(req);
    const planId = z.string().uuid().parse((req.body as { planId?: unknown } | undefined)?.planId);
    ok(res, req, await payments.startCheckout(actor, planId, env));
  }));
  api.post("/payments/ecpay/notify", async (req, res) => {
    try {
      await payments.applyEcpayNotification(env, req.body);
      res.type("text/plain").send("1|OK");
    } catch {
      res.type("text/plain").send("0|Error");
    }
  });
  api.post("/payments/ecpay/result", async (req, res) => {
    const site = env.APP_ENV === "local" ? env.WEB_DEV_ORIGIN : env.APP_BASE_URL;
    try {
      await payments.applyEcpayNotification(env, req.body);
      res.redirect(303, `${site}/portal/payments?ecpay=received`);
    } catch {
      res.redirect(303, `${site}/portal/payments?ecpay=failed`);
    }
  });
  api.get("/payments", route(async (req, res) => {
    const actor = await requireActor(req);
    if (actor.role !== UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有此操作的權限");
    ok(res, req, await payments.myPayments(actor));
  }));
  api.get("/admin/payments", route(async (req, res) => ok(res, req, await payments.paymentDesk(await requireActor(req)))));
  api.post("/admin/plans", route(async (req, res) => ok(res, req, await payments.createPlan(await requireActor(req), servicePlanWriteSchema.parse(req.body)))));
  api.patch("/admin/plans/:id", route(async (req, res) => ok(res, req, await payments.updatePlan(await requireActor(req), String(req.params.id), servicePlanUpdateSchema.parse(req.body)))));
  api.post("/admin/payments", route(async (req, res) => ok(res, req, await payments.recordPayment(await requireActor(req), paymentRecordWriteSchema.parse(req.body)))));

  api.get("/admin/access", route(async (req, res) => {
    const actor = await requireActor(req);
    await access.assertFeature(actor, "users.manage");
    ok(res, req, await access.listAccess());
  }));
  api.patch("/admin/access/features", route(async (req, res) => ok(res, req, await access.updateFeature(await requireActor(req), featureToggleSchema.parse(req.body)))));
  api.patch("/admin/access/integrations", route(async (req, res) => ok(res, req, await access.updateIntegration(await requireActor(req), integrationWriteSchema.parse(req.body)))));

  api.use((req, res) => {
    res.status(404).json({ success: false, error: { code: ErrorCodes.NOT_FOUND, message: "找不到 API" }, requestId: req.header("x-request-id") ?? "unknown" });
  });

  app.use("/api/v1", api);
  app.use(errorMiddleware);
  return app;
}

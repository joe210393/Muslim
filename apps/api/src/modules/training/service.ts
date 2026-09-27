import {
  AttendanceStatus,
  CourseStatus,
  EnrollmentStatus,
  ErrorCodes,
  UserRole,
  buildLearningRecord,
  canCancelEnrollment,
  canEnroll,
  minutesToHourLabel,
  pageMeta,
  remainingSeats,
  validateAttendance,
  validateCourseDraft,
  type CourseWrite,
} from "@mf/contracts";
import { prisma, type Prisma } from "@mf/db/server";
import { ApiError } from "../../lib/errors";
import { fieldFailure } from "../../lib/http";
import type { SessionActor } from "../../middleware/auth";

function courseDto(course: {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  capacity: number;
  durationMinutes: number;
  requiredAttendanceMinutes: number;
  status: CourseStatus;
  version: number;
}, confirmedCount: number) {
  return {
    id: course.id,
    title: course.title,
    description: course.description,
    location: course.location,
    startsAt: course.startsAt.toISOString(),
    endsAt: course.endsAt.toISOString(),
    registrationOpensAt: course.registrationOpensAt.toISOString(),
    registrationClosesAt: course.registrationClosesAt.toISOString(),
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

async function confirmedCount(courseId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  return tx.enrollment.count({ where: { courseId, status: EnrollmentStatus.CONFIRMED } });
}

export async function listCourses(scope: "public" | "manage") {
  const where: Prisma.CourseWhereInput = scope === "manage" ? {} : { status: { not: CourseStatus.DRAFT } };
  const courses = await prisma.course.findMany({ where, orderBy: { startsAt: "asc" } });
  const counts = await prisma.enrollment.groupBy({
    by: ["courseId"],
    where: { status: EnrollmentStatus.CONFIRMED, courseId: { in: courses.map((course) => course.id) } },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((item) => [item.courseId, item._count._all]));
  return courses.map((course) => courseDto(course, countMap.get(course.id) ?? 0));
}

export async function getCourse(actor: SessionActor | null, id: string) {
  const course = await prisma.course.findUnique({ where: { id } });
  if (!course) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到課程");
  const staff = actor && (actor.role === UserRole.ADMIN || actor.role === UserRole.CASE_OFFICER);
  if (!staff && course.status === CourseStatus.DRAFT) {
    throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到課程");
  }
  return courseDto(course, await confirmedCount(id));
}

export async function saveCourse(actor: SessionActor, input: CourseWrite, id?: string) {
  if (actor.role === UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有課程管理權限");
  const current = id ? await prisma.course.findUnique({ where: { id } }) : null;
  if (id && !current) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到課程");
  if (current && input.expectedVersion !== undefined && current.version !== input.expectedVersion) {
    throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "課程已被更新，請重新載入");
  }
  const count = current ? await confirmedCount(current.id) : 0;
  const issues = validateCourseDraft(input, count);
  if (current) {
    const recorded = await prisma.enrollment.count({
      where: { courseId: current.id, attendanceStatus: { not: AttendanceStatus.NOT_RECORDED } },
    });
    if (recorded > 0 && input.requiredAttendanceMinutes !== current.requiredAttendanceMinutes) {
      issues.push({ path: "requiredAttendanceMinutes", message: "已有出席紀錄，初版不修改完課門檻，以免默默改變歷史結果" });
    }
  }
  if (issues.length) fieldFailure(issues);
  const data = {
    title: input.title,
    description: input.description,
    location: input.location,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    registrationOpensAt: new Date(input.registrationOpensAt),
    registrationClosesAt: new Date(input.registrationClosesAt),
    capacity: input.capacity,
    durationMinutes: input.durationMinutes,
    requiredAttendanceMinutes: input.requiredAttendanceMinutes,
    status: input.status,
  };
  const saved = current
    ? await prisma.course.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 } } })
    : await prisma.course.create({ data: { ...data, createdById: actor.id } });
  await prisma.auditLog.create({
    data: { actorId: actor.id, action: current ? "COURSE_UPDATE" : "COURSE_CREATE", entityType: "Course", entityId: saved.id, requestId: saved.id, safeChanges: { status: saved.status, capacity: saved.capacity } },
  });
  return courseDto(saved, count);
}

export async function enroll(actor: SessionActor, courseId: string) {
  if (actor.role !== UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "請使用業者帳號報名");
  const enrollment = await prisma.$transaction(async (tx) => {
    await tx.$queryRawUnsafe(`SELECT id FROM courses WHERE id = $1::uuid FOR UPDATE`, courseId);
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (!course) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到課程");
    const existing = await tx.enrollment.findUnique({ where: { courseId_userId: { courseId, userId: actor.id } } });
    const confirmed = await tx.enrollment.count({ where: { courseId, status: EnrollmentStatus.CONFIRMED } });
    const decision = canEnroll({
      status: course.status,
      registrationOpensAt: course.registrationOpensAt.toISOString(),
      registrationClosesAt: course.registrationClosesAt.toISOString(),
      capacity: course.capacity,
      confirmedCount: existing?.status === EnrollmentStatus.CONFIRMED ? confirmed - 1 : confirmed,
      nowIso: new Date().toISOString(),
      existingStatus: existing?.status ?? null,
    });
    if (!decision.ok) {
      throw new ApiError(decision.code === "COURSE_FULL" ? 409 : 400, decision.code === "COURSE_FULL" ? ErrorCodes.COURSE_FULL : ErrorCodes.VALIDATION_ERROR, decision.message);
    }
    if (existing) {
      return tx.enrollment.update({
        where: { id: existing.id },
        data: {
          status: EnrollmentStatus.CONFIRMED,
          cancelledAt: null,
          attendanceStatus: AttendanceStatus.NOT_RECORDED,
          attendedMinutes: 0,
          attendanceRecordedAt: null,
          attendanceRecordedById: null,
          requiredAttendanceMinutesSnapshot: course.requiredAttendanceMinutes,
          version: { increment: 1 },
        },
      });
    }
    return tx.enrollment.create({
      data: {
        courseId,
        userId: actor.id,
        status: EnrollmentStatus.CONFIRMED,
        requiredAttendanceMinutesSnapshot: course.requiredAttendanceMinutes,
      },
    });
  });
  return mapEnrollment(enrollment.id);
}

export async function cancelEnrollment(actor: SessionActor, enrollmentId: string) {
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: true } });
  if (!enrollment || enrollment.userId !== actor.id) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到報名");
  const decision = canCancelEnrollment({
    enrollmentStatus: enrollment.status,
    registrationClosesAt: enrollment.course.registrationClosesAt.toISOString(),
    nowIso: new Date().toISOString(),
  });
  if (!decision.ok) throw new ApiError(400, ErrorCodes.VALIDATION_ERROR, decision.message);
  await prisma.enrollment.update({
    where: { id: enrollment.id },
    data: { status: EnrollmentStatus.CANCELLED, cancelledAt: new Date(), version: { increment: 1 } },
  });
  return mapEnrollment(enrollment.id);
}

export async function updateAttendance(actor: SessionActor, enrollmentId: string, input: { expectedVersion: number; attendanceStatus: AttendanceStatus; attendedMinutes: number }) {
  if (actor.role === UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有出席登錄權限");
  const enrollment = await prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: true } });
  if (!enrollment) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到報名");
  if (enrollment.version !== input.expectedVersion) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "出席資料已被更新，請重新載入");
  const issues = validateAttendance({ ...input, durationMinutes: enrollment.course.durationMinutes });
  if (issues.length) fieldFailure(issues);
  const changed = await prisma.enrollment.updateMany({
    where: { id: enrollmentId, version: input.expectedVersion },
    data: {
      attendanceStatus: input.attendanceStatus,
      attendedMinutes: input.attendanceStatus === AttendanceStatus.ABSENT ? 0 : input.attendedMinutes,
      attendanceRecordedById: actor.id,
      attendanceRecordedAt: new Date(),
      version: { increment: 1 },
    },
  });
  if (changed.count !== 1) throw new ApiError(409, ErrorCodes.VERSION_CONFLICT, "出席資料已被更新，請重新載入");
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "ATTENDANCE_UPDATE",
      entityType: "Enrollment",
      entityId: enrollmentId,
      requestId: `${enrollmentId}:${input.expectedVersion}`,
      safeChanges: { attendanceStatus: input.attendanceStatus, attendedMinutes: input.attendedMinutes },
    },
  });
  return mapEnrollment(enrollmentId);
}

async function mapEnrollment(id: string) {
  const row = await prisma.enrollment.findUnique({
    where: { id },
    include: { course: true, user: { include: { organization: true } } },
  });
  if (!row) throw new ApiError(404, ErrorCodes.NOT_FOUND, "找不到報名");
  const learning = buildLearningRecord({
    enrollmentStatus: row.status,
    attendanceStatus: row.attendanceStatus,
    attendedMinutes: row.attendedMinutes,
    requiredAttendanceMinutesSnapshot: row.requiredAttendanceMinutesSnapshot,
  });
  return {
    id: row.id,
    courseId: row.courseId,
    courseTitle: row.course.title,
    userId: row.userId,
    userName: row.user.displayName,
    userEmail: row.user.email,
    organizationName: row.user.organization?.organizationName ?? null,
    status: row.status,
    attendanceStatus: row.attendanceStatus,
    attendedMinutes: row.attendedMinutes,
    requiredAttendanceMinutesSnapshot: row.requiredAttendanceMinutesSnapshot,
    completion: learning.completion,
    countsTowardTotal: learning.countsTowardTotal,
    attendedHoursLabel: minutesToHourLabel(row.attendedMinutes),
    version: row.version,
    enrolledAt: row.enrolledAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    startsAt: row.course.startsAt.toISOString(),
    endsAt: row.course.endsAt.toISOString(),
    location: row.course.location,
  };
}

export async function myEnrollments(actor: SessionActor) {
  const rows = await prisma.enrollment.findMany({ where: { userId: actor.id }, orderBy: { enrolledAt: "desc" } });
  return Promise.all(rows.map((row) => mapEnrollment(row.id)));
}

export async function courseEnrollments(actor: SessionActor, courseId: string, page: number, pageSize: number) {
  if (actor.role === UserRole.APPLICANT) throw new ApiError(403, ErrorCodes.FORBIDDEN, "沒有名單權限");
  const where = { courseId };
  const [total, rows] = await prisma.$transaction([
    prisma.enrollment.count({ where }),
    prisma.enrollment.findMany({ where, orderBy: { enrolledAt: "asc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { items: await Promise.all(rows.map((row) => mapEnrollment(row.id))), meta: pageMeta(page, pageSize, total) };
}

import { AttendanceStatus, CourseStatus, EnrollmentStatus } from "@mf/db/enums";
import type { CompletionCode } from "./status-labels";

export type CourseDeliveryMode = "ONLINE" | "OFFLINE";

export function onlinePassSeconds(videoDurationSeconds: number): number {
  if (!Number.isInteger(videoDurationSeconds) || videoDurationSeconds < 1) return Number.POSITIVE_INFINITY;
  return Math.ceil((videoDurationSeconds * 2) / 3);
}

/** 只接受不超過實際經過時間的觀看進度，避免直接把播放頭拉到結尾就算看完。 */
export function acceptWatchProgress(input: {
  currentSeconds: number;
  reportedSeconds: number;
  videoDurationSeconds: number;
  lastReportedAt: string | null;
  nowIso: string;
}): number {
  const cap = Math.max(0, input.videoDurationSeconds);
  const current = Math.min(cap, Math.max(0, Math.floor(input.currentSeconds)));
  const reported = Math.min(cap, Math.max(0, Math.floor(input.reportedSeconds)));
  if (reported <= current) return current;
  const elapsed = input.lastReportedAt ? Math.floor((Date.parse(input.nowIso) - Date.parse(input.lastReportedAt)) / 1000) : 0;
  const allowance = Math.max(0, elapsed) + 2;
  return Math.min(reported, current + allowance);
}

export type CourseDraftInput = {
  title: string;
  description: string;
  delivery: CourseDeliveryMode;
  hasVideo: boolean;
  location: string;
  startsAt: string;
  endsAt: string;
  registrationOpensAt: string;
  registrationClosesAt: string;
  capacity: number;
  durationMinutes: number;
  requiredAttendanceMinutes: number;
  status: CourseStatus;
};

export function validateCourseDraft(input: CourseDraftInput, confirmedEnrollmentCount = 0): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (!input.title.trim()) issues.push({ path: "title", message: "請填寫課程名稱" });
  if (input.delivery === "OFFLINE" && !input.location.trim()) issues.push({ path: "location", message: "線下課程請填寫地點" });
  if (input.delivery === "ONLINE" && input.status === CourseStatus.PUBLISHED && !input.hasVideo) {
    issues.push({ path: "video", message: "線上課程要先上傳影片，才能公開" });
  }
  const starts = Date.parse(input.startsAt);
  const ends = Date.parse(input.endsAt);
  const opens = Date.parse(input.registrationOpensAt);
  const closes = Date.parse(input.registrationClosesAt);
  if (Number.isNaN(starts) || Number.isNaN(ends) || ends <= starts) {
    issues.push({ path: "endsAt", message: "結束時間必須晚於開始時間" });
  }
  if (Number.isNaN(opens) || Number.isNaN(closes) || closes < opens) {
    issues.push({ path: "registrationClosesAt", message: "報名截止必須不早於報名開始" });
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 1) {
    issues.push({ path: "capacity", message: "名額必須是正整數" });
  } else if (input.capacity < confirmedEnrollmentCount) {
    issues.push({ path: "capacity", message: "名額不可小於目前有效報名數" });
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 1) {
    issues.push({ path: "durationMinutes", message: "課程時數必須是正整數分鐘" });
  }
  if (
    !Number.isInteger(input.requiredAttendanceMinutes) ||
    input.requiredAttendanceMinutes < 0 ||
    input.requiredAttendanceMinutes > input.durationMinutes
  ) {
    issues.push({ path: "requiredAttendanceMinutes", message: "完課分鐘數需介於 0 與課程時數之間" });
  }
  return issues;
}

export function remainingSeats(capacity: number, confirmedCount: number): number {
  return Math.max(0, capacity - confirmedCount);
}

export function canEnroll(input: {
  status: CourseStatus;
  registrationOpensAt: string;
  registrationClosesAt: string;
  capacity: number;
  confirmedCount: number;
  nowIso: string;
  existingStatus: EnrollmentStatus | null;
}): { ok: true } | { ok: false; code: "COURSE_FULL" | "VALIDATION_ERROR"; message: string } {
  if (input.status !== CourseStatus.PUBLISHED) {
    return { ok: false, code: "VALIDATION_ERROR", message: "此課程目前不開放報名" };
  }
  const now = Date.parse(input.nowIso);
  if (now < Date.parse(input.registrationOpensAt) || now > Date.parse(input.registrationClosesAt)) {
    return { ok: false, code: "VALIDATION_ERROR", message: "目前不在報名期間" };
  }
  if (input.existingStatus === EnrollmentStatus.CONFIRMED) {
    return { ok: false, code: "VALIDATION_ERROR", message: "您已報名此梯次" };
  }
  if (input.confirmedCount >= input.capacity) {
    return { ok: false, code: "COURSE_FULL", message: "課程已額滿，初版不提供候補" };
  }
  return { ok: true };
}

/** 取消報名截止條件為暫定：報名截止前可取消。正式規則待確認。 */
export const CANCEL_ENROLLMENT_POLICY_NOTE = "暫定可於報名截止前取消，此規則待確認";

export function canCancelEnrollment(input: {
  enrollmentStatus: EnrollmentStatus;
  registrationClosesAt: string;
  nowIso: string;
  completed?: boolean;
}): { ok: true } | { ok: false; message: string } {
  if (input.completed) return { ok: false, message: "已通過不可退選" };
  if (input.enrollmentStatus !== EnrollmentStatus.CONFIRMED) {
    return { ok: false, message: "此報名已取消" };
  }
  if (Date.parse(input.nowIso) > Date.parse(input.registrationClosesAt)) {
    return { ok: false, message: "已過報名截止時間，依暫定規則不能取消" };
  }
  return { ok: true };
}

export function validateAttendance(input: {
  attendanceStatus: AttendanceStatus;
  attendedMinutes: number;
  durationMinutes: number;
}): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (!Number.isInteger(input.attendedMinutes) || input.attendedMinutes < 0) {
    issues.push({ path: "attendedMinutes", message: "時數必須是 0 以上的整數分鐘" });
  }
  if (input.attendedMinutes > input.durationMinutes) {
    issues.push({ path: "attendedMinutes", message: "時數不可超過課程總分鐘數" });
  }
  if (input.attendanceStatus === AttendanceStatus.ABSENT && input.attendedMinutes > 0) {
    issues.push({ path: "attendedMinutes", message: "缺席不能登錄正分鐘數" });
  }
  if (input.attendanceStatus === AttendanceStatus.NOT_RECORDED && input.attendedMinutes !== 0) {
    issues.push({ path: "attendedMinutes", message: "尚未登錄出席時，分鐘數應為 0" });
  }
  return issues;
}

export function buildLearningRecord(input: {
  enrollmentStatus: EnrollmentStatus;
  attendanceStatus: AttendanceStatus;
  attendedMinutes: number;
  requiredAttendanceMinutesSnapshot: number;
  delivery?: CourseDeliveryMode;
  watchedSeconds?: number;
  videoDurationSeconds?: number;
}): { completion: CompletionCode; countsTowardTotal: boolean } {
  if (input.enrollmentStatus === EnrollmentStatus.CANCELLED) {
    return { completion: "CANCELLED", countsTowardTotal: false };
  }
  if (input.delivery === "ONLINE") {
    const needed = onlinePassSeconds(input.videoDurationSeconds ?? 0);
    if ((input.watchedSeconds ?? 0) >= needed) return { completion: "COMPLETED", countsTowardTotal: true };
    return { completion: "PENDING", countsTowardTotal: false };
  }
  if (input.attendanceStatus === AttendanceStatus.NOT_RECORDED) {
    return { completion: "PENDING", countsTowardTotal: false };
  }
  if (input.attendanceStatus === AttendanceStatus.ABSENT) {
    return { completion: "NOT_COMPLETED", countsTowardTotal: false };
  }
  if (input.attendedMinutes >= input.requiredAttendanceMinutesSnapshot) {
    return { completion: "COMPLETED", countsTowardTotal: true };
  }
  return { completion: "NOT_COMPLETED", countsTowardTotal: false };
}

export function withdrawState(input: {
  enrollmentStatus: EnrollmentStatus;
  completed: boolean;
  registrationClosesAt: string;
  nowIso: string;
}): { canCancel: boolean; label: string } {
  if (input.completed) return { canCancel: false, label: "已通過不可退選" };
  const decision = canCancelEnrollment(input);
  if (decision.ok) return { canCancel: true, label: "退選" };
  if (input.enrollmentStatus !== EnrollmentStatus.CONFIRMED) return { canCancel: false, label: "已取消" };
  return { canCancel: false, label: "不可退選" };
}

export function studyStatusLabel(completion: CompletionCode): { label: string; tone: "success" | "danger" | "neutral" } {
  if (completion === "COMPLETED") return { label: "通過", tone: "success" };
  if (completion === "CANCELLED") return { label: "已取消", tone: "neutral" };
  if (completion === "NOT_COMPLETED") return { label: "未完成", tone: "danger" };
  return { label: "進行中", tone: "danger" };
}

export function minutesToHourLabel(minutes: number): string {
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} 小時`;
}

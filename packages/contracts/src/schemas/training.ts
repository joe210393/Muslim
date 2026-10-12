import { z } from "zod";
import { youtubeVideoId } from "../domain/platform-defaults";
import { attendanceStatusSchema, courseDeliverySchema, courseStatusSchema, enrollmentStatusSchema } from "./common";
import { completionLabels } from "../domain/status-labels";

export const courseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  delivery: courseDeliverySchema,
  youtubeUrl: z.string(),
  imageUrl: z.string().nullable(),
  hasVideo: z.boolean(),
  videoDurationSeconds: z.number().int(),
  location: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  registrationOpensAt: z.string().datetime(),
  registrationClosesAt: z.string().datetime(),
  capacity: z.number().int(),
  confirmedCount: z.number().int(),
  remainingSeats: z.number().int(),
  durationMinutes: z.number().int(),
  requiredAttendanceMinutes: z.number().int(),
  status: courseStatusSchema,
  version: z.number().int(),
  isDemo: z.boolean(),
});

export const courseWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).default(""),
  delivery: courseDeliverySchema.default("OFFLINE"),
  youtubeUrl: z.string().trim().max(200).default("").refine((value) => value === "" || youtubeVideoId(value) !== null, "請貼 YouTube 影片連結"),
  location: z.string().trim().max(200).default(""),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  registrationOpensAt: z.string().datetime(),
  registrationClosesAt: z.string().datetime(),
  capacity: z.number().int().positive(),
  durationMinutes: z.number().int().positive(),
  requiredAttendanceMinutes: z.number().int().nonnegative(),
  status: courseStatusSchema,
  expectedVersion: z.number().int().optional(),
});

export const enrollmentSchema = z.object({
  id: z.string().uuid(),
  courseId: z.string().uuid(),
  courseTitle: z.string(),
  userId: z.string().uuid(),
  userName: z.string(),
  userEmail: z.string().email(),
  organizationName: z.string().nullable(),
  status: enrollmentStatusSchema,
  attendanceStatus: attendanceStatusSchema,
  attendedMinutes: z.number().int(),
  watchedSeconds: z.number().int(),
  requiredAttendanceMinutesSnapshot: z.number().int(),
  delivery: courseDeliverySchema,
  videoDurationSeconds: z.number().int(),
  passSeconds: z.number().int(),
  durationMinutes: z.number().int(),
  canCancel: z.boolean(),
  withdrawLabel: z.string(),
  completion: z.enum(Object.keys(completionLabels) as [keyof typeof completionLabels, ...(keyof typeof completionLabels)[]]),
  version: z.number().int(),
  enrolledAt: z.string().datetime(),
  cancelledAt: z.string().datetime().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string(),
});

export const watchProgressSchema = z.object({
  expectedVersion: z.number().int(),
  watchedSeconds: z.number().int().nonnegative(),
});

export const attendancePatchSchema = z.object({
  expectedVersion: z.number().int(),
  attendanceStatus: attendanceStatusSchema,
  attendedMinutes: z.number().int().nonnegative(),
});

export const learningRecordSchema = enrollmentSchema.extend({
  countsTowardTotal: z.boolean(),
  attendedHoursLabel: z.string(),
});

export type Course = z.infer<typeof courseSchema>;
export type Enrollment = z.infer<typeof enrollmentSchema>;
export type LearningRecord = z.infer<typeof learningRecordSchema>;
export type CourseWrite = z.infer<typeof courseWriteSchema>;

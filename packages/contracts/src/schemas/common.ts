import {
  ApplicationAction,
  ApplicationStatus,
  AttendanceStatus,
  ConfigurationStatus,
  CourseStatus,
  EnrollmentStatus,
  ImportBatchStatus,
  ImportBatchType,
  NotificationJobStatus,
  NotificationType,
  UserRole,
} from "@mf/db/enums";
import { z } from "zod";

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  INVALID_TRANSITION: "INVALID_TRANSITION",
  COURSE_FULL: "COURSE_FULL",
  DUPLICATE_ENROLLMENT: "DUPLICATE_ENROLLMENT",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  UNSUPPORTED_FILE_TYPE: "UNSUPPORTED_FILE_TYPE",
  CATEGORY_NOT_CONFIRMED: "CATEGORY_NOT_CONFIRMED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

function enumSchema<T extends Record<string, string>>(source: T) {
  return z.enum(Object.values(source) as [T[keyof T], ...T[keyof T][]]);
}

export const userRoleSchema = enumSchema(UserRole);
export const applicationStatusSchema = enumSchema(ApplicationStatus);
export const applicationActionSchema = enumSchema(ApplicationAction);
export const configurationStatusSchema = enumSchema(ConfigurationStatus);
export const courseStatusSchema = enumSchema(CourseStatus);
export const enrollmentStatusSchema = enumSchema(EnrollmentStatus);
export const attendanceStatusSchema = enumSchema(AttendanceStatus);
export const notificationJobStatusSchema = enumSchema(NotificationJobStatus);
export const notificationTypeSchema = enumSchema(NotificationType);
export const importBatchTypeSchema = enumSchema(ImportBatchType);
export const importBatchStatusSchema = enumSchema(ImportBatchStatus);

export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const pageMetaSchema = z.object({
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
});

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    fieldErrors: z.array(fieldErrorSchema).optional(),
  }),
  requestId: z.string(),
});

export function apiSuccessSchema<T extends z.ZodTypeAny>(data: T) {
  return z.object({
    success: z.literal(true),
    data,
    meta: pageMetaSchema.optional(),
    requestId: z.string(),
  });
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const nullableText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().min(1).max(max).nullable(),
  );

export const passwordSchema = z
  .string()
  .min(8, "密碼至少 8 碼")
  .max(72, "密碼最長 72 碼")
  .regex(/[A-Za-z]/, "密碼需包含英文字")
  .regex(/[0-9]/, "密碼需包含數字");

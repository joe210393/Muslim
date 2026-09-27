export {
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

export * from "./domain/status-labels";
export * from "./domain/permissions";
export * from "./domain/application-workflow";
export * from "./domain/file-policy";
export * from "./domain/category-definition";
export * from "./domain/application-validation";
export * from "./domain/training";
export * from "./domain/certification";
export * from "./domain/csv";
export * from "./domain/hash";
export * from "./schemas/common";
export * from "./schemas/auth";
export * from "./schemas/organization";
export * from "./schemas/application";
export * from "./schemas/training";
export * from "./schemas/admin";
export * from "./registry/field-metadata";
export * from "./fixtures/categories";
export {
  DEMO_PASSWORD,
  DEMO_SOURCE_SYSTEM,
  TINY_PNG_BASE64,
  demoUuid,
  buildDemoDataset,
} from "./fixtures/demo-dataset";
export type {
  DemoDataset,
  DemoApplication,
  DemoUser,
  DemoOrganization,
} from "./fixtures/demo-dataset";

export const APP_NAME = "穆斯林友善驗證線上申請暨審核系統";
export const DEMO_CONTACT_EMAIL = "contact@example.test";

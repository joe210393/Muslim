import {
  ApplicationStatus,
  AttendanceStatus,
  ConfigurationStatus,
  CourseStatus,
  EnrollmentStatus,
  ImportBatchStatus,
  NotificationJobStatus,
  UserRole,
} from "@mf/db/enums";

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export type StatusLabel = {
  label: string;
  tone: StatusTone;
};

function record<T extends string>(values: Record<T, StatusLabel>): Record<T, StatusLabel> {
  return values;
}

export const userRoleLabels = record<UserRole>({
  [UserRole.APPLICANT]: { label: "業者", tone: "info" },
  [UserRole.CASE_OFFICER]: { label: "承辦人", tone: "info" },
  [UserRole.ADMIN]: { label: "管理員", tone: "neutral" },
});

export const applicationStatusLabels = record<ApplicationStatus>({
  [ApplicationStatus.DRAFT]: { label: "草稿", tone: "neutral" },
  [ApplicationStatus.SUBMITTED]: { label: "已送件", tone: "info" },
  [ApplicationStatus.INITIAL_REVIEW]: { label: "初審中", tone: "info" },
  [ApplicationStatus.SECOND_REVIEW]: { label: "複審中", tone: "info" },
  [ApplicationStatus.FINAL_REVIEW]: { label: "待核定", tone: "warning" },
  [ApplicationStatus.NEED_SUPPLEMENT]: { label: "待補件", tone: "warning" },
  [ApplicationStatus.APPROVED]: { label: "已核定", tone: "success" },
  [ApplicationStatus.REJECTED]: { label: "已退件", tone: "danger" },
});

export const courseStatusLabels = record<CourseStatus>({
  [CourseStatus.DRAFT]: { label: "草稿", tone: "neutral" },
  [CourseStatus.PUBLISHED]: { label: "公開", tone: "success" },
  [CourseStatus.CANCELLED]: { label: "已取消", tone: "danger" },
  [CourseStatus.COMPLETED]: { label: "已結束", tone: "neutral" },
});

export const enrollmentStatusLabels = record<EnrollmentStatus>({
  [EnrollmentStatus.CONFIRMED]: { label: "已報名", tone: "success" },
  [EnrollmentStatus.CANCELLED]: { label: "已取消", tone: "neutral" },
});

export const attendanceStatusLabels = record<AttendanceStatus>({
  [AttendanceStatus.NOT_RECORDED]: { label: "待登錄", tone: "warning" },
  [AttendanceStatus.PRESENT]: { label: "出席", tone: "success" },
  [AttendanceStatus.ABSENT]: { label: "缺席", tone: "danger" },
});

export const configurationStatusLabels = record<ConfigurationStatus>({
  [ConfigurationStatus.CONFIRMED]: { label: "已確認", tone: "success" },
  [ConfigurationStatus.DEMO]: { label: "示範設定", tone: "warning" },
});

export const notificationJobStatusLabels = record<NotificationJobStatus>({
  [NotificationJobStatus.PENDING]: { label: "待寄送", tone: "warning" },
  [NotificationJobStatus.SENT]: { label: "已寄出", tone: "success" },
  [NotificationJobStatus.FAILED]: { label: "寄送失敗", tone: "danger" },
  [NotificationJobStatus.MOCKED]: { label: "僅模擬、未真正寄出", tone: "neutral" },
});

export const importBatchStatusLabels = record<ImportBatchStatus>({
  [ImportBatchStatus.PREVIEWED]: { label: "已預覽", tone: "info" },
  [ImportBatchStatus.COMMITTED]: { label: "已匯入", tone: "success" },
  [ImportBatchStatus.FAILED]: { label: "未匯入", tone: "danger" },
});

export const completionLabels = {
  PENDING: { label: "待登錄", tone: "warning" },
  COMPLETED: { label: "已完課", tone: "success" },
  NOT_COMPLETED: { label: "未達完課時數", tone: "danger" },
  CANCELLED: { label: "已取消", tone: "neutral" },
} as const;

export type CompletionCode = keyof typeof completionLabels;

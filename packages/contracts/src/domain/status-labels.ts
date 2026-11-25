import {
  ApplicationStatus,
  AttendanceStatus,
  ConfigurationStatus,
  CourseStatus,
  CourseDelivery,
  EnrollmentStatus,
  ImportBatchStatus,
  ContractStatus,
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

/** 用 1124 案件生命週期規格的名稱。enum 值不變，只換顯示文字。 */
export const applicationStatusLabels = record<ApplicationStatus>({
  [ApplicationStatus.DRAFT]: { label: "未申請", tone: "neutral" },
  [ApplicationStatus.SUBMITTED]: { label: "未初審", tone: "info" },
  [ApplicationStatus.INITIAL_REVIEW]: { label: "初審中", tone: "info" },
  [ApplicationStatus.SECOND_REVIEW]: { label: "未複審", tone: "info" },
  [ApplicationStatus.FINAL_REVIEW]: { label: "未核複審", tone: "warning" },
  [ApplicationStatus.NEED_SUPPLEMENT]: { label: "未補件", tone: "warning" },
  [ApplicationStatus.APPROVED]: { label: "審核通過", tone: "success" },
  [ApplicationStatus.REJECTED]: { label: "未成立", tone: "danger" },
});

export const courseStatusLabels = record<CourseStatus>({
  [CourseStatus.DRAFT]: { label: "草稿", tone: "neutral" },
  [CourseStatus.PUBLISHED]: { label: "公開", tone: "success" },
  [CourseStatus.CANCELLED]: { label: "已取消", tone: "danger" },
  [CourseStatus.COMPLETED]: { label: "已結束", tone: "neutral" },
});

export const courseDeliveryLabels = record<CourseDelivery>({
  [CourseDelivery.ONLINE]: { label: "線上課程", tone: "info" },
  [CourseDelivery.OFFLINE]: { label: "線下課程", tone: "neutral" },
});

export const enrollmentStatusLabels = record<EnrollmentStatus>({
  [EnrollmentStatus.CONFIRMED]: { label: "已報名", tone: "success" },
  [EnrollmentStatus.CANCELLED]: { label: "已取消", tone: "neutral" },
});

export const companyTrainingRequestStatusLabels = {
  DRAFT: { label: "草稿", tone: "neutral" as const },
  SUBMITTED: { label: "待審核", tone: "warning" as const },
  APPROVED: { label: "已核准", tone: "success" as const },
  REJECTED: { label: "未通過", tone: "danger" as const },
  CANCELLED: { label: "已取消", tone: "neutral" as const },
};

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

export const contractStatusLabels = record<ContractStatus>({
  [ContractStatus.ISSUED]: { label: "待上傳合約", tone: "warning" },
  [ContractStatus.SIGNED]: { label: "已簽約", tone: "success" },
  [ContractStatus.RENEWED]: { label: "已續約", tone: "success" },
  [ContractStatus.NOT_RENEWED]: { label: "未續約", tone: "neutral" },
  [ContractStatus.VOID]: { label: "已收回", tone: "neutral" },
});

/** 合約指揮台分頁（可續約為依效期計算，不是獨立狀態）。 */
export const contractAdminTabs = [
  { id: "pending", label: "待上傳合約", status: "ISSUED" as const },
  { id: "signed", label: "已簽約", status: "SIGNED" as const },
  { id: "renewable", label: "可續約", status: null },
  { id: "not_renewed", label: "未續約", status: "NOT_RENEWED" as const },
  { id: "recalled", label: "已收回", status: "VOID" as const },
] as const;

/** 業者端合約指揮台（用詞較短）。 */
export const contractPortalTabs = [
  { id: "pending", label: "未簽訂", status: "ISSUED" as const },
  { id: "signed", label: "已簽", status: "SIGNED" as const },
  { id: "renewable", label: "可續約", status: null },
  { id: "not_renewed", label: "未續約", status: "NOT_RENEWED" as const },
] as const;

/** 業者端列表用指揮台的短名稱，避免同一筆在方塊寫未簽訂、列上又寫待上傳合約。 */
export function portalContractStatusLabel(status: keyof typeof contractStatusLabels) {
  const tab = contractPortalTabs.find((item) => item.status === status);
  return tab?.label ?? contractStatusLabels[status].label;
}

export const completionLabels = {
  PENDING: { label: "待登錄", tone: "warning" },
  COMPLETED: { label: "已完課", tone: "success" },
  NOT_COMPLETED: { label: "未達完課時數", tone: "danger" },
  CANCELLED: { label: "已取消", tone: "neutral" },
} as const;

export type CompletionCode = keyof typeof completionLabels;

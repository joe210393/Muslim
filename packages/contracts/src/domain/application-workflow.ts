import { ApplicationAction, ApplicationStatus, UserRole } from "@mf/db/enums";

export const REVIEW_RESUME_STATUSES = [
  ApplicationStatus.INITIAL_REVIEW,
  ApplicationStatus.SECOND_REVIEW,
  ApplicationStatus.FINAL_REVIEW,
] as const;

export type ReviewResumeStatus = (typeof REVIEW_RESUME_STATUSES)[number];

export function isReviewResumeStatus(status: ApplicationStatus): status is ReviewResumeStatus {
  return (REVIEW_RESUME_STATUSES as readonly ApplicationStatus[]).includes(status);
}

export type TransitionInput = {
  action: ApplicationAction;
  status: ApplicationStatus;
  resumeStatus: ApplicationStatus | null;
  role: UserRole;
  isAssignee: boolean;
  hasAssignee: boolean;
};

export type TransitionResult =
  | {
      ok: true;
      toStatus: ApplicationStatus;
      nextResumeStatus: ApplicationStatus | null;
    }
  | { ok: false; message: string };

function canProcessStage(input: TransitionInput): boolean {
  if (input.role === UserRole.ADMIN) return true;
  if (input.role !== UserRole.CASE_OFFICER || !input.isAssignee) return false;
  return (
    input.status === ApplicationStatus.INITIAL_REVIEW ||
    input.status === ApplicationStatus.SECOND_REVIEW ||
    input.status === ApplicationStatus.SUBMITTED
  );
}

export function resolveTransition(input: TransitionInput): TransitionResult {
  if (input.action === ApplicationAction.ASSIGN) {
    return { ok: false, message: "派案不是案件狀態轉移" };
  }

  switch (input.action) {
    case ApplicationAction.SUBMIT:
      if (input.role !== UserRole.APPLICANT) return { ok: false, message: "只有業者可以送件" };
      if (input.status !== ApplicationStatus.DRAFT) {
        return { ok: false, message: "只有草稿可以送件" };
      }
      return {
        ok: true,
        toStatus: ApplicationStatus.SUBMITTED,
        nextResumeStatus: null,
      };
    case ApplicationAction.START_REVIEW:
      if (input.status !== ApplicationStatus.SUBMITTED) {
        return { ok: false, message: "只有已送件案件可以開始初審" };
      }
      if (!input.hasAssignee) return { ok: false, message: "需先指派承辦人" };
      if (input.role === UserRole.APPLICANT) return { ok: false, message: "業者不能開始審查" };
      if (input.role === UserRole.CASE_OFFICER && !input.isAssignee) {
        return { ok: false, message: "只有指派承辦人或管理員可以開始初審" };
      }
      return {
        ok: true,
        toStatus: ApplicationStatus.INITIAL_REVIEW,
        nextResumeStatus: null,
      };
    case ApplicationAction.PASS_INITIAL:
      if (input.status !== ApplicationStatus.INITIAL_REVIEW) {
        return { ok: false, message: "目前不是初審階段" };
      }
      if (!canProcessStage(input)) return { ok: false, message: "沒有初審權限" };
      return {
        ok: true,
        toStatus: ApplicationStatus.SECOND_REVIEW,
        nextResumeStatus: null,
      };
    case ApplicationAction.PASS_SECOND:
      if (input.status !== ApplicationStatus.SECOND_REVIEW) {
        return { ok: false, message: "目前不是複審階段" };
      }
      if (!canProcessStage(input)) return { ok: false, message: "沒有複審權限" };
      return {
        ok: true,
        toStatus: ApplicationStatus.FINAL_REVIEW,
        nextResumeStatus: null,
      };
    case ApplicationAction.APPROVE:
      if (input.role !== UserRole.ADMIN) return { ok: false, message: "只有管理員可以核定" };
      if (input.status !== ApplicationStatus.FINAL_REVIEW) {
        return { ok: false, message: "只有待核定案件可以核定" };
      }
      return {
        ok: true,
        toStatus: ApplicationStatus.APPROVED,
        nextResumeStatus: null,
      };
    case ApplicationAction.REQUEST_SUPPLEMENT:
      if (!isReviewResumeStatus(input.status)) {
        return { ok: false, message: "只有審查中的案件可以要求補件" };
      }
      if (input.status === ApplicationStatus.FINAL_REVIEW) {
        if (input.role !== UserRole.ADMIN) return { ok: false, message: "待核定階段僅管理員可要求補件" };
      } else if (!canProcessStage(input)) {
        return { ok: false, message: "沒有要求補件的權限" };
      }
      return {
        ok: true,
        toStatus: ApplicationStatus.NEED_SUPPLEMENT,
        nextResumeStatus: input.status,
      };
    case ApplicationAction.RESUBMIT:
      if (input.role !== UserRole.APPLICANT) return { ok: false, message: "只有業者可以重新送件" };
      if (input.status !== ApplicationStatus.NEED_SUPPLEMENT) {
        return { ok: false, message: "只有待補件案件可以重新送件" };
      }
      if (!input.resumeStatus || !isReviewResumeStatus(input.resumeStatus)) {
        return { ok: false, message: "補件返回階段無效" };
      }
      return {
        ok: true,
        toStatus: input.resumeStatus,
        nextResumeStatus: null,
      };
    case ApplicationAction.REJECT:
      if (input.role !== UserRole.ADMIN) return { ok: false, message: "只有管理員可以退件" };
      if (!isReviewResumeStatus(input.status)) {
        return { ok: false, message: "只有審查中的案件可以退件" };
      }
      return {
        ok: true,
        toStatus: ApplicationStatus.REJECTED,
        nextResumeStatus: null,
      };
    default:
      return { ok: false, message: "不支援的動作" };
  }
}

export function commentRequirement(action: ApplicationAction): "public" | "review" | "none" {
  if (
    action === ApplicationAction.REQUEST_SUPPLEMENT ||
    action === ApplicationAction.REJECT ||
    action === ApplicationAction.APPROVE
  ) {
    return "public";
  }
  if (action === ApplicationAction.PASS_INITIAL || action === ApplicationAction.PASS_SECOND) {
    return "review";
  }
  return "none";
}

export const applicantEditableStatuses: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.NEED_SUPPLEMENT,
];

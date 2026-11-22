import { ApplicationStatus, ContractStatus } from "@mf/db/enums";

export type IssuableApplicationView = {
  id: string;
  applicationNo: string;
  categoryCode: string;
  categoryName: string;
  siteName: string | null;
  status: ApplicationStatus;
  /** 畫面上用來辨識的短標，例如「穆斯林友善餐廳」 */
  label: string;
  formData: Record<string, unknown>;
};

const OPEN_APPLICATION_STATUSES = new Set<ApplicationStatus>([
  ApplicationStatus.DRAFT,
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.INITIAL_REVIEW,
  ApplicationStatus.SECOND_REVIEW,
  ApplicationStatus.FINAL_REVIEW,
  ApplicationStatus.NEED_SUPPLEMENT,
  ApplicationStatus.APPROVED,
]);

/** 已有非作廢合約的申請，不算「尚未完成合約」。 */
export function applicationNeedsContract(
  applicationId: string,
  contracts: Array<{ applicationId?: string | null; status: ContractStatus | string }>,
): boolean {
  return !contracts.some(
    (item) => item.applicationId === applicationId && item.status !== ContractStatus.VOID && item.status !== "VOID",
  );
}

export function isOpenApplicationForContract(status: ApplicationStatus | string): boolean {
  return OPEN_APPLICATION_STATUSES.has(status as ApplicationStatus);
}

export function issuableApplicationLabel(categoryName: string, siteName?: string | null): string {
  const site = siteName?.trim();
  return site ? `${categoryName}（${site}）` : categoryName;
}

import type { PaymentStatusValue } from "../schemas/payments";

export function taipeiMonthRange(now = new Date()) {
  const label = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit" }).format(now);
  const [year, month] = label.split("-").map(Number);
  const start = new Date(Date.UTC(year!, month! - 1, 1, -8, 0, 0));
  const end = new Date(Date.UTC(year!, month!, 1, -8, 0, 0));
  return { label, start, end };
}

export function taipeiMonthTitle(now = new Date()) {
  const [year, month] = taipeiMonthRange(now).label.split("-");
  return `${year}年${Number(month)}月`;
}

export function formatTwd(amount: number) {
  return `NT$ ${amount.toLocaleString("zh-Hant-TW")}`;
}

export function isInTaipeiMonth(iso: string, now = new Date()) {
  const { start, end } = taipeiMonthRange(now);
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
}

/** 核帳完成（PAID）後才開通教育訓練與合約申請書。 */
export function isServiceUnlocked(statuses: Array<PaymentStatusValue | string>) {
  return statuses.some((status) => status === "PAID");
}

export function planIsVisibleToUser(visibleUserIds: string[], userId: string) {
  if (visibleUserIds.length === 0) return true;
  return visibleUserIds.includes(userId);
}

export const paymentStatusLabels: Record<PaymentStatusValue, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  QUOTED: { label: "待付款", tone: "info" },
  PENDING: { label: "待付款", tone: "info" },
  PAID_PENDING: { label: "待核帳", tone: "warning" },
  PAID: { label: "已核帳開通", tone: "success" },
};

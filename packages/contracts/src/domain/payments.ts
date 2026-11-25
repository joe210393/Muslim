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

/** 1124 規格：註冊報價 → 繳費及開發票。核帳後案件進入「未申請」。 */
export const paymentStatusLabels: Record<PaymentStatusValue, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  QUOTED: { label: "未核案件", tone: "warning" },
  PENDING: { label: "未付款", tone: "info" },
  PAID_PENDING: { label: "未核付款", tone: "warning" },
  PAID: { label: "已核帳（未申請）", tone: "success" },
  VOID: { label: "未成立", tone: "danger" },
};

export const paymentDecisionLabels = {
  APPROVE_QUOTE: "核准並產生匯款單",
  REJECT_QUOTE: "不核准（未成立）",
  RETURN_RECEIPT: "退回單據重傳",
  VOID: "改為未成立",
} as const;

/** 未付款且已過繳費期限。期限以整天計，到期日當天 23:59（台北）前仍可上傳。 */
export function isPaymentOverdue(status: PaymentStatusValue | string, dueAt: string | Date | null | undefined, now = new Date()) {
  if (status !== "PENDING" || !dueAt) return false;
  return new Date(dueAt).getTime() < now.getTime();
}

/** 核准當下起算 dueDays 天，截止於台北時間當天 23:59:59。 */
export function paymentDueAt(dueDays: number, from = new Date()) {
  const label = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(from);
  const [year, month, day] = label.split("-").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day! + dueDays, 15, 59, 59));
}

export function remittanceSlipNo(from = new Date(), suffix = Math.random().toString(36).slice(2, 8)) {
  const label = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(from).replaceAll("-", "");
  return `MF${label}${suffix.toUpperCase().padEnd(6, "0").slice(0, 6)}`;
}

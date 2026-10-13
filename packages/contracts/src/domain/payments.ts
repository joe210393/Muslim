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

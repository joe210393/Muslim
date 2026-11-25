const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function taipeiDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 新發證書的建議到期日：核發日往後 N 個月的前一天。不改已核發證書。 */
export function certificateDefaultUntil(issuedOnDate: string, months: number): string {
  if (!DATE_ONLY.test(issuedOnDate) || !Number.isInteger(months) || months < 1) return "";
  const year = Number(issuedOnDate.slice(0, 4));
  const month = Number(issuedOnDate.slice(5, 7));
  const day = Number(issuedOnDate.slice(8, 10));
  const cursor = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
  cursor.setUTCDate(Math.min(day, last));
  cursor.setUTCDate(cursor.getUTCDate() - 1);
  const y = cursor.getUTCFullYear();
  const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
  const d = String(cursor.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function validateCertificationDates(issuedOnDate: string, validUntilDate: string): { path: string; message: string }[] {
  const issues: { path: string; message: string }[] = [];
  if (!DATE_ONLY.test(issuedOnDate)) issues.push({ path: "issuedOnDate", message: "核發日需為 YYYY-MM-DD" });
  if (!DATE_ONLY.test(validUntilDate)) issues.push({ path: "validUntilDate", message: "到期日需為 YYYY-MM-DD" });
  if (DATE_ONLY.test(issuedOnDate) && DATE_ONLY.test(validUntilDate) && issuedOnDate > validUntilDate) {
    issues.push({ path: "validUntilDate", message: "到期日不可早於核發日" });
  }
  return issues;
}

export function certificationValidity(input: {
  issuedOnDate: string;
  validUntilDate: string;
  today?: string;
}): { isCurrent: boolean; label: string } {
  const today = input.today ?? taipeiDateString();
  if (today < input.issuedOnDate) return { isCurrent: false, label: "尚未生效" };
  if (today > input.validUntilDate) return { isCurrent: false, label: "已逾效期" };
  return { isCurrent: true, label: "效期內" };
}

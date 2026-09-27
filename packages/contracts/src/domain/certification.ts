const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function taipeiDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

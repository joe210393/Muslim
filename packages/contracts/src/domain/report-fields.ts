import { sanitizeCsvCell } from "./csv";

export const REPORT_SOURCES = [
  { key: "APPLICATION", label: "案件" },
  { key: "ORGANIZATION", label: "業者" },
  { key: "ENROLLMENT", label: "訓練報名" },
  { key: "CONTRACT", label: "合約" },
] as const;

export type ReportSource = (typeof REPORT_SOURCES)[number]["key"];

export type ReportField = {
  source: ReportSource;
  key: string;
  label: string;
};

export const REPORT_FIELDS: ReportField[] = [
  { source: "APPLICATION", key: "applicationNo", label: "案件編號" },
  { source: "APPLICATION", key: "status", label: "案件狀態" },
  { source: "APPLICATION", key: "categoryName", label: "申請類別" },
  { source: "APPLICATION", key: "organizationName", label: "業者名稱" },
  { source: "APPLICATION", key: "taxId", label: "統一編號" },
  { source: "APPLICATION", key: "contactName", label: "聯絡人" },
  { source: "APPLICATION", key: "contactPhone", label: "聯絡電話" },
  { source: "APPLICATION", key: "contactEmail", label: "聯絡 Email" },
  { source: "APPLICATION", key: "organizationAddress", label: "地址" },
  { source: "APPLICATION", key: "siteName", label: "場所名稱" },
  { source: "APPLICATION", key: "siteAddress", label: "場所地址" },
  { source: "APPLICATION", key: "applicationDescription", label: "申請說明" },
  { source: "APPLICATION", key: "assignedToName", label: "承辦人" },
  { source: "APPLICATION", key: "submittedAt", label: "送件時間" },
  { source: "APPLICATION", key: "decidedAt", label: "核定時間" },
  { source: "APPLICATION", key: "createdAt", label: "建立時間" },
  { source: "ORGANIZATION", key: "organizationName", label: "業者名稱" },
  { source: "ORGANIZATION", key: "taxId", label: "統一編號" },
  { source: "ORGANIZATION", key: "contactName", label: "聯絡人" },
  { source: "ORGANIZATION", key: "contactPhone", label: "聯絡電話" },
  { source: "ORGANIZATION", key: "contactEmail", label: "聯絡 Email" },
  { source: "ORGANIZATION", key: "address", label: "地址" },
  { source: "ENROLLMENT", key: "courseTitle", label: "課程名稱" },
  { source: "ENROLLMENT", key: "courseStartsAt", label: "上課時間" },
  { source: "ENROLLMENT", key: "location", label: "地點" },
  { source: "ENROLLMENT", key: "userName", label: "姓名" },
  { source: "ENROLLMENT", key: "userEmail", label: "Email" },
  { source: "ENROLLMENT", key: "organizationName", label: "業者" },
  { source: "ENROLLMENT", key: "enrollmentStatus", label: "報名狀態" },
  { source: "ENROLLMENT", key: "attendanceStatus", label: "出席" },
  { source: "ENROLLMENT", key: "attendedMinutes", label: "出席分鐘" },
  { source: "CONTRACT", key: "contractNo", label: "合約編號" },
  { source: "CONTRACT", key: "organizationName", label: "業者名稱" },
  { source: "CONTRACT", key: "title", label: "合約標題" },
  { source: "CONTRACT", key: "status", label: "合約狀態" },
  { source: "CONTRACT", key: "signerName", label: "簽署人" },
  { source: "CONTRACT", key: "signerTitle", label: "簽署人職稱" },
  { source: "CONTRACT", key: "signedAt", label: "簽署時間" },
  { source: "CONTRACT", key: "createdAt", label: "發出時間" },
];

export function reportFieldsFor(source: ReportSource): ReportField[] {
  return REPORT_FIELDS.filter((field) => field.source === source);
}

export function unknownReportFields(source: ReportSource, keys: string[]): string[] {
  const known = new Set(reportFieldsFor(source).map((field) => field.key));
  return keys.filter((key) => !known.has(key));
}

export type ReportSelection = {
  source: ReportSource;
  fieldKeys: string[];
};

export function reportFieldId(source: ReportSource, key: string) {
  return `${source}.${key}`;
}

export function parseReportFieldId(value: string): { source: ReportSource; key: string } | null {
  const splitAt = value.indexOf(".");
  if (splitAt < 1) return null;
  const source = value.slice(0, splitAt);
  const key = value.slice(splitAt + 1);
  if (!REPORT_SOURCES.some((item) => item.key === source) || !key) return null;
  return { source: source as ReportSource, key };
}

export function sourceLabel(source: ReportSource) {
  return REPORT_SOURCES.find((item) => item.key === source)?.label ?? source;
}

export function countReportValues(rows: Array<Record<string, string>>, key: string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = row[key]?.trim() || "未填";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, "zh-Hant"));
}

export function reportSectionsCsv(sections: Array<{ title: string; headers: string[]; rows: unknown[][] }>) {
  const blocks = sections.map((section) => {
    const lines = [[section.title], section.headers, ...section.rows].map((row) => row.map((cell) => sanitizeCsvCell(cell)).join(","));
    return lines.join("\r\n");
  });
  return `\uFEFF${blocks.join("\r\n\r\n")}`;
}

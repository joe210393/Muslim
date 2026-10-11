import { applicationStatusLabels, attendanceStatusLabels, completionLabels, courseStatusLabels, enrollmentStatusLabels, userRoleLabels, type StatusTone } from "@mf/contracts";

const tones: Record<StatusTone, string> = {
  neutral: "bg-[#ebe6dc] text-[#1a1916]",
  info: "bg-[#e6eef3] text-[#163044]",
  warning: "bg-[#f6edd8] text-[#4a3410]",
  success: "bg-[#e5f0e8] text-[#163526]",
  danger: "bg-[#f8e8e4] text-[#7a261c]",
};

export function toneClass(tone: StatusTone): string {
  return tones[tone];
}

export function formatTaipei(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const labels = {
  application: applicationStatusLabels,
  course: courseStatusLabels,
  enrollment: enrollmentStatusLabels,
  attendance: attendanceStatusLabels,
  completion: completionLabels,
  role: userRoleLabels,
};

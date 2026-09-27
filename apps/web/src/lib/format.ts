import { applicationStatusLabels, attendanceStatusLabels, completionLabels, courseStatusLabels, enrollmentStatusLabels, userRoleLabels, type StatusTone } from "@mf/contracts";

const tones: Record<StatusTone, string> = {
  neutral: "bg-stone-100 text-stone-700",
  info: "bg-sky-50 text-sky-800",
  warning: "bg-amber-50 text-amber-800",
  success: "bg-emerald-50 text-emerald-800",
  danger: "bg-rose-50 text-rose-800",
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

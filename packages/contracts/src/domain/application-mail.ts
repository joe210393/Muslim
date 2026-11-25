import { ApplicationAction, ApplicationStatus, NotificationType } from "@mf/db/enums";
import { applicationStatusLabels } from "./status-labels";

export const MAIL_TEMPLATE_KEYS = [
  "submit",
  "resubmit",
  "supplement",
  "approve",
  "reject",
  "assign",
  "start-review",
  "pass-initial",
  "pass-second",
  "renewal",
] as const;

export type MailTemplateKey = (typeof MAIL_TEMPLATE_KEYS)[number];

export type MailTemplateDraft = {
  key: MailTemplateKey;
  label: string;
  hint: string;
  subject: string;
  body: string;
};

const tail = "請登入系統查看。這封信不含內部審查意見。";

export const DEFAULT_MAIL_TEMPLATES: MailTemplateDraft[] = [
  { key: "submit", label: "送件", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "已收到驗證申請", body: `我們已收到這件驗證申請，下一步是審查。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "resubmit", label: "補件後送回", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "已收到補件後的驗證申請", body: `補件已重新送出，案件回到審查。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "supplement", label: "要求補件", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "請補充驗證申請資料", body: `這件申請需要補資料後才能繼續。請依說明修正並重新送出。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "approve", label: "核定", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "驗證申請已核定", body: `這件申請已核定。證書要等管理員另行核發，這封信不代表證書已經可以下載。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "reject", label: "退件", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "驗證申請未成立", body: `這件申請已退件，不會進入後續發證。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "assign", label: "派案", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "驗證申請已指派承辦", body: `這件申請已指派承辦，下一步是審查。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "start-review", label: "開始初審", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "驗證申請開始初審", body: `這件申請已開始初審。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "pass-initial", label: "進入複審", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "驗證申請進入複審", body: `初審已通過，下一步是複審。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "pass-second", label: "進入核定", hint: "{applicationNo} 案件編號、{status} 狀態、{comment} 公開說明", subject: "驗證申請進入核定", body: `複審已通過，下一步是核定。\n\n案件編號：{applicationNo}\n目前狀態：{status}{comment}\n\n${tail}` },
  { key: "renewal", label: "續約提醒", hint: "{contractNo} 合約編號、{organizationName} 業者、{daysLeft} 剩餘天數、{reminderDays} 提醒天數", subject: "驗證合約即將到期", body: `{organizationName} 的合約 {contractNo} 剩餘 {daysLeft} 天。提醒範圍是到期前 {reminderDays} 天。\n\n請登入系統查看續約。續約付款方式尚未定。` },
];

const TYPE_BY_KEY: Record<MailTemplateKey, NotificationType> = {
  submit: NotificationType.SUBMISSION_CONFIRMATION,
  resubmit: NotificationType.SUBMISSION_CONFIRMATION,
  supplement: NotificationType.SUPPLEMENT_REQUEST,
  approve: NotificationType.DECISION_RESULT,
  reject: NotificationType.DECISION_RESULT,
  assign: NotificationType.CASE_PROGRESS,
  "start-review": NotificationType.CASE_PROGRESS,
  "pass-initial": NotificationType.CASE_PROGRESS,
  "pass-second": NotificationType.CASE_PROGRESS,
  renewal: NotificationType.RENEWAL,
};

export function isMailTemplateKey(value: string): value is MailTemplateKey {
  return (MAIL_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function templateKeyForAction(action: ApplicationAction): MailTemplateKey {
  switch (action) {
    case ApplicationAction.SUBMIT:
      return "submit";
    case ApplicationAction.RESUBMIT:
      return "resubmit";
    case ApplicationAction.REQUEST_SUPPLEMENT:
      return "supplement";
    case ApplicationAction.APPROVE:
      return "approve";
    case ApplicationAction.REJECT:
      return "reject";
    case ApplicationAction.ASSIGN:
      return "assign";
    case ApplicationAction.START_REVIEW:
      return "start-review";
    case ApplicationAction.PASS_INITIAL:
      return "pass-initial";
    case ApplicationAction.PASS_SECOND:
      return "pass-second";
    default:
      return "start-review";
  }
}

export function fillMailTemplate(template: { subject: string; body: string }, values: Record<string, string>): { subject: string; body: string } {
  const apply = (text: string) => text.replace(/\{([A-Za-z]+)\}/g, (_, key: string) => values[key] ?? "");
  return { subject: apply(template.subject).slice(0, 200), body: apply(template.body) };
}

function storedOrDefault(key: MailTemplateKey, templates?: Array<{ key: string; subject: string; body: string }>): { subject: string; body: string } {
  const custom = templates?.find((item) => item.key === key);
  const fallback = DEFAULT_MAIL_TEMPLATES.find((item) => item.key === key)!;
  return { subject: custom?.subject || fallback.subject, body: custom?.body || fallback.body };
}

export function customerNotice(input: {
  action: ApplicationAction;
  applicationNo: string;
  toStatus: ApplicationStatus;
  publicComment?: string | null;
  templates?: Array<{ key: string; subject: string; body: string }>;
}): { type: NotificationType; subject: string; body: string } {
  const key = templateKeyForAction(input.action);
  const comment = input.publicComment?.trim();
  const filled = fillMailTemplate(storedOrDefault(key, input.templates), {
    applicationNo: input.applicationNo,
    status: applicationStatusLabels[input.toStatus].label,
    comment: comment ? `\n\n說明：\n${comment}` : "",
  });
  return { type: TYPE_BY_KEY[key], ...filled };
}

export function renewalNotice(input: {
  contractNo: string;
  organizationName: string;
  daysLeft: number;
  reminderDays: number;
  templates?: Array<{ key: string; subject: string; body: string }>;
}): { type: NotificationType; subject: string; body: string } {
  const filled = fillMailTemplate(storedOrDefault("renewal", input.templates), {
    contractNo: input.contractNo,
    organizationName: input.organizationName,
    daysLeft: String(input.daysLeft),
    reminderDays: String(input.reminderDays),
  });
  return { type: NotificationType.RENEWAL, ...filled };
}

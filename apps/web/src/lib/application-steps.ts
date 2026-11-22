import {
  attachmentIsRequired,
  fieldIsRequired,
  fieldIsVisible,
  VERIFICATION_PICK_KEYS,
  type ApplicationDetail,
  type CategoryDefinition,
  type FieldIssue,
} from "@mf/contracts";

export const APPLICATION_STEPS = ["申請類別", "業者與聯絡資料", "申請內容", "附件資料", "線上預覽", "確認送件"] as const;

function pushRequired(value: string | null | undefined, path: string, label: string, issues: FieldIssue[]) {
  if (!value?.trim()) issues.push({ path, message: `請填寫${label}` });
}

export function issueAnchorId(path: string) {
  return `apply-${path.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

export function stepForIssuePath(path: string): number {
  if (path === "category" || path === "categoryId") return 0;
  if (
    path === "organizationName"
    || path === "taxId"
    || path === "contactName"
    || path === "contactPhone"
    || path === "contactEmail"
    || path === "organizationAddress"
  ) return 1;
  if (path.startsWith("formData.") || path === "siteName" || path === "siteAddress" || path === "applicationDescription") return 2;
  if (path.startsWith("attachments.")) return 3;
  if (path === "declarationAccepted") return 5;
  return 5;
}

export function describeSubmitIssue(path: string, message: string, definition: CategoryDefinition): { step: number; stepLabel: string; text: string } {
  const step = stepForIssuePath(path);
  const stepLabel = APPLICATION_STEPS[step] ?? "確認送件";
  let fieldLabel = message.replace(/^請填寫/, "").replace(/^請上傳/, "").replace(/^請勾選/, "");
  if (path.startsWith("formData.")) {
    const key = path.slice("formData.".length);
    fieldLabel = definition.fields.find((field) => field.key === key)?.label ?? fieldLabel;
  } else if (path.startsWith("attachments.")) {
    const key = path.slice("attachments.".length);
    fieldLabel = definition.attachmentRequirements.find((item) => item.key === key)?.label ?? fieldLabel;
  } else if (path === "organizationName") fieldLabel = "業者名稱";
  else if (path === "taxId") fieldLabel = "統一編號";
  else if (path === "contactName") fieldLabel = "聯絡人";
  else if (path === "contactPhone") fieldLabel = "電話";
  else if (path === "contactEmail") fieldLabel = "Email";
  else if (path === "organizationAddress") fieldLabel = "地址";
  else if (path === "siteName") fieldLabel = "單位名稱（中文）";
  else if (path === "siteAddress") fieldLabel = "單位地址（中文）";
  else if (path === "applicationDescription") fieldLabel = "申請說明";
  else if (path === "declarationAccepted") fieldLabel = "資料聲明";
  const prefix = `請到 ${step + 1}. ${stepLabel}`;
  if (message.includes("上傳")) return { step, stepLabel, text: `${prefix}，上傳「${fieldLabel}」` };
  if (message.includes("勾選") || path === "declarationAccepted" || message.includes("至少勾選")) {
    return { step, stepLabel, text: `${prefix}，完成「${fieldLabel || message}」` };
  }
  if (message.includes("擇一") || message.includes("格式") || message.includes("暫定")) {
    return { step, stepLabel, text: `${prefix}：${message}` };
  }
  return { step, stepLabel, text: `${prefix} 的「${fieldLabel}」` };
}

export function validateApplicationStep(
  step: number,
  draft: Pick<
    ApplicationDetail,
    | "categoryId"
    | "organizationName"
    | "taxId"
    | "contactName"
    | "contactPhone"
    | "contactEmail"
    | "organizationAddress"
    | "siteName"
    | "siteAddress"
    | "applicationDescription"
    | "formData"
    | "definition"
    | "attachments"
  >,
): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const definition = draft.definition;
  if (step === 0) {
    if (!draft.categoryId) issues.push({ path: "categoryId", message: "請選擇申請類別" });
    return issues;
  }
  if (step === 1) {
    pushRequired(draft.organizationName, "organizationName", "業者名稱", issues);
    pushRequired(draft.contactName, "contactName", "聯絡人", issues);
    pushRequired(draft.contactPhone, "contactPhone", "電話", issues);
    pushRequired(draft.contactEmail, "contactEmail", "Email", issues);
    pushRequired(draft.organizationAddress, "organizationAddress", "地址", issues);
    if (draft.taxId?.trim() && !/^\d{8}$/.test(draft.taxId.trim())) {
      issues.push({ path: "taxId", message: "統一編號暫定為 8 位數字" });
    }
    return issues;
  }
  if (step === 2) {
    pushRequired(draft.siteName, "siteName", "單位名稱（中文）", issues);
    pushRequired(draft.siteAddress, "siteAddress", "單位地址（中文）", issues);
    pushRequired(draft.applicationDescription, "applicationDescription", "申請說明", issues);
    for (const field of definition.fields) {
      if (!fieldIsVisible(field, draft.formData) || !fieldIsRequired(field, draft.formData)) continue;
      if (VERIFICATION_PICK_KEYS.includes(field.key as (typeof VERIFICATION_PICK_KEYS)[number])) continue;
      const value = draft.formData[field.key];
      if (field.inputType === "checkbox") continue;
      if (value === undefined || value === null || String(value).trim() === "") {
        issues.push({ path: `formData.${field.key}`, message: `請填寫${field.label}` });
      }
    }
    if (definition.fields.some((field) => field.key === "mealBreakfast")) {
      const pickKeys = definition.fields.filter((field) => VERIFICATION_PICK_KEYS.includes(field.key as (typeof VERIFICATION_PICK_KEYS)[number]));
      if (pickKeys.length > 0 && !pickKeys.some((field) => draft.formData[field.key] === true)) {
        issues.push({ path: "formData.mealBreakfast", message: "請至少勾選一項申請餐點種類" });
      }
    }
    return issues;
  }
  if (step === 3) {
    const keys = draft.attachments.filter((item) => !item.capturedOnSite).map((item) => item.requirementKey);
    for (const requirement of definition.attachmentRequirements) {
      if (requirement.group === "checklist") continue;
      if (attachmentIsRequired(requirement, draft.formData) && !keys.includes(requirement.key)) {
        issues.push({ path: `attachments.${requirement.key}`, message: `請上傳${requirement.label}` });
      }
    }
    return issues;
  }
  return issues;
}

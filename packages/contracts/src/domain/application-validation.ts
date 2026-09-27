import type { CategoryDefinition, CategoryField } from "./category-definition";

export type CommonApplicationInput = {
  organizationName: string | null;
  taxId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  organizationAddress: string | null;
  siteName: string | null;
  siteAddress: string | null;
  applicationDescription: string | null;
  declarationAccepted: boolean;
  formData: Record<string, unknown>;
};

export type FieldIssue = { path: string; message: string };

const TAX_ID_DEMO = /^\d{8}$/;
const PHONE_DEMO = /^[0-9+\-()\s]{8,30}$/;
const EMAIL_DEMO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function requiredText(value: string | null, path: string, label: string, issues: FieldIssue[], max = 200) {
  if (!value || value.trim() === "") {
    issues.push({ path, message: `請填寫${label}` });
    return;
  }
  if (value.trim().length > max) issues.push({ path, message: `${label}最長 ${max} 字` });
}

function draftText(value: string | null, path: string, label: string, issues: FieldIssue[], max: number) {
  if (value && value.trim().length > max) issues.push({ path, message: `${label}最長 ${max} 字` });
}

function checkTaxId(value: string | null, issues: FieldIssue[], required: boolean) {
  if (!value || value.trim() === "") {
    if (required) issues.push({ path: "taxId", message: "送件需要統一編號" });
    return;
  }
  if (!TAX_ID_DEMO.test(value.trim())) {
    issues.push({ path: "taxId", message: "統一編號暫定為 8 位數字（海外規則待確認）" });
  }
}

function checkPhone(value: string | null, issues: FieldIssue[], required: boolean) {
  if (!value || value.trim() === "") {
    if (required) issues.push({ path: "contactPhone", message: "請填寫聯絡電話" });
    return;
  }
  if (!PHONE_DEMO.test(value.trim())) issues.push({ path: "contactPhone", message: "電話格式不正確" });
}

function checkEmail(value: string | null, issues: FieldIssue[], required: boolean) {
  if (!value || value.trim() === "") {
    if (required) issues.push({ path: "contactEmail", message: "請填寫聯絡 Email" });
    return;
  }
  if (!EMAIL_DEMO.test(value.trim())) issues.push({ path: "contactEmail", message: "Email 格式不正確" });
}

function checkFieldValue(field: CategoryField, raw: unknown, issues: FieldIssue[], required: boolean) {
  const path = `formData.${field.key}`;
  const empty = raw === undefined || raw === null || raw === "";
  if (empty) {
    if (required && field.requiredOnSubmit) issues.push({ path, message: `請填寫${field.label}` });
    return;
  }
  if (field.inputType === "checkbox") {
    if (typeof raw !== "boolean") issues.push({ path, message: `${field.label}必須是勾選值` });
    else if (required && field.requiredOnSubmit && raw !== true) issues.push({ path, message: `請勾選${field.label}` });
    return;
  }
  if (field.inputType === "number") {
    const numeric = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(numeric)) issues.push({ path, message: `${field.label}必須是數字` });
    return;
  }
  if (typeof raw !== "string") {
    issues.push({ path, message: `${field.label}格式不正確` });
    return;
  }
  const value = raw.trim();
  if (field.minLength && value.length < field.minLength) {
    issues.push({ path, message: `${field.label}至少 ${field.minLength} 字` });
  }
  if (field.maxLength && value.length > field.maxLength) {
    issues.push({ path, message: `${field.label}最長 ${field.maxLength} 字` });
  }
  if (field.inputType === "date" && !DATE_ONLY.test(value)) {
    issues.push({ path, message: `${field.label}需為 YYYY-MM-DD` });
  }
  if (field.inputType === "select" && !field.options?.some((option) => option.value === value)) {
    issues.push({ path, message: `${field.label}不是有效選項` });
  }
}

export function validateDraft(input: CommonApplicationInput, definition: CategoryDefinition): FieldIssue[] {
  const issues: FieldIssue[] = [];
  draftText(input.organizationName, "organizationName", "業者名稱", issues, 200);
  checkTaxId(input.taxId, issues, false);
  draftText(input.contactName, "contactName", "聯絡人", issues, 100);
  checkPhone(input.contactPhone, issues, false);
  checkEmail(input.contactEmail, issues, false);
  draftText(input.organizationAddress, "organizationAddress", "地址", issues, 300);
  draftText(input.siteName, "siteName", "場所名稱", issues, 200);
  draftText(input.siteAddress, "siteAddress", "場所地址", issues, 300);
  draftText(input.applicationDescription, "applicationDescription", "申請說明", issues, 4000);
  const known = new Set(definition.fields.map((field) => field.key));
  for (const key of Object.keys(input.formData)) {
    if (!known.has(key)) issues.push({ path: `formData.${key}`, message: "此類別版本沒有這個欄位" });
  }
  for (const field of definition.fields) {
    checkFieldValue(field, input.formData[field.key], issues, false);
  }
  return issues;
}

export function validateSubmit(
  input: CommonApplicationInput,
  definition: CategoryDefinition,
  activeAttachmentKeys: string[],
): FieldIssue[] {
  const issues = validateDraft(input, definition);
  requiredText(input.organizationName, "organizationName", "業者名稱", issues);
  checkTaxId(input.taxId, issues, true);
  requiredText(input.contactName, "contactName", "聯絡人", issues, 100);
  checkPhone(input.contactPhone, issues, true);
  checkEmail(input.contactEmail, issues, true);
  requiredText(input.organizationAddress, "organizationAddress", "地址", issues, 300);
  requiredText(input.siteName, "siteName", "場所名稱", issues);
  requiredText(input.siteAddress, "siteAddress", "場所地址", issues, 300);
  requiredText(input.applicationDescription, "applicationDescription", "申請說明", issues, 4000);
  if (!input.declarationAccepted) {
    issues.push({ path: "declarationAccepted", message: "請勾選資料聲明" });
  }
  for (const field of definition.fields) {
    checkFieldValue(field, input.formData[field.key], issues, true);
  }
  for (const requirement of definition.attachmentRequirements) {
    if (requirement.requiredOnSubmit && !activeAttachmentKeys.includes(requirement.key)) {
      issues.push({ path: `attachments.${requirement.key}`, message: `請上傳${requirement.label}` });
    }
  }
  return issues;
}

export function normalizeEmpty(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function snapshotPayload(input: CommonApplicationInput, categoryFormVersionId: string) {
  return {
    schemaVersion: 1 as const,
    categoryFormVersionId,
    organizationName: input.organizationName,
    taxId: input.taxId,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    contactEmail: input.contactEmail,
    organizationAddress: input.organizationAddress,
    siteName: input.siteName,
    siteAddress: input.siteAddress,
    applicationDescription: input.applicationDescription,
    declarationAccepted: input.declarationAccepted,
    formData: input.formData,
  };
}

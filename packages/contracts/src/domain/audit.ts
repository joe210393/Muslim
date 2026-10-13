export const AUDIT_PAGE_SIZE = 100;
export const AUDIT_RETENTION_DAYS = 30;

export const AUDIT_CATEGORIES = [
  { key: "AUTH", label: "登入與帳號", detail: "註冊、登入成功或失敗、建立員工、停用帳號，以及功能開關。" },
  { key: "APPLICATION", label: "案件審查", detail: "送件、派案、初審、現場複審、補件、核定與退件。" },
  { key: "CONTRACT", label: "合約", detail: "發出合約、業者簽署，以及登記已續約或未續約。" },
  { key: "TRAINING", label: "教育訓練", detail: "新增或修改課程，以及登錄出席。" },
  { key: "CONTENT", label: "內容管理", detail: "修改首頁、消息、常見問題等前台內容。" },
  { key: "REPORT", label: "報表", detail: "新增、修改、刪除或下載報表，以及匯出案件。" },
  { key: "DATA", label: "資料匯入", detail: "匯入資料、更新業者資料，以及登錄證書。" },
  { key: "PAYMENT", label: "方案與付款", detail: "建立或修改方案、導向綠界付款，以及登錄已收到的款項。" },
  { key: "SYSTEM", label: "系統", detail: "串接設定、示範資料，以及其他未歸類的操作。" },
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["key"];

const ACTIONS: Record<string, { category: AuditCategory; label: string }> = {
  REGISTER: { category: "AUTH", label: "註冊" },
  LOGIN_SUCCESS: { category: "AUTH", label: "登入成功" },
  LOGIN_FAILED: { category: "AUTH", label: "登入失敗" },
  USER_CREATE: { category: "AUTH", label: "建立員工" },
  USER_UPDATE: { category: "AUTH", label: "更新員工" },
  FEATURE_UPDATE: { category: "AUTH", label: "調整功能" },
  SUBMIT: { category: "APPLICATION", label: "送件" },
  START_REVIEW: { category: "APPLICATION", label: "開始初審" },
  PASS_INITIAL: { category: "APPLICATION", label: "初審通過" },
  PASS_SECOND: { category: "APPLICATION", label: "複審通過" },
  APPROVE: { category: "APPLICATION", label: "核定" },
  REQUEST_SUPPLEMENT: { category: "APPLICATION", label: "要求補件" },
  RESUBMIT: { category: "APPLICATION", label: "補件送回" },
  REJECT: { category: "APPLICATION", label: "退件" },
  ASSIGN: { category: "APPLICATION", label: "指派承辦" },
  CONTRACT_ISSUE: { category: "CONTRACT", label: "發出合約" },
  CONTRACT_SIGN: { category: "CONTRACT", label: "簽署合約" },
  CONTRACT_RENEWAL: { category: "CONTRACT", label: "登記續約" },
  COURSE_CREATE: { category: "TRAINING", label: "新增課程" },
  COURSE_UPDATE: { category: "TRAINING", label: "更新課程" },
  ATTENDANCE_UPDATE: { category: "TRAINING", label: "更新出席" },
  SITE_CONTENT_UPDATE: { category: "CONTENT", label: "更新網站內容" },
  EDITORIAL_CREATE: { category: "CONTENT", label: "新增內容" },
  EDITORIAL_UPDATE: { category: "CONTENT", label: "更新內容" },
  EDITORIAL_DELETE: { category: "CONTENT", label: "刪除內容" },
  REPORT_CREATE: { category: "REPORT", label: "新增報表" },
  REPORT_UPDATE: { category: "REPORT", label: "更新報表" },
  REPORT_DELETE: { category: "REPORT", label: "刪除報表" },
  REPORT_EXPORT: { category: "REPORT", label: "下載報表" },
  EXPORT_APPLICATIONS: { category: "REPORT", label: "匯出案件" },
  IMPORT_COMMIT: { category: "DATA", label: "匯入資料" },
  ORGANIZATION_UPDATE: { category: "DATA", label: "更新業者" },
  CERTIFICATION_SAVE: { category: "DATA", label: "登錄證書" },
  PLAN_CREATE: { category: "PAYMENT", label: "建立方案" },
  PLAN_UPDATE: { category: "PAYMENT", label: "更新方案" },
  PAYMENT_RECORD: { category: "PAYMENT", label: "登錄付款" },
  PAYMENT_CHECKOUT: { category: "PAYMENT", label: "建立綠界訂單" },
  PAYMENT_ECPAY: { category: "PAYMENT", label: "綠界付款完成" },
  SEED_DEMO: { category: "SYSTEM", label: "寫入示範資料" },
  INTEGRATION_UPDATE: { category: "SYSTEM", label: "更新串接" },
};

const ENTITY_LABELS: Record<string, string> = {
  User: "帳號",
  Application: "案件",
  ContractRecord: "合約",
  Course: "課程",
  Enrollment: "報名",
  EditorialEntry: "內容",
  SiteContent: "網站內容",
  SavedReport: "報表",
  ImportBatch: "匯入",
  Organization: "業者",
  Certification: "證書",
  ServicePlan: "方案",
  PaymentRecord: "付款",
  Dataset: "系統資料",
};

export function auditRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export function auditCategoryOf(action: string): AuditCategory {
  return ACTIONS[action]?.category ?? "SYSTEM";
}

export function auditActionLabel(action: string) {
  return ACTIONS[action]?.label ?? "其他操作";
}

export function auditEntityLabel(entityType: string) {
  return ENTITY_LABELS[entityType] ?? "其他";
}

export function auditCategoryDetail(key: string) {
  return AUDIT_CATEGORIES.find((item) => item.key === key)?.detail ?? "最近一個月的全部操作。";
}

export function auditActionsIn(category: AuditCategory) {
  return Object.entries(ACTIONS).filter(([, item]) => item.category === category).map(([action]) => action);
}

export function auditActionsOutsideSystem() {
  return Object.entries(ACTIONS).filter(([, item]) => item.category !== "SYSTEM").map(([action]) => action);
}

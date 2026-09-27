export type FieldMeta = {
  entity: string;
  purpose: string;
  label: string;
  prismaField: string;
  dbColumn: string;
  apiField: string;
  type: string;
  nullable: string;
  createRequired: string;
  submitRequired: string;
  defaultValue: string;
  validation: string;
  source: string;
  pages: string;
  sensitivity: "低" | "中" | "高";
  mutable: string;
};

export const fieldMetadata: FieldMeta[] = [
  row("Organization", "業者名稱", "organizationName", "organization_name", "string", "否", "建立必填", "送件必填", "無", "1–200 字", "中", "業者可改自己的組織；申請快照不回寫"),
  row("Organization", "統一編號", "taxId", "tax_id", "string", "是", "註冊必填", "草稿可空、送件必填", "無", "暫定 8 位數字；非空唯一；海外規則待確認", "高", "初版註冊後不在畫面上改統編"),
  row("Organization", "聯絡人", "contactName", "contact_name", "string", "是", "否", "送件快照必填", "無", "最多 100 字", "高", "可改"),
  row("Organization", "聯絡電話", "contactPhone", "contact_phone", "string", "是", "否", "送件快照必填", "無", "字串，保留前導零", "高", "可改"),
  row("Organization", "聯絡 Email", "contactEmail", "contact_email", "string", "是", "否", "送件快照必填", "無", "email", "高", "可改"),
  row("Organization", "地址", "address", "address", "string", "是", "否", "送件時寫入 organizationAddress", "無", "最多 300 字", "高", "可改"),
  row("User", "登入 Email", "email", "email", "string", "否", "必填", "必填", "無", "正規化小寫後唯一", "高", "不可改為他人帳號"),
  row("User", "顯示名稱", "displayName", "display_name", "string", "否", "必填", "必填", "無", "1–100 字", "中", "可改"),
  row("User", "角色", "role", "role", "UserRole", "否", "必填", "必填", "註冊為 APPLICANT", "APPLICANT / CASE_OFFICER / ADMIN", "中", "僅管理員可改內部帳號"),
  row("User", "所屬組織", "organizationId", "organization_id", "uuid", "內部帳號可空", "業者必填", "業者必填", "無", "業者必須有組織", "中", "初版不調動組織"),
  row("User", "是否啟用", "isActive", "is_active", "boolean", "否", "否", "否", "true", "停用後拒絕後續請求", "中", "管理員可改；最後一位管理員不可停用"),
  row("User", "密碼雜湊", "passwordHash", "password_hash", "string", "否", "必填", "不回傳", "無", "只存雜湊，API 不回傳", "高", "僅經改密碼流程"),
  row("Application", "案件編號", "applicationNo", "application_no", "string", "否", "server 產生", "不可由 client 指定", "無", "unique，格式 MF-西元年-序號", "低", "不可改"),
  row("Application", "申請類別", "categoryId", "category_id", "uuid", "否", "建立必填", "必填", "無", "外鍵；草稿可改類別", "低", "未送件草稿可改"),
  row("Application", "表單版本", "categoryFormVersionId", "category_form_version_id", "uuid", "否", "建立時綁定", "必填", "該類別最新版", "送件後不自動改版", "低", "建立時決定"),
  row("Application", "案件狀態", "status", "status", "ApplicationStatus", "否", "是", "僅 workflow", "DRAFT", "禁止魔法數字與任意下拉改狀態", "低", "只經動作"),
  row("Application", "補件返回階段", "resumeStatus", "resume_status", "ApplicationStatus", "是", "否", "補件時寫入", "null", "只允許三種審查階段", "低", "補件結束清空"),
  row("Application", "承辦人", "assignedToId", "assigned_to_id", "uuid", "是", "否", "開始初審前需要", "null", "必須是承辦或管理員", "中", "管理員派案"),
  row("Application", "編輯版本", "version", "version", "int", "否", "是", "每次更新比對", "1", "不符回 409", "低", "server 遞增"),
  row("Application", "業者名稱快照", "organizationNameSnapshot", "organization_name_snapshot", "string", "是", "否", "送件必填", "null", "API 欄位 organizationName", "中", "草稿／補件可改"),
  row("Application", "統編快照", "taxIdSnapshot", "tax_id_snapshot", "string", "是", "否", "送件必填", "null", "API 欄位 taxId", "高", "草稿／補件可改"),
  row("Application", "聯絡人快照", "contactNameSnapshot", "contact_name_snapshot", "string", "是", "否", "送件必填", "null", "API 欄位 contactName", "高", "草稿／補件可改"),
  row("Application", "電話快照", "contactPhoneSnapshot", "contact_phone_snapshot", "string", "是", "否", "送件必填", "null", "API 欄位 contactPhone", "高", "草稿／補件可改"),
  row("Application", "Email 快照", "contactEmailSnapshot", "contact_email_snapshot", "string", "是", "否", "送件必填", "null", "API 欄位 contactEmail", "高", "草稿／補件可改"),
  row("Application", "地址快照", "organizationAddressSnapshot", "organization_address_snapshot", "string", "是", "否", "送件必填", "null", "API 欄位 organizationAddress", "高", "草稿／補件可改"),
  row("Application", "場所名稱", "siteName", "site_name", "string", "是", "否", "送件必填", "null", "最多 200 字", "中", "草稿／補件可改"),
  row("Application", "場所地址", "siteAddress", "site_address", "string", "是", "否", "送件必填", "null", "最多 300 字", "中", "草稿／補件可改"),
  row("Application", "申請說明", "applicationDescription", "application_description", "string", "是", "否", "送件必填", "null", "最多 4000 字", "中", "草稿／補件可改"),
  row("Application", "資料聲明", "declarationAccepted", "declaration_accepted", "boolean", "否", "否", "送件必須 true", "false", "未勾選不能送件", "低", "草稿／補件可改"),
  row("Application", "類別額外欄位", "formData", "form_data", "json", "否", "否", "依類別版本", "{}", "不可含保留 key 或未知欄位", "中", "草稿／補件可改"),
  row("Application", "外部來源", "sourceSystem", "source_system", "string", "與 sourceRecordKey 同空或同有", "否", "匯入時成對", "null", "與 sourceRecordKey 聯合唯一", "低", "匯入寫入"),
  row("Application", "外部鍵", "sourceRecordKey", "source_record_key", "string", "與 sourceSystem 成對", "否", "匯入時成對", "null", "不可只用公司名稱去重", "低", "匯入寫入"),
  row("Enrollment", "實際時數", "attendedMinutes", "attended_minutes", "int", "否", "否", "登錄出席時", "0", "0 到課程 durationMinutes；缺席不可為正", "低", "承辦登錄"),
  row("Enrollment", "完課門檻快照", "requiredAttendanceMinutesSnapshot", "required_attendance_minutes_snapshot", "int", "否", "報名時寫入", "報名時寫入", "報名當下課程門檻", "歷史完課不隨課程門檻默默改變", "低", "報名時固定"),
  row("Enrollment", "出席狀態", "attendanceStatus", "attendance_status", "AttendanceStatus", "否", "否", "否", "NOT_RECORDED", "未登錄不算不合格", "低", "承辦登錄"),
  row("Certification", "證書編號", "certificateNo", "certificate_no", "string", "否", "核定後登錄必填", "必填", "無", "unique；初版人工登錄", "低", "管理員可更正並留紀錄"),
  row("Certification", "核發日", "issuedOnDate", "issued_on_date", "date", "否", "必填", "必填", "無", "YYYY-MM-DD，不可晚於到期日", "低", "管理員可更正"),
  row("Certification", "到期日", "validUntilDate", "valid_until_date", "date", "否", "必填", "必填", "無", "date-only；是否有效依 Asia/Taipei 計算", "低", "管理員可更正"),
  row("Course", "課程名稱", "title", "title", "string", "否", "必填", "必填", "無", "1–200 字", "低", "尚無出席紀錄前可改"),
  row("Course", "名額", "capacity", "capacity", "int", "否", "必填", "必填", "無", "正整數，不可小於有效報名數", "低", "可改但受報名數限制"),
  row("Course", "課程分鐘數", "durationMinutes", "duration_minutes", "int", "否", "必填", "必填", "無", "正整數分鐘", "低", "有出席後初版不改門檻"),
  row("Course", "完課門檻", "requiredAttendanceMinutes", "required_attendance_minutes", "int", "否", "必填", "必填", "無", "0 到課程分鐘數；示範規則", "低", "有出席後初版不改"),
  row("Course", "課程狀態", "status", "status", "CourseStatus", "否", "必填", "必填", "DRAFT", "DRAFT / PUBLISHED / CANCELLED / COMPLETED", "低", "管理端可改"),
  row("FileObject", "儲存鍵", "storageKey", "storage_key", "string", "否", "server 產生", "不回傳實體路徑", "無", "不可覆寫；阻擋路徑穿越", "高", "不可改"),
  row("ApplicationAttachment", "附件要求代碼", "requirementKey", "requirement_key", "string", "否", "上傳必填", "依類別版本", "無", "必須存在於該表單版本", "低", "移除只標 removedAt"),
];

function row(
  entity: string,
  label: string,
  prismaField: string,
  dbColumn: string,
  type: string,
  nullable: string,
  createRequired: string,
  submitRequired: string,
  defaultValue: string,
  validation: string,
  sensitivity: FieldMeta["sensitivity"],
  mutable: string,
): FieldMeta {
  return {
    entity,
    purpose: label,
    label,
    prismaField,
    dbColumn,
    apiField: prismaField.replace(/Snapshot$/, "").replace("organizationAddressSnapshot", "organizationAddress"),
    type,
    nullable,
    createRequired,
    submitRequired,
    defaultValue,
    validation,
    source: "packages/db/prisma/schema.prisma",
    pages: "見 docs/DATA_DICTIONARY.md 使用頁",
    sensitivity,
    mutable,
  };
}

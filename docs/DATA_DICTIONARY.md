# 資料字典

這是跨模組欄位的查閱入口。正式定義以 `packages/db/prisma/schema.prisma`、`packages/contracts` 為準；本檔由 `pnpm docs:generate` 從欄位註冊表產生。

命名例：畫面與 API 的 `taxId` 對應資料庫 `tax_id`。

| Entity | 中文 | API / 程式 | DB | 型別與規則 | 可空 | 建立 | 送件 | 敏感性 | 可否修改 |
|---|---|---|---|---|---|---|---|---|---|
| Organization | 業者名稱 | organizationName | organization_name | string；1–200 字 | 否 | 建立必填 | 送件必填 | 中 | 業者可改自己的組織；申請快照不回寫 |
| Organization | 統一編號 | taxId | tax_id | string；暫定 8 位數字；非空唯一；海外規則待確認 | 是 | 註冊必填 | 草稿可空、送件必填 | 高 | 初版註冊後不在畫面上改統編 |
| Organization | 聯絡人 | contactName | contact_name | string；最多 100 字 | 是 | 否 | 送件快照必填 | 高 | 可改 |
| Organization | 聯絡電話 | contactPhone | contact_phone | string；字串，保留前導零 | 是 | 否 | 送件快照必填 | 高 | 可改 |
| Organization | 聯絡 Email | contactEmail | contact_email | string；email | 是 | 否 | 送件快照必填 | 高 | 可改 |
| Organization | 地址 | address | address | string；最多 300 字 | 是 | 否 | 送件時寫入 organizationAddress | 高 | 可改 |
| User | 登入 Email | email | email | string；正規化小寫後唯一 | 否 | 必填 | 必填 | 高 | 不可改為他人帳號 |
| User | 顯示名稱 | displayName | display_name | string；1–100 字 | 否 | 必填 | 必填 | 中 | 可改 |
| User | 角色 | role | role | UserRole；APPLICANT / CASE_OFFICER / ADMIN | 否 | 必填 | 必填 | 中 | 僅管理員可改內部帳號 |
| User | 所屬組織 | organizationId | organization_id | uuid；業者必須有組織 | 內部帳號可空 | 業者必填 | 業者必填 | 中 | 初版不調動組織 |
| User | 是否啟用 | isActive | is_active | boolean；停用後拒絕後續請求 | 否 | 否 | 否 | 中 | 管理員可改；最後一位管理員不可停用 |
| User | 密碼雜湊 | passwordHash | password_hash | string；只存雜湊，API 不回傳 | 否 | 必填 | 不回傳 | 高 | 僅經改密碼流程 |
| Application | 案件編號 | applicationNo | application_no | string；unique，格式 MF-西元年-序號 | 否 | server 產生 | 不可由 client 指定 | 低 | 不可改 |
| Application | 申請類別 | categoryId | category_id | uuid；外鍵；草稿可改類別 | 否 | 建立必填 | 必填 | 低 | 未送件草稿可改 |
| Application | 表單版本 | categoryFormVersionId | category_form_version_id | uuid；送件後不自動改版 | 否 | 建立時綁定 | 必填 | 低 | 建立時決定 |
| Application | 案件狀態 | status | status | ApplicationStatus；禁止魔法數字與任意下拉改狀態 | 否 | 是 | 僅 workflow | 低 | 只經動作 |
| Application | 補件返回階段 | resumeStatus | resume_status | ApplicationStatus；只允許三種審查階段 | 是 | 否 | 補件時寫入 | 低 | 補件結束清空 |
| Application | 承辦人 | assignedToId | assigned_to_id | uuid；必須是承辦或管理員 | 是 | 否 | 開始初審前需要 | 中 | 管理員派案 |
| Application | 編輯版本 | version | version | int；不符回 409 | 否 | 是 | 每次更新比對 | 低 | server 遞增 |
| Application | 業者名稱快照 | organizationName | organization_name_snapshot | string；API 欄位 organizationName | 是 | 否 | 送件必填 | 中 | 草稿／補件可改 |
| Application | 統編快照 | taxId | tax_id_snapshot | string；API 欄位 taxId | 是 | 否 | 送件必填 | 高 | 草稿／補件可改 |
| Application | 聯絡人快照 | contactName | contact_name_snapshot | string；API 欄位 contactName | 是 | 否 | 送件必填 | 高 | 草稿／補件可改 |
| Application | 電話快照 | contactPhone | contact_phone_snapshot | string；API 欄位 contactPhone | 是 | 否 | 送件必填 | 高 | 草稿／補件可改 |
| Application | Email 快照 | contactEmail | contact_email_snapshot | string；API 欄位 contactEmail | 是 | 否 | 送件必填 | 高 | 草稿／補件可改 |
| Application | 地址快照 | organizationAddress | organization_address_snapshot | string；API 欄位 organizationAddress | 是 | 否 | 送件必填 | 高 | 草稿／補件可改 |
| Application | 場所名稱 | siteName | site_name | string；最多 200 字 | 是 | 否 | 送件必填 | 中 | 草稿／補件可改 |
| Application | 場所地址 | siteAddress | site_address | string；最多 300 字 | 是 | 否 | 送件必填 | 中 | 草稿／補件可改 |
| Application | 申請說明 | applicationDescription | application_description | string；最多 4000 字 | 是 | 否 | 送件必填 | 中 | 草稿／補件可改 |
| Application | 資料聲明 | declarationAccepted | declaration_accepted | boolean；未勾選不能送件 | 否 | 否 | 送件必須 true | 低 | 草稿／補件可改 |
| Application | 類別額外欄位 | formData | form_data | json；不可含保留 key 或未知欄位 | 否 | 否 | 依類別版本 | 中 | 草稿／補件可改 |
| Application | 外部來源 | sourceSystem | source_system | string；與 sourceRecordKey 聯合唯一 | 與 sourceRecordKey 同空或同有 | 否 | 匯入時成對 | 低 | 匯入寫入 |
| Application | 外部鍵 | sourceRecordKey | source_record_key | string；不可只用公司名稱去重 | 與 sourceSystem 成對 | 否 | 匯入時成對 | 低 | 匯入寫入 |
| Enrollment | 實際時數 | attendedMinutes | attended_minutes | int；0 到課程 durationMinutes；缺席不可為正 | 否 | 否 | 登錄出席時 | 低 | 承辦登錄 |
| Enrollment | 完課門檻快照 | requiredAttendanceMinutes | required_attendance_minutes_snapshot | int；歷史完課不隨課程門檻默默改變 | 否 | 報名時寫入 | 報名時寫入 | 低 | 報名時固定 |
| Enrollment | 出席狀態 | attendanceStatus | attendance_status | AttendanceStatus；未登錄不算不合格 | 否 | 否 | 否 | 低 | 承辦登錄 |
| Certification | 證書編號 | certificateNo | certificate_no | string；unique；初版人工登錄 | 否 | 核定後登錄必填 | 必填 | 低 | 管理員可更正並留紀錄 |
| Certification | 核發日 | issuedOnDate | issued_on_date | date；YYYY-MM-DD，不可晚於到期日 | 否 | 必填 | 必填 | 低 | 管理員可更正 |
| Certification | 到期日 | validUntilDate | valid_until_date | date；date-only；是否有效依 Asia/Taipei 計算 | 否 | 必填 | 必填 | 低 | 管理員可更正 |
| Course | 課程名稱 | title | title | string；1–200 字 | 否 | 必填 | 必填 | 低 | 尚無出席紀錄前可改 |
| Course | 名額 | capacity | capacity | int；正整數，不可小於有效報名數 | 否 | 必填 | 必填 | 低 | 可改但受報名數限制 |
| Course | 課程分鐘數 | durationMinutes | duration_minutes | int；正整數分鐘 | 否 | 必填 | 必填 | 低 | 有出席後初版不改門檻 |
| Course | 完課門檻 | requiredAttendanceMinutes | required_attendance_minutes | int；0 到課程分鐘數；示範規則 | 否 | 必填 | 必填 | 低 | 有出席後初版不改 |
| Course | 課程狀態 | status | status | CourseStatus；DRAFT / PUBLISHED / CANCELLED / COMPLETED | 否 | 必填 | 必填 | 低 | 管理端可改 |
| FileObject | 儲存鍵 | storageKey | storage_key | string；不可覆寫；阻擋路徑穿越 | 否 | server 產生 | 不回傳實體路徑 | 高 | 不可改 |
| ApplicationAttachment | 附件要求代碼 | requirementKey | requirement_key | string；必須存在於該表單版本 | 否 | 上傳必填 | 依類別版本 | 低 | 移除只標 removedAt |


## 使用頁面

- Organization / User：註冊、業者資料、會員管理
- Application：申請編輯、案件詳情、管理端審查
- Enrollment / Course：課程、報名、出席與學習紀錄
- Certification：驗證紀錄與核定後人工登錄
- FileObject / ApplicationAttachment：申請附件

環境變數實際值、密碼雜湊與 token 不寫入本檔。密碼雜湊欄位僅標示存在，API 不回傳。

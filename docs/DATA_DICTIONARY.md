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
| Course | YouTube 連結 | youtubeUrl | youtube_url | string；空字串或 youtube.com、youtu.be 影片網址 | 否 | 否 | 否 | 低 | 管理端可改 |
| Course | 圖片 | imageFileId | image_file_id | uuid；JPEG 或 PNG。前台顯示為 imageUrl | 是 | 否 | 否 | 低 | 管理端可換圖 |
| FileObject | 儲存鍵 | storageKey | storage_key | string；不可覆寫；阻擋路徑穿越 | 否 | server 產生 | 不回傳實體路徑 | 高 | 不可改 |
| ApplicationAttachment | 附件要求代碼 | requirementKey | requirement_key | string；必須存在於該表單版本 | 否 | 上傳必填 | 依類別版本 | 低 | 移除只標 removedAt |
| SiteContent | 版位 | slot | slot | ContentSlot；同一版位只有一筆 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| SiteContent | 眉題 | eyebrow | eyebrow | string；1–80 字 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| SiteContent | 標題 | title | title | string；1–200 字 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| SiteContent | 副標 | subtitle | subtitle | string；1–500 字 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| SiteContent | 內文 | body | body | string；1–4000 字 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| SiteContent | 主按鈕文字 | ctaLabel | cta_label | string；最多 40 字 | 否 | 否 | 否 | 低 | 管理員可改 |
| SiteContent | 主按鈕路徑 | ctaHref | cta_href | string；只允許站內路徑 | 否 | 否 | 否 | 低 | 管理員可改 |
| SiteContent | 次按鈕文字 | secondaryCtaLabel | secondary_cta_label | string；最多 40 字 | 否 | 否 | 否 | 低 | 管理員可改 |
| SiteContent | 次按鈕路徑 | secondaryCtaHref | secondary_cta_href | string；只允許站內路徑 | 否 | 否 | 否 | 低 | 管理員可改 |
| SiteContent | 圖片 | imageFileId | image_file_id | uuid；JPEG 或 PNG。每個內容頁都可以換圖 | 是 | 否 | 否 | 低 | 管理員可換圖 |
| SiteContent | YouTube 連結 | youtubeUrl | youtube_url | string；空字串或 youtube.com、youtu.be 影片網址 | 否 | 否 | 否 | 低 | 管理員可改 |
| SiteContent | 是否發布 | isPublished | is_published | boolean；未發布時前台不顯示該版位 | 否 | 否 | 否 | 低 | 管理員可改 |
| EditorialEntry | 種類 | kind | kind | EditorialKind；首頁重點、關於事實、消息、驗證步驟、費用、問答、通知草稿 | 否 | 必填 | 必填 | 低 | 建立後不改種類 |
| EditorialEntry | 代碼 | slug | slug | string；同種類內唯一；小寫英文、數字與連字號。消息網址用此代碼 | 否 | 必填 | 必填 | 低 | 建立後不改 |
| EditorialEntry | 分類 | groupLabel | group_label | string；最多 40 字；常見問題的分類 | 否 | 問答必填 | 問答必填 | 低 | 管理員可改 |
| EditorialEntry | 標題 | title | title | string；1–200 字。問答為問題，費用為項目名稱，關於我們為標籤 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| EditorialEntry | 摘要 | summary | summary | string；最多 500 字。費用為計費方式，通知為寄送時機 | 否 | 消息、費用、通知必填 | 同左 | 低 | 管理員可改 |
| EditorialEntry | 內文 | body | body | string；1–4000 字。問答為答案，費用為金額，關於我們為內容 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| EditorialEntry | 備註 | note | note | string；最多 200 字。費用的退費說明放這裡 | 否 | 否 | 否 | 低 | 管理員可改 |
| EditorialEntry | YouTube 連結 | youtubeUrl | youtube_url | string；最新消息使用。空字串或 YouTube 影片網址 | 否 | 否 | 否 | 低 | 管理員可改 |
| EditorialEntry | 圖片 | imageFileId | image_file_id | uuid；最新消息使用。JPEG 或 PNG，前台顯示為 imageUrl | 是 | 否 | 否 | 低 | 管理員可換圖 |
| EditorialEntry | 發布日 | publishedOn | published_on | date；YYYY-MM-DD。首頁消息依此由新到舊取前五則 | 消息以外可空 | 消息必填 | 消息必填 | 低 | 管理員可改 |
| EditorialEntry | 排序 | sortOrder | sort_order | int；0–9999。同日消息再依此排序 | 否 | 否 | 否 | 低 | 管理員可改 |
| EditorialEntry | 是否發布 | isPublished | is_published | boolean；未發布時前台與首頁都不列出 | 否 | 否 | 否 | 低 | 管理員可改或刪除 |
| ContractTemplate | 範本代碼 | code | code | string；唯一 | 否 | 必填 | 必填 | 低 | 不在畫面上改代碼 |
| ContractTemplate | 範本標題 | title | title | string；1–200 字 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| ContractTemplate | 範本內文 | body | body | string；可用 {{organizationName}} 等代換欄 | 否 | 必填 | 必填 | 低 | 管理員可改，已簽署合約不回寫 |
| ContractRecord | 合約編號 | contractNo | contract_no | string；CT-西元年-序號 | 否 | server 產生 | 不可由 client 指定 | 低 | 不可改 |
| ContractRecord | 合約標題 | title | title | string；1–200 字 | 否 | 發出時寫入 | 必填 | 低 | 待簽署可改 |
| ContractRecord | 合約快照 | body | body_snapshot | string；API 欄位 body | 否 | 發出時寫入 | 必填 | 中 | 待簽署可改；簽署後凍結 |
| ContractRecord | 合約狀態 | status | status | ContractStatus；ISSUED / SIGNED / VOID | 否 | 是 | 僅簽署或作廢 | 低 | 只經動作 |
| ContractRecord | 簽署人 | signerName | signer_name | string；1–100 字 | 是 | 否 | 簽署必填 | 高 | 簽署時寫入 |
| ContractRecord | 簽署人職稱 | signerTitle | signer_title | string；1–100 字 | 是 | 否 | 簽署必填 | 中 | 簽署時寫入 |
| ContractRecord | 人像檔 | faceFileId | face_file_id | uuid；JPEG 或 PNG，最短邊 120 | 是 | 否 | 簽署必填 | 高 | 簽署時寫入 |
| ContractRecord | 手寫簽名檔 | signatureFileId | signature_file_id | uuid；PNG，需有筆畫 | 是 | 否 | 簽署必填 | 高 | 簽署時寫入 |
| ContractRecord | 合約 PDF | pdfFileId | pdf_file_id | uuid；內含簽名與人像 | 是 | 否 | 簽署後產生 | 高 | 簽署時產生 |
| UserFeature | 功能鍵 | featureKey | feature_key | string；與使用者聯合唯一 | 否 | 必填 | 必填 | 中 | 建立帳號時一併勾選；之後可對該帳號開關 |
| UserFeature | 是否啟用 | enabled | enabled | boolean；關閉後該帳號呼叫對應 API 會被拒絕 | 否 | 必填 | 必填 | 中 | 不可關閉最後一個帳號管理 |
| RoleFeature | 功能鍵 | featureKey | feature_key | string；與角色聯合唯一 | 否 | 必填 | 必填 | 中 | 不再用來授權，保留既有資料 |
| RoleFeature | 是否啟用 | enabled | enabled | boolean；已改由 UserFeature 判斷 | 否 | 必填 | 必填 | 中 | 不再用來授權 |
| IntegrationSetting | 串接鍵 | key | key | string；主鍵 | 否 | 必填 | 必填 | 低 | 不可改鍵名 |
| IntegrationSetting | 服務商 | provider | provider | string；1–80 字，不存放金鑰 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| IntegrationSetting | 是否啟用 | enabled | enabled | boolean；關閉後相關上傳或簽署會被拒絕 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| IntegrationSetting | 說明 | note | note | string；1–500 字 | 否 | 必填 | 必填 | 低 | 管理員可改 |
| SavedReport | 報表名稱 | name | name | string；1–80 字，全系統不可重複 | 否 | 必填 | 必填 | 低 | 可改 |
| SavedReport | 欄位組合 | selections | selections | json；可同時包含案件、業者、訓練報名、合約；每個來源的欄位必須在白名單內 | 否 | 必填 | 必填 | 中 | 可改 |
| SavedReport | 顯示方式 | chartKind | chart_kind | string；table / bar / pie | 否 | 否 | 否 | 低 | 可改 |
| SavedReport | 統計欄位 | chartField | chart_field | string；來源.欄位，必須是已勾選欄位 | 否 | 否 | 否 | 低 | 可改 |


## 使用頁面

- Organization / User：註冊、業者資料、會員管理
- Application：申請編輯、案件詳情、管理端審查
- Enrollment / Course：課程、報名、出席與學習紀錄
- Certification：驗證紀錄與核定後人工登錄
- FileObject / ApplicationAttachment：申請附件
- SiteContent / EditorialEntry：首頁、關於我們、最新消息、驗證介紹、常見問題。最新消息是一篇篇文章，圖片與 YouTube 在文章上。首頁消息與課程各顯示前五筆
- Course：公開列表可切換月曆。課程介紹、圖片與 YouTube 在課程頁
- ContractTemplate / ContractRecord：合約範本、發出、簽署與 PDF
- UserFeature / IntegrationSetting：帳號功能與串接開關。RoleFeature 只保留舊資料，不再用來授權
- SavedReport：後台自訂報表。一份報表可同時包含案件、業者、訓練報名、合約的白名單欄位，並以表格、長條圖或圓餅圖查看。密碼、憑證與檔案本體不可選

環境變數實際值、密碼雜湊與 token 不寫入本檔。密碼雜湊欄位僅標示存在，API 不回傳。

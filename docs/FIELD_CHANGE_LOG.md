# 欄位變更紀錄

尚無上線後的改名或刪除。以下是初版建立時固定下來的對照，之後每次新增、改名或刪除都要補一列，並同步 migration、API、表單、示範資料與資料字典。

| 日期 | 變更 | 處理 |
|---|---|---|
| 2026-11-26 | 每一頁可設自己的背景圖 | migration `20261126001500_site_page_background`。`site_pages.draft_background`／`published_background`；前台讀 `backgroundImage`；空＝全站預設底色 |
| 2026-11-22 | 合約可修改與收回 | migration `20261122190000_contract_fill_snapshot`。`contracts.fill_snapshot` 留下黃底欄位。`VOID` 對廠商表示已收回 |
| 2026-11-22 | 證書範本改存資料庫 | migration `20261122180000_certificate_templates`。首次讀取寫入與展示模式相同的 11 份官方內文 |
| 2026-11-20 | 新增合約大小章電子檔設定 | migration `20261120230000_contract_seals`。`contract_seal_settings` 存公司大章／負責人小章 `file_objects` |
| 2026-09-28 | 初版建立。畫面／API `taxId` 對資料庫 `tax_id`；申請快照為 `taxIdSnapshot`／`tax_id_snapshot` | 見 `schema.prisma` 與 `docs/DATA_DICTIONARY.md` |
| 2026-10-11 | 新增首頁版位、合約範本與合約、角色功能、串接設定 | migration `20261011000000_site_and_contracts`。合約快照 API 欄位為 `body` |
| 2026-10-12 | 功能改掛在帳號上 | migration `20261012000000_account_features`。建立帳號時傳 `features`。`role_features` 保留，不再用來授權 |
| 2026-10-12 | 前台五個頁面改由內容管理儲存 | migration `20261012120000_editorial_content`。版位增加關於我們、最新消息、驗證介紹、常見問題。可重複的文字放 `editorial_entries` |
| 2026-10-12 | 每個內容頁可放 YouTube 連結 | migration `20261012140000_site_youtube`。`youtube_url` 只接受 YouTube 網址 |
| 2026-10-12 | 最新消息與課程可放圖片、YouTube | migration `20261012160000_blog_media`。消息文章與課程各有 `youtube_url`、`image_file_id` |
| 2026-10-12 | 新增自訂報表 | migration `20261012180000_saved_reports`。`saved_reports` 存名稱、來源與勾選欄位。密碼、憑證與檔案本體不可選 |
| 2026-10-12 | 自訂報表改為跨來源組合 | migration `20261012190000_report_selections`。`source`、`field_keys` 併入 `selections`。另存 `chart_kind`、`chart_field` |
| 2026-10-12 | 首頁圖庫 | migration `20261012200000_home_gallery`。`editorial_kind` 增加 `HOME_GALLERY`，一筆一張輪播圖 |
| 2026-10-12 | 案件欄位審查 | migration `20261012210000_field_reviews`。`applications.field_reviews` 記錄每個送件欄位要不要補件、公開意見與內部註記 |
| 2026-10-12 | 課程分線上與線下 | migration `20261012220000_course_delivery`。`delivery`、`video_file_id`、`video_duration_seconds`、`watched_seconds`。線下才用地點；線上通過門檻是影片秒數的三分之二 |
| 2026-10-12 | 合約範本可多版 | migration `20261012230000_contract_template_revisions`。`code` 不再單獨唯一，改與 `revision` 聯合唯一。既有範本為第 1 版。發出合約時選定 `templateId` |
| 2026-10-12 | 合約增加續約狀態 | migration `20261012240000_contract_renewal_status`。`contract_status` 增加 `RENEWED`、`NOT_RENEWED`。已發出的內文不再由管理員修改 |
| 2026-10-12 | 操作紀錄只留 30 天 | 沒有新增欄位。查詢時刪除 `created_at` 早於 30 天的 `audit_logs`。分類由既有 `action` 對照，不另存 |
| 2026-10-13 | 方案與付款 | migration `20261013000000_service_plans`。`service_plans` 存方案、金額與付款網址。`payment_records` 存已登錄收款與當時的業者、方案、金額 |
| 2026-10-13 | 綠界訂單 | migration `20261013010000_ecpay_payments`。`payment_records` 增加 `status`、`merchant_trade_no`、`ecpay_trade_no`、`payment_method`。待付款的 `paid_at` 可空。金鑰不入庫 |
| 2026-10-13 | 方案內容加長 | migration `20261013020000_plan_description`。`service_plans.description` 由 500 字改為 4000 字。沒有新增欄位 |
| 2026-11-21 | 合約對應申請 | migration `20261121090000_contract_application`。`contracts.application_id` 可空，發出時可綁尚未完成合約的申請 |
| 2026-11-21 | 大小章位置 | migration `20261121140000_seal_positions`。`contract_seal_settings` 增加公司／負責人章 X/Y（甲方欄位百分比） |
| 2026-11-21 | 證書內文快照 | migration `20261121160000_certification_body`。`certifications` 增加 `template_key`、`body_html` |
| 2026-11-22 | 案件列表帶證書編號 | 沒有新增欄位或 migration。`applicationListItemSchema` 增加衍生欄位 `certificateNo`（由既有 `certifications` 關聯帶出，未發證為 null）；列表查詢增加 `certification=pending\|issued`。API mapper 與 mock 同步 |
| 2026-11-21 | 證書範本 Logo | 各 CertificateTemplateKey 對應 `/cert-logos/*`；後台可上傳覆寫 `logoUrl`／`logoFileId`（mock）；版式對齊官方 PDF 置中 Logo |
| 2026-11-21 | 證書範本簽名檔 | 新增 `signatureUrl`／`signatureFileId`（mock）；後台可上傳；下載時以範本目前簽名覆寫，舊證書缺槽位會自動補在「驗證單位」後 |
| 2026-11-21 | 合約／證書內文 HTML（body、bodySnapshot、bodyHtml） | 清理器新增保留 `style` 的 `text-align`（段落／標題／儲存格）與 `font-size: Npt`（span，6–72pt），其餘樣式仍移除；規則在 `packages/contracts/src/domain/rich-text.ts` |
| 2026-10-24 | 名稱改為 HALAL | migration `20261024000000_halal_spelling`。合約範本代碼 `HALA_SERVICE_V1` 改為 `HALAL_SERVICE_V1`。頁面內容、內容條目與合約範本裡的 HALA 改成 HALAL。已發出與已簽署的合約保留原文。沒有新增欄位 |
| 2026-10-28 | 申請類別改為空白申請表 | 沒有新增欄位。`application_categories` 的名稱改為七份空白表。另建已確認的 `category_form_versions`。已建立的案件仍指向舊版本 |
| 2026-10-28 | 檢查表照片 | 沒有新增欄位。新的表單版本在附件定義加上 `group: checklist`。已建立的案件仍用沒有檢查表的版本 |
| 2026-10-28 | 指定複審人員與現場結果 | migration `20261028000000_site_reviewer`。`applications.site_reviewer_id` 在初審通過時指定。`applications.site_checks` 記附件通過或沒通過。`application_attachments.captured_on_site` 標記檢查表上補拍的現場照片。既有列用預設空值 |

# 欄位變更紀錄

尚無上線後的改名或刪除。以下是初版建立時固定下來的對照，之後每次新增、改名或刪除都要補一列，並同步 migration、API、表單、示範資料與資料字典。

| 日期 | 變更 | 處理 |
|---|---|---|
| 2026-09-28 | 初版建立。畫面／API `taxId` 對資料庫 `tax_id`；申請快照為 `taxIdSnapshot`／`tax_id_snapshot` | 見 `schema.prisma` 與 `docs/DATA_DICTIONARY.md` |
| 2026-10-11 | 新增首頁版位、合約範本與合約、角色功能、串接設定 | migration `20261011000000_site_and_contracts`。合約快照 API 欄位為 `body` |
| 2026-10-12 | 功能改掛在帳號上 | migration `20261012000000_account_features`。建立帳號時傳 `features`。`role_features` 保留，不再用來授權 |
| 2026-10-12 | 前台五個頁面改由內容管理儲存 | migration `20261012120000_editorial_content`。版位增加關於我們、最新消息、驗證介紹、常見問題。可重複的文字放 `editorial_entries` |
| 2026-10-12 | 每個內容頁可放 YouTube 連結 | migration `20261012140000_site_youtube`。`youtube_url` 只接受 YouTube 網址 |
| 2026-10-12 | 最新消息與課程可放圖片、YouTube | migration `20261012160000_blog_media`。消息文章與課程各有 `youtube_url`、`image_file_id` |
| 2026-10-12 | 新增自訂報表 | migration `20261012180000_saved_reports`。`saved_reports` 存名稱、來源與勾選欄位。密碼、憑證與檔案本體不可選 |
| 2026-10-12 | 自訂報表改為跨來源組合 | migration `20261012190000_report_selections`。`source`、`field_keys` 併入 `selections`。另存 `chart_kind`、`chart_field` |

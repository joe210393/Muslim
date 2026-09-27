# 欄位變更紀錄

尚無上線後的改名或刪除。以下是初版建立時固定下來的對照，之後每次新增、改名或刪除都要補一列，並同步 migration、API、表單、示範資料與資料字典。

| 日期 | 變更 | 處理 |
|---|---|---|
| 2026-09-28 | 初版建立。畫面／API `taxId` 對資料庫 `tax_id`；申請快照為 `taxIdSnapshot`／`tax_id_snapshot` | 見 `schema.prisma` 與 `docs/DATA_DICTIONARY.md` |

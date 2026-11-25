# 封存目錄

這裡放從專案根目錄移出、目前不參與執行的檔案。正式規格與進度仍以根目錄的 `PROJECT_SPEC.md`、`docs/` 為準。

| 路徑 | 說明 |
|---|---|
| `specs/` | 與 `PROJECT_SPEC.md` 重複或過期的規格／測試報告 |
| `dev-scripts/` | 過去本機手動跑過的 e2e／角色腳本（非正式測試套件） |
| `local/` | 本機產物（截圖、log）；已列在 `.gitignore`，不會進版控 |

不要把 `local/` 裡的大型產物 commit 進倉庫。

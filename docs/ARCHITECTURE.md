# 架構

模組化單體。網站、API、共用契約與資料庫 schema 在同一個 pnpm workspace，部署時由 API 行程提供正式前端靜態檔。

```text
apps/web  → 只呼叫 Services
              ├─ mock（VITE_DATA_MODE=mock，正式建置會拒絕）
              └─ http（VITE_DATA_MODE=api，失敗不改走 mock）
apps/api  → Express /api/v1
packages/contracts → 狀態、驗證、權限、API schema、示範資料
packages/db → Prisma schema 與只給伺服器使用的 client
```

瀏覽器不可 import `@mf/db/server`。列舉從 `@mf/db/enums` 進入 contracts，再給前後端共用。

## 執行模式

| 模式 | 資料 | 何時使用 |
|---|---|---|
| mock | IndexedDB | 沒有資料庫時展示完整按鈕流程 |
| api + PostgreSQL | 本機 Docker 或 Zeabur | 同一畫面改接真實 API |
| production | PostgreSQL、本機磁碟 Volume | `DEMO_MODE` 必須關閉，郵件不可只用主控台 |

## 部署拓撲

Zeabur 上是一個服務加上 PostgreSQL。檔案放在掛載的 Volume，路徑由 `UPLOAD_ROOT` 決定。重啟不會清資料庫，但沒掛 Volume 時上傳檔會消失。詳見 `docs/DEPLOY_ZEABUR.md`。

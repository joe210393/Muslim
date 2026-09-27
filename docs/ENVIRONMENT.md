# 環境變數

實際值只放在未提交的 `.env`。本檔不記錄連線字串、密碼或 token。

| 變數 | 用途 | 正式環境 |
|---|---|---|
| `NODE_ENV` | Node 執行模式 | `production` |
| `APP_ENV` | `local`、`staging` 或 `production` | `production` |
| `PORT` | API 監聽埠 | 由平台指定 |
| `DATABASE_URL` | PostgreSQL 連線 | 必填，使用平台密鑰 |
| `SESSION_SECRET` | session 簽章用 | 必填且不可用範例短字串 |
| `APP_BASE_URL` | 對外網址，重設密碼連結使用 | 必填 |
| `STORAGE_DRIVER` | 目前只接受 `local` | `local` |
| `UPLOAD_ROOT` | 上傳目錄，正式環境指向 Volume | 必填 |
| `MAIL_DRIVER` | `console` 或 `smtp` | 不可為 `console` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `MAIL_FROM` | SMTP | `smtp` 時主機必填 |
| `DEMO_MODE` | 允許示範類別送件與種子 | 必須 `false` |
| `VITE_DATA_MODE` | `mock` 或 `api` | build 必須 `api` |
| `VITE_API_BASE_URL` | 前端 API 前綴 | `/api/v1` |
| `WEB_DEV_ORIGIN` | 本機 CORS 來源 | 正式環境改用 `APP_BASE_URL` |

`APP_ENV=production` 時，程式拒絕 `DEMO_MODE=true`、`MAIL_DRIVER=console`，以及過短的 `SESSION_SECRET`。

# Zeabur 部署

這份文件說明怎麼部署。目前沒有建立 Zeabur 專案，也沒有排程備份。

## 服務

1. 在同一個 Zeabur 專案建立 PostgreSQL。
2. 建立 Node 服務，使用專案根目錄的 `Dockerfile`。啟動時會執行 `pnpm db:migrate`，不要在正式庫執行 seed。
3. 在網站服務的 Variables 設定：

| 變數 | 值 |
|---|---|
| `DATABASE_URL` | `${POSTGRES_CONNECTION_STRING}` |
| `APP_BASE_URL` | 對外網址，例如 `https://muslim.zeabur.app` |
| `SESSION_SECRET` | 至少 32 字元的隨機字串 |
| `APP_ENV` | 還沒有 SMTP 時用 `staging`。設成 `production` 時必須同時把 `MAIL_DRIVER` 設成 `smtp`，且 `DEMO_MODE=false` |
| `DEMO_MODE` | `false` |
| `VITE_DATA_MODE` | `api` |
| `UPLOAD_ROOT` | Volume 掛載路徑，例如 `/data/uploads` |

`DATABASE_URL` 要選變數引用，不要貼本機的 `127.0.0.1`。服務與資料庫必須在同一個 Zeabur 專案，才連得到 `.zeabur.internal`。

4. 掛載 Volume 到 `UPLOAD_ROOT`。沒有 Volume 時，重啟後上傳檔會不見。

## 建置與啟動

映像在建置時產生 Prisma client，並以 `VITE_DATA_MODE=api` 建置網站。啟動命令是 `pnpm --filter @mf/api start`。正式模式由 API 提供 `apps/web/dist`，並拒絕展示模式。

API 目前以 `tsx` 執行 TypeScript，沒有另外輸出編譯後的 `dist`。這是原型部署方式。

## 備份與回復

- 資料庫：在維護視窗手動 `pg_dump`，回復用 `psql` 還原到新庫後再改 `DATABASE_URL`。
- 檔案：複製 Volume 內的上傳目錄。只還原資料庫而沒有檔案時，附件下載會失敗。
- 尚未設定自動備份、異地複本或回復演練。上線前必須另行安排。

## 健康檢查

- `GET /health/live` 只回程序活著。
- `GET /health/ready` 會查資料庫。

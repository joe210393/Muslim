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
| `DEMO_MODE` | 展示站設 `true`，才可以使用 `applicant01@example.test` 等帳號送出示範類別。正式上線設 `false` |
| `VITE_DATA_MODE` | `api` |
| `UPLOAD_ROOT` | Volume 掛載路徑，例如 `/data/uploads` |

`DATABASE_URL` 要選變數引用，不要貼本機的 `127.0.0.1`。服務與資料庫必須在同一個 Zeabur 專案，才連得到 `.zeabur.internal`。

4. 掛載 Volume 到 `UPLOAD_ROOT`。沒有 Volume 時，重啟後上傳檔會不見。

## 資料庫要掛在 PostgreSQL 18 的資料目錄

網站服務重新部署不會清資料庫。資料消失，是 PostgreSQL 服務自己的資料目錄沒有掛 Volume。PostgreSQL 18 的資料在 `/var/lib/postgresql/18/docker`，不是舊版的 `/var/lib/postgresql/data`。

在 **PostgreSQL 服務**（不是網站服務）設定：

| 位置 | 值 |
|---|---|
| Volume 掛載目錄 | `/var/lib/postgresql/18/docker` |
| `PGDATA` | `/var/lib/postgresql/18/docker/pgdata` |
| `POSTGRES_DB` | `zeabur` |
| `POSTGRES_USER` | `root` |
| `POSTGRES_USERNAME` | `${POSTGRES_USER}` |
| `POSTGRES_PASSWORD` | `${PASSWORD}` |
| `POSTGRES_HOST` | `${CONTAINER_HOSTNAME}` |
| `POSTGRES_PORT` | `${DATABASE_PORT}` |
| `POSTGRES_DATABASE` | `${POSTGRES_DB}` |
| `POSTGRES_CONNECTION_STRING` | `postgresql://${POSTGRES_USERNAME}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}` |
| `POSTGRES_URI` | `${POSTGRES_CONNECTION_STRING}` |

`PASSWORD` 只放在 Zeabur 的 PostgreSQL 服務變數裡，用平台產生的值。不要寫進 Git、`.env` 或文件。網站服務的 `DATABASE_URL` 維持 `${POSTGRES_CONNECTION_STRING}`，不要貼完整連線字串。

第一次把 Volume 掛到這個目錄時，Zeabur 會把該目錄當成新的空磁碟。之後再重新部署，資料庫才會留著。

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

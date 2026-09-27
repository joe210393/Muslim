# Zeabur 部署

這份文件說明怎麼部署。目前沒有建立 Zeabur 專案，也沒有排程備份。

## 服務

1. 建立 PostgreSQL。
2. 建立一個 Node 服務，使用專案根目錄的 `Dockerfile`。
3. 設定環境變數，見 `docs/ENVIRONMENT.md`。正式環境 `DEMO_MODE=false`、`VITE_DATA_MODE=api`、`MAIL_DRIVER=smtp`、`APP_ENV=production`。
4. 掛載 Volume 到 `UPLOAD_ROOT`。沒有 Volume 時，重啟後上傳檔會不見。
5. 第一次啟動前執行 migration：`pnpm db:migrate`。不要在正式庫執行 seed。

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

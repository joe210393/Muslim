# API

前綴 `/api/v1`。成功回應為 `{ success: true, data, requestId }`，列表可帶 `meta`。失敗為 `{ success: false, error: { code, message, fieldErrors? }, requestId }`。

除 `GET`、`HEAD`、`OPTIONS` 外，要帶 cookie `mf_csrf` 與標頭 `x-csrf-token`。登入後使用 HttpOnly cookie `mf_session`。

## 公開與身分

| 方法與路徑 | 角色 | 作用 |
|---|---|---|
| `GET /health/live` | 無 | 程序存活 |
| `GET /health/ready` | 無 | 資料庫可查詢 |
| `GET /public-config` | 無 | 檔案限制與是否為示範模式 |
| `GET /auth/csrf` | 無 | 發 CSRF token |
| `POST /auth/register` | 無 | 建立新業者與申請人；統編已存在不會加入該組織 |
| `POST /auth/login` | 無 | 建立 session |
| `POST /auth/logout` | 已登入 | 刪除 session |
| `GET /auth/me` | 已登入 | 目前使用者 |
| `POST /auth/forgot-password` | 無 | 一律回相同訊息；主控台模式不回傳重設網址 |
| `POST /auth/reset-password` | 無 | 使用一次性 token |
| `POST /auth/change-password` | 已登入 | 變更密碼 |

## 業者

| 方法與路徑 | 角色 | 範圍 |
|---|---|---|
| `GET /organizations/me` | 業者 | 自己的組織 |
| `PATCH /organizations/me` | 業者 | 不改統編 |
| `GET /application-categories` | 已登入 | 啟用類別與最新表單版本 |
| `GET /applications` | 依角色 | 業者看同組織，承辦看派給自己的，管理員看全部 |
| `POST /applications` | 業者 | 建立草稿並綁定最新表單版本 |
| `GET /applications/:id` | 依角色 | 無權限回 404 |
| `PATCH /applications/:id` | 業者 | 草稿或補件；版本不符 409 |
| `POST /applications/:id/submit` | 業者 | 驗證完整後送件 |
| `POST /applications/:id/resubmit` | 業者 | 回到補件前階段 |
| `GET /applications/:id/events` | 依角色 | 業者看不到內部註記 |
| `GET /applications/:id/submissions` | 依角色 | 送件快照 |
| `POST /applications/:id/attachments` | 業者 | multipart `file` 與 `requirementKey` |
| `DELETE /applications/:id/attachments/:attachmentId` | 業者 | 只標 `removedAt` |
| `GET /files/:fileId/download` | 依案件權限 | 下載附件 |

## 課程與驗證紀錄

| 方法與路徑 | 角色 | 作用 |
|---|---|---|
| `GET /courses` | 公開 | 不含草稿課程 |
| `GET /courses/:id` | 公開 | 草稿只給內部人員 |
| `POST /courses/:id/enrollments` | 業者 | 名額內報名 |
| `POST /enrollments/:id/cancel` | 業者 | 取消自己的報名 |
| `GET /enrollments/mine` | 業者 | 報名與學習紀錄 |
| `GET /learning-records/mine` | 業者 | 同上 |
| `GET /certifications/mine` | 業者 | 同組織驗證紀錄；是否有效依台北日期計算 |
| `GET /portal/summary` | 業者 | 首頁摘要 |

## 管理

| 方法與路徑 | 角色 | 作用 |
|---|---|---|
| `GET /admin/summary` | 承辦、管理員 | 承辦只統計自己的案件 |
| `GET /admin/applications` | 承辦、管理員 | 案件列表 |
| `GET /admin/applications/export` | 承辦、管理員 | CSV，公式字元已處理 |
| `GET /admin/applications/:id` | 承辦、管理員 | 案件詳情 |
| `POST /admin/applications/:id/assign` | 管理員 | 派案 |
| `POST /admin/applications/:id/actions` | 承辦、管理員 | 審查；核定與退件限管理員 |
| `POST` 或 `PATCH /admin/applications/:id/certification` | 管理員 | 僅已核定案件可登錄 |
| `GET /admin/courses` | 承辦、管理員 | 含草稿 |
| `POST /admin/courses` | 承辦、管理員 | 建立課程 |
| `PATCH /admin/courses/:id` | 承辦、管理員 | 修改課程 |
| `GET /admin/courses/:id/enrollments` | 承辦、管理員 | 名冊 |
| `GET /admin/courses/:id/enrollments/export` | 承辦、管理員 | 名冊 CSV |
| `PATCH /admin/enrollments/:id/attendance` | 承辦、管理員 | 登錄出席與分鐘 |
| `GET /admin/users` | 管理員 | 內部帳號 |
| `POST /admin/users` | 管理員 | 建立承辦或管理員 |
| `PATCH /admin/users/:id` | 管理員 | 停用或改角色 |
| `GET /admin/organizations` | 管理員 | 業者列表 |
| `GET /admin/organizations/:id` | 管理員 | 業者詳情 |
| `GET /admin/imports/template/:type` | 管理員 | `ORGANIZATIONS` 或 `APPLICATION_DRAFTS` |
| `POST /admin/imports/preview` | 管理員 | 只預覽，不寫入業務資料 |
| `POST /admin/imports/:id/commit` | 管理員 | 整批成功或整批不寫；相同 requestId 不重複 |
| `GET /admin/audit-logs` | 管理員 | 稽核，不含密碼與 token |

常見錯誤碼：`VALIDATION_ERROR`、`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`VERSION_CONFLICT`、`CATEGORY_NOT_CONFIRMED`、`INTERNAL`。

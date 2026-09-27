# 穆斯林友善驗證線上申請暨審核系統

70 萬精簡版原型。同一套畫面可先用瀏覽器展示資料操作，再改接 PostgreSQL API。正式類別名稱與表單內容尚未取得，畫面標示為示範或待確認。

## 需求

- Node.js 22
- pnpm 10.29.3（`packageManager` 已指定）
- 串接資料庫時需要 Docker，用來啟動本機 PostgreSQL 16

## 第一次啟動（展示模式，不必開資料庫）

```bash
pnpm install
cp .env.example .env
pnpm dev:web
```

開啟 `http://127.0.0.1:5173`。`.env` 預設 `VITE_DATA_MODE=mock`。展示帳號密碼是 `Demo1234!`：

| Email | 角色 |
|---|---|
| applicant01@example.test | 業者 |
| officer.lin@example.test | 承辦 |
| officer.chen@example.test | 承辦 |
| admin@example.test | 管理員 |

展示資料存在瀏覽器 IndexedDB（`mf-demo`）。右上角可以切換展示帳號或重設資料。這不是正式登入，也不會寄出郵件。

## 串接本機 API 與 PostgreSQL

```bash
pnpm dev:db
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

把 `.env` 與 `apps/web/.env` 的 `VITE_DATA_MODE` 改成 `api`，然後：

```bash
pnpm dev
```

網站仍是 `http://127.0.0.1:5173`，`/api` 會轉到 `http://127.0.0.1:4000`。種子帳號與展示模式相同，密碼只存在本機種子，正式環境禁止 `DEMO_MODE=true`。

## 常用指令

| 指令 | 作用 |
|---|---|
| `pnpm dev:web` | 只開網站 |
| `pnpm dev:api` | 只開 API |
| `pnpm db:migrate` | 套用既有 migration，不重置資料 |
| `pnpm db:seed` | 寫入示範資料；不會清空既有案件 |
| `pnpm docs:generate` | 由欄位註冊表產生資料字典 |
| `pnpm check` | 格式、lint、型別、schema、契約、字典與測試 |
| `pnpm test` | Vitest |

## 資料定義從哪裡查

- 欄位對照：`docs/DATA_DICTIONARY.md`
- 資料表：`packages/db/prisma/schema.prisma`
- API 與驗證：`packages/contracts`
- 欄位異動紀錄：`docs/FIELD_CHANGE_LOG.md`

畫面欄位 `taxId`、API `taxId`、資料庫 `tax_id` 是同一件事。

## 尚未完成

付款、發票、QR 報到、簡訊、LINE、AI 審核、正式 PDF 證書與自動發證都不在範圍內。郵件預設只寫主控台並標成未寄出。備份排程尚未設定。驗收結果以 `docs/TEST_CASES.md` 為準，未執行的項目會標示未測。

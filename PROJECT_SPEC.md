# Cursor 完整開發提示詞：穆斯林友善驗證線上申請暨審核系統

版本：初版原型規格 v1.0｜整理日期：2026-09-28

使用方式：將本檔放到專案根目錄，命名為 `PROJECT_SPEC.md`，在 Cursor Agent 中引用整份文件，要求依序實作。本文的金額與查核背景用於限制範圍，不需顯示在產品介面。

---

## 01. 你的任務與完成標準

你是本專案的全端工程師。請依這份規格，在目前工作目錄實際建立「穆斯林友善驗證線上申請暨審核系統」的可操作初版，供業主檢視畫面、功能與流程。

請直接建立檔案、撰寫程式、啟動系統與檢查主要流程，不要只回覆架構建議或程式片段。先檢查目前目錄、README、既有規則、package.json、lockfile、資料庫 schema 及未提交變更；空專案才依本規格初始化，既有專案採漸進修改。

### 本次交付的兩個完成層級

1. **可操作展示版**：完整前台、會員端、後台畫面；使用一致的示範資料，可填表、儲存、送件、審核、補件、報名、登錄出席及時數。沒有資料庫時也能啟動展示。
2. **真實資料庫初版**：同一組畫面切換至 API，使用 PostgreSQL 持久儲存資料；登入、權限、資料驗證、審核流程與關鍵操作確實由後端執行。

依序完成兩層，不要展示版做好就自行宣稱正式系統完成。若資料庫或外部服務目前無法連接，先完成可操作展示版、schema、migration 與 API 程式，並明列尚未實際驗證的部分；不可把模擬寄信或模擬資料庫寫入說成成功串接。

### 工作方式

- 先建立精簡工作清單，再立即實作；每階段完成更新 `docs/PROGRESS.md`。
- 一般技術選擇自行決定並記錄，不要每做一頁就停下問是否繼續。
- 缺少正式業務資料時，使用清楚標記的示範設定，記錄於 `docs/OPEN_QUESTIONS.md`，繼續不受影響的部分。
- 不覆蓋現有使用者程式、不任意重建資料庫、不刪除既有 migration。
- 不自動建立付費服務、不自動公開部署；交付可部署程式與操作步驟即可。
- 開發過程以繁體中文說明進度。不能執行的檢查如實列出，不虛構測試通過。

## 02. 專案背景與初版範圍

本案由單人主要開發，採 70 萬元精簡版範圍，預定部署 Zeabur。請採用模組化單體架構，控制依賴與維運工作量。

### 必須具備

- 公開課程資訊、申請說明與登入入口。
- 業者註冊、登入、登出、忘記密碼、帳號資料維護。
- 7 類驗證申請的共用表單骨架、類別欄位設定、附件清單、手動儲存草稿。
- 送件、案件查詢、承辦派案、初審、複審、核定、補件、退件。
- 可追查的案件歷程、補件前後版本、重要操作紀錄。
- 課程梯次、報名、名單、人工出席及時數登錄、完課紀錄。
- 證書核定資料與效期人工登錄、查詢；初版不自動產製證書。
- 固定三種角色的權限管理、基本資料匯出與管理。
- Zeabur 部署準備、資料備份與回復說明。

### 初版範圍外

不實作金流、電子發票、QR 報到、直播或線上教學平台、簡訊、LINE、AI 審查、站內訊息聊天室、複雜動態明細表、附件整包 ZIP、指定版型 PDF、電子簽章、自動換證、證書自動核發或到期排程通知、通用工作流程引擎、可任意新增角色的權限編輯器。

不要為範圍外功能放一堆無法使用的按鈕。需要的地方以簡短說明呈現目前的人工流程。

### 待確認的業務資料

目前只知道共有 7 類，且第 1 類涉及 Halal 廚房／餐廳／友善餐廳。其餘類別名稱、各類正式表單、附件一至九的正式名稱及審查細則尚未完整提供。

- 使用穩定代碼 `CAT_01` 至 `CAT_07`。
- `CAT_01` 暫顯示「第 1 類：廚房／餐廳相關（名稱待確認）」。
- 其餘顯示「第 2 類（待提供正式名稱）」等，不自行杜撰官方分類。
- 所有暫定欄位、附件要求、學習時數及完課規則皆標註「示範設定」。
- 本地展示可操作示範類別；正式環境必須使用已確認且啟用的類別設定才能送件。
- 教育訓練是否為申請資格、需幾小時、效期多久，先顯示資料供承辦參考，不自行加上硬性阻擋或資格認定。

## 03. 技術架構

空專案預設採以下組合；若已有成熟技術棧，保留可用部分，記錄差異與理由。

| 層級 | 選擇 | 用途 |
|---|---|---|
| 前端 | React、TypeScript、Vite、React Router | 公開、會員及管理畫面 |
| UI | Tailwind CSS、shadcn/ui、Lucide | 統一元件與圖示 |
| 表單 | React Hook Form、Zod | 表單狀態與共用驗證 |
| API 狀態 | TanStack Query | 請求、快取與操作後更新 |
| 後端 | Node.js、Express、TypeScript | 模組化 REST API |
| 資料庫 | PostgreSQL、Prisma | 關聯資料、交易、migration |
| 共用契約 | TypeScript、Zod、Prisma 產生的 enum | 前後端欄位與狀態一致 |
| 測試 | Vitest；核心 API 整合測試；Playwright 關鍵流程 | 驗證資料與權限邊界 |
| 套件管理 | pnpm workspace | 共用套件與單一 lockfile |
| 部署 | Zeabur 上的 Web/API 服務與 PostgreSQL | 初期維持簡單拓撲 |

選用執行當下相容且受維護的穩定版本，先核對官方文件，鎖定 lockfile、Node 版本及 packageManager。不要混用不同大版本的 Prisma、Tailwind 或 UI 套件範例。

部署初版可以讓 Express 提供 Vite build 後的靜態頁面及 `/api/v1`，共用一個來源，減少 cookie、CORS 與服務數量的複雜度。本地仍由 Vite dev server 代理 API。資料庫獨立服務。

### 模組分工

| 模組 | 責任 |
|---|---|
| auth | 身分驗證、session、密碼重設 |
| users / organizations | 帳號、業者資料與會員所屬組織 |
| categories | 七類申請設定、欄位定義、版本 |
| applications | 草稿、送件、申請內容及申請快照 |
| reviews | 派案、流程動作、補件與意見 |
| files | 附件接收、保存、授權下載 |
| training | 課程、報名、出席與時數 |
| certifications | 驗證證書資料與效期登錄 |
| notifications | 必要郵件的寄送介面及結果紀錄 |
| audit | 重要操作的追查紀錄 |
| imports / exports | CSV 匯入預覽及授權匯出 |

Controller 處理 HTTP；Service 執行業務流程與交易；Repository 或模組資料存取函式操作 Prisma。不要把所有功能塞到 `server.ts`，也不必為每個簡單查詢建立過度抽象的層次。

## 04. 檔案結構

以下為必須建立的主要位置，依實際使用的工具補齊設定檔。

| 位置 | 內容 |
|---|---|
| `PROJECT_SPEC.md` | 本需求主文件 |
| `.cursor/rules/00-project.mdc` | 簡短、持續套用的開發規則 |
| `apps/web/src/app/` | 路由、Provider、主版型 |
| `apps/web/src/pages/public/` | 公開頁 |
| `apps/web/src/pages/portal/` | 業者會員頁 |
| `apps/web/src/pages/admin/` | 管理頁 |
| `apps/web/src/components/` | 表單、表格、狀態標籤、上傳等元件 |
| `apps/web/src/services/` | 統一服務介面、HTTP 與 mock adapter |
| `apps/web/src/mocks/` | 示範資料、展示儲存及重設 |
| `apps/web/src/config/` | 前端路由、導覽與安全的公開設定 |
| `apps/api/src/modules/` | 上述各後端模組 |
| `apps/api/src/middleware/` | 登入、授權、輸入驗證及錯誤處理 |
| `apps/api/src/config/env.ts` | 後端環境變數驗證 |
| `apps/api/src/storage/` | LocalStorageAdapter 與 StorageAdapter 介面 |
| `apps/api/src/app.ts` | Express 組裝與測試入口 |
| `apps/api/src/server.ts` | 啟動、port、關閉處理 |
| `packages/db/prisma/schema.prisma` | 資料模型與資料庫 enum 的唯一來源 |
| `packages/db/prisma/migrations/` | 按時間記錄的資料庫變更 |
| `packages/db/src/generated/prisma/` | Prisma 自動產生的程式，禁止手改 |
| `packages/db/src/server.ts` | 僅後端使用的 PrismaClient |
| `packages/contracts/src/enums.ts` | 重新匯出產生的 browser-safe enum |
| `packages/contracts/src/schemas/` | 各 API 輸入與輸出 Zod schema |
| `packages/contracts/src/domain/` | 共用流程、中文標籤、固定權限及政策 |
| `packages/contracts/src/registry/` | 欄位描述與範例，不重複定義型別 |
| `packages/contracts/src/index.ts` | 對外公開入口，不匯出伺服器機密或 DB client |
| `scripts/` | 資料字典產生、檢查與開發輔助 |
| `docs/` | 架構、資料字典、API、流程、部署與進度 |

## 05. 最重要要求：統一欄位、變數與資料庫定義

我要有一個地方能查到所有跨模組的重要資料定義，而且程式真的共用它們。請建立 **「資料與變數中心」**，由 `docs/DATA_DICTIONARY.md` 作為查閱入口，搭配可執行的 schema、enum 與驗證。

這裡記錄的是資料欄位、API 契約、狀態、角色、設定、環境變數及計算規則。元件內部如 `isDialogOpen`、`searchInput` 不必全部搬成全域變數；私密金鑰、密碼、token 的實際值也不得寫入文件。

### 5.1 每種內容只指定一個權威來源

| 內容 | 權威來源 | 使用規則 |
|---|---|---|
| Table、column、relation、enum、唯一鍵 | `schema.prisma`，SQL 約束透過 migration | 後端使用生成型別，不手抄 DB interface |
| 可執行的資料庫變更歷史 | `migrations/` | 已套用 migration 不修改，新增下一筆 |
| API request / response 形狀 | `contracts/src/schemas/` | 前端與後端共用 Zod schema，DTO type 從 schema 推導 |
| 業務 enum 的程式值 | Prisma 生成的 `enums` | Contracts 重新匯出，禁止另一份手寫字串 enum |
| 狀態中文名稱與顏色 | `domain/status-labels.ts` | 用完整 enum Record 檢查缺漏 |
| 角色對功能的許可 | `domain/permissions.ts` | 前端控制顯示，後端另查角色及資料所屬關係 |
| 狀態轉移 | `domain/application-workflow.ts` | 共用可做動作；後端為最後執行權威 |
| 類別欄位與附件設定 | DB 的 `CategoryFormVersion.definition` | 使用共用 schema 驗證；不在每個畫面手寫七份 |
| 欄位中文説明與範例 | `registry/field-metadata.ts` | key 必須對應已存在的 DTO 或 DB 欄位 |
| 環境設定 | `apps/api/src/config/env.ts`、前端公開設定 schema | 啟動時驗證；`.env.example` 只含安全範例 |
| 查閱總表 | `docs/DATA_DICTIONARY.md` | 由前述定義生成／檢查，不作為另一套獨立規則 |

若文件與程式不一致，必須修正來源與文件的一致性，不能任選一份繼續寫。

### 5.2 前後端命名

- DB 實體欄位使用 `snake_case`；Prisma、DTO、TypeScript 使用 `camelCase`；透過 `@map` 明確映射。
- Model 用 PascalCase；資料表用複數 snake_case，必要時 `@@map`。
- 例如統編統一為 DTO `taxId` → Prisma `taxId` → DB `tax_id`。不要在不同頁用 `companyNo`、`businessId`、`vatNumber` 表示同一內容。
- UUID 欄位統一 `id`，關聯統一 `organizationId`、`applicationId` 等，不能把可見案件編號當資料主鍵。
- `applicationNo` 是可見案件編號；`id` 是內部主鍵；`status` 是流程狀態；`categoryId` 是申請類別 ID。
- 企業名稱用 `organizationName`；聯絡人用 `contactName`；電話用字串 `contactPhone`。
- 布林用 `isActive`、`isRequired`；數量用 `...Count`；時間點用 `...At`。
- 統編、電話、郵遞區號使用字串，不轉成數字，保留前導零。
- 禁止用 `status = 1 / 2 / 3` 的魔法數字或把中文顯示名稱存成流程代碼。

### 5.3 Browser-safe 邊界

使用所安裝 Prisma 版本支援的 `prisma-client` generator 與明確 output。DB 套件提供獨立 export：`@mf/db/server` 僅後端使用；`@mf/db/enums` 只匯出產生的純 enum。Contracts 只依賴 enum 入口，前端只依賴 Contracts。

前端不得 import `PrismaClient`、Node.js server module、伺服器環境設定，也不得把整個 DB Model 直接當成 API Response。`passwordHash`、session token 等欄位不能因為 spread ORM 物件而回傳。

生成順序為 `db:generate` → contracts → API / web。Mock 啟動與型別生成不得要求可連線的資料庫；如工具設定需要 DATABASE_URL 格式，可使用明確的本地占位值，不能執行連線或 migration。不要建立 `db → contracts → db` 的循環依賴；seed 可放在後端的開發腳本中，同時使用兩個套件。

### 5.4 資料字典必要欄位

每列至少包含：entity、欄位用途、中文名稱、Prisma field、DB column、API field、型別、nullable、createRequired、submitRequired、預設值、驗證規則、來源檔案、使用頁面、敏感性、是否可修改。

以下是初始範例，請擴展到全部對外欄位：

| Entity | 中文 | API / 程式 | DB | 型別與規則 |
|---|---|---|---|---|
| Organization | 公司名稱 | organizationName | organization_name | string；送件必填 |
| Organization | 統一編號 | taxId | tax_id | string；草稿可空；暫定 8 位數字，海外規則待確認 |
| Application | 案件編號 | applicationNo | application_no | server 產生；unique；不可由 client 指定 |
| Application | 申請類別 | categoryId | category_id | UUID 外鍵；依設定版本驗證 |
| Application | 案件狀態 | status | status | ApplicationStatus；僅 workflow action 更新 |
| Application | 編輯版本 | version | version | integer；更新時比對；server 遞增 |
| Application | 補件返回階段 | resumeStatus | resume_status | nullable enum；僅三種審查階段可用 |
| Enrollment | 實際時數 | attendedMinutes | attended_minutes | 非負整數分鐘，UI 轉為小時 |
| Certification | 到期日 | validUntilDate | valid_until_date | date-only 字串 YYYY-MM-DD |

區分 DB 可空、草稿允許空、送件必填。不能因為送件必填就讓草稿儲存失敗。空字串轉 null 的規則在 schema 統一處理；PATCH 缺少欄位代表不變，明確 null 才代表清空可空欄位。

### 5.5 自動檢查

建立實際可執行的 `pnpm check`，串接 format/lint、typecheck、Prisma validate、共用契約檢查及必要測試。

- DB 欄位／enum 變更後先重新 generate；檢查 response mapper、mock fixture、頁面是否仍通過型別與 runtime schema。
- response schema 必須使用明確允許欄位，不可直接 serialize 全部 Prisma model。
- 中文標籤要覆蓋所有 enum；每個 category version 的欄位 key 唯一；保留 key 不得拿來存 extension data。
- 資料字典與契約來源若不一致，檢查要失敗；使用與目前版本相容的生成方式，不依賴不穩定的私有 API。
- `pnpm docs:generate` 更新資料字典；`pnpm docs:check` 比較生成結果；無法自動提取的中文用途放在 typed metadata，不偽稱全部自動。
- 建立 `docs/FIELD_CHANGE_LOG.md`，每次 rename/add/remove 記錄 migration、DTO、mock、頁面及舊資料處理方式。
- 既有欄位改名要規劃資料搬移；禁止用新增另一個同義欄位的方式掩蓋不一致。

## 06. 三種角色與資料隔離

固定角色 enum：`APPLICANT`（業者）、`CASE_OFFICER`（承辦人）、`ADMIN`（管理員）。公開訪客是未登入狀態，不需要存成 DB 角色。

| 功能 | 業者 | 承辦人 | 管理員 |
|---|---|---|---|
| 公開課程查詢 | 可以 | 可以 | 可以 |
| 維護業者資料 | 自己的組織 | 依授權唯讀查看 | 全部查看，必要更正留紀錄 |
| 建立／修改草稿 | 自己的申請 | 不可代改申請內容 | 不可無紀錄代改申請內容 |
| 查看案件與附件 | 自己組織的案件 | 指派給自己的案件 | 所有案件 |
| 初審／複審／要求補件 | 不可 | 自己承辦且階段符合 | 可以，需留紀錄 |
| 最終核定／退件 | 不可 | 提交審查意見 | 管理員執行 |
| 指派承辦／管理帳號 | 不可 | 不可 | 可以 |
| 課程管理與出席登錄 | 不可 | 可以 | 可以 |
| 個人報名／學習紀錄 | 僅本人 | 承辦所需 | 可以 |

初版一位業者帳號只屬於一個 Organization；不做企業子帳號邀請系統。其他人以相同統編註冊時，不自動加入既有企業；顯示聯繫管理員處理，避免越權。

API 從 session 決定使用者與 organizationId，不能信任 client 傳來的 actorId、role、organizationId。跨組織讀取與寫入均檢查，附件下載與匯出也包括在內。

## 07. 頁面與介面內容

### 7.1 視覺方向

- 繁體中文，乾淨的行政作業介面，深綠主色、白底與淺灰區塊，狀態色一致。
- 公開頁以資訊與入口為主；會員端降低填表壓力；後台以搜尋、表格、狀態、待辦數量為核心。
- 不使用虛構官方標章或未授權機構 Logo；先用文字標題。
- 支援桌機、平板、手機；手機表格可轉卡片或限制在區塊內橫向捲動。
- 所有表單有 label、必填提示、欄位錯誤與可聚焦位置；不只靠顏色傳達狀態。
- 確認送件、退件、取消報名等動作要有確認視窗與具體動作名稱。
- 具備 loading、empty、error、403、404、儲存中、儲存成功、版本衝突等狀態。
- 成功訊息只有在操作真的完成才顯示；不使用 `alert('成功')` 代替資料異動。

### 7.2 公開頁

| 路由 | 畫面內容 | 主要動作 |
|---|---|---|
| `/` | 平台用途、申請步驟、課程入口、聯絡資訊占位 | 開始申請、查看課程、登入 |
| `/guide` | 七類申請卡片、作業流程、準備資料、常見問題 | 登入後建立申請 |
| `/courses` | 已公開課程、日期、地點、名額、報名期限 | 搜尋與查看詳情 |
| `/courses/:courseId` | 簡介、梯次時間、時數、地點、剩餘名額、注意事項 | 登入後報名 |
| `/login` | Email、密碼、忘記密碼、註冊入口 | 登入後依角色前往入口 |
| `/register` | 聯絡人、Email、密碼、確認密碼、業者名稱、統編 | 建立業者帳號與組織 |
| `/forgot-password` | Email、統一回應訊息 | 申請重設 |
| `/reset-password` | 驗證 token 後輸入新密碼 | 完成重設並返回登入 |

### 7.3 業者會員端

導覽：總覽、我的申請、新增申請、課程報名、我的學習紀錄、驗證紀錄、業者資料、帳號設定。

| 路由 | 必須呈現的內容 |
|---|---|
| `/portal` | 草稿、審核中、待補件、已核定數量；待辦案件及近期課程 |
| `/portal/profile` | 業者名稱、統編、聯絡人、電話、Email、地址 |
| `/portal/account` | 本人帳號、修改密碼、登出 |
| `/portal/applications` | 案件編號、類別、日期、狀態、搜尋與篩選 |
| `/portal/applications/new` | 類別選擇，建立草稿後取得 id，導向編輯器 |
| `/portal/applications/:applicationId/edit` | 多步驟表單、儲存草稿、附件、檢查及送件 |
| `/portal/applications/:applicationId` | 唯讀申請摘要、歷程、審查公開意見、補件項目、列印 |
| `/portal/enrollments` | 已報名課程、日期、報名狀態、符合規則時可取消 |
| `/portal/learning-records` | 課程、出席、實際時數、完課與合計 |
| `/portal/certifications` | 人工登錄的證書編號、核發日、效期與相關案件 |

### 7.4 管理端

導覽：工作總覽、案件管理、課程管理、會員管理、資料匯入、操作紀錄。

| 路由 | 必須呈現的內容 |
|---|---|
| `/admin` | 待派案、初審、複審、待核定、待補件、近期課程；數值依可見資料計算 |
| `/admin/applications` | 搜尋編號／業者、類別、狀態、承辦、日期、分頁；授權 CSV 匯出 |
| `/admin/applications/:applicationId` | 摘要、送件快照、附件、歷程、派案及依目前階段顯示的操作 |
| `/admin/courses` | 課程清單、草稿／公開／取消／結束狀態 |
| `/admin/courses/new` | 課程與單一梯次建立 |
| `/admin/courses/:courseId/edit` | 課程內容、時間、名額、時數、完課設定 |
| `/admin/courses/:courseId/enrollments` | 報名名單、出席登錄、分鐘數、完課與匯出 |
| `/admin/users` | 管理員使用；帳號角色、啟用／停用、查詢 |
| `/admin/organizations` | 管理員使用；業者列表與資料查看 |
| `/admin/imports` | 範本下載、CSV 上傳預覽、逐列錯誤、確認匯入及結果 |
| `/admin/audit-logs` | 管理員使用；操作者、事件、目標、時間、結果 |

開發用資料字典集中在專案的 `docs/DATA_DICTIONARY.md`，不需要為此增加客戶後台頁面。文件不保存環境變數實際值、DB 連線字串、passwordHash 或 token。

## 08. 申請填寫流程與表單內容

### 共用五步驟

1. **申請類別**：選擇 CAT_01 至 CAT_07，說明適用情境與目前設定是否已確認。
2. **業者與聯絡資料**：帶入業者資料，允許在本次申請填寫聯絡人及地址快照。
3. **申請內容**：場所名稱、場所地址、申請說明，以及此類別版本所設定的額外欄位。
4. **附件資料**：顯示要求清單、允許格式、單檔大小、必要／選填、已上傳檔案、重新上傳。
5. **確認送件**：可讀摘要、未完成欄位跳轉、資料聲明勾選、送出申請。

### 初始共用欄位

`organizationName`、`taxId`、`contactName`、`contactPhone`、`contactEmail`、`organizationAddress`、`siteName`、`siteAddress`、`applicationDescription`、`declarationAccepted`。

申請共用欄位存於 Application 的明確欄位／快照欄位；類別額外欄位才放 `formData` JSONB。不得把狀態、角色、組織 ID、證書資料或所有申請內容全部塞入沒有驗證的 JSON。

### 草稿與版本

- 新增申請先由 API 建立草稿，取得 UUID 及案件編號；附件必須掛在存在且有權限的草稿下。
- 草稿可不完整；依當前已填值檢查型別、長度與格式，不要求所有送件條件。
- 有未存變更，離開頁面時提醒；初版手動儲存，不承諾跨裝置即時自動存檔。
- 保存成功顯示 server 回傳的更新時間與版本。
- 送件／重新送件使用獨立命令，先保存可編輯內容，再執行完整驗證；全部成功後才改狀態。
- 送件時保存不可覆寫的 `ApplicationSubmission`，包含共用欄位快照、formData、類別版本、附件 ID 清單及送件時間。
- 之後業者改公司資料，不回寫或覆蓋過去的送件版本。

### 類別設定格式

`CategoryFormVersion.definition` 至少包含：`fields`、`attachmentRequirements`、`helpText`。

fields 每個項目包含 `key`、`label`、`inputType`、`requiredOnSubmit`、`options`、`min/maxLength`、`helpText`；只支援 text、textarea、select、date、number、checkbox。輸入值由相同 definition 在前後端驗證。禁止存入可執行 JavaScript、任意 HTML 或 SQL。

欄位 key 可採 `serviceDescription` 等業務名稱，不使用 `field1`。型別用 Zod discriminated union 定義；未知欄位及保留 key 要拒絕。

版本已被案件引用後不可覆寫；新增版本使用遞增 version。既有案件繼續使用原 version，初版不自動搬到新表單。類別切換只允許未送件草稿，提示清理不相容的額外欄位及附件要求，保留使用者可確認的共用資料。

## 09. 案件狀態與流程規則

使用固定 state machine，從共用 enum 匯入值。後台不可用任意下拉選單直接改 status。

| 代碼 | 中文 | 業者可編輯 |
|---|---|---|
| `DRAFT` | 草稿 | 可以 |
| `SUBMITTED` | 已送件 | 不可 |
| `INITIAL_REVIEW` | 初審中 | 不可 |
| `SECOND_REVIEW` | 複審中 | 不可 |
| `FINAL_REVIEW` | 待核定 | 不可 |
| `NEED_SUPPLEMENT` | 待補件 | 可以，保留既有快照 |
| `APPROVED` | 已核定 | 不可 |
| `REJECTED` | 已退件 | 不可 |

### 允許轉移

| 當前狀態 | 動作 | 下一狀態 | 執行者／條件 |
|---|---|---|---|
| DRAFT | SUBMIT | SUBMITTED | 本組織業者，送件驗證通過 |
| SUBMITTED | START_REVIEW | INITIAL_REVIEW | 指派承辦或管理員；有承辦人 |
| INITIAL_REVIEW | PASS_INITIAL | SECOND_REVIEW | 指派承辦或管理員；填寫審查意見 |
| SECOND_REVIEW | PASS_SECOND | FINAL_REVIEW | 指派承辦或管理員；填寫審查意見 |
| FINAL_REVIEW | APPROVE | APPROVED | 管理員；填寫核定意見 |
| INITIAL_REVIEW / SECOND_REVIEW / FINAL_REVIEW | REQUEST_SUPPLEMENT | NEED_SUPPLEMENT | 有權處理該階段的人；有公開補件理由 |
| NEED_SUPPLEMENT | RESUBMIT | resumeStatus | 本組織業者；驗證通過並建立新送件版本 |
| INITIAL_REVIEW / SECOND_REVIEW / FINAL_REVIEW | REJECT | REJECTED | 管理員；有公開退件理由 |

`REQUEST_SUPPLEMENT` 將當時的審查狀態記入 `resumeStatus`；重新送件回該階段，不一律退回初審。`resumeStatus` 僅允許 INITIAL_REVIEW、SECOND_REVIEW、FINAL_REVIEW，其他狀態拒絕；補件結束後清空。承辦可提退件意見，正式 REJECT 由管理員執行。

派案是獨立管理動作，不直接跳過任何審查階段；管理員更換承辦必須記錄。初版由同一承辦操作初審與複審，管理員核定；是否需不同審查人是待確認項目，不自行宣稱符合雙人覆核制度。

### 更新一致性

- 每次更新與動作帶 `expectedVersion`，在 DB transaction 內用 `id + version + 原狀態` 條件更新；更新成功後版本 +1。
- 版本不符回 HTTP 409 `VERSION_CONFLICT`，前端提示重新載入，不覆蓋另一位操作者內容。
- 狀態異動、ApplicationEvent、送件快照，以及需要的通知工作紀錄應在同一交易中完成。requestId 重試需核對相同使用者與相同 payload；相同 key 帶不同內容應拒絕，不直接重用先前結果。
- 寄信是提交後的工作，不在 DB transaction 內等待外部 SMTP；寄信失敗不回滾已完成的送件或核定。
- 重複按送件／核定使用 `requestId` 或 idempotency key，避免重複事件與通知。
- 拒絕不合法的狀態轉移。APPROVED 與 REJECTED 初版是終態，需要新案件就另建，不能直接偷偷改回草稿。

## 10. 教育訓練流程

初版每筆 Course 表示一個梯次；另一天或另一時段開新課程，不建立多層 LMS。

### 管理端

- 欄位：`title`、`description`、`location`、`startsAt`、`endsAt`、`registrationOpensAt`、`registrationClosesAt`、`capacity`、`durationMinutes`、`requiredAttendanceMinutes`、`status`。
- CourseStatus：`DRAFT`、`PUBLISHED`、`CANCELLED`、`COMPLETED`。
- 檢查開始早於結束、報名起迄順序、名額正整數；已報名後不能把容量改成小於現有有效報名數。
- 初版免費／人工處理收費，不呈現信用卡付款畫面。

### 會員端

- 只有公開、在報名期間內且未額滿課程可報名。
- Enrollment 唯一鍵為 `[courseId, userId]`，一人一梯次只有一筆；取消後若規則允許再次報名，更新同筆，不插重複資料。
- 報名成功顯示確認資訊。可取消的條件暫定為報名截止前，寫入共用政策並標示待確認。
- 名額在 server transaction 中檢查與保留，搭配資料庫鎖或 Serializable 交易重試；不能只靠畫面上「剩餘名額」。
- 初版不做候補；額滿時清楚顯示。

### 出席與完課

- EnrollmentStatus：`CONFIRMED`、`CANCELLED`。
- AttendanceStatus：`NOT_RECORDED`、`PRESENT`、`ABSENT`。
- 承辦人工登錄出席及 `attendedMinutes`；時數以整數分鐘儲存，顯示時再轉小時。
- `attendedMinutes` 在 0 至課程 durationMinutes 之間；缺席不能帶正分鐘數。
- 完課是計算結果：有效報名、PRESENT，且 attendedMinutes 達到報名時保存的 requiredAttendanceMinutesSnapshot。
- 未登錄出席顯示「待登錄」，不提前算成不合格；取消的報名不計入已完成時數。
- 已經有出席紀錄時，修改課程門檻不能默默改變歷史完課結果；需明确重算操作與原因。初版可禁止此類修改並說明。
- 不要同時保存互相矛盾的 `isCompleted`、`completionStatus` 和沒有來源的 `completedHours`；用一個共用計算函式產生 ViewModel。

## 11. 資料庫模型

以關聯式資料建模，建立必要外鍵、unique、索引、刪除限制及建立／更新時間。以下是最低資料集合，可增加認證必需的輔助表，不任意合併不同領域。

| Model | 核心欄位 | 關聯與限制 |
|---|---|---|
| User | id、email、passwordHash、displayName、role、organizationId?、isActive、createdAt、updatedAt | email 正規化後 unique；業者必須有組織 |
| Organization | id、organizationName、taxId?、contactName?、contactPhone?、contactEmail?、address?、createdAt、updatedAt | taxId 非空時 unique；案件以 org 隔離 |
| Session | id、tokenHash、userId、expiresAt、createdAt | server 持久化 session；登出可撤銷 |
| PasswordResetToken | id、tokenHash、userId、expiresAt、usedAt? | 有效期與單次使用；不存原始 token |
| ApplicationCategory | id、code、name、description?、isActive、displayOrder | code unique；七筆穩定代碼 |
| CategoryFormVersion | id、categoryId、version、configurationStatus、definition、createdAt | `[categoryId, version]` unique；CONFIRMED / DEMO |
| Application | id、applicationNo、organizationId、createdById、categoryId、categoryFormVersionId、status、resumeStatus?、assignedToId?、version、各共用快照欄位、formData、declarationAccepted、sourceSystem?、sourceRecordKey?、submittedAt?、decidedAt?、createdAt、updatedAt | 案件編號 unique，使用 DB sequence 或等價原子編號機制，不用 count+1；status、org、assignee、時間索引 |
| ApplicationSubmission | id、applicationId、revision、submittedById、submittedAt、formVersionId、payloadSnapshot、attachmentIdsSnapshot | `[applicationId, revision]` unique；不可覆寫 |
| ApplicationEvent | id、applicationId、submissionId?、actorId、action、fromStatus?、toStatus?、publicComment?、internalNote?、requestId、createdAt | requestId 依案件去重；內外意見明確區分 |
| FileObject | id、uploadedById、storageKey、originalName、mimeType、sizeBytes、sha256、createdAt、deletedAt? | 不公開實體路徑；內容不可原地覆蓋 |
| ApplicationAttachment | id、applicationId、fileId、requirementKey、createdAt、removedAt? | 留存過去送件所引用檔案；不 cascade 刪除歷史 |
| Course | id、上述課程欄位、createdById、version、createdAt、updatedAt | 公開時間及報名期間索引 |
| Enrollment | id、courseId、userId、status、attendanceStatus、attendedMinutes、requiredAttendanceMinutesSnapshot、attendanceRecordedById?、attendanceRecordedAt?、version、enrolledAt、cancelledAt? | `[courseId, userId]` unique |
| Certification | id、applicationId、certificateNo、issuedOnDate、validUntilDate、registeredById、registeredAt、updatedAt | 初版一案最多一筆；案件需 APPROVED；證書編號 unique |
| NotificationJob | id、dedupeKey、type、recipientUserId?、recipientEmail、applicationId?、status、attemptCount、lastErrorCode?、createdAt、sentAt? | dedupeKey unique；PENDING/SENT/FAILED/MOCKED |
| AuditLog | id、actorId?、action、entityType、entityId?、requestId、safeChanges、createdAt | 不存密碼、token、完整附件或多餘個資 |
| ImportBatch | id、type、fileDigest、createdById、status、rowCount、resultSummary、createdAt | 記錄預覽、確認與匯入結果；重複提交去重 |

所有詳情 payload、DTO 與 snapshot 要有 schemaVersion，或以可追溯的 formVersionId 明確指定解讀方式。認證等必要模型的設計說明寫入 ERD 與資料字典。Certification 檢查核發日不晚於到期日；是否有效或已到期依 Asia/Taipei 的日期及登錄內容計算，不另存一個容易過期的 isExpired，也不等同自動換證或到期通知。

### 關係總覽

- Organization 對多筆 Application；User 作為建立者、承辦或操作者。
- ApplicationCategory 對多個 CategoryFormVersion；Application 綁定其中一版。
- Application 對多筆 Submission、Event、Attachment，對零或一筆 Certification。
- Attachment 連至 FileObject；歷史 Submission 保存當時的附件引用。
- Course 與 User 經 Enrollment 形成多對多。

### 日期與金額

- 操作時間使用 UTC timestamptz，API 回 ISO 8601；UI 以 Asia/Taipei 顯示。
- 證書起迄等純日期使用 date-only，避免 UTC 轉換導致少一天。
- 民國年是顯示方式，不把 `115/10/01` 直接當資料庫時間。
- 本版本沒有金流或付款資料表；未來若增加費用，另作契約與 migration，不先塞入未知欄位。

## 12. API 契約與錯誤處理

統一 base path `/api/v1`。API input、response、query、params 都有共用 schema；client 只透過 services 呼叫，不在頁面散寫 fetch。

### 回傳格式

成功：`{ success: true, data, meta?: { page, pageSize, total, totalPages }, requestId }`

失敗：`{ success: false, error: { code, message, fieldErrors?: [{ path, message }] }, requestId }`

日期字串、null、enum、分頁格式完全統一。GET 詳情依角色回傳明確的 ApplicantDetail 或 AdminDetail DTO，不能先回傳 internalNote 再靠前端隱藏。檔案下載、CSV 為 binary/text response，不能硬包 JSON；在契約中分別說明。

常用錯誤碼集中為 `VALIDATION_ERROR`、`UNAUTHENTICATED`、`FORBIDDEN`、`NOT_FOUND`、`VERSION_CONFLICT`、`INVALID_TRANSITION`、`COURSE_FULL`、`DUPLICATE_ENROLLMENT`、`FILE_TOO_LARGE`、`UNSUPPORTED_FILE_TYPE`、`CATEGORY_NOT_CONFIRMED`。

### 最少端點

| 群組 | Method / path | 說明 |
|---|---|---|
| Auth | POST `/auth/register`、`/auth/login`、`/auth/logout` | 註冊、登入及登出 |
| Auth | GET `/auth/me`、`/auth/csrf` | 本人與 CSRF token |
| Auth | POST `/auth/forgot-password`、`/auth/reset-password`、`/auth/change-password` | 密碼相關 |
| Organization | GET / PATCH `/organizations/me` | 本組織資料；業者 ID 由 session 決定 |
| Categories | GET `/application-categories` | 取得類別及可用 form version |
| Applications | GET / POST `/applications` | 本人範圍清單、建立草稿 |
| Applications | GET / PATCH `/applications/:id` | 詳情、草稿／補件內容儲存 |
| Applications | POST `/applications/:id/submit`、`/resubmit` | 正式送件動作 |
| Applications | GET `/applications/:id/events`、`/submissions` | 經權限過濾的歷程與快照 |
| Attachments | POST `/applications/:id/attachments` | 權限檢查後接收 multipart |
| Attachments | DELETE `/applications/:id/attachments/:attachmentId` | 移除現行引用，保留歷史快照所需檔案 |
| Files | GET `/files/:fileId/download` | 檢查所屬案件與角色後下載 |
| Admin cases | GET `/admin/applications`、`/admin/applications/:id` | 授權清單與詳情 |
| Admin cases | POST `/admin/applications/:id/assign` | 指派／重派承辦 |
| Admin cases | POST `/admin/applications/:id/actions` | body 使用已定義 action、expectedVersion、意見、requestId；不接受任意 targetStatus |
| Certifications | GET `/certifications/mine` | 本組織驗證紀錄 |
| Certifications | POST / PATCH `/admin/applications/:id/certification` | 核定後人工登錄／更正；留 audit |
| Courses | GET `/courses`、`/courses/:id` | 公開課程，不洩漏草稿 |
| Enrollments | POST `/courses/:id/enrollments` | 本人報名 |
| Enrollments | POST `/enrollments/:id/cancel` | 取消本人報名 |
| Learning | GET `/enrollments/mine`、`/learning-records/mine` | 個人報名與學習 |
| Admin training | GET / POST `/admin/courses`、GET / PATCH `/admin/courses/:id` | 課程管理 |
| Admin training | GET `/admin/courses/:id/enrollments` | 課程名單 |
| Admin training | PATCH `/admin/enrollments/:id/attendance` | 人工登錄出席、分鐘數 |
| Users | GET `/admin/users`、POST `/admin/users`、PATCH `/admin/users/:id` | 管理員新增內部帳號、停用與固定角色指派 |
| Organizations | GET `/admin/organizations`、`/admin/organizations/:id` | 管理員的業者列表／詳情 |
| Imports | POST `/admin/imports/preview`、`/admin/imports/:id/commit` | 先預覽再匯入 |
| Exports | GET `/admin/applications/export`、`/admin/courses/:id/enrollments/export` | 依權限及篩選輸出 CSV |
| Audit | GET `/admin/audit-logs` | 管理員查詢 |
| Settings | GET `/public-config` | 白名單公開設定，例如展示標示及檔案限制，不含機密 |
| Health | GET `/health/live`、`/health/ready` | 程序健康／資料庫可用 |

Express 固定路由如 `/mine`、`/export` 應優先於 `/:id`，並檢查 id 格式，避免路由被誤吃。每個 API 在 `docs/API_SPEC.md` 記錄角色、資料範圍、範例、錯誤及 side effects。

## 13. Mock 與真實 API 的切換

定義 `ApplicationService`、`TrainingService`、`AuthService` 等一致介面，實作 `Http...Service` 與 `Mock...Service`。前端只在組装入口依 `VITE_DATA_MODE=mock|api` 選擇，不在每個 page 寫 if/else。

- 兩個 adapter 使用完全相同 request / response schema；mock fixtures 載入時也 parse 驗證。
- Mock 可以使用 IndexedDB 保存示範狀態與小型附件，使重整頁面後仍可展示。
- mock 畫面固定顯示「展示模式：使用模擬資料」，提供重設展示資料按鈕。
- 角色快速切換只在 mock 展示有效，不能變成正式 API 的權限入口。
- API 模式驗證 server session，不信任瀏覽器保存的角色。
- API 模式不得在 401／500 時靜默退回 mock 顯示成功；必須讓使用者看見錯誤。
- 正式 build 檢查必須為 API 模式，禁止內含可啟用的展示登入捷徑或測試帳號密碼。
- 前端資料切換後元件不需要重寫；TanStack Query key 必須包含目前身分／資料範圍，登出或切換身分清空快取。正式系統不得將個資及私有案件快照長期保存在 localStorage。

### 示範資料

- 至少 40 筆明確標示「示範」的驗證案件，分散在 7 類及不同流程狀態。
- 至少 8 家假業者、1 位管理員、2 位承辦、數位假學員、6 個課程梯次。
- 至少包含：不完整草稿、缺附件送件失敗、待派案、初審、複審補件、核定、退件、課程額滿、取消報名、待登錄出席。
- 使用 `.example` 或 `.test` 等非真實聯絡資料，不複製真實個資。
- seed 重跑採 upsert 或只針對示範 namespace，不能清空已有資料。
- demo seed 禁止在 production 執行，需明確命令啟用；一般啟動不自動灌假帳號。
- 不把假資料或模擬測試算成客戶 SBIR 的實際市場驗證結果。

## 14. 附件、登入與基本保護

### 附件

- 示範政策：PDF、JPEG、PNG；單檔 10 MiB，每案合計 100 MiB，常數集中並註記可調整。
- 前後端都驗證，後端再驗 MIME、檔案 signature、大小及案件權限；不只信任副檔名。
- storageKey 由 server 產生，原始名稱僅供顯示，阻擋路徑穿越與可執行檔。
- 檔案儲存介面至少有 save、read、delete；初版實作 local driver，S3 只留介面與部署說明，不在無帳號時宣稱接通。
- Zeabur local driver 使用持久 Volume 掛載的路徑，例如 `/data/uploads`，不能依賴容器臨時目錄保留附件。
- 不把私有附件放在公開靜態目錄；API 每次下載查權限，圖片／PDF 預覽也適用。
- 替換附件建立新 FileObject，舊送件仍可查到當時附件；不可覆寫原 storageKey。
- FileObject 與資料庫關聯若部分失敗，要處理孤立檔案及可重試狀態，不留下虛假的成功紀錄。

### 帳號

- 密碼使用成熟函式庫做適當雜湊，不使用自製加密或明文存入 DB。
- 使用伺服器 session，cookie 為 HttpOnly，正式環境 Secure、適當 SameSite；使用持久 session store。
- cookie 身分驗證的變更請求實作 CSRF 防護，登入與密碼重設加 rate limit。
- token 一次性、到期、雜湊保存；忘記密碼對存在／不存在帳號回應一致。
- production 缺必要金鑰／服務設定要清楚失敗，不使用示範預設密碼繼續啟動。
- 帳號停用立即影響後續請求；管理員不能把最後一個有效 ADMIN 停用或改成別的角色。
- 不把 Prisma 查詢結果整包回傳，不把內部審查意見回傳給業者。
- 以上是初版實作要求，不代表已取得資安認證或完成第三方檢測。

## 15. 通知與紀錄

最低支援送件確認、補件通知、核定／退件結果及忘記密碼的電子郵件介面。

- `MAIL_DRIVER=console|smtp`；console 僅本地／明確展示環境，UI 不可寫「已成功寄到信箱」。
- NotificationJob 對事件去重，重試有上限，記錄失敗類型，不記錄 SMTP 密碼或原始重設 token。
- 真實寄送尚未接上時，寫入 MOCKED 或 FAILED，不誤標 SENT。
- 補件理由與結果在案件詳情本身可查，不依賴 Email 才知道待辦。
- AuditLog 記錄登入結果、送件、補件、派案、審查、證書登錄、出席更正、角色／帳號變更、匯入與匯出。
- 案件業務歷程與系統 audit 分開：前者是業者理解流程所需，後者是管理追查；不要把全部 audit 顯示給業者。

## 16. 匯入、匯出與列印

初版提供 CSV，無需建立複雜 Excel 編輯器。

- 匯入對象先限定業者資料與驗證草稿，不允許用 CSV 直接產生「已核定」或捏造審核歷程。
- 客戶既有已審結歷史案件另訂 migration／匯入規則，先列待確認。
- 提供範本，欄位名由同一份資料字典對應，預覽逐列驗證結果，錯誤行號清楚。
- 確認前不寫入業務資料；選擇全批成功或全批不匯入的原則，初版採全批交易。
- 說明去重 key：業者按 taxId；案件需外部來源與 sourceRecordKey 組合。這兩個欄位納入 Application 的可空 sourceSystem、sourceRecordKey，兩者同時為空或同時有值，非空組合設 unique；正式加入 schema 與字典，不能用公司名稱假裝唯一鍵。
- 同一批 commit 重試不可重複建立資料，ImportBatch 留結果。
- CSV 匯出依角色可見範圍及篩選條件，避免公式注入，正確處理中文、逗號與換行。
- 申請詳情提供 print stylesheet 與瀏覽器列印／另存 PDF；不承諾等同指定官方表單套版。

## 17. Zeabur 與環境變數

建立 `.env.example`，只放名稱、用途及安全占位內容。真正的 `.env`、DB URL、SMTP 密碼、session secret 全部 gitignore。

| 變數 | 作用域 | 用途 |
|---|---|---|
| NODE_ENV | server / build | 工具的 development / production 模式 |
| APP_ENV | server | local / staging / production 業務環境 |
| PORT | server | 平台提供的 listen port |
| DATABASE_URL | server only | PostgreSQL 連線，禁止前端使用 |
| SESSION_SECRET | server only | session 相關金鑰，不得輸出 |
| APP_BASE_URL | server | 郵件連結與允許的 origin |
| STORAGE_DRIVER | server | local；未實作的 driver 啟動即報錯 |
| UPLOAD_ROOT | server | 持久化上傳目錄 |
| MAIL_DRIVER | server | console 或 smtp |
| SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / MAIL_FROM | server only | 郵件服務設定 |
| DEMO_MODE | server | 僅非 production 可啟用，允許示範類別與測試資料 |
| VITE_API_BASE_URL | public / build | 本地與同源預設 `/api/v1` |
| VITE_DATA_MODE | public / build | mock 或 api；正式 build 必須 api |

所有環境變數由 schema 解析布林、數字、必填關係。不要在模組中散讀 `process.env`；敏感設定只從 server env 模組取得。

### 部署交付

- 提供本地啟動、build、start 與 smoke check 指令，全部實際對應 scripts。
- build 先 generate Prisma，再 build contracts / web / api；確認 ESM/CJS 與路徑相容。
- Express 綁定 `0.0.0.0` 與平台 PORT；SPA fallback 不攔截 `/api` 或不存在的附件。
- 產出 Dockerfile 或清楚的 Zeabur build/start 配置；workspace build context 包含共用 packages。
- 正式 schema 更新走經確認的 `prisma migrate deploy`；不可啟動時自動 `db push --force-reset`。
- PostgreSQL 與附件分別有持久儲存；Volume 不等於備份。文件寫出備份目標、頻率、保留天數、還原命令與演練方式；未實際配置排程要標為未完成。
- local 檔案 driver 初版限定單一應用實例；未改用共用物件儲存前，不宣稱可水平擴展。
- 文件說明掛載 Volume 的重啟特性及資料移轉步驟，不承諾零停機。
- production 禁用 demo、console mail 與測試帳號初始化；部署與測試環境資料分離。

## 18. 分階段實作順序

### Phase 0：讀取與建置骨架

盤點現有專案；建立工作清單、資料字典來源、schema、共用契約、Cursor rule、版型及啟動腳本。先確認生成 enum 及前端 build 邊界能運作，再展開頁面。

### Phase 1：完整畫面與可操作 Mock

完成全部路由與導覽；三角色展示入口；40 案示範資料；申請五步驟、案件審核、課程報名、出席登錄。每個主要按鈕對應確實可見的資料變化。mock 狀態與真正契約一致。

此階段完成後，啟動 preview 並提供 URL、示範操作路徑及明確的 mock 標示；繼續下一階段，不把登入展示切換當正式驗證。

### Phase 2：資料庫、API 與身分權限

在本地開發 PostgreSQL 套用 migration；實作 session、API、資料驗證、隔離；切換相同畫面到 API adapter。Docker 可用時提供 compose 開發資料庫；不可用時接受既有 DATABASE_URL，不安裝破壞性系統服務。

### Phase 3：打通跨模組流程

驗證申請建立→附件→送件→派案→初審→補件→重送→複審→核定→證書資料登錄；課程建立→公開→報名→出席→時數→學習紀錄。補齊通知介面、匯入匯出、檔案授權，更新資料字典。

### Phase 4：必要驗證與交付

完成重要邊界測試、桌機／手機檢查、部署與交接文件。記錄已測、未測、尚未取得的正式資料。不要為拖延交付新增無關功能。

## 19. 至少十個可重現驗收情境

使用獨立測試 DB／測試資料。Mock 視覺驗證與真實 API 驗證分開報告。

| 編號 | 情境 | 必須結果 |
|---|---|---|
| T01 | 業者註冊、登入、登出、刷新 | session 行為正確；停用後不能繼續存取 |
| T02 | 草稿只填部分資料，儲存再開 | 原值保留；缺資料可存草稿、不能送件 |
| T03 | 補齊資料及附件送件 | 狀態正確、編號唯一、送件快照完整 |
| T04 | 業者 A 猜業者 B 的案件／附件 ID | API 拒絕，畫面無資料洩漏 |
| T05 | 複審要求補件後重新送件 | 回到 SECOND_REVIEW；前後快照及附件仍可追查 |
| T06 | 兩個視窗同時操作同一案件 | 後送者收到 409，不覆蓋第一筆更新 |
| T07 | 重複按核定或送件 | 只發生一次狀態事件及對應通知工作 |
| T08 | 最後一個課程名額同時有兩人報名 | 只有一人成功；無超額與重複報名 |
| T09 | 出席及分鐘數更正 | 學習紀錄同步；分鐘上限及完課規則正確；有 audit |
| T10 | 附件上傳、重新啟動、授權下載 | API 模式檔案仍存在；非法格式／超限拒絕 |
| T11 | 類別新增 form version | 舊案件仍讀原版本；新草稿讀新版 |
| T12 | 匯入預覽有錯誤、重複 commit | 錯誤不寫入；重試不重複建立 |
| T13 | 郵件服務失敗 | 案件操作已保存；郵件標示失敗／可重試，無假成功 |
| T14 | 正式 build 夾帶 mock／demo 設定 | 檢查失敗或明確拒絕啟動，不開放展示捷徑 |

測試重點放在資料隔離、交易、狀態、名額、版本與持久化。畫面顏色及簡單展示文案不需建立大量快照測試。

## 20. 必須建立的專案文件

| 文件 | 內容 |
|---|---|
| `README.md` | 安裝、啟動、模式切換、腳本與資料庫準備 |
| `docs/ARCHITECTURE.md` | 模組、依賴方向、前後端與部署拓撲 |
| `docs/DATA_DICTIONARY.md` | 統一資料與變數查閱總表 |
| `docs/ERD.md` | 實際 schema 對應的 Mermaid ERD，可分模組 |
| `docs/API_SPEC.md` | request、response、角色、資料範圍與錯誤 |
| `docs/WORKFLOW.md` | 狀態轉移、補件返回、交易與並行處理 |
| `docs/PERMISSIONS.md` | 三種角色及資料隔離矩陣 |
| `docs/ENVIRONMENT.md` | 環境變數用途與必填條件，不含實值 |
| `docs/FIELD_CHANGE_LOG.md` | 欄位與契約變更紀錄 |
| `docs/TEST_CASES.md` | 至少上述十個情境及實測結果 |
| `docs/DEPLOY_ZEABUR.md` | build、migrate、start、Volume、備份與回復 |
| `docs/OPEN_QUESTIONS.md` | 業務未知、暫定假設及對正式上線的影響 |
| `docs/PROGRESS.md` | 當前階段、已完成、未完成、下一步 |

若後續使用於 SBIR 文件，本原型可整理支援 A1/A2 的需求及規格、B1/B2 的測試資料及畫面、B3 的三核心模組、C1 的操作測試紀錄、C2 的部署與成果資料。實際業者導入、訪談、營收與服務產值需要真實執行證據，不生成假的驗證結果。

## 21. 請建立的 Cursor 持續規則

建立 `.cursor/rules/00-project.mdc`，使用以下核心內容；維持簡短，詳細規格透過文件引用，不把本文件完整複製到每一個 rule。

```mdc
---
description: 本專案的功能範圍、共用契約與資料一致性規則
alwaysApply: true
---

- 開始工作先讀 PROJECT_SPEC.md、docs/PROGRESS.md 與相關來源檔。
- 本案為七類共用表單的精簡版；新增功能先核對既定範圍。
- 不確定的官方分類、附件名稱及審查規則寫入 OPEN_QUESTIONS，不自行杜撰。
- DB 模型與 enum 以 packages/db/prisma/schema.prisma 為唯一來源。
- API 輸入輸出及 DTO 以 packages/contracts/src/schemas 為唯一來源。
- 狀態、角色、驗證規則、中文標籤從共用來源匯入，不在頁面手抄。
- 前端不得匯入 PrismaClient、server env 或含機密的 server 模組。
- 新增／改名欄位要同步 schema、migration、契約、mapper、fixture、字典與受影響頁面。
- 每次更改資料結構先檢查 DATA_DICTIONARY，避免建立同義重複欄位。
- 保留舊 migration 及既有資料；禁止以 reset 或全表刪除解決錯誤。
- API 必須驗身分、角色及資料所屬關係；前端隱藏按鈕不是授權。
- 狀態更新只經 workflow action 與交易；處理 expectedVersion 和重複請求。
- Mock 與 API 使用同一契約；API 出錯不可靜默退回 Mock。
- 不將密碼、token、DB URL 或實際 secret 寫入程式、文件或日誌。
- 交付前跑目前階段的必要檢查，記錄實際結果並更新 PROGRESS。
- 未完成或未測試要明列，不假裝成功，不因文件寫完就宣稱功能完成。
```

這份規則是提醒；一致性仍要靠型別、Zod、DB 約束、migration 與測試，不宣稱一份提示詞就能保證永遠沒有衝突。

## 22. 開始執行與最後回報

現在請依序：

1. 檢查現有專案並列出精簡實作清單。
2. 建立規則、schema、共用契約、資料字典來源及可運行骨架。
3. 實作完整頁面與可操作展示資料。
4. 接上真實 API／PostgreSQL 並逐條打通核心流程。
5. 執行必要驗證，交付啟動方式及部署準備。

回報請包含：修改了哪些模組、可開啟的本地 URL、展示／API 模式如何切換、主流程怎麼操作、檢查實際結果、尚未確認的正式業務資料，以及下一次從哪個進度繼續。請持續實作，不要只把以上規格換句話說。

---

## 附錄：中斷後的接續提示詞

請讀取 PROJECT_SPEC.md、.cursor/rules/00-project.mdc、docs/PROGRESS.md、docs/DATA_DICTIONARY.md，以及目前未提交的修改。沿用已完成的架構與共用契約，從尚未完成的第一個階段繼續。先核對實際程式及 schema，不根據記憶新增同義欄位、不重建資料庫、不重做已完成頁面。完成這階段後執行必要檢查並更新進度。

## 附錄：變更欄位時的提示詞

我要調整欄位／功能：[填入需求]。請先搜尋 DATA_DICTIONARY、schema.prisma、共用 contracts 與使用頁面，說明現有欄位是否可沿用。若必須改名或新增，請一起處理 migration、舊資料、DTO/Zod、response mapper、mock fixture、表單、API、匯入匯出、資料字典及必要測試。不要用另一個同義欄位臨時繞過錯誤，也不要直接 reset 資料庫。

## 技術來源備註

以下僅支援工具使用方式，業務範圍依本案討論訂定；實作時仍應核對安裝版本。

- Cursor project rules：<https://cursor.com/docs/rules>，規則使用 `.cursor/rules/*.mdc`。
- Prisma generator：<https://www.prisma.io/docs/orm/prisma-schema/overview/generators>，依支援版本使用生成的 enum 入口，分離 server 與 browser import。
- Zeabur Volumes：<https://zeabur.com/docs/en-US/data-management/volumes>，檔案持久化與重啟特性需在部署時實際配置。

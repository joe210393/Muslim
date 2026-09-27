import { writeFileSync } from "node:fs";
import { fieldMetadata } from "../packages/contracts/src/registry/field-metadata.ts";

const header = `# 資料字典

這是跨模組欄位的查閱入口。正式定義以 \`packages/db/prisma/schema.prisma\`、\`packages/contracts\` 為準；本檔由 \`pnpm docs:generate\` 從欄位註冊表產生。

命名例：畫面與 API 的 \`taxId\` 對應資料庫 \`tax_id\`。

| Entity | 中文 | API / 程式 | DB | 型別與規則 | 可空 | 建立 | 送件 | 敏感性 | 可否修改 |
|---|---|---|---|---|---|---|---|---|---|
`;

const rows = fieldMetadata
  .map((field) => `| ${field.entity} | ${field.label} | ${field.apiField} | ${field.dbColumn} | ${field.type}；${field.validation} | ${field.nullable} | ${field.createRequired} | ${field.submitRequired} | ${field.sensitivity} | ${field.mutable} |`)
  .join("\n");

const extra = `

## 使用頁面

- Organization / User：註冊、業者資料、會員管理
- Application：申請編輯、案件詳情、管理端審查
- Enrollment / Course：課程、報名、出席與學習紀錄
- Certification：驗證紀錄與核定後人工登錄
- FileObject / ApplicationAttachment：申請附件

環境變數實際值、密碼雜湊與 token 不寫入本檔。密碼雜湊欄位僅標示存在，API 不回傳。
`;

writeFileSync(new URL("../docs/DATA_DICTIONARY.md", import.meta.url), `${header}${rows}\n${extra}`);
console.info("已更新 docs/DATA_DICTIONARY.md");

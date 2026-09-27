import { readFileSync } from "node:fs";
import { fieldMetadata } from "../packages/contracts/src/registry/field-metadata.ts";

const markdown = readFileSync(new URL("../docs/DATA_DICTIONARY.md", import.meta.url), "utf8");
const missing = fieldMetadata.filter((field) => !markdown.includes(`| ${field.entity} | ${field.label} | ${field.apiField} |`));
if (missing.length) {
  console.error("資料字典缺少欄位，請執行 pnpm docs:generate");
  for (const field of missing) console.error(`- ${field.entity}.${field.prismaField}`);
  process.exit(1);
}
const keys = new Set<string>();
for (const field of fieldMetadata) {
  const key = `${field.entity}.${field.prismaField}`;
  if (keys.has(key)) {
    console.error(`欄位註冊重複：${key}`);
    process.exit(1);
  }
  keys.add(key);
}
console.info("資料字典與欄位註冊表一致");

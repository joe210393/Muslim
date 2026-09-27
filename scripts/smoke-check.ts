import { readFileSync } from "node:fs";

const gate = readFileSync(new URL("../apps/web/src/services/create-services.ts", import.meta.url), "utf8");
if (!gate.includes('import.meta.env.PROD') || !gate.includes("正式建置不可使用展示模式")) {
  console.error("正式建置缺少展示模式拒絕");
  process.exit(1);
}
console.info("展示模式閘門存在。正式 build 產物掃描需在 pnpm --filter @mf/web build 之後另做，本次不把未建置視為通過。");

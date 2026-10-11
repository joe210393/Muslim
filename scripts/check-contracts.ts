import {
  ApplicationStatus,
  ContractStatus,
  CourseStatus,
  UserRole,
  applicationStatusLabels,
  buildDemoDataset,
  categoryDefinitionSchema,
  contractStatusLabels,
  courseStatusLabels,
  userRoleLabels,
  cat01DefinitionV1,
  cat01DefinitionV2,
  genericCategoryDefinition,
} from "../packages/contracts/src/index.ts";

function assertCovered(name: string, values: Record<string, string>, labels: Record<string, unknown>) {
  for (const value of Object.values(values)) {
    if (!(value in labels)) {
      console.error(`${name} 缺少中文標籤：${value}`);
      process.exit(1);
    }
  }
}

assertCovered("ApplicationStatus", ApplicationStatus, applicationStatusLabels);
assertCovered("ContractStatus", ContractStatus, contractStatusLabels);
assertCovered("CourseStatus", CourseStatus, courseStatusLabels);
assertCovered("UserRole", UserRole, userRoleLabels);
categoryDefinitionSchema.parse(cat01DefinitionV1);
categoryDefinitionSchema.parse(cat01DefinitionV2);
categoryDefinitionSchema.parse(genericCategoryDefinition("CAT_02"));
const data = buildDemoDataset();
if (data.applications.length < 40 || data.organizations.length < 8 || data.courses.length < 6) {
  console.error("示範資料數量不足");
  process.exit(1);
}
console.info("共用契約檢查通過");

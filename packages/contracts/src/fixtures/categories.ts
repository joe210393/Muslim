import type { CategoryDefinition } from "../domain/category-definition";

export const DEMO_CATEGORY_NOTE = "示範設定。正式類別名稱、表單與附件名稱尚未提供。";

const registration = {
  key: "business_registration",
  label: "公司或商業登記文件（示範附件名稱，待確認）",
  requiredOnSubmit: true,
  helpText: DEMO_CATEGORY_NOTE,
};

const sitePhoto = {
  key: "site_photo",
  label: "場所照片（示範附件名稱，待確認）",
  requiredOnSubmit: true,
  helpText: DEMO_CATEGORY_NOTE,
};

const extraFile = {
  key: "supplementary_doc",
  label: "其他補充文件（示範附件名稱，待確認）",
  requiredOnSubmit: false,
  helpText: DEMO_CATEGORY_NOTE,
};

export const cat01DefinitionV1: CategoryDefinition = {
  schemaVersion: 1,
  helpText: "第 1 類暫以廚房／餐廳相關展示。正式名稱與審查細則待確認。",
  fields: [
    {
      key: "kitchenType",
      label: "場所型態（示範）",
      inputType: "select",
      requiredOnSubmit: true,
      helpText: DEMO_CATEGORY_NOTE,
      options: [
        { value: "central_kitchen", label: "中央廚房（示範選項）" },
        { value: "restaurant", label: "餐廳（示範選項）" },
        { value: "friendly_restaurant", label: "友善餐廳（示範選項）" },
      ],
    },
    {
      key: "operationNote",
      label: "作業說明（示範）",
      inputType: "textarea",
      requiredOnSubmit: false,
      maxLength: 1000,
      helpText: DEMO_CATEGORY_NOTE,
    },
  ],
  attachmentRequirements: [
    registration,
    sitePhoto,
    extraFile,
    {
      key: "menu_sample",
      label: "菜單或品項資料（示範附件名稱，待確認）",
      requiredOnSubmit: false,
      helpText: DEMO_CATEGORY_NOTE,
    },
  ],
};

export const cat01DefinitionV2: CategoryDefinition = {
  ...cat01DefinitionV1,
  helpText: "第 1 類表單第 2 版（示範）。已送件案件仍使用原版本。",
  fields: [
    ...cat01DefinitionV1.fields,
    {
      key: "serviceHoursNote",
      label: "營業時間說明（示範，第 2 版新增）",
      inputType: "text",
      requiredOnSubmit: false,
      maxLength: 200,
      helpText: DEMO_CATEGORY_NOTE,
    },
  ],
};

export function genericCategoryDefinition(code: string): CategoryDefinition {
  return {
    schemaVersion: 1,
    helpText: `${code} 的正式名稱、欄位與附件尚待提供。以下為示範設定。`,
    fields: [
      {
        key: "serviceDescription",
        label: "服務內容說明（示範）",
        inputType: "textarea",
        requiredOnSubmit: true,
        maxLength: 2000,
        helpText: DEMO_CATEGORY_NOTE,
      },
      {
        key: "operationStartDate",
        label: "開始營運日期（示範）",
        inputType: "date",
        requiredOnSubmit: false,
        helpText: DEMO_CATEGORY_NOTE,
      },
    ],
    attachmentRequirements: [registration, sitePhoto, extraFile],
  };
}

export const categoryBlueprints = [
  {
    code: "CAT_01",
    name: "第 1 類：廚房／餐廳相關（名稱待確認）",
    description: "暫知與 Halal 廚房、餐廳或友善餐廳有關。正式名稱待確認。",
  },
  { code: "CAT_02", name: "第 2 類（待提供正式名稱）", description: "正式分類尚未提供，不可視為官方名稱。" },
  { code: "CAT_03", name: "第 3 類（待提供正式名稱）", description: "正式分類尚未提供，不可視為官方名稱。" },
  { code: "CAT_04", name: "第 4 類（待提供正式名稱）", description: "正式分類尚未提供，不可視為官方名稱。" },
  { code: "CAT_05", name: "第 5 類（待提供正式名稱）", description: "正式分類尚未提供，不可視為官方名稱。" },
  { code: "CAT_06", name: "第 6 類（待提供正式名稱）", description: "正式分類尚未提供，不可視為官方名稱。" },
  { code: "CAT_07", name: "第 7 類（待提供正式名稱）", description: "正式分類尚未提供，不可視為官方名稱。" },
] as const;

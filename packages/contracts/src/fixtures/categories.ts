import type { CategoryDefinition, CategoryField } from "../domain/category-definition";

export const DEMO_CATEGORY_NOTE = "示範設定。正式類別名稱、表單與附件名稱尚未提供。";

const registration = {
  key: "business_registration",
  label: "公司或商業登記文件（示範附件名稱，待確認）",
  requiredOnSubmit: true,
  helpText: DEMO_CATEGORY_NOTE,
  accept: "file" as const,
  multiple: false,
};

const sitePhoto = {
  key: "site_photo",
  label: "場所照片（示範附件名稱，待確認）",
  requiredOnSubmit: true,
  helpText: DEMO_CATEGORY_NOTE,
  accept: "file" as const,
  multiple: false,
};

const extraFile = {
  key: "supplementary_doc",
  label: "其他補充文件（示範附件名稱，待確認）",
  requiredOnSubmit: false,
  helpText: DEMO_CATEGORY_NOTE,
  accept: "file" as const,
  multiple: false,
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
      accept: "file" as const,
      multiple: false,
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
    name: "Halal廚房／Halal餐廳／穆斯林友善餐廳",
    description: "同一份申請表勾一種。Halal廚房沒有內用座位。Halal餐廳全菜單可食用。穆斯林友善餐廳只有部分 Halal 餐點，廚具要區隔。",
  },
  {
    code: "CAT_02",
    name: "食用品",
    description: "空白表標題是食用品驗證申請表。申請項目格子沒有印名稱，檔名為穆斯林友善食用品。",
  },
  {
    code: "CAT_03",
    name: "穆斯林友善旅宿",
    description: "可選住宿含早餐或住宿不含早餐。不含早餐只交住宿資料；含早餐另交廚房、菜單與食材。",
  },
  { code: "CAT_04", name: "穆斯林友善商店", description: "販售 Halal 商品的商店。要附商品名稱，以及商品與擺放位置的照片。" },
  { code: "CAT_05", name: "穆斯林友善旅行社", description: "要附兩條中英文行程，以及從業人員在職證明。這份表沒有照片。" },
  { code: "CAT_06", name: "穆斯林友善環境", description: "祈禱室、淨下洗手間與前往祈禱室的方向指標。" },
  { code: "CAT_07", name: "穆斯林友善體驗活動", description: "要附中英文價格與步驟、器具食材，以及器具、食材、場地和成品照片。" },
] as const;

const FORM_NOTE = "欄位依 2026 年空白申請表。表上寫人員須修畢指定時數，時數沒有印在表上，送件時不檢查。";

function text(key: string, label: string, required = true, helpText?: string, maxLength = 80): CategoryField {
  return { key, label, inputType: "text", requiredOnSubmit: required, maxLength, ...(helpText ? { helpText } : {}) };
}

function notes(key: string, label: string, required = true, helpText?: string, when?: { field: string; equals: string }): CategoryField {
  return {
    key,
    label,
    inputType: "textarea",
    requiredOnSubmit: when ? false : required,
    maxLength: 4000,
    ...(helpText ? { helpText } : {}),
    ...(when ? { requiredWhen: when } : {}),
  };
}

function choice(key: string, label: string, options: Array<[string, string]>, helpText?: string): CategoryField {
  return {
    key,
    label,
    inputType: "select",
    requiredOnSubmit: true,
    options: options.map(([value, optionLabel]) => ({ value, label: optionLabel })),
    ...(helpText ? { helpText } : {}),
  };
}

function file(key: string, label: string, options?: { image?: boolean; multiple?: boolean; required?: boolean; when?: { field: string; equals: string }; helpText?: string; group?: "application" | "checklist" }): CategoryDefinition["attachmentRequirements"][number] {
  return {
    key,
    label,
    requiredOnSubmit: options?.when ? false : (options?.required ?? true),
    accept: options?.image ? "image" : "file",
    multiple: options?.multiple ?? false,
    ...(options?.when ? { requiredWhen: options.when } : {}),
    ...(options?.helpText ? { helpText: options.helpText } : {}),
    ...(options?.group ? { group: options.group } : {}),
  };
}

function checklist(items: Array<[string, string]>) {
  return items.map(([key, label]) => file(key, label, { image: true, group: "checklist", helpText: "檢查表這一項的照片。JPEG 或 PNG。" }));
}

const checklistByCode: Record<string, Array<[string, string]>> = {
  CAT_01: [
    ["check_menu", "Halal菜單"],
    ["check_ingredients", "食材及原物料"],
    ["check_cooking_equipment", "烹調設備"],
    ["check_utensils", "廚具與相關器具"],
    ["check_detergent", "清潔用具及洗劑"],
    ["check_storage", "冷藏／凍冰箱及乾料倉庫"],
    ["check_tableware", "穆斯林專用餐具"],
    ["check_dining", "用餐區"],
  ],
  CAT_02: [
    ["check_floor_plan", "工廠平面圖"],
    ["check_process_chart", "產品製程圖"],
    ["check_material_proof", "原物料明細列表及證明"],
    ["check_purchase", "採購單據"],
    ["check_environment", "整體環境"],
    ["check_equipment", "使用之器材"],
    ["check_storage", "冷藏／凍冰箱及乾料倉庫"],
    ["check_packaging", "外包裝"],
    ["check_halal_team", "Halal人員管理小組"],
    ["check_restroom", "洗手間"],
  ],
  CAT_03: [
    ["check_toilet", "免治馬桶或沖洗噴頭"],
    ["check_qibla", "麥加方向指標之張貼"],
    ["check_prayer_kit", "禱告毯子數量／時間表"],
    ["check_images", "人物或動物畫像及裝飾"],
    ["check_alcohol", "酒精類飲料"],
    ["check_refreshment", "Halal的點心／茶包／咖啡包"],
    ["check_adult_channel", "成人頻道管理"],
    ["check_room_count", "穆斯林友善客房之數量"],
  ],
  CAT_04: [
    ["check_product_list", "Halal商品之清單"],
    ["check_display", "Halal商品之陳列專用區"],
    ["check_product_mark", "Halal商品標示或證書"],
    ["check_restroom", "洗手間"],
  ],
  CAT_05: [
    ["check_documents", "書面資料"],
    ["check_package", "旅遊配套"],
    ["check_training", "教育訓練"],
    ["check_site_visit", "現場訪視"],
    ["check_guide", "司導（車）"],
  ],
  CAT_06: [
    ["check_room_clean", "祈禱室空間清潔"],
    ["check_rug_count", "祈禱毯子數量"],
    ["check_qibla", "麥加方向指標之張貼"],
    ["check_screen", "屏風之擺放"],
    ["check_clock", "時鐘之擺放"],
    ["check_shoes", "鞋櫃及拖鞋"],
    ["check_timetable", "禮拜時間表之擺放"],
    ["check_toilet", "免治馬桶或沖洗噴頭"],
    ["check_sign", "中英文祈禱室之標示"],
  ],
  CAT_07: [
    ["check_materials", "體驗活動使用之食／原物料"],
    ["check_tools", "器具／器材"],
    ["check_venue", "體驗活動使用之場地"],
    ["check_steps", "操作步驟"],
    ["check_price", "中英文項目及價格"],
    ["check_restroom", "洗手間"],
  ],
};

const certificateFields: CategoryField[] = [
  text("certificateNameEn", "單位名稱（英文）", true, "印在證書上的英文名稱", 200),
  text("certificateAddressEn", "單位地址（英文）", true, "印在證書上的英文地址", 300),
  text("certificatePhone", "單位電話", true, "印在證書上的電話", 30),
  text("ownerName", "負責人姓名", true, "合約負責人"),
  text("registeredName", "營業登記名稱", false, "與單位名稱相同則免填", 200),
  text("registeredAddress", "營業登記地址", false, "與單位地址相同則免填", 300),
];

const staffFields: CategoryField[] = [
  text("supervisorName", "驗證監督主管姓名"),
  text("supervisorTitle", "驗證監督主管職稱"),
  text("supervisorPhone", "驗證監督主管電話", true, undefined, 30),
  text("supervisorEmail", "驗證監督主管信箱", true, undefined, 320),
  text("liaisonName", "驗證業務窗口姓名"),
  text("liaisonTitle", "驗證業務窗口職稱"),
  text("liaisonPhone", "驗證業務窗口電話", true, undefined, 30),
  text("liaisonEmail", "驗證業務窗口信箱", true, undefined, 320),
];

const meatChoice = choice("usesMeat", "是否使用肉品", [["yes", "有使用"], ["no", "未使用"]], "有使用才要上傳肉品 Halal 證書。");

const kitchenShots: Array<[string, string]> = [
  ["photo_cooking", "專用烹調區"],
  ["photo_utensils", "專用廚具"],
  ["photo_worktop", "專用工作臺"],
  ["photo_fridge", "專用冰箱"],
  ["photo_dry_storage", "專用儲藏櫃（乾貨）"],
  ["photo_tableware", "專用儲藏櫃（餐具）"],
  ["photo_sink", "專用水槽"],
  ["photo_detergent", "清潔劑成分照"],
  ["photo_dining", "用餐區"],
  ["photo_toilet_wash", "廁所淨下設施"],
];

function kitchenPhotos(when?: { field: string; equals: string }) {
  return kitchenShots.map(([key, label]) => file(key, label, { image: true, when, helpText: "上傳這一處的照片。JPEG 或 PNG。" }));
}

const breakfast = { field: "lodgingPlan", equals: "with_breakfast" };
const usesMeat = { field: "usesMeat", equals: "yes" };

export function officialCategoryDefinition(code: string): CategoryDefinition {
  const common = { schemaVersion: 1 as const, helpText: FORM_NOTE };
  if (code === "CAT_01") {
    return {
      ...common,
      fields: [
        choice("applicationItem", "申請項目", [["halal_kitchen", "Halal廚房"], ["halal_restaurant", "Halal餐廳"], ["friendly_restaurant", "穆斯林友善餐廳"]], "Halal廚房沒有內用座位。Halal餐廳全菜單可食用。穆斯林友善餐廳要區隔廚具。"),
        choice("mealKind", "申請餐點種類", [["meals", "早／午／晚餐"], ["drinks", "飲品／點心"], ["both", "兩者都有"]]),
        ...certificateFields,
        ...staffFields,
        text("managerName", "餐廳主管姓名"),
        text("managerTitle", "餐廳主管職稱"),
        text("chefName", "餐廳廚師姓名"),
        text("chefTitle", "餐廳廚師職稱"),
        meatChoice,
        notes("ingredientDetail", "Halal菜單原物料明細", true, "每列寫餐點名稱與成分，含調味料和肉品。"),
      ],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("operating_license", "營業登記證或行業許可執照影本"),
        ...kitchenPhotos(),
        file("photo_place_other", "其他環境照片", { image: true, multiple: true, required: false, helpText: "空白表的其他格。一欄一張，最多 16 張。" }),
        file("menu_bilingual", "中英文 Halal 菜單"),
        file("photo_ingredients", "食材及醬料成分照片", { image: true, multiple: true, helpText: "一張照片一個物品。可上傳多張，最多 16 張。" }),
        file("meat_certificate", "肉類 Halal 證書與 2 個月內採購證明", { when: usesMeat, helpText: "未使用肉品不必上傳。" }),
        ...checklist(checklistByCode.CAT_01 ?? []),
      ],
    };
  }
  if (code === "CAT_02") {
    return {
      ...common,
      helpText: `${FORM_NOTE}申請項目格子在空白表是空的，類別名稱用表頭「食用品」。`,
      fields: [
        ...certificateFields,
        text("oemName", "代工廠名稱", false, "沒有代工則免填", 200),
        text("oemAddress", "代工廠地址", false, "沒有代工則免填", 300),
        text("oemPhone", "代工廠電話", false, "沒有代工則免填", 30),
        ...staffFields,
        meatChoice,
        notes("productDetail", "產品清單與原物料", true, "每列寫產品中文名、英文名和使用的原物料。"),
        notes("halalTeam", "清真小組", true, "每列寫職稱、姓名、電話和工作內容。負責人要列在內。"),
      ],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("factory_registration", "工廠登記證影本"),
        file("floor_plan", "製造單位生產線平面圖"),
        file("photo_process", "生產作業流程與現場照片", { image: true, multiple: true, helpText: "流程圖若是照片也放這裡。最多 16 張。" }),
        file("photo_materials", "原物料成分與成品照片", { image: true, multiple: true, helpText: "清單寫成分照片，內頁同時要成品。最多 16 張。" }),
        file("meat_certificate", "肉製品原料 Halal 證書", { when: usesMeat }),
        file("other_proof", "產品其他相關證明", { helpText: "例如 ISO、HACCP、產地證明、無農藥殘留或產品責任險。" }),
        ...checklist(checklistByCode.CAT_02 ?? []),
      ],
    };
  }
  if (code === "CAT_03") {
    return {
      ...common,
      fields: [
        choice("lodgingPlan", "申請項目", [["room_only", "住宿不含早餐"], ["with_breakfast", "住宿含早餐"]], "不含早餐只交附件一到四。含早餐另交廚房、菜單和食材。"),
        ...certificateFields,
        text("lodgingLicenseNo", "旅宿合法編號", true, undefined, 40),
        ...staffFields,
        text("roomManagerName", "客房主管姓名"),
        text("roomManagerTitle", "客房主管職稱"),
        text("chefName", "餐廳廚師姓名", false, "空白表這欄沒有標必填"),
        text("chefTitle", "餐廳廚師職稱", false),
        meatChoice,
        notes("roomDetail", "免治馬桶或沖洗器房號表", true, "每列寫房號、房型與間數。表上寫旅館至少 10 間、民宿至少 5 間。"),
        notes("ingredientDetail", "Halal菜單原物料明細", false, "含早餐才要填。每列寫餐點名稱與成分。", breakfast),
      ],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("lodging_license", "旅館／民宿營業登記證影本"),
        file("photo_room_wall", "客房牆面", { image: true }),
        file("photo_room_wash", "客房洗手間淨下", { image: true }),
        file("photo_prayer_board", "朝拜指標與朝拜時間表", { image: true }),
        file("photo_prayer_rug", "朝拜毯", { image: true }),
        file("photo_room_other", "其他客房照片", { image: true, multiple: true, required: false }),
        ...kitchenPhotos(breakfast),
        file("menu_bilingual", "中英文 Halal 菜單", { when: breakfast }),
        file("photo_ingredients", "食材成分照片", { image: true, multiple: true, when: breakfast, helpText: "含早餐才要。一張照片一個物品，最多 16 張。" }),
        file("meat_certificate", "肉類 Halal 證書與採購證明", { when: usesMeat, helpText: "未使用肉品不必上傳。" }),
        ...checklist(checklistByCode.CAT_03 ?? []),
      ],
    };
  }
  if (code === "CAT_04") {
    return {
      ...common,
      fields: [...certificateFields, ...staffFields, notes("productDetail", "Halal 商品一覽表", true, "每列寫一個商品名稱。")],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("trade_license", "行業許可執照影本"),
        file("photo_products", "商品與擺放位置照片", { image: true, multiple: true, helpText: "商品本身和現場欲擺放的位置都要拍。最多 16 張。" }),
        ...checklist(checklistByCode.CAT_04 ?? []),
      ],
    };
  }
  if (code === "CAT_05") {
    return {
      ...common,
      fields: [...certificateFields, ...staffFields, notes("itineraryDetail", "中英文旅遊行程", true, "要有兩條路線，中文和英文都寫。")],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("trade_license", "行業許可執照影本"),
        file("staff_proof", "從業人員在職證明"),
        ...checklist(checklistByCode.CAT_05 ?? []),
      ],
    };
  }
  if (code === "CAT_06") {
    return {
      ...common,
      fields: [...certificateFields, ...staffFields],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("trade_license", "行業許可執照影本"),
        file("photo_prayer_room", "祈禱室空間", { image: true }),
        file("photo_screen", "屏風", { image: true }),
        file("photo_prayer_direction", "朝拜指標", { image: true }),
        file("photo_prayer_rug", "朝拜毯", { image: true }),
        file("photo_clock", "時鐘", { image: true }),
        file("photo_shoes", "鞋櫃與拖鞋", { image: true }),
        file("photo_rules", "祈禱室使用規則", { image: true, helpText: "中英文版。" }),
        file("photo_wash_room", "淨下洗手間", { image: true }),
        file("photo_timetable", "朝拜時間表", { image: true }),
        file("photo_place_other", "其他環境照片", { image: true, multiple: true, required: false }),
        file("photo_signs", "指引祈禱室的方向指標", { image: true, multiple: true, helpText: "空白表有方向 1 到 8。可上傳多張，最多 16 張。" }),
        ...checklist(checklistByCode.CAT_06 ?? []),
      ],
    };
  }
  if (code === "CAT_07") {
    return {
      ...common,
      fields: [...certificateFields, ...staffFields, notes("activityDetail", "器具食材一覽表", true, "每列寫體驗活動名稱、使用器具和食用品成分。")],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("trade_license", "行業許可執照影本"),
        file("price_sheet", "中英文項目價格表與步驟解說"),
        file("photo_activity", "器具、食材、場地與成品照片", { image: true, multiple: true, helpText: "一張照片一個物品。最多 16 張。" }),
        ...checklist(checklistByCode.CAT_07 ?? []),
      ],
    };
  }
  throw new Error(`沒有這個類別的申請表：${code}`);
}

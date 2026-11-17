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
    name: "穆斯林友善餐廳",
    description: "證書用餐廳這一類。菜單、廚房和食材依勾選的驗證項目才要交。",
    displayOrder: 1,
  },
  {
    code: "CAT_02",
    name: "穆斯林友善產品",
    description: "證書列出通過的產品。申請附件仍用食用品申請表，不跟場域勾選表混用。",
    displayOrder: 7,
  },
  {
    code: "CAT_03",
    name: "穆斯林友善旅宿",
    description: "證書依旅宿這一類。含早餐才交早餐與廚房，勾了客房才交客房資料。",
    displayOrder: 2,
  },
  { code: "CAT_04", name: "穆斯林友善商店", description: "證書用商店這一類。專區和產品證明在勾了商店之後才要交。", displayOrder: 5 },
  { code: "CAT_05", name: "穆斯林友善旅行社", description: "證書寫從業人員與穆斯林友善行程。附件用旅行社申請表，不跟場域勾選表混用。", displayOrder: 6 },
  { code: "CAT_06", name: "穆斯林友善環境", description: "證書寫祈禱室與淨下設施。勾了環境之後才要交祈禱室和洗手間。", displayOrder: 3 },
  { code: "CAT_07", name: "穆斯林友善體驗活動", description: "證書寫體驗活動。含食用品才交材料；不含食用品只交器材、場地和洗手間。", displayOrder: 4 },
] as const;

const FORM_NOTE = "欄位依 2026 年空白申請表。表上寫人員須修畢指定時數，時數沒有印在表上，送件時不檢查。";

function text(key: string, label: string, required = true, helpText?: string, maxLength = 80): CategoryField {
  return { key, label, inputType: "text", requiredOnSubmit: required, maxLength, ...(helpText ? { helpText } : {}) };
}

function notes(key: string, label: string, required = true, helpText?: string, when?: { field: string; equals: string }, whenAny?: { field: string; equals: string }[]): CategoryField {
  return {
    key,
    label,
    inputType: "textarea",
    requiredOnSubmit: when || whenAny ? false : required,
    maxLength: 4000,
    ...(helpText ? { helpText } : {}),
    ...(when ? { requiredWhen: when, visibleWhenAny: [when] } : {}),
    ...(whenAny ? { requiredWhenAny: whenAny, visibleWhenAny: whenAny } : {}),
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

function file(key: string, label: string, options?: { image?: boolean; multiple?: boolean; required?: boolean; when?: { field: string; equals: string }; whenAny?: { field: string; equals: string }[]; helpText?: string; group?: "application" | "checklist" }): CategoryDefinition["attachmentRequirements"][number] {
  return {
    key,
    label,
    requiredOnSubmit: options?.when || options?.whenAny ? false : (options?.required ?? true),
    accept: options?.image ? "image" : "file",
    multiple: options?.multiple ?? false,
    ...(options?.when ? { requiredWhen: options.when } : {}),
    ...(options?.whenAny ? { requiredWhenAny: options.whenAny, visibleWhenAny: options.whenAny } : {}),
    ...(options?.when && !options?.whenAny ? { visibleWhenAny: [options.when] } : {}),
    ...(options?.helpText ? { helpText: options.helpText } : {}),
    ...(options?.group ? { group: options.group } : {}),
  };
}

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

const usesMeat = { field: "usesMeat", equals: "yes" };

function checked(keys: string[]) {
  return keys.map((field) => ({ field, equals: "true" }));
}

export const VERIFICATION_PICK_KEYS = [
  "scopeKitchen",
  "scopeHalalRestaurant",
  "scopeFriendlyRestaurant",
  "mealBreakfast",
  "mealLunch",
  "mealDinner",
  "mealDrink",
  "mealSnack",
  "scopeRestroom",
  "lodgingBreakfast",
  "lodgingNoBreakfast",
  "scopeGuestRoom",
  "activityWithFood",
  "activityWithoutFood",
  "scopeEnvironment",
  "scopeShop",
] as const;

export const VERIFICATION_EXCLUSIVE = [
  ["lodgingBreakfast", "lodgingNoBreakfast"],
  ["activityWithFood", "activityWithoutFood"],
] as const;

const FOOD_SCOPE = ["scopeKitchen", "scopeHalalRestaurant", "scopeFriendlyRestaurant", "mealBreakfast", "mealLunch", "mealDinner", "mealDrink", "mealSnack", "lodgingBreakfast", "activityWithFood"];
const MENU_SCOPE = ["scopeKitchen", "scopeHalalRestaurant", "scopeFriendlyRestaurant", "mealBreakfast", "mealLunch", "mealDinner", "mealDrink", "mealSnack"];
const RESTAURANT_MEAL = ["scopeHalalRestaurant", "scopeFriendlyRestaurant", "mealBreakfast", "mealLunch", "mealDinner", "mealDrink", "mealSnack"];
const KITCHEN_SCOPE = [...MENU_SCOPE, "lodgingBreakfast"];
const RESTROOM_SCOPE = ["scopeRestroom", "activityWithFood", "activityWithoutFood", "scopeEnvironment"];
const ACTIVITY_SCOPE = ["activityWithFood", "activityWithoutFood"];

function tick(key: string, label: string): CategoryField {
  return { key, label, inputType: "checkbox", requiredOnSubmit: false };
}

const verificationPicks: CategoryField[] = [
  tick("scopeKitchen", "Halal 廚房"),
  tick("scopeHalalRestaurant", "Halal 餐廳"),
  tick("scopeFriendlyRestaurant", "穆斯林友善餐廳"),
  tick("mealBreakfast", "早餐"),
  tick("mealLunch", "午餐"),
  tick("mealDinner", "晚餐"),
  tick("mealDrink", "飲品"),
  tick("mealSnack", "點心"),
  tick("scopeRestroom", "洗手間：備有淨下設施"),
  tick("lodgingBreakfast", "旅宿含早餐"),
  tick("lodgingNoBreakfast", "旅宿不含早餐"),
  tick("scopeGuestRoom", "客房"),
  tick("activityWithFood", "體驗活動含食用品"),
  tick("activityWithoutFood", "體驗活動不含食用品"),
  tick("scopeEnvironment", "穆斯林友善環境"),
  tick("scopeShop", "穆斯林友善商店"),
];

const kitchenZone: CategoryField = {
  key: "kitchenZone",
  label: "廚房範圍",
  inputType: "select",
  requiredOnSubmit: false,
  options: [
    { value: "full", label: "全 Halal 廚房" },
    { value: "partial", label: "部分專區廚房" },
  ],
  helpText: "Halal 餐廳、穆斯林友善餐廳或任一餐別要選。Halal 廚房本身就是全廚房。",
  requiredWhenAny: checked(RESTAURANT_MEAL),
  visibleWhenAny: checked(RESTAURANT_MEAL),
};

function meatField(): CategoryField {
  return {
    ...meatChoice,
    requiredOnSubmit: false,
    visibleWhenAny: checked(FOOD_SCOPE),
    requiredWhenAny: checked(FOOD_SCOPE),
  };
}

function sharedVerificationFiles(): CategoryDefinition["attachmentRequirements"] {
  return [
    file("menu_bilingual", "Halal 中英文菜單", { whenAny: checked(MENU_SCOPE) }),
    file("photo_kitchen_set", "廚房設備、廚具、餐具、器具、洗劑", { image: true, multiple: true, whenAny: checked(KITCHEN_SCOPE), helpText: "Halal 廚房、餐廳、餐別或旅宿含早餐要交。可上傳多張。" }),
    file("photo_ingredient_set", "食材：原物料、醬料、調味料", { image: true, multiple: true, whenAny: checked(MENU_SCOPE), helpText: "可上傳多張。" }),
    file("photo_breakfast_service", "Halal 早餐", { image: true, multiple: true, whenAny: checked(["lodgingBreakfast"]), helpText: "提供的 Halal 早餐。廚房設備用上面的廚房照片。" }),
    file("photo_guest_room", "客房：麥加方向、禱告毯、無酒精與非 Halal 點心、無人物或動物畫像、淨下設施", { image: true, multiple: true, whenAny: checked(["scopeGuestRoom"]) }),
    file("photo_activity_place", "體驗活動使用的器材及場地", { image: true, multiple: true, whenAny: checked(ACTIVITY_SCOPE) }),
    file("photo_activity_materials", "體驗活動的原物料、醬料、調味料、餐具、器具、洗劑", { image: true, multiple: true, whenAny: checked(["activityWithFood"]) }),
    file("photo_prayer_room", "祈禱室：禱告毯、麥加方向貼紙、禱告時間表、屏風、時鐘、鞋櫃、拖鞋", { image: true, multiple: true, whenAny: checked(["scopeEnvironment"]) }),
    file("photo_restroom_wash", "洗手間淨下設施", { image: true, whenAny: checked(RESTROOM_SCOPE) }),
    file("photo_shop_zone", "販售 Halal 產品的專用區", { image: true, multiple: true, whenAny: checked(["scopeShop"]) }),
    file("shop_halal_proof", "Halal 標示或證書", { whenAny: checked(["scopeShop"]), helpText: "用來證明產品的 Halal 狀態。" }),
    file("meat_certificate", "肉類 Halal 證書與採購證明", { when: usesMeat, whenAny: checked(FOOD_SCOPE), helpText: "有使用肉品才要上傳。" }),
  ];
}

export function officialCategoryDefinition(code: string): CategoryDefinition {
  const common = { schemaVersion: 1 as const, helpText: FORM_NOTE };
  if (code === "CAT_01") {
    return {
      ...common,
      fields: [
        ...verificationPicks,
        kitchenZone,
        ...certificateFields,
        ...staffFields,
        text("managerName", "餐廳主管姓名"),
        text("managerTitle", "餐廳主管職稱"),
        text("chefName", "餐廳廚師姓名"),
        text("chefTitle", "餐廳廚師職稱"),
        meatField(),
        notes("ingredientDetail", "Halal菜單原物料明細", true, "每列寫餐點名稱與成分，含調味料和肉品。", undefined, checked(FOOD_SCOPE)),
      ],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("operating_license", "營業登記證或行業許可執照影本"),
        ...sharedVerificationFiles(),
        file("photo_place_other", "其他環境照片", { image: true, multiple: true, required: false, helpText: "空白表的其他格。一欄一張，最多 16 張。" }),
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
      ],
    };
  }
  if (code === "CAT_03") {
    return {
      ...common,
      fields: [
        ...verificationPicks,
        kitchenZone,
        ...certificateFields,
        text("lodgingLicenseNo", "旅宿合法編號", true, undefined, 40),
        ...staffFields,
        text("roomManagerName", "客房主管姓名"),
        text("roomManagerTitle", "客房主管職稱"),
        text("chefName", "餐廳廚師姓名", false, "空白表這欄沒有標必填"),
        text("chefTitle", "餐廳廚師職稱", false),
        meatField(),
        notes("roomDetail", "免治馬桶或沖洗器房號表", true, "每列寫房號、房型與間數。表上寫旅館至少 10 間、民宿至少 5 間。", undefined, checked(["lodgingBreakfast", "lodgingNoBreakfast", "scopeGuestRoom"])),
        notes("ingredientDetail", "Halal菜單原物料明細", false, "含早餐或有餐點時才要填。每列寫餐點名稱與成分。", undefined, checked(FOOD_SCOPE)),
      ],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("lodging_license", "旅館／民宿營業登記證影本"),
        ...sharedVerificationFiles(),
      ],
    };
  }
  if (code === "CAT_04") {
    return {
      ...common,
      fields: [...verificationPicks, kitchenZone, ...certificateFields, ...staffFields, meatField(), notes("productDetail", "Halal 商品一覽表", true, "每列寫一個商品名稱。", undefined, checked(["scopeShop"]))],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("trade_license", "行業許可執照影本"),
        ...sharedVerificationFiles(),
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
      ],
    };
  }
  if (code === "CAT_06") {
    return {
      ...common,
      fields: [...verificationPicks, kitchenZone, ...certificateFields, ...staffFields, meatField()],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("trade_license", "行業許可執照影本"),
        ...sharedVerificationFiles(),
        file("photo_signs", "指引祈禱室的方向指標", { image: true, multiple: true, whenAny: checked(["scopeEnvironment"]), helpText: "空白表有方向 1 到 8。可上傳多張，最多 16 張。" }),
      ],
    };
  }
  if (code === "CAT_07") {
    return {
      ...common,
      fields: [...verificationPicks, kitchenZone, ...certificateFields, ...staffFields, meatField(), notes("activityDetail", "器具食材一覽表", true, "每列寫體驗活動名稱、使用器具和食用品成分。", undefined, checked(ACTIVITY_SCOPE))],
      attachmentRequirements: [
        file("registration_copy", "公司／商業設立登記影本"),
        file("trade_license", "行業許可執照影本"),
        file("price_sheet", "中英文項目價格表與步驟解說", { whenAny: checked(ACTIVITY_SCOPE) }),
        ...sharedVerificationFiles(),
      ],
    };
  }
  throw new Error(`沒有這個類別的申請表：${code}`);
}

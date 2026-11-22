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
    description: "依餐廳申請表：Halal 廚房／Halal 餐廳／穆斯林友善餐廳，以及餐點種類與對應附件。",
    displayOrder: 1,
  },
  {
    code: "CAT_02",
    name: "穆斯林友善產品",
    description: "依食用品申請表：產品清單、產線與清真小組等固定附件。",
    displayOrder: 7,
  },
  {
    code: "CAT_03",
    name: "穆斯林友善旅宿",
    description: "依旅宿申請表：含早餐或不含早餐；含早餐才要交廚房與菜單相關附件。",
    displayOrder: 2,
  },
  { code: "CAT_04", name: "穆斯林友善商店", description: "依商店申請表：Halal 商品一覽與陳列照片。", displayOrder: 5 },
  { code: "CAT_05", name: "穆斯林友善旅行社", description: "依旅行社申請表：中英文行程與從業人員在職證明。", displayOrder: 6 },
  { code: "CAT_06", name: "穆斯林友善環境", description: "依環境申請表：祈禱室、洗手間與指引指標照片。", displayOrder: 3 },
  { code: "CAT_07", name: "穆斯林友善體驗活動", description: "依體驗活動申請表：價格表、器具食材與活動照片。", displayOrder: 4 },
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
const lodgingWithBreakfast = { field: "applyType", equals: "with_breakfast" };

function checked(keys: string[]) {
  return keys.map((field) => ({ field, equals: "true" }));
}

const mealMainWhen = checked(["mealBreakfast", "mealLunch", "mealDinner"]);
const mealSnackWhen = checked(["mealDrink", "mealSnack"]);
const anyRestaurantMealWhen = [...mealMainWhen, ...mealSnackWhen];

/** 餐廳申請餐點種類：畫面拆五項；附件依「早／午／晚餐」與「飲品／點心」兩組出現。 */
export const VERIFICATION_PICK_KEYS = [
  "mealBreakfast",
  "mealLunch",
  "mealDinner",
  "mealDrink",
  "mealSnack",
] as const;

/** 目前各類申請項目為 select 擇一，無 checkbox 互斥組。 */
export const VERIFICATION_EXCLUSIVE: ReadonlyArray<readonly [string, string]> = [];

function tick(key: string, label: string, helpText?: string): CategoryField {
  return { key, label, inputType: "checkbox", requiredOnSubmit: false, ...(helpText ? { helpText } : {}) };
}

export function officialCategoryDefinition(code: string): CategoryDefinition {
  const common = { schemaVersion: 1 as const, helpText: FORM_NOTE };
  if (code === "CAT_01") {
    return {
      ...common,
      helpText: `${FORM_NOTE}欄位與附件依「穆斯林友善餐廳驗證申請表」。`,
      fields: [
        choice("applyType", "申請項目", [
          ["halal_kitchen", "Halal廚房：無餐飲內用座位"],
          ["halal_restaurant", "Halal餐廳：全菜單與全 Halal 廚房"],
          ["friendly_restaurant", "穆斯林友善餐廳：部分菜單 Halal 並區隔"],
        ], "請擇一。"),
        tick("mealBreakfast", "早餐"),
        tick("mealLunch", "午餐"),
        tick("mealDinner", "晚餐"),
        tick("mealDrink", "飲品"),
        tick("mealSnack", "點心"),
        ...certificateFields,
        ...staffFields,
        text("managerName", "餐廳主管姓名"),
        text("managerTitle", "餐廳主管職稱"),
        text("chefName", "餐廳廚師姓名"),
        text("chefTitle", "餐廳廚師職稱"),
        {
          ...meatChoice,
          requiredOnSubmit: false,
          visibleWhenAny: anyRestaurantMealWhen,
          requiredWhenAny: anyRestaurantMealWhen,
        },
        notes("ingredientDetail", "Halal菜單原物料明細（早／午／晚餐）", true, "每列寫餐點名稱與成分，含調味料和肉品。", undefined, mealMainWhen),
        notes("ingredientDetailDrinkSnack", "Halal菜單原物料明細（飲品／點心）", true, "每列寫品項名稱與成分。", undefined, mealSnackWhen),
      ],
      attachmentRequirements: [
        file("registration_copy", "附件一：公司／商業設立登記影本"),
        file("operating_license", "附件二：營業登記證／該行業許可執照影本"),
        file("photo_environment", "附件三：環境照片（請貼上專用標示）", { image: true, multiple: true, helpText: "含專用烹調區、廚具、工作臺、冰箱、儲藏、水槽、清潔劑、用餐區、廁所淨下等。最多 16 張。" }),
        file("menu_bilingual", "附件四：中英文版 Halal 菜單（早／午／晚餐）", { whenAny: mealMainWhen }),
        file("ingredient_list", "附件五：Halal菜單原物料明細（早／午／晚餐）", { whenAny: mealMainWhen }),
        file("photo_ingredient_set", "附件六：食材及醬料成分照片（早／午／晚餐）", { image: true, multiple: true, whenAny: mealMainWhen }),
        file("menu_drink_snack", "附件四：中英文版 Halal 菜單（飲品／點心）", { whenAny: mealSnackWhen }),
        file("ingredient_list_drink_snack", "附件五：Halal菜單原物料明細（飲品／點心）", { whenAny: mealSnackWhen }),
        file("photo_ingredient_drink_snack", "附件六：食材及醬料成分照片（飲品／點心）", { image: true, multiple: true, whenAny: mealSnackWhen }),
        file("meat_certificate", "附件七：肉類 Halal 證書與 2 個月內採購證明", { when: usesMeat, helpText: "有使用肉品才要上傳。" }),
      ],
    };
  }
  if (code === "CAT_02") {
    return {
      ...common,
      helpText: `${FORM_NOTE}欄位與附件依「食用品驗證申請表」。`,
      fields: [
        ...certificateFields,
        text("oemName", "代工廠名稱", false, "沒有代工則免填", 200),
        text("oemAddress", "代工廠地址", false, "沒有代工則免填", 300),
        text("oemPhone", "代工廠電話", false, "沒有代工則免填", 30),
        ...staffFields,
        meatChoice,
        notes("productDetail", "申請 Halal 驗證產品清單及使用的原物料清單", true, "每列寫產品與原物料。"),
        notes("halalTeam", "清真小組", true, "請提供所有參與清真產品製作流程的人員名單。"),
      ],
      attachmentRequirements: [
        file("registration_copy", "附件一：公司／商業設立登記影本"),
        file("factory_registration", "附件二：工廠登記證影本"),
        file("floor_plan", "附件三：製造單位生產線平面圖"),
        file("photo_process", "附件四：製造單位生產作業流程圖與現場照片", { image: true, multiple: true }),
        file("product_material_list", "附件五：申請 Halal 驗證產品清單及原物料清單"),
        file("photo_materials", "附件六：原物料成分明細照片", { image: true, multiple: true }),
        file("meat_certificate", "附件七：肉製品原料 Halal 證書", { when: usesMeat }),
        file("other_proof", "附件八：產品其他相關證明", { helpText: "例如 ISO、HACCP、產地證明、無農藥殘留證明等。" }),
        file("halal_team_list", "附件九：清真小組人員名單"),
      ],
    };
  }
  if (code === "CAT_03") {
    return {
      ...common,
      helpText: `${FORM_NOTE}欄位與附件依「穆斯林友善旅宿驗證申請表」。不含早餐交附件一至四；含早餐交附件一至九。`,
      fields: [
        choice("applyType", "申請項目", [
          ["with_breakfast", "穆斯林友善旅宿（住宿含早餐）"],
          ["without_breakfast", "穆斯林友善旅宿（住宿不含早餐）"],
        ], "請擇一。"),
        ...certificateFields,
        text("lodgingLicenseNo", "旅宿合法編號", true, undefined, 40),
        ...staffFields,
        text("roomManagerName", "客房主管姓名"),
        text("roomManagerTitle", "客房主管職稱"),
        text("chefName", "餐廳廚師姓名", false, "空白表這欄沒有標必填"),
        text("chefTitle", "餐廳廚師職稱", false),
        {
          ...meatChoice,
          requiredOnSubmit: false,
          visibleWhenAny: [lodgingWithBreakfast],
          requiredWhenAny: [lodgingWithBreakfast],
        },
        notes("roomDetail", "旅宿設有免治馬桶或沖洗器的房號表", true, "每列寫房號、房型與間數。表上寫旅館至少 10 間、民宿至少 5 間。"),
        notes("ingredientDetail", "Halal菜單原物料明細", false, "含早餐才要填。", lodgingWithBreakfast),
      ],
      attachmentRequirements: [
        file("registration_copy", "附件一：公司／商業設立登記影本"),
        file("lodging_license", "附件二：旅館／民宿營業登記證影本"),
        file("room_bidet_list", "附件三：免治馬桶或沖洗器房號表"),
        file("photo_environment", "附件四：環境照片", { image: true, multiple: true }),
        file("photo_kitchen_dining", "附件五：廚房專區及用餐區等環境照片", { image: true, multiple: true, when: lodgingWithBreakfast }),
        file("menu_bilingual", "附件六：中英文版 Halal 菜單", { when: lodgingWithBreakfast }),
        file("ingredient_list", "附件七：Halal菜單原物料明細", { when: lodgingWithBreakfast }),
        file("photo_ingredient_set", "附件八：食材成分照片", { image: true, multiple: true, when: lodgingWithBreakfast }),
        file("meat_certificate", "附件九：肉類 Halal 證書與採購證明", { when: usesMeat, helpText: "有使用肉品才要上傳。" }),
      ],
    };
  }
  if (code === "CAT_04") {
    return {
      ...common,
      helpText: `${FORM_NOTE}欄位與附件依「穆斯林友善商店驗證申請表」。`,
      fields: [
        ...certificateFields,
        ...staffFields,
        notes("productDetail", "商店販售之 Halal 商品一覽表", true, "每列寫一個商品名稱。"),
      ],
      attachmentRequirements: [
        file("registration_copy", "附件一：公司／商業設立登記影本"),
        file("trade_license", "附件二：行業許可執照影本"),
        file("product_list", "附件三：商店販售之 Halal 商品一覽表"),
        file("photo_shop_display", "附件四：Halal 商品清單與照片、現場欲擺放位置照片", { image: true, multiple: true }),
      ],
    };
  }
  if (code === "CAT_05") {
    return {
      ...common,
      helpText: `${FORM_NOTE}欄位與附件依「穆斯林友善旅行社驗證申請表」。`,
      fields: [
        ...certificateFields,
        ...staffFields,
        notes("itineraryDetail", "中英文旅遊行程路線兩條", true, "要有兩條路線，中文和英文都寫。"),
      ],
      attachmentRequirements: [
        file("registration_copy", "附件一：公司／商業設立登記影本"),
        file("trade_license", "附件二：行業許可執照影本"),
        file("itinerary_files", "附件三：中英文旅遊行程路線兩條"),
        file("staff_proof", "附件四：從業人員在職證明"),
      ],
    };
  }
  if (code === "CAT_06") {
    return {
      ...common,
      helpText: `${FORM_NOTE}欄位與附件依「穆斯林友善環境驗證申請表」。`,
      fields: [...certificateFields, ...staffFields],
      attachmentRequirements: [
        file("registration_copy", "附件一：公司／商業設立登記影本"),
        file("trade_license", "附件二：行業許可執照影本"),
        file("photo_prayer_restroom", "附件三：祈禱室與洗手間相關照片", { image: true, multiple: true, helpText: "含祈禱室空間、屏風、朝拜指標、朝拜毯、時鐘、鞋櫃拖鞋、使用規則、淨下洗手間、朝拜時間表等。" }),
        file("photo_signs", "附件四：指引前往祈禱室的方向指標照片", { image: true, multiple: true }),
      ],
    };
  }
  if (code === "CAT_07") {
    return {
      ...common,
      helpText: `${FORM_NOTE}欄位與附件依「穆斯林友善體驗活動驗證申請表」。`,
      fields: [
        ...certificateFields,
        ...staffFields,
        notes("activityDetail", "體驗活動器具食材一覽表", true, "每列寫體驗活動名稱、使用器具和食用品成分。"),
      ],
      attachmentRequirements: [
        file("registration_copy", "附件一：公司／商業設立登記影本"),
        file("trade_license", "附件二：行業許可執照影本"),
        file("price_sheet", "附件三：體驗活動中英文項目價格表、中英文步驟解說"),
        file("activity_material_list", "附件四：體驗活動器具食材一覽表"),
        file("photo_activity_set", "附件五：器具／食材成分／活動場地及成品照片", { image: true, multiple: true }),
      ],
    };
  }
  throw new Error(`沒有這個類別的申請表：${code}`);
}

/** 範本編輯器可插入的黃底可填欄位（發出時由管理員表單帶入）。 */
export const CONTRACT_FIELD_DEFS = [
  { key: "siteName", label: "驗證場域名稱" },
  { key: "feeAmount", label: "費用總金額" },
  { key: "partyBName", label: "乙方名稱" },
  { key: "partyBAddress", label: "乙方地址" },
  { key: "partyBOwner", label: "乙方負責人" },
  { key: "partyBTaxId", label: "乙方統一編號" },
  { key: "contractNo", label: "合約編號" },
  { key: "issuedOn", label: "發出日期" },
  { key: "signYear", label: "簽約年" },
  { key: "signMonth", label: "簽約月" },
  { key: "signDay", label: "簽約日" },
  // 驗證類別勾選（對應合約表格左側框）
  { key: "checkHalalKitchen", label: "Halal廚房勾選", kind: "checkbox" as const },
  { key: "checkHalalRestaurant", label: "Halal餐廳勾選", kind: "checkbox" as const },
  { key: "checkMuslimFriendlyRestaurant", label: "穆斯林友善餐廳勾選", kind: "checkbox" as const },
  { key: "checkMealService", label: "早/午/晚餐勾選", kind: "checkbox" as const },
  { key: "checkDrinksSnacks", label: "飲品/點心勾選", kind: "checkbox" as const },
  { key: "checkFullHalalKitchen", label: "全Halal廚房勾選", kind: "checkbox" as const },
  { key: "checkPartialKitchen", label: "部分專區廚房勾選", kind: "checkbox" as const },
  { key: "checkRestaurantRestroom", label: "餐廳洗手間勾選", kind: "checkbox" as const },
  { key: "lodgingWithBreakfast", label: "旅宿含早餐勾選", kind: "checkbox" as const },
  { key: "lodgingWithoutBreakfast", label: "旅宿不含早餐勾選", kind: "checkbox" as const },
  { key: "itemBreakfast", label: "旅宿早餐項目勾選", kind: "checkbox" as const },
  { key: "itemGuestRoom", label: "旅宿客房項目勾選", kind: "checkbox" as const },
  { key: "checkExperience", label: "體驗活動勾選", kind: "checkbox" as const },
  { key: "checkExperienceWithFood", label: "體驗含食用品勾選", kind: "checkbox" as const },
  { key: "checkExperienceWithoutFood", label: "體驗不含食用品勾選", kind: "checkbox" as const },
  { key: "checkEnvironment", label: "穆斯林友善環境勾選", kind: "checkbox" as const },
  { key: "checkShop", label: "穆斯林友善商店勾選", kind: "checkbox" as const },
] as const;

export type ContractFieldKey = (typeof CONTRACT_FIELD_DEFS)[number]["key"];

export function contractFieldLabel(key: string): string {
  return CONTRACT_FIELD_DEFS.find((item) => item.key === key)?.label ?? key;
}

export function isContractCheckboxField(key: string): boolean {
  return CONTRACT_FIELD_DEFS.some((item) => item.key === key && "kind" in item && item.kind === "checkbox");
}

/** 發出合約表單上的驗證項目勾選（不含旅宿四項，旅宿另列）。 */
export const CONTRACT_CATEGORY_CHECKBOXES = [
  { key: "checkHalalKitchen", label: "Halal廚房" },
  { key: "checkHalalRestaurant", label: "Halal餐廳" },
  { key: "checkMuslimFriendlyRestaurant", label: "穆斯林友善餐廳" },
  { key: "checkMealService", label: "早/午/晚餐" },
  { key: "checkDrinksSnacks", label: "飲品/點心" },
  { key: "checkFullHalalKitchen", label: "全Halal廚房" },
  { key: "checkPartialKitchen", label: "部分專區廚房" },
  { key: "checkRestaurantRestroom", label: "餐廳洗手間" },
  { key: "checkExperience", label: "穆斯林友善體驗活動" },
  { key: "checkExperienceWithFood", label: "體驗含食用品" },
  { key: "checkExperienceWithoutFood", label: "體驗不含食用品" },
  { key: "checkEnvironment", label: "穆斯林友善環境" },
  { key: "checkShop", label: "穆斯林友善商店" },
] as const;

/** 依合約表格分組：類別／細項分開勾選，避免全部混在一起。 */
export const CONTRACT_CHECKBOX_GROUPS = [
  {
    id: "restaurant",
    title: "餐廳／廚房",
    items: [
      { key: "checkHalalKitchen", label: "Halal廚房" },
      { key: "checkHalalRestaurant", label: "Halal餐廳" },
      { key: "checkMuslimFriendlyRestaurant", label: "穆斯林友善餐廳" },
      { key: "checkMealService", label: "早/午/晚餐" },
      { key: "checkDrinksSnacks", label: "飲品/點心" },
      { key: "checkFullHalalKitchen", label: "全Halal廚房" },
      { key: "checkPartialKitchen", label: "部分專區廚房" },
      { key: "checkRestaurantRestroom", label: "餐廳洗手間" },
    ],
  },
  {
    id: "lodging",
    title: "穆斯林友善旅宿",
    items: [
      { key: "lodgingWithBreakfast", label: "含早餐" },
      { key: "lodgingWithoutBreakfast", label: "不含早餐" },
      { key: "itemBreakfast", label: "早餐項目" },
      { key: "itemGuestRoom", label: "客房項目" },
    ],
  },
  {
    id: "experience",
    title: "穆斯林友善體驗活動",
    items: [
      { key: "checkExperience", label: "體驗活動" },
      { key: "checkExperienceWithFood", label: "含食用品" },
      { key: "checkExperienceWithoutFood", label: "不含食用品" },
    ],
  },
  {
    id: "environment",
    title: "穆斯林友善環境",
    items: [{ key: "checkEnvironment", label: "友善環境" }],
  },
  {
    id: "shop",
    title: "穆斯林友善商店",
    items: [{ key: "checkShop", label: "友善商店" }],
  },
] as const;

/** 依申請類別帶出建議勾選（管理員仍可改）。 */
export function suggestedContractChecksForCategory(
  categoryCode: string,
  formData: Record<string, unknown> = {},
): Record<string, boolean> {
  const checks: Record<string, boolean> = {};
  const kitchenType = String(formData.kitchenType ?? formData.restaurantType ?? "");
  if (categoryCode === "CAT_01") {
    if (kitchenType === "halal_restaurant" || kitchenType.includes("halal")) checks.checkHalalRestaurant = true;
    else if (kitchenType === "friendly_restaurant" || kitchenType.includes("friendly")) checks.checkMuslimFriendlyRestaurant = true;
    else checks.checkMuslimFriendlyRestaurant = true;
  }
  if (categoryCode === "CAT_03") {
    const lodging = String(formData.lodgingType ?? formData.breakfastOption ?? "");
    if (lodging.includes("without") || lodging.includes("不含")) {
      checks.lodgingWithoutBreakfast = true;
      checks.itemGuestRoom = true;
    } else {
      checks.lodgingWithBreakfast = true;
      checks.itemBreakfast = true;
      checks.itemGuestRoom = true;
    }
  }
  if (categoryCode === "CAT_04") checks.checkShop = true;
  if (categoryCode === "CAT_06") checks.checkEnvironment = true;
  if (categoryCode === "CAT_07") {
    checks.checkExperience = true;
    const food = String(formData.foodOption ?? formData.experienceFood ?? "");
    if (food.includes("without") || food.includes("不含")) checks.checkExperienceWithoutFood = true;
    else checks.checkExperienceWithFood = true;
  }
  return checks;
}

/**
 * 尚未改由內容管理儲存的前台占位。
 * 首頁、關於我們、最新消息、驗證介紹與常見問題改在後台編輯。
 * 朝拜時間不填推測值。每一段仍標成待甲方確認。
 */
export const contentStatus = {
  label: "待甲方確認",
  note: "這是依 HALA 驗證網站需求分析簡報推論的初稿。金額、法律文字、檢查標準與正式文案都以甲方日後提供的版本為準。",
} as const;

export const brand = {
  name: "HALA 驗證",
  product: "穆斯林友善驗證線上申請暨審核",
  summary: "公開前台說明制度，業者會員區處理申請與補件，內部後台負責審查、訓練與紀錄。",
};

export const prayerSchedule = {
  note: "甲方需提供正式朝拜時間表或指定資料來源。以下只保留欄位，不填入推測時間。",
  columns: ["日期", "晨禮", "晌禮", "晡禮", "昏禮", "宵禮"],
  rows: [
    ["待填", "待填", "待填", "待填", "待填", "待填"],
  ],
};

export const contactContent = {
  title: "聯絡我們",
  email: "contact@example.test",
  phone: "待填",
  address: "待填",
  hours: "待填",
  inboxNote: "正式收件信箱與是否改由表單進件，都待甲方確認。按下送出只會留在這台瀏覽器，不會寄信。",
};

export const siteReviewChecklist = [
  { key: "supplier-docs", label: "供應商與原料文件", detail: "可追溯的原料來源文件是否齊備。判定標準待甲方提供。" },
  { key: "segregation", label: "交叉污染防範", detail: "作業區、器具與清潔劑是否分開。拍照項目待確認。" },
  { key: "cleaning", label: "清潔與病媒", detail: "清潔紀錄與現場狀態。錄影長度與保存年限待確認。" },
  { key: "staff", label: "人員與訓練", detail: "在場人員是否完成指定課程。課程名單待甲方提供。" },
  { key: "facility", label: "洗淨與祈禱空間", detail: "若申請類別需要，再依正式檢查表補充，此項可能不適用於每一類。" },
];

export const contractFields = [
  { key: "version", label: "合約版本", hint: "正式範本編號，待甲方提供" },
  { key: "signer", label: "簽約人姓名", hint: "是否必須為負責人，待確認" },
  { key: "title", label: "職稱", hint: "" },
  { key: "termYears", label: "年限", hint: "各類年限可能不同" },
  { key: "start", label: "起始日", hint: "YYYY-MM-DD" },
  { key: "scope", label: "授權範圍", hint: "可使用的名稱、菜單或標示，待法律文字" },
];

export const renewalRules = [
  "到期前兩個月是否發信提醒，待通知文案核定後才啟用。",
  "續約是否沿用原審查結果，或必須重新現場複審，尚未確認。",
  "續約費用與是否重新簽約，待合約範本。",
];

export const authorizedResources = [
  { title: "公版菜單", status: "檔案待提供" },
  { title: "標示使用規範", status: "檔案待提供" },
  { title: "驗證標章圖檔", status: "使用授權待確認，不可先放正式標章" },
];

export const standardReports = [
  { name: "案件進度表", fields: "案件編號、業者、類別、狀態、送件日", ready: true },
  { name: "補件逾期表", fields: "案件編號、要求補件日、尚未回覆天數", ready: false },
  { name: "訓練出席表", fields: "課程、姓名、出席、分鐘、完課", ready: true },
  { name: "證書效期表", fields: "證書編號、核發日、到期日、是否仍有效", ready: false },
  { name: "續約提醒表", fields: "業者、到期日、是否已通知", ready: false },
];

/**
 * 尚未改由內容管理儲存的占位文案。
 * 公開頁面版面改在頁面編輯；這裡只留品牌名稱與少數仍寫在畫面裡的說明。
 */
export const contentStatus = {
  label: "待甲方確認",
  note: "這是依 HALAL 驗證網站需求分析簡報推論的初稿。金額、法律文字、檢查標準與正式文案都以甲方日後提供的版本為準。",
} as const;

export const brand = {
  name: "HALAL 驗證",
};

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

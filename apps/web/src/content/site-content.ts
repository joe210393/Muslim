/**
 * 甲方尚未提供的前台文案、費用、檢查表與通知稿。
 * 正式資料到手後，只改這個檔案，頁面結構不必重寫。
 * 每一段都標成「待甲方確認」，不得當成已核定的官方規則。
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

export const homeContent = {
  eyebrow: "公開前台",
  title: "把驗證申請、補件與教育訓練放在同一套流程",
  lead: "訪客可以先閱讀制度說明與課程。業者登入後建立草稿、補件並查詢進度。審查與出席由內部人員處理，初版不自動核發證書，也不串接金流。",
  points: [
    { title: "先了解制度", body: "驗證介紹說明申請順序。正式費用與合約文字尚未核定。" },
    { title: "再準備資料", body: "七類申請共用同一份表單骨架。類別名稱與附件仍待甲方確認。" },
    { title: "依結果補件", body: "補件會回到要求當下的審查階段，前後內容都留著。" },
  ],
};

export const aboutContent = {
  title: "關於我們",
  paragraphs: [
    "本站用於受理穆斯林友善驗證的線上申請與審查。組織沿革、負責人、據點照片與品牌影片尚未由甲方提供，以下只保留頁面結構。",
    "對外名稱暫用 HALA 驗證。若甲方有正式機構名稱、標章使用規範或不可使用的用語，請直接替換本段，不要在畫面上另寫一套名稱。",
  ],
  facts: [
    { label: "服務對象", value: "提出驗證申請的業者，以及負責審查與訓練的內部人員" },
    { label: "目前不做", value: "金流扣款、自動發證、簡訊與 LINE 通知。線上簽約可測試，正式法律效力待確認。" },
    { label: "聯絡信箱", value: "contact@example.test（占位，不可當成正式窗口）" },
  ],
};

export const newsItems = [
  {
    slug: "draft-application-open",
    title: "線上申請草稿已開放試用",
    date: "2026-10-01",
    summary: "業者可以先建立草稿。這則不是正式公告。",
    body: "試用期間的類別名稱、附件與費用都尚未核定。送出前請再核對甲方提供的正式表單。此訊息可整篇替換或下架。",
  },
  {
    slug: "training-schedule-pending",
    title: "教育訓練梯次仍使用示範課程",
    date: "2026-10-08",
    summary: "月曆與列表已可瀏覽，題庫與正式教材尚未提供。",
    body: "目前課程用於確認報名、名額與出席登錄。及格分數、重考次數與影片完課規則待甲方確認後才會生效。",
  },
] as const;

export const halaSteps = [
  { title: "閱讀驗證介紹", body: "了解申請順序與尚未核定的項目。朝拜時間表待甲方提供後填入，此處不臆造禮拜時間。" },
  { title: "確認費用", body: "費用項目已留欄位。金額、退款與金流服務商未定，系統不會假裝扣款成功。" },
  { title: "填寫申請", body: "草稿可分次儲存。缺資料時不能送件。" },
  { title: "初審與補件", body: "審查人員可要求補件。業者只看到需補充的說明，看不到內部註記。" },
  { title: "現場複審", body: "檢查表為推論初稿。實地拍照與錄影仍以人工歸檔，尚未綁定手機拍攝流程。" },
  { title: "簽約、證書與續約", body: "合約可在線上簽署並下載 PDF。證書仍由管理員在核定後人工登錄。" },
];

export const feeItems = [
  { code: "FEE_DOC", item: "文件初審", basis: "每一申請案", amount: "待填", refund: "送件前取消是否退費，待確認" },
  { code: "FEE_SITE", item: "現場複審", basis: "每一場所", amount: "待填", refund: "已派出人員後的取消費，待確認" },
  { code: "FEE_CERT_DIGITAL", item: "電子證書", basis: "核定後", amount: "待填", refund: "初版不自動產製" },
  { code: "FEE_CERT_PAPER", item: "實體證書", basis: "另案申請", amount: "待填", refund: "印製後不退費與否，待確認" },
  { code: "FEE_RENEW", item: "續約", basis: "到期前辦理", amount: "待填", refund: "是否需重新現場複審，待確認" },
];

export const prayerSchedule = {
  note: "甲方需提供正式朝拜時間表或指定資料來源。以下只保留欄位，不填入推測時間。",
  columns: ["日期", "晨禮", "晌禮", "晡禮", "昏禮", "宵禮"],
  rows: [
    ["待填", "待填", "待填", "待填", "待填", "待填"],
  ],
};

export const faqs = [
  { group: "申請", q: "誰可以註冊？", a: "前台只開放業者自行註冊。承辦、驗證人員與管理員由管理員在後台建立。" },
  { group: "申請", q: "草稿可以先不填完嗎？", a: "可以。缺資料時不能送件，已填內容會保留。" },
  { group: "費用", q: "現在可以線上付款嗎？", a: "不可以。金流服務商、金額與退款規則都還沒有。" },
  { group: "訓練", q: "上完課才可以送件嗎？", a: "初版不會用時數擋住申請。是否列為資格，待甲方確認。" },
  { group: "證書", q: "核定後會自動拿到證書嗎？", a: "不會。編號、版型與效期由管理員人工登錄。" },
];

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

export const emailDrafts = [
  { key: "submitted", when: "送件完成", subject: "已收到驗證申請", body: "案件編號與下一步說明。正式寄件名稱與內文待核定。" },
  { key: "supplement", when: "要求補件", subject: "請補充驗證申請資料", body: "只列出需補充的項目，不含內部審查意見。" },
  { key: "approved", when: "核定", subject: "驗證申請已核定", body: "證書尚未自動核發時，信中不寫成已可下載正式證書。" },
  { key: "renewal", when: "即將到期", subject: "驗證效期即將屆滿", body: "提醒日與是否需重新審查，待確認後才寄。" },
];

export const standardReports = [
  { name: "案件進度表", fields: "案件編號、業者、類別、狀態、送件日", ready: true },
  { name: "補件逾期表", fields: "案件編號、要求補件日、尚未回覆天數", ready: false },
  { name: "訓練出席表", fields: "課程、姓名、出席、分鐘、完課", ready: true },
  { name: "證書效期表", fields: "證書編號、核發日、到期日、是否仍有效", ready: false },
  { name: "續約提醒表", fields: "業者、到期日、是否已通知", ready: false },
];

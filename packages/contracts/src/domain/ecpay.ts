const STAGE_CHECKOUT_URL = "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5";
const PRODUCTION_CHECKOUT_URL = "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5";

export function ecpayCheckoutUrl(stage: boolean) {
  return stage ? STAGE_CHECKOUT_URL : PRODUCTION_CHECKOUT_URL;
}

export function ecpayTradeDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${read("year")}/${read("month")}/${read("day")} ${read("hour")}:${read("minute")}:${read("second")}`;
}

export function ecpayPlainText(value: string, max: number) {
  return value.replace(/[#&<>"'\\\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) || "方案";
}

export function ecpayMethodLabel(value: string) {
  if (!value) return "人工登錄";
  if (value.startsWith("WebATM")) return "網路 ATM";
  if (value.startsWith("Credit")) return "信用卡";
  if (value.startsWith("ATM")) return "ATM";
  if (value.startsWith("CVS")) return "超商代碼";
  if (value.startsWith("BARCODE")) return "超商條碼";
  if (value.startsWith("TWQR")) return "TWQR";
  if (value.startsWith("BNPL")) return "無卡分期";
  if (value.startsWith("ApplePay")) return "Apple Pay";
  if (value.startsWith("WeiXin")) return "微信支付";
  return "綠界付款";
}

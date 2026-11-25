import { describe, expect, it } from "vitest";
import { ecpayCheckoutUrl, ecpayMethodLabel, ecpayPlainText, ecpayTradeDate } from "./ecpay";

describe("綠界訂單欄位", () => {
  it("交易時間用台北時間，測試與正式網址分開", () => {
    expect(ecpayTradeDate(new Date("2026-10-12T16:00:00.000Z"))).toBe("2026/10/13 00:00:00");
    expect(ecpayCheckoutUrl(true)).toContain("payment-stage.ecpay.com.tw");
    expect(ecpayCheckoutUrl(false)).toBe("https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5");
    expect(ecpayPlainText("A&B#方案", 20)).toBe("A B 方案");
  });

  it("尚未接金流的付款方式不要顯示成綠界", () => {
    expect(ecpayMethodLabel("")).toBe("人工登錄");
    expect(ecpayMethodLabel("MANUAL")).toBe("人工登錄");
    expect(ecpayMethodLabel("Credit_CreditCard")).toBe("信用卡");
  });
});

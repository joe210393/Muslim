import { describe, expect, it } from "vitest";
import { ecpayCheckMac, ecpayCheckoutFields } from "./ecpay-mac";

describe("綠界檢查碼", () => {
  it("簽章可以驗回去，金額被改就對不上", () => {
    const fields = ecpayCheckoutFields(
      {
        merchantId: "3002607",
        merchantTradeNo: "MFTEST0001",
        merchantTradeDate: "2026/10/13 09:00:00",
        totalAmount: 1200,
        tradeDesc: "文件初審",
        itemName: "文件初審",
        returnUrl: "https://example.test/api/v1/payments/ecpay/notify",
        orderResultUrl: "https://example.test/api/v1/payments/ecpay/result",
        clientBackUrl: "https://example.test/portal/payments",
        customField1: "00000000-0000-4000-8000-000000000001",
      },
      { hashKey: "test-hash-key", hashIv: "test-hash-iv" },
    );
    const { CheckMacValue, ...rest } = fields;
    expect(fields.ChoosePayment).toBe("ALL");
    expect(ecpayCheckMac(rest, "test-hash-key", "test-hash-iv")).toBe(CheckMacValue);
    expect(ecpayCheckMac({ ...rest, TotalAmount: "1" }, "test-hash-key", "test-hash-iv")).not.toBe(CheckMacValue);
  });
});

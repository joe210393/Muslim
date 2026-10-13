import { createHash, randomBytes } from "node:crypto";
import { ecpayPlainText } from "@mf/contracts";

function ecpayUrlEncode(value: string) {
  let encoded = "";
  for (const byte of Buffer.from(value, "utf8")) {
    const char = String.fromCharCode(byte);
    if (/[A-Za-z0-9]/.test(char)) encoded += char;
    else if (char === " ") encoded += "+";
    else encoded += `%${byte.toString(16).padStart(2, "0")}`;
  }
  return encoded
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
}

export function ecpayCheckMac(params: Record<string, string>, hashKey: string, hashIv: string) {
  const raw = Object.keys(params)
    .filter((key) => key !== "CheckMacValue")
    .sort((left, right) => left.toLowerCase().localeCompare(right.toLowerCase()))
    .reduce((text, key) => `${text}&${key}=${params[key] ?? ""}`, `HashKey=${hashKey}`);
  return createHash("sha256").update(ecpayUrlEncode(`${raw}&HashIV=${hashIv}`).toLowerCase()).digest("hex").toUpperCase();
}

export function ecpayCheckoutFields(
  input: {
    merchantId: string;
    merchantTradeNo: string;
    merchantTradeDate: string;
    totalAmount: number;
    tradeDesc: string;
    itemName: string;
    returnUrl: string;
    orderResultUrl: string;
    clientBackUrl: string;
    customField1: string;
  },
  keys: { hashKey: string; hashIv: string },
) {
  const fields: Record<string, string> = {
    MerchantID: input.merchantId,
    MerchantTradeNo: input.merchantTradeNo,
    MerchantTradeDate: input.merchantTradeDate,
    PaymentType: "aio",
    TotalAmount: String(input.totalAmount),
    TradeDesc: ecpayPlainText(input.tradeDesc, 200),
    ItemName: ecpayPlainText(input.itemName, 400),
    ReturnURL: input.returnUrl,
    ChoosePayment: "ALL",
    EncryptType: "1",
    ClientBackURL: input.clientBackUrl,
    OrderResultURL: input.orderResultUrl,
    NeedExtraPaidInfo: "N",
    CustomField1: input.customField1,
  };
  fields.CheckMacValue = ecpayCheckMac(fields, keys.hashKey, keys.hashIv);
  return fields;
}

export function ecpayMerchantTradeNo() {
  return `MF${Date.now().toString(36)}${randomBytes(3).toString("hex")}`.toUpperCase().slice(0, 20);
}

export function ecpayBody(body: unknown): Record<string, string> {
  if (!body || typeof body !== "object") return {};
  return Object.fromEntries(Object.entries(body).map(([key, value]) => [key, typeof value === "string" ? value : String(value ?? "")]));
}

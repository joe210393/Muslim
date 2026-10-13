import { ErrorCodes, ecpayCheckoutUrl } from "@mf/contracts";
import type { Env } from "../../config/env";
import { ApiError } from "../../lib/errors";

// 綠界文件公開的測試商店，只在還沒換成甲方正式介接資訊時使用。
// https://developers.ecpay.com.tw/2856/
const STAGE_MERCHANT_ID = "3002607";
const STAGE_HASH_KEY = "pwFHCqoQZGmho4w6";
const STAGE_HASH_IV = "EkRm7iFT261dpevs";

export function ecpaySettings(env: Env) {
  const stage = env.ECPAY_ENV !== "production";
  if (!stage) {
    if (!env.ECPAY_MERCHANT_ID || !env.ECPAY_HASH_KEY || !env.ECPAY_HASH_IV) {
      throw new ApiError(503, ErrorCodes.VALIDATION_ERROR, "正式環境要先設定甲方的綠界商店代號與金鑰");
    }
    return {
      stage: false,
      action: ecpayCheckoutUrl(false),
      merchantId: env.ECPAY_MERCHANT_ID,
      hashKey: env.ECPAY_HASH_KEY,
      hashIv: env.ECPAY_HASH_IV,
    };
  }
  if (env.APP_ENV === "production") {
    throw new ApiError(503, ErrorCodes.VALIDATION_ERROR, "正式環境不能使用綠界測試商店");
  }
  return {
    stage: true,
    action: ecpayCheckoutUrl(true),
    merchantId: env.ECPAY_MERCHANT_ID || STAGE_MERCHANT_ID,
    hashKey: env.ECPAY_HASH_KEY || STAGE_HASH_KEY,
    hashIv: env.ECPAY_HASH_IV || STAGE_HASH_IV,
  };
}

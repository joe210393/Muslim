import { ErrorCodes, ecpayCheckoutUrl } from "@mf/contracts";
import type { Env } from "../../config/env";
import { ApiError } from "../../lib/errors";
import { resolvePayment } from "../platform/system-connection";

// 綠界文件公開的測試商店，只在還沒換成甲方正式介接資訊時使用。
// https://developers.ecpay.com.tw/2856/
const STAGE_MERCHANT_ID = "3002607";
const STAGE_HASH_KEY = "pwFHCqoQZGmho4w6";
const STAGE_HASH_IV = "EkRm7iFT261dpevs";

export async function ecpaySettings(env: Env) {
  const saved = await resolvePayment(env);
  const stage = saved.stage;
  if (!stage) {
    if (!saved.merchantId || !saved.hashKey || !saved.hashIv) {
      throw new ApiError(503, ErrorCodes.VALIDATION_ERROR, "正式環境要先設定甲方的綠界商店代號與金鑰");
    }
    return {
      stage: false,
      action: ecpayCheckoutUrl(false),
      merchantId: saved.merchantId,
      hashKey: saved.hashKey,
      hashIv: saved.hashIv,
    };
  }
  if (env.APP_ENV === "production") {
    throw new ApiError(503, ErrorCodes.VALIDATION_ERROR, "正式環境不能使用綠界測試商店");
  }
  return {
    stage: true,
    action: ecpayCheckoutUrl(true),
    merchantId: saved.merchantId || STAGE_MERCHANT_ID,
    hashKey: saved.hashKey || STAGE_HASH_KEY,
    hashIv: saved.hashIv || STAGE_HASH_IV,
  };
}

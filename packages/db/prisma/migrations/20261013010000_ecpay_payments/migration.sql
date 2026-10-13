CREATE TYPE "payment_status" AS ENUM ('PENDING', 'PAID');

ALTER TABLE "payment_records" ADD COLUMN "status" "payment_status" NOT NULL DEFAULT 'PAID';
ALTER TABLE "payment_records" ADD COLUMN "merchant_trade_no" VARCHAR(20);
ALTER TABLE "payment_records" ADD COLUMN "ecpay_trade_no" VARCHAR(20);
ALTER TABLE "payment_records" ADD COLUMN "payment_method" VARCHAR(20) NOT NULL DEFAULT '';
ALTER TABLE "payment_records" ALTER COLUMN "paid_at" DROP NOT NULL;
ALTER TABLE "payment_records" ALTER COLUMN "recorded_by_id" DROP NOT NULL;

CREATE UNIQUE INDEX "payment_records_merchant_trade_no_key" ON "payment_records"("merchant_trade_no");

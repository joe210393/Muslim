-- 註冊報價／繳費：管理員核准後產生匯款單，逾期或不核准為未成立
ALTER TYPE "payment_status" ADD VALUE IF NOT EXISTS 'VOID';

ALTER TABLE "operation_settings"
  ADD COLUMN "payment_due_days" INTEGER NOT NULL DEFAULT 14,
  ADD COLUMN "remit_bank_name" VARCHAR(120) NOT NULL DEFAULT '',
  ADD COLUMN "remit_account_no" VARCHAR(40) NOT NULL DEFAULT '',
  ADD COLUMN "remit_account_name" VARCHAR(120) NOT NULL DEFAULT '';

ALTER TABLE "payment_records"
  ADD COLUMN "due_at" TIMESTAMPTZ(6),
  ADD COLUMN "receipt_file_id" UUID,
  ADD COLUMN "voided_at" TIMESTAMPTZ(6),
  ADD COLUMN "void_reason" VARCHAR(200) NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "payment_records_receipt_file_id_key" ON "payment_records"("receipt_file_id");
CREATE INDEX "payment_records_status_due_at_idx" ON "payment_records"("status", "due_at");

ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_receipt_file_id_fkey"
  FOREIGN KEY ("receipt_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

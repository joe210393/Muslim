ALTER TYPE "payment_status" ADD VALUE 'QUOTED';
ALTER TYPE "payment_status" ADD VALUE 'PAID_PENDING';

ALTER TABLE "payment_records" ADD COLUMN "quote_confirmed_at" TIMESTAMPTZ(6);
ALTER TABLE "payment_records" ADD COLUMN "accounting_confirmed_at" TIMESTAMPTZ(6);

CREATE TABLE "service_plan_images" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "caption" VARCHAR(200) NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_plan_images_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_plan_images_file_id_key" ON "service_plan_images"("file_id");
CREATE INDEX "service_plan_images_plan_id_sort_order_idx" ON "service_plan_images"("plan_id", "sort_order");
CREATE INDEX "payment_records_organization_id_status_idx" ON "payment_records"("organization_id", "status");
CREATE INDEX "payment_records_status_idx" ON "payment_records"("status");

ALTER TABLE "service_plan_images" ADD CONSTRAINT "service_plan_images_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "service_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_plan_images" ADD CONSTRAINT "service_plan_images_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "service_plans" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL DEFAULT '',
    "payment_url" VARCHAR(500) NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "organization_name" VARCHAR(200) NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_name" VARCHAR(80) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by_id" UUID NOT NULL,
    "note" VARCHAR(200) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_records_organization_id_paid_at_idx" ON "payment_records"("organization_id", "paid_at");
CREATE INDEX "payment_records_paid_at_idx" ON "payment_records"("paid_at");

ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "service_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "service_plan_viewers" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_plan_viewers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_plan_viewers_plan_id_user_id_key" ON "service_plan_viewers"("plan_id", "user_id");
CREATE INDEX "service_plan_viewers_user_id_idx" ON "service_plan_viewers"("user_id");

ALTER TABLE "service_plan_viewers" ADD CONSTRAINT "service_plan_viewers_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "service_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_plan_viewers" ADD CONSTRAINT "service_plan_viewers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 舊的待確認報價直接改為待付款（已取消報價確認步驟）
UPDATE "payment_records" SET "status" = 'PENDING' WHERE "status" = 'QUOTED';

-- 基礎課觀看分鐘門檻與進度秒數；完成改由系統依觀看時間寫入

ALTER TABLE "basic_training_modules"
  ADD COLUMN IF NOT EXISTS "required_watch_minutes" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "basic_training_progress"
  ADD COLUMN IF NOT EXISTS "watched_seconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "watch_updated_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "basic_training_progress"
  ALTER COLUMN "completed_at" DROP NOT NULL,
  ALTER COLUMN "completed_at" DROP DEFAULT;

UPDATE "basic_training_progress"
SET
  "created_at" = COALESCE("created_at", COALESCE("completed_at", CURRENT_TIMESTAMP)),
  "updated_at" = COALESCE("updated_at", COALESCE("completed_at", CURRENT_TIMESTAMP))
WHERE TRUE;

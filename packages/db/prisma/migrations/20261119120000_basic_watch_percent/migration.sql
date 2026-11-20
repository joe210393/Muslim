-- 基礎課觀看門檻改為影片百分比；進度保存影片長度

ALTER TABLE "basic_training_modules"
  ADD COLUMN IF NOT EXISTS "required_watch_percent" INTEGER NOT NULL DEFAULT 80;

UPDATE "basic_training_modules"
SET "required_watch_percent" = 80
WHERE COALESCE("required_watch_percent", 0) < 1;

ALTER TABLE "basic_training_modules" DROP COLUMN IF EXISTS "required_watch_minutes";

ALTER TABLE "basic_training_progress"
  ADD COLUMN IF NOT EXISTS "video_duration_seconds" INTEGER NOT NULL DEFAULT 0;

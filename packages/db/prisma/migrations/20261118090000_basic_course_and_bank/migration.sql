-- 基礎課改為可多門＋網址／教材；題庫改全域；門檻改抽題數／及格題數

ALTER TABLE "training_policies"
  ADD COLUMN IF NOT EXISTS "quiz_draw_count" INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "quiz_pass_count" INTEGER NOT NULL DEFAULT 4;

UPDATE "training_policies"
SET
  "quiz_draw_count" = 5,
  "quiz_pass_count" = GREATEST(1, CEIL(COALESCE("quiz_pass_percent", 80)::numeric / 100.0 * 5))
WHERE TRUE;

ALTER TABLE "training_policies" DROP COLUMN IF EXISTS "quiz_pass_percent";

ALTER TABLE "basic_training_modules"
  ADD COLUMN IF NOT EXISTS "description" VARCHAR(4000) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "youtube_url" VARCHAR(200) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "material_file_id" UUID;

UPDATE "basic_training_modules"
SET "description" = LEFT(COALESCE("body", ''), 4000)
WHERE COALESCE("description", '') = '' AND COALESCE("body", '') <> '';

ALTER TABLE "basic_training_modules" DROP COLUMN IF EXISTS "body";
ALTER TABLE "basic_training_modules" DROP CONSTRAINT IF EXISTS "basic_training_modules_video_file_id_fkey";
ALTER TABLE "basic_training_modules" DROP COLUMN IF EXISTS "video_file_id";

DO $$ BEGIN
  ALTER TABLE "basic_training_modules"
    ADD CONSTRAINT "basic_training_modules_material_file_id_fkey"
    FOREIGN KEY ("material_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "basic_training_modules_material_file_id_key"
  ON "basic_training_modules"("material_file_id");

ALTER TABLE "basic_training_questions" DROP CONSTRAINT IF EXISTS "basic_training_questions_module_id_fkey";
DROP INDEX IF EXISTS "basic_training_questions_module_id_sort_order_idx";
ALTER TABLE "basic_training_questions" DROP COLUMN IF EXISTS "module_id";
ALTER TABLE "basic_training_questions"
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "basic_training_questions_is_active_sort_order_idx"
  ON "basic_training_questions"("is_active", "sort_order");

ALTER TABLE "basic_training_attempts"
  ADD COLUMN IF NOT EXISTS "correct_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "draw_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pass_count_snapshot" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "drawn_question_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ(6);

UPDATE "basic_training_attempts"
SET
  "draw_count" = GREATEST(1, COALESCE(jsonb_array_length("answers"), 0)),
  "pass_count_snapshot" = COALESCE("quiz_pass_percent_snapshot", 80),
  "submitted_at" = COALESCE("submitted_at", "created_at")
WHERE "submitted_at" IS NULL;

UPDATE "basic_training_attempts"
SET
  "correct_count" = ROUND(COALESCE("score_percent", 0)::numeric * GREATEST("draw_count", 1) / 100.0)
WHERE "correct_count" = 0 AND "score_percent" > 0;

ALTER TABLE "basic_training_attempts" ALTER COLUMN "answers" DROP NOT NULL;
ALTER TABLE "basic_training_attempts" DROP COLUMN IF EXISTS "quiz_pass_percent_snapshot";

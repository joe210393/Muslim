ALTER TABLE "courses" ADD COLUMN "material_file_id" UUID;
ALTER TABLE "enrollments" ADD COLUMN "quiz_passed_at" TIMESTAMPTZ(6);
ALTER TABLE "enrollments" ADD COLUMN "recognized_minutes" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "course_quiz_attempts" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "correct_count" INTEGER NOT NULL DEFAULT 0,
    "draw_count" INTEGER NOT NULL DEFAULT 0,
    "pass_count_snapshot" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "drawn_question_ids" JSONB NOT NULL DEFAULT '[]',
    "answers" JSONB,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_quiz_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "courses_material_file_id_key" ON "courses"("material_file_id");
CREATE INDEX "course_quiz_attempts_enrollment_id_created_at_idx" ON "course_quiz_attempts"("enrollment_id", "created_at");

ALTER TABLE "courses" ADD CONSTRAINT "courses_material_file_id_fkey" FOREIGN KEY ("material_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "course_quiz_attempts" ADD CONSTRAINT "course_quiz_attempts_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "course_quiz_attempts" ADD CONSTRAINT "course_quiz_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

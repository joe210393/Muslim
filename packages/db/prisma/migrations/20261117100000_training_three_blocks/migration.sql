CREATE TYPE "company_training_request_status" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TABLE "training_policies" (
    "id" UUID NOT NULL,
    "require_basic_before_apply" BOOLEAN NOT NULL DEFAULT true,
    "quiz_pass_percent" INTEGER NOT NULL DEFAULT 80,
    "private_request_min_headcount" INTEGER NOT NULL DEFAULT 20,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "basic_training_modules" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(8000) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "video_file_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "basic_training_modules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "basic_training_questions" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "prompt" VARCHAR(1000) NOT NULL,
    "options" JSONB NOT NULL,
    "correct_index" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "basic_training_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "basic_training_progress" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "completed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "basic_training_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "basic_training_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "score_percent" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB NOT NULL,
    "quiz_pass_percent_snapshot" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "basic_training_attempts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_basic_trainings" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "passed_at" TIMESTAMPTZ(6),
    "certificate_no" VARCHAR(64),
    "certificate_file_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_basic_trainings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "company_training_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "headcount" INTEGER NOT NULL,
    "preferred_starts_on" CHAR(10) NOT NULL,
    "preferred_ends_on" CHAR(10) NOT NULL,
    "delivery" "course_delivery" NOT NULL DEFAULT 'OFFLINE',
    "location" VARCHAR(200) NOT NULL DEFAULT '',
    "note" VARCHAR(2000) NOT NULL DEFAULT '',
    "status" "company_training_request_status" NOT NULL DEFAULT 'DRAFT',
    "admin_note" VARCHAR(2000) NOT NULL DEFAULT '',
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "course_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "submitted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "company_training_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "training_certificates" (
    "id" UUID NOT NULL,
    "enrollment_id" UUID NOT NULL,
    "certificate_no" VARCHAR(64) NOT NULL,
    "issued_on_date" CHAR(10) NOT NULL,
    "valid_until_date" CHAR(10) NOT NULL,
    "registered_by_id" UUID NOT NULL,
    "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "training_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "basic_training_modules_video_file_id_key" ON "basic_training_modules"("video_file_id");
CREATE INDEX "basic_training_modules_is_active_sort_order_idx" ON "basic_training_modules"("is_active", "sort_order");
CREATE INDEX "basic_training_questions_module_id_sort_order_idx" ON "basic_training_questions"("module_id", "sort_order");
CREATE UNIQUE INDEX "basic_training_progress_user_id_module_id_key" ON "basic_training_progress"("user_id", "module_id");
CREATE INDEX "basic_training_progress_module_id_idx" ON "basic_training_progress"("module_id");
CREATE INDEX "basic_training_attempts_user_id_created_at_idx" ON "basic_training_attempts"("user_id", "created_at");
CREATE UNIQUE INDEX "user_basic_trainings_user_id_key" ON "user_basic_trainings"("user_id");
CREATE UNIQUE INDEX "user_basic_trainings_certificate_no_key" ON "user_basic_trainings"("certificate_no");
CREATE UNIQUE INDEX "user_basic_trainings_certificate_file_id_key" ON "user_basic_trainings"("certificate_file_id");
CREATE INDEX "company_training_requests_organization_id_status_idx" ON "company_training_requests"("organization_id", "status");
CREATE INDEX "company_training_requests_status_submitted_at_idx" ON "company_training_requests"("status", "submitted_at");
CREATE UNIQUE INDEX "training_certificates_enrollment_id_key" ON "training_certificates"("enrollment_id");
CREATE UNIQUE INDEX "training_certificates_certificate_no_key" ON "training_certificates"("certificate_no");

ALTER TABLE "training_policies" ADD CONSTRAINT "training_policies_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "basic_training_modules" ADD CONSTRAINT "basic_training_modules_video_file_id_fkey" FOREIGN KEY ("video_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "basic_training_modules" ADD CONSTRAINT "basic_training_modules_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "basic_training_questions" ADD CONSTRAINT "basic_training_questions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "basic_training_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "basic_training_progress" ADD CONSTRAINT "basic_training_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "basic_training_progress" ADD CONSTRAINT "basic_training_progress_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "basic_training_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "basic_training_attempts" ADD CONSTRAINT "basic_training_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_basic_trainings" ADD CONSTRAINT "user_basic_trainings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_basic_trainings" ADD CONSTRAINT "user_basic_trainings_certificate_file_id_fkey" FOREIGN KEY ("certificate_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_training_requests" ADD CONSTRAINT "company_training_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_training_requests" ADD CONSTRAINT "company_training_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_training_requests" ADD CONSTRAINT "company_training_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "company_training_requests" ADD CONSTRAINT "company_training_requests_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "training_certificates" ADD CONSTRAINT "training_certificates_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

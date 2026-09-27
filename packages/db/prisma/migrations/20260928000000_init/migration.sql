-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('APPLICANT', 'CASE_OFFICER', 'ADMIN');

-- CreateEnum
CREATE TYPE "application_status" AS ENUM ('DRAFT', 'SUBMITTED', 'INITIAL_REVIEW', 'SECOND_REVIEW', 'FINAL_REVIEW', 'NEED_SUPPLEMENT', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "application_action" AS ENUM ('SUBMIT', 'START_REVIEW', 'PASS_INITIAL', 'PASS_SECOND', 'APPROVE', 'REQUEST_SUPPLEMENT', 'RESUBMIT', 'REJECT', 'ASSIGN');

-- CreateEnum
CREATE TYPE "configuration_status" AS ENUM ('CONFIRMED', 'DEMO');

-- CreateEnum
CREATE TYPE "course_status" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "enrollment_status" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "attendance_status" AS ENUM ('NOT_RECORDED', 'PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "notification_job_status" AS ENUM ('PENDING', 'SENT', 'FAILED', 'MOCKED');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('SUBMISSION_CONFIRMATION', 'SUPPLEMENT_REQUEST', 'DECISION_RESULT', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "import_batch_type" AS ENUM ('ORGANIZATIONS', 'APPLICATION_DRAFTS');

-- CreateEnum
CREATE TYPE "import_batch_status" AS ENUM ('PREVIEWED', 'COMMITTED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" VARCHAR(100) NOT NULL,
    "role" "user_role" NOT NULL,
    "organization_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "organization_name" VARCHAR(200) NOT NULL,
    "tax_id" VARCHAR(32),
    "contact_name" VARCHAR(100),
    "contact_phone" VARCHAR(30),
    "contact_email" VARCHAR(320),
    "address" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL,

    CONSTRAINT "application_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_form_versions" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "configuration_status" "configuration_status" NOT NULL,
    "definition" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_form_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "application_no" VARCHAR(32) NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "category_form_version_id" UUID NOT NULL,
    "status" "application_status" NOT NULL,
    "resume_status" "application_status",
    "assigned_to_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "organization_name_snapshot" VARCHAR(200),
    "tax_id_snapshot" VARCHAR(32),
    "contact_name_snapshot" VARCHAR(100),
    "contact_phone_snapshot" VARCHAR(30),
    "contact_email_snapshot" VARCHAR(320),
    "organization_address_snapshot" VARCHAR(300),
    "site_name" VARCHAR(200),
    "site_address" VARCHAR(300),
    "application_description" VARCHAR(4000),
    "declaration_accepted" BOOLEAN NOT NULL DEFAULT false,
    "form_data" JSONB NOT NULL DEFAULT '{}',
    "source_system" VARCHAR(64),
    "source_record_key" VARCHAR(128),
    "submitted_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_submissions" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "submitted_by_id" UUID NOT NULL,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,
    "form_version_id" UUID NOT NULL,
    "payload_snapshot" JSONB NOT NULL,
    "attachment_ids_snapshot" JSONB NOT NULL,

    CONSTRAINT "application_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "submission_id" UUID,
    "actor_id" UUID NOT NULL,
    "action" "application_action" NOT NULL,
    "from_status" "application_status",
    "to_status" "application_status",
    "public_comment" VARCHAR(2000),
    "internal_note" VARCHAR(2000),
    "request_id" VARCHAR(80) NOT NULL,
    "request_hash" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_objects" (
    "id" UUID NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_attachments" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "requirement_key" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMPTZ(6),

    CONSTRAINT "application_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(4000) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "starts_at" TIMESTAMPTZ(6) NOT NULL,
    "ends_at" TIMESTAMPTZ(6) NOT NULL,
    "registration_opens_at" TIMESTAMPTZ(6) NOT NULL,
    "registration_closes_at" TIMESTAMPTZ(6) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "required_attendance_minutes" INTEGER NOT NULL,
    "status" "course_status" NOT NULL,
    "created_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "enrollment_status" NOT NULL,
    "attendance_status" "attendance_status" NOT NULL DEFAULT 'NOT_RECORDED',
    "attended_minutes" INTEGER NOT NULL DEFAULT 0,
    "required_attendance_minutes_snapshot" INTEGER NOT NULL,
    "attendance_recorded_by_id" UUID,
    "attendance_recorded_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(6),

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certifications" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "certificate_no" VARCHAR(64) NOT NULL,
    "issued_on_date" CHAR(10) NOT NULL,
    "valid_until_date" CHAR(10) NOT NULL,
    "registered_by_id" UUID NOT NULL,
    "registered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" UUID NOT NULL,
    "dedupe_key" VARCHAR(200) NOT NULL,
    "type" "notification_type" NOT NULL,
    "recipient_user_id" UUID,
    "recipient_email" VARCHAR(320) NOT NULL,
    "application_id" UUID,
    "status" "notification_job_status" NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ(6),

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID,
    "request_id" VARCHAR(80) NOT NULL,
    "safe_changes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "type" "import_batch_type" NOT NULL,
    "file_digest" CHAR(64) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "status" "import_batch_status" NOT NULL,
    "row_count" INTEGER NOT NULL,
    "result_summary" JSONB NOT NULL,
    "commit_key" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_tax_id_key" ON "organizations"("tax_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_categories_code_key" ON "application_categories"("code");

-- CreateIndex
CREATE UNIQUE INDEX "category_form_versions_category_id_version_key" ON "category_form_versions"("category_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "applications_application_no_key" ON "applications"("application_no");

-- CreateIndex
CREATE INDEX "applications_status_idx" ON "applications"("status");

-- CreateIndex
CREATE INDEX "applications_organization_id_idx" ON "applications"("organization_id");

-- CreateIndex
CREATE INDEX "applications_assigned_to_id_idx" ON "applications"("assigned_to_id");

-- CreateIndex
CREATE INDEX "applications_category_id_idx" ON "applications"("category_id");

-- CreateIndex
CREATE INDEX "applications_created_at_idx" ON "applications"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "applications_source_system_source_record_key_key" ON "applications"("source_system", "source_record_key");

-- CreateIndex
CREATE UNIQUE INDEX "application_submissions_application_id_revision_key" ON "application_submissions"("application_id", "revision");

-- CreateIndex
CREATE INDEX "application_events_application_id_created_at_idx" ON "application_events"("application_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "application_events_application_id_request_id_key" ON "application_events"("application_id", "request_id");

-- CreateIndex
CREATE UNIQUE INDEX "file_objects_storage_key_key" ON "file_objects"("storage_key");

-- CreateIndex
CREATE INDEX "application_attachments_application_id_requirement_key_idx" ON "application_attachments"("application_id", "requirement_key");

-- CreateIndex
CREATE INDEX "courses_status_registration_opens_at_registration_closes_at_idx" ON "courses"("status", "registration_opens_at", "registration_closes_at");

-- CreateIndex
CREATE INDEX "enrollments_user_id_idx" ON "enrollments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_course_id_user_id_key" ON "enrollments"("course_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "certifications_application_id_key" ON "certifications"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "certifications_certificate_no_key" ON "certifications"("certificate_no");

-- CreateIndex
CREATE UNIQUE INDEX "notification_jobs_dedupe_key_key" ON "notification_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "notification_jobs_status_idx" ON "notification_jobs"("status");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_commit_key_key" ON "import_batches"("commit_key");

-- CreateIndex
CREATE INDEX "import_batches_file_digest_status_idx" ON "import_batches"("file_digest", "status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_form_versions" ADD CONSTRAINT "category_form_versions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "application_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "application_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_category_form_version_id_fkey" FOREIGN KEY ("category_form_version_id") REFERENCES "category_form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_submissions" ADD CONSTRAINT "application_submissions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_submissions" ADD CONSTRAINT "application_submissions_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_submissions" ADD CONSTRAINT "application_submissions_form_version_id_fkey" FOREIGN KEY ("form_version_id") REFERENCES "category_form_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "application_submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_objects" ADD CONSTRAINT "file_objects_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_attachments" ADD CONSTRAINT "application_attachments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_attendance_recorded_by_id_fkey" FOREIGN KEY ("attendance_recorded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- 案件編號使用資料庫 sequence，避免 count+1 產生重複編號。
CREATE SEQUENCE "application_no_seq" AS INTEGER START WITH 1;

-- 外部來源與外部鍵必須同時為空或同時有值。
ALTER TABLE "applications" ADD CONSTRAINT "applications_source_pair_check" CHECK (
  ("source_system" IS NULL AND "source_record_key" IS NULL)
  OR ("source_system" IS NOT NULL AND "source_record_key" IS NOT NULL)
);

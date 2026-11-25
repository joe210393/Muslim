ALTER TABLE "application_categories" ADD COLUMN "draft_definition" JSONB;

ALTER TABLE "operation_settings" ADD COLUMN "attachment_max_bytes" INTEGER NOT NULL DEFAULT 10485760;

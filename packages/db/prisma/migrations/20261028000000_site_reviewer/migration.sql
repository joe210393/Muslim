ALTER TABLE "applications" ADD COLUMN "site_reviewer_id" UUID;
ALTER TABLE "applications" ADD COLUMN "site_checks" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "application_attachments" ADD COLUMN "captured_on_site" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "applications" ADD CONSTRAINT "applications_site_reviewer_id_fkey" FOREIGN KEY ("site_reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "applications_site_reviewer_id_idx" ON "applications"("site_reviewer_id");

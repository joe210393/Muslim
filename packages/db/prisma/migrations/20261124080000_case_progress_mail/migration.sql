ALTER TYPE "notification_type" ADD VALUE 'CASE_PROGRESS';

ALTER TABLE "notification_jobs" ADD COLUMN "subject" VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE "notification_jobs" ADD COLUMN "body" TEXT NOT NULL DEFAULT '';

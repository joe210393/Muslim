ALTER TYPE "notification_type" ADD VALUE 'RENEWAL';
ALTER TYPE "notification_type" ADD VALUE 'MANUAL';

CREATE TABLE "mail_templates" (
    "key" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mail_templates_pkey" PRIMARY KEY ("key")
);

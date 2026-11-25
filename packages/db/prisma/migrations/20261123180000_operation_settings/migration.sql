CREATE TABLE "operation_settings" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "renewal_reminder_days" INTEGER NOT NULL DEFAULT 60,
    "certificate_term_months" INTEGER NOT NULL DEFAULT 12,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_settings_pkey" PRIMARY KEY ("id")
);

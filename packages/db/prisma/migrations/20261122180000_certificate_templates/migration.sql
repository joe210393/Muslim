-- CreateTable
CREATE TABLE "certificate_templates" (
    "key" VARCHAR(64) NOT NULL,
    "title_zh" VARCHAR(200) NOT NULL,
    "title_en" VARCHAR(200) NOT NULL,
    "category_code" VARCHAR(16) NOT NULL,
    "match_note" VARCHAR(300) NOT NULL,
    "body" TEXT NOT NULL,
    "logo_file_id" UUID,
    "signature_file_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("key")
);

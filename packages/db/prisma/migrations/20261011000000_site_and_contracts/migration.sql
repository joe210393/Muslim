-- CreateEnum
CREATE TYPE "content_slot" AS ENUM ('HOME_HERO', 'HOME_BANNER');

-- CreateEnum
CREATE TYPE "contract_status" AS ENUM ('ISSUED', 'SIGNED', 'VOID');

-- CreateTable
CREATE TABLE "site_contents" (
    "id" UUID NOT NULL,
    "slot" "content_slot" NOT NULL,
    "eyebrow" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "subtitle" VARCHAR(500) NOT NULL,
    "body" VARCHAR(4000) NOT NULL,
    "cta_label" VARCHAR(40) NOT NULL,
    "cta_href" VARCHAR(200) NOT NULL,
    "secondary_cta_label" VARCHAR(40) NOT NULL DEFAULT '',
    "secondary_cta_href" VARCHAR(200) NOT NULL DEFAULT '',
    "image_file_id" UUID,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contract_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "contract_no" VARCHAR(32) NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body_snapshot" TEXT NOT NULL,
    "status" "contract_status" NOT NULL,
    "signer_name" VARCHAR(100),
    "signer_title" VARCHAR(100),
    "face_file_id" UUID,
    "signature_file_id" UUID,
    "pdf_file_id" UUID,
    "issued_by_id" UUID NOT NULL,
    "signed_by_id" UUID,
    "signed_at" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_features" (
    "id" UUID NOT NULL,
    "role" "user_role" NOT NULL,
    "feature_key" VARCHAR(64) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "role_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_settings" (
    "key" VARCHAR(64) NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "provider" VARCHAR(80) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "note" VARCHAR(500) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_contents_slot_key" ON "site_contents"("slot");

-- CreateIndex
CREATE UNIQUE INDEX "site_contents_image_file_id_key" ON "site_contents"("image_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_templates_code_key" ON "contract_templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_contract_no_key" ON "contracts"("contract_no");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_face_file_id_key" ON "contracts"("face_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_signature_file_id_key" ON "contracts"("signature_file_id");

-- CreateIndex
CREATE UNIQUE INDEX "contracts_pdf_file_id_key" ON "contracts"("pdf_file_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_status_idx" ON "contracts"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "role_features_role_feature_key_key" ON "role_features"("role", "feature_key");

-- AddForeignKey
ALTER TABLE "site_contents" ADD CONSTRAINT "site_contents_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_contents" ADD CONSTRAINT "site_contents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_templates" ADD CONSTRAINT "contract_templates_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "contract_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_face_file_id_fkey" FOREIGN KEY ("face_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signature_file_id_fkey" FOREIGN KEY ("signature_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_pdf_file_id_fkey" FOREIGN KEY ("pdf_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE SEQUENCE "contract_no_seq" AS INTEGER START WITH 1;

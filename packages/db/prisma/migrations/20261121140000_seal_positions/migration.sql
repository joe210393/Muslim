-- AlterTable
ALTER TABLE "contract_seal_settings" ADD COLUMN "company_seal_x" DOUBLE PRECISION NOT NULL DEFAULT 8;
ALTER TABLE "contract_seal_settings" ADD COLUMN "company_seal_y" DOUBLE PRECISION NOT NULL DEFAULT 4;
ALTER TABLE "contract_seal_settings" ADD COLUMN "person_seal_x" DOUBLE PRECISION NOT NULL DEFAULT 42;
ALTER TABLE "contract_seal_settings" ADD COLUMN "person_seal_y" DOUBLE PRECISION NOT NULL DEFAULT 14;

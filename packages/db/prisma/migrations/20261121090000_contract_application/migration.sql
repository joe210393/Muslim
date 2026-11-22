-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "application_id" UUID;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "contracts_application_id_idx" ON "contracts"("application_id");

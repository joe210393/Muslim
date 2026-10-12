DROP INDEX "contract_templates_code_key";

ALTER TABLE "contract_templates" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX "contract_templates_code_revision_key" ON "contract_templates"("code", "revision");

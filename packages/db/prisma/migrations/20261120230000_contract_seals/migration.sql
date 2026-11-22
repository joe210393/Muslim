-- CreateTable
CREATE TABLE "contract_seal_settings" (
    "id" VARCHAR(32) NOT NULL,
    "company_seal_file_id" UUID,
    "person_seal_file_id" UUID,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "contract_seal_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "contract_seal_settings_company_seal_file_id_key" ON "contract_seal_settings"("company_seal_file_id");
CREATE UNIQUE INDEX "contract_seal_settings_person_seal_file_id_key" ON "contract_seal_settings"("person_seal_file_id");

ALTER TABLE "contract_seal_settings" ADD CONSTRAINT "contract_seal_settings_company_seal_file_id_fkey" FOREIGN KEY ("company_seal_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "contract_seal_settings" ADD CONSTRAINT "contract_seal_settings_person_seal_file_id_fkey" FOREIGN KEY ("person_seal_file_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "contract_seal_settings" ("id", "updated_at") VALUES ('default', CURRENT_TIMESTAMP);

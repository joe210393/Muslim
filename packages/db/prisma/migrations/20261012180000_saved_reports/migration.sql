CREATE TYPE "report_source" AS ENUM ('APPLICATION', 'ORGANIZATION', 'ENROLLMENT', 'CONTRACT');

CREATE TABLE "saved_reports" (
    "id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "source" "report_source" NOT NULL,
    "field_keys" TEXT[] NOT NULL,
    "created_by_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_reports_name_key" ON "saved_reports"("name");

ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

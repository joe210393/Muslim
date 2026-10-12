ALTER TABLE "saved_reports" ADD COLUMN "selections" JSONB;
ALTER TABLE "saved_reports" ADD COLUMN "chart_kind" VARCHAR(8) NOT NULL DEFAULT 'table';
ALTER TABLE "saved_reports" ADD COLUMN "chart_field" VARCHAR(80) NOT NULL DEFAULT '';

UPDATE "saved_reports"
SET "selections" = jsonb_build_array(jsonb_build_object('source', "source"::text, 'fieldKeys', to_jsonb("field_keys"))),
    "chart_field" = CASE
      WHEN cardinality("field_keys") > 0 THEN "source"::text || '.' || "field_keys"[1]
      ELSE ''
    END;

ALTER TABLE "saved_reports" ALTER COLUMN "selections" SET NOT NULL;
ALTER TABLE "saved_reports" DROP COLUMN "source";
ALTER TABLE "saved_reports" DROP COLUMN "field_keys";
DROP TYPE "report_source";

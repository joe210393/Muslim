-- Issued and signed contracts keep their original snapshot.
UPDATE "site_contents"
SET
  "eyebrow" = regexp_replace("eyebrow", 'HALA(?!L)', 'HALAL', 'g'),
  "title" = regexp_replace("title", 'HALA(?!L)', 'HALAL', 'g'),
  "subtitle" = regexp_replace("subtitle", 'HALA(?!L)', 'HALAL', 'g'),
  "body" = regexp_replace("body", 'HALA(?!L)', 'HALAL', 'g'),
  "version" = "version" + 1,
  "updated_at" = now()
WHERE ("eyebrow" ~ 'HALA(?!L)' OR "title" ~ 'HALA(?!L)' OR "subtitle" ~ 'HALA(?!L)' OR "body" ~ 'HALA(?!L)')
  AND char_length(regexp_replace("eyebrow", 'HALA(?!L)', 'HALAL', 'g')) <= 80
  AND char_length(regexp_replace("title", 'HALA(?!L)', 'HALAL', 'g')) <= 200
  AND char_length(regexp_replace("subtitle", 'HALA(?!L)', 'HALAL', 'g')) <= 500
  AND char_length(regexp_replace("body", 'HALA(?!L)', 'HALAL', 'g')) <= 4000;

UPDATE "editorial_entries"
SET
  "title" = regexp_replace("title", 'HALA(?!L)', 'HALAL', 'g'),
  "summary" = regexp_replace("summary", 'HALA(?!L)', 'HALAL', 'g'),
  "body" = regexp_replace("body", 'HALA(?!L)', 'HALAL', 'g'),
  "version" = "version" + 1,
  "updated_at" = now()
WHERE ("title" ~ 'HALA(?!L)' OR "summary" ~ 'HALA(?!L)' OR "body" ~ 'HALA(?!L)')
  AND char_length(regexp_replace("title", 'HALA(?!L)', 'HALAL', 'g')) <= 200
  AND char_length(regexp_replace("summary", 'HALA(?!L)', 'HALAL', 'g')) <= 500
  AND char_length(regexp_replace("body", 'HALA(?!L)', 'HALAL', 'g')) <= 4000;

UPDATE "contract_templates"
SET "code" = 'HALAL_SERVICE_V1'
WHERE "code" = 'HALA_SERVICE_V1'
  AND NOT EXISTS (SELECT 1 FROM "contract_templates" WHERE "code" = 'HALAL_SERVICE_V1');

UPDATE "contract_templates"
SET
  "title" = regexp_replace("title", 'HALA(?!L)', 'HALAL', 'g'),
  "body" = regexp_replace("body", 'HALA(?!L)', 'HALAL', 'g'),
  "version" = "version" + 1,
  "updated_at" = now()
WHERE ("title" ~ 'HALA(?!L)' OR "body" ~ 'HALA(?!L)')
  AND char_length(regexp_replace("title", 'HALA(?!L)', 'HALAL', 'g')) <= 200;

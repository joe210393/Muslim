-- AlterTable
ALTER TABLE "site_pages" ADD COLUMN "draft_background" VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE "site_pages" ADD COLUMN "published_background" VARCHAR(500);

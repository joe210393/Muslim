-- CreateEnum
CREATE TYPE "SitePageKind" AS ENUM ('PAGE', 'PRODUCT');

-- CreateTable
CREATE TABLE "site_pages" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "kind" "SitePageKind" NOT NULL DEFAULT 'PAGE',
    "in_header" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "draft_sections" JSONB NOT NULL,
    "published_sections" JSONB,
    "published_at" TIMESTAMPTZ(6),
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_pages_slug_key" ON "site_pages"("slug");

-- CreateIndex
CREATE INDEX "site_pages_sort_order_idx" ON "site_pages"("sort_order");

-- AddForeignKey
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


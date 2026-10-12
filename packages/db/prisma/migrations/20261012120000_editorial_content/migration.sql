-- AlterEnum
ALTER TYPE "content_slot" ADD VALUE 'ABOUT';
ALTER TYPE "content_slot" ADD VALUE 'NEWS_INTRO';
ALTER TYPE "content_slot" ADD VALUE 'VERIFICATION';
ALTER TYPE "content_slot" ADD VALUE 'FAQ';

-- CreateEnum
CREATE TYPE "editorial_kind" AS ENUM ('HOME_POINT', 'ABOUT_FACT', 'NEWS', 'VERIFICATION_STEP', 'FEE', 'FAQ', 'EMAIL_DRAFT');

-- CreateTable
CREATE TABLE "editorial_entries" (
    "id" UUID NOT NULL,
    "kind" "editorial_kind" NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "group_label" VARCHAR(40) NOT NULL DEFAULT '',
    "title" VARCHAR(200) NOT NULL,
    "summary" VARCHAR(500) NOT NULL DEFAULT '',
    "body" VARCHAR(4000) NOT NULL,
    "note" VARCHAR(200) NOT NULL DEFAULT '',
    "published_on" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "editorial_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "editorial_entries_kind_slug_key" ON "editorial_entries"("kind", "slug");

-- CreateIndex
CREATE INDEX "editorial_entries_kind_is_published_sort_order_idx" ON "editorial_entries"("kind", "is_published", "sort_order");

-- AddForeignKey
ALTER TABLE "editorial_entries" ADD CONSTRAINT "editorial_entries_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "editorial_entries" ADD COLUMN "youtube_url" VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE "editorial_entries" ADD COLUMN "image_file_id" UUID;
CREATE UNIQUE INDEX "editorial_entries_image_file_id_key" ON "editorial_entries"("image_file_id");
ALTER TABLE "editorial_entries" ADD CONSTRAINT "editorial_entries_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "courses" ADD COLUMN "youtube_url" VARCHAR(200) NOT NULL DEFAULT '';
ALTER TABLE "courses" ADD COLUMN "image_file_id" UUID;
CREATE UNIQUE INDEX "courses_image_file_id_key" ON "courses"("image_file_id");
ALTER TABLE "courses" ADD CONSTRAINT "courses_image_file_id_fkey" FOREIGN KEY ("image_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

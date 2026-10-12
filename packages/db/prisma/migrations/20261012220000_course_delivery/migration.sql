CREATE TYPE "course_delivery" AS ENUM ('ONLINE', 'OFFLINE');

ALTER TABLE "courses" ADD COLUMN "delivery" "course_delivery" NOT NULL DEFAULT 'OFFLINE';
ALTER TABLE "courses" ADD COLUMN "video_file_id" UUID;
ALTER TABLE "courses" ADD COLUMN "video_duration_seconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "courses" ALTER COLUMN "location" SET DEFAULT '';

CREATE UNIQUE INDEX "courses_video_file_id_key" ON "courses"("video_file_id");
ALTER TABLE "courses" ADD CONSTRAINT "courses_video_file_id_fkey" FOREIGN KEY ("video_file_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "enrollments" ADD COLUMN "watched_seconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "enrollments" ADD COLUMN "watch_updated_at" TIMESTAMPTZ(6);

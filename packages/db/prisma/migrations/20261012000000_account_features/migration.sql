-- CreateTable
CREATE TABLE "user_features" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "feature_key" VARCHAR(64) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_features_user_id_feature_key_key" ON "user_features"("user_id", "feature_key");

-- AddForeignKey
ALTER TABLE "user_features" ADD CONSTRAINT "user_features_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill account features from the existing role matrix. New accounts are written directly.
INSERT INTO "user_features" ("id", "user_id", "feature_key", "enabled", "updated_at")
SELECT gen_random_uuid(), u."id", rf."feature_key", rf."enabled", NOW()
FROM "users" u
JOIN "role_features" rf ON rf."role" = u."role";

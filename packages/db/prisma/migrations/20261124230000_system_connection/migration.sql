CREATE TABLE "system_connections" (
    "id" VARCHAR(32) NOT NULL DEFAULT 'default',
    "support_enabled" BOOLEAN NOT NULL DEFAULT false,
    "support_label" VARCHAR(40) NOT NULL DEFAULT '客服',
    "support_url" VARCHAR(500) NOT NULL DEFAULT '',
    "smtp_host" VARCHAR(200) NOT NULL DEFAULT '',
    "smtp_port" INTEGER,
    "smtp_user" VARCHAR(320) NOT NULL DEFAULT '',
    "smtp_from" VARCHAR(320) NOT NULL DEFAULT '',
    "smtp_password" VARCHAR(200) NOT NULL DEFAULT '',
    "ecpay_env" VARCHAR(16) NOT NULL DEFAULT '',
    "ecpay_merchant_id" VARCHAR(20) NOT NULL DEFAULT '',
    "ecpay_hash_key" VARCHAR(64) NOT NULL DEFAULT '',
    "ecpay_hash_iv" VARCHAR(64) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_connections_pkey" PRIMARY KEY ("id")
);

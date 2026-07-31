-- MEV-02: recupero password
ALTER TABLE "users" ADD COLUMN "password_reset_token_hash" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "password_reset_expires_at" TIMESTAMPTZ;

-- MEV-02: cambio email
ALTER TABLE "users" ADD COLUMN "pending_email" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "pending_email_token_hash" VARCHAR(255);
ALTER TABLE "users" ADD COLUMN "pending_email_expires_at" TIMESTAMPTZ;

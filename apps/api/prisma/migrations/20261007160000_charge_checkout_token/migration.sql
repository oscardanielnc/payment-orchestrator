-- AlterTable: nullable first, so existing charges can get a token before the NOT NULL.
ALTER TABLE "charges" ADD COLUMN "checkout_token" TEXT;

-- Backfill: 122 random bits from gen_random_uuid() (built in since Postgres 13), hex without dashes.
UPDATE "charges" SET "checkout_token" = replace(gen_random_uuid()::text, '-', '') WHERE "checkout_token" IS NULL;

ALTER TABLE "charges" ALTER COLUMN "checkout_token" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "charges_checkout_token_key" ON "charges"("checkout_token");

-- CreateIndex: the expiry sweep looks up pending charges by expiry.
CREATE INDEX "charges_status_expires_at_idx" ON "charges"("status", "expires_at");

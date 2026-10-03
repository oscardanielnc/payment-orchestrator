-- CreateEnum
CREATE TYPE "NormalBalance" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "LedgerTransactionStatus" AS ENUM ('pending', 'posted', 'archived');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "normal_balance" "NormalBalance" NOT NULL,
    "organization_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" UUID NOT NULL,
    "external_id" TEXT NOT NULL,
    "organization_id" UUID,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "status" "LedgerTransactionStatus" NOT NULL,
    "effective_at" TIMESTAMPTZ(3) NOT NULL,
    "posted_at" TIMESTAMPTZ(3),

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "NormalBalance" NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ledger_accounts_organization_id_idx" ON "ledger_accounts"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_currency_key" ON "ledger_accounts"("code", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_external_id_key" ON "ledger_transactions"("external_id");

-- CreateIndex
CREATE INDEX "ledger_transactions_reference_idx" ON "ledger_transactions"("reference");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_idx" ON "ledger_entries"("account_id");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "ledger_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ledger immutability, enforced by the database too (ADR 0009).
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_amount_positive" CHECK ("amount" > 0);

CREATE FUNCTION ledger_entries_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON "ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();

CREATE FUNCTION ledger_transactions_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ledger_transactions cannot be deleted; post a reversal instead';
  END IF;
  IF OLD."status" <> 'pending' THEN
    RAISE EXCEPTION 'a % ledger transaction cannot change', OLD."status";
  END IF;
  IF NEW."external_id" <> OLD."external_id" OR NEW."description" <> OLD."description"
     OR NEW."effective_at" <> OLD."effective_at" THEN
    RAISE EXCEPTION 'only the status of a pending ledger transaction can change';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_transactions_guard
  BEFORE UPDATE OR DELETE ON "ledger_transactions"
  FOR EACH ROW EXECUTE FUNCTION ledger_transactions_guard();

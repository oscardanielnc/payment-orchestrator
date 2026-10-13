-- CreateEnum
CREATE TYPE "ReconciliationFindingKind" AS ENUM ('missing_in_ledger', 'missing_at_provider', 'amount_mismatch');

-- CreateEnum
CREATE TYPE "ReconciliationFindingStatus" AS ENUM ('open', 'resolved', 'cleared');

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "window_start" TIMESTAMPTZ(3) NOT NULL,
    "window_end" TIMESTAMPTZ(3) NOT NULL,
    "matched" INTEGER NOT NULL,
    "discrepancies" INTEGER NOT NULL,
    "ran_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_findings" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "kind" "ReconciliationFindingKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "organization_id" UUID,
    "charge_id" UUID,
    "currency" VARCHAR(10) NOT NULL,
    "provider_amount" DECIMAL(78,0) NOT NULL,
    "ledger_amount" DECIMAL(78,0) NOT NULL,
    "status" "ReconciliationFindingStatus" NOT NULL,
    "first_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL,
    "resolved_at" TIMESTAMPTZ(3),
    "resolved_by" UUID,
    "note" TEXT,
    "version" INTEGER NOT NULL,

    CONSTRAINT "reconciliation_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_runs_source_window_start_window_end_key" ON "reconciliation_runs"("source", "window_start", "window_end");

-- CreateIndex
CREATE INDEX "reconciliation_findings_organization_id_first_seen_at_idx" ON "reconciliation_findings"("organization_id", "first_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_findings_source_subject_key" ON "reconciliation_findings"("source", "subject");

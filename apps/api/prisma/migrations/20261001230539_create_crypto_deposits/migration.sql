-- CreateTable
CREATE TABLE "deposit_addresses" (
    "id" UUID NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "match_key" TEXT NOT NULL,
    "derivation_index" INTEGER NOT NULL,
    "attempt_id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "expected_amount" DECIMAL(78,0) NOT NULL,
    "received_amount" DECIMAL(78,0) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "deposit_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_transfers" (
    "id" UUID NOT NULL,
    "network" TEXT NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "event_index" INTEGER NOT NULL,
    "deposit_address_id" UUID NOT NULL,
    "from_match_key" TEXT NOT NULL,
    "amount" DECIMAL(78,0) NOT NULL,
    "block_number" BIGINT NOT NULL,
    "block_timestamp" TIMESTAMPTZ(3) NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watcher_cursors" (
    "network" TEXT NOT NULL,
    "cursor" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "watcher_cursors_pkey" PRIMARY KEY ("network")
);

-- CreateIndex
CREATE UNIQUE INDEX "deposit_addresses_attempt_id_key" ON "deposit_addresses"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_addresses_network_address_key" ON "deposit_addresses"("network", "address");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_addresses_network_match_key_key" ON "deposit_addresses"("network", "match_key");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_addresses_network_derivation_index_key" ON "deposit_addresses"("network", "derivation_index");

-- CreateIndex
CREATE INDEX "chain_transfers_deposit_address_id_idx" ON "chain_transfers"("deposit_address_id");

-- CreateIndex
CREATE UNIQUE INDEX "chain_transfers_network_tx_hash_event_index_key" ON "chain_transfers"("network", "tx_hash", "event_index");

-- AddForeignKey
ALTER TABLE "chain_transfers" ADD CONSTRAINT "chain_transfers_deposit_address_id_fkey" FOREIGN KEY ("deposit_address_id") REFERENCES "deposit_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Derivation indexes come from sequences: never reused, even if a transaction rolls back.
CREATE SEQUENCE "deposit_index_tron_nile" MINVALUE 0 START 0;
CREATE SEQUENCE "deposit_index_base_sepolia" MINVALUE 0 START 0;

-- CreateEnum
CREATE TYPE "InboundEventStatus" AS ENUM ('received', 'processed', 'ignored', 'failed');

-- CreateTable
CREATE TABLE "inbound_events" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" "InboundEventStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "inbound_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_events_status_received_at_idx" ON "inbound_events"("status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_events_provider_external_id_key" ON "inbound_events"("provider", "external_id");

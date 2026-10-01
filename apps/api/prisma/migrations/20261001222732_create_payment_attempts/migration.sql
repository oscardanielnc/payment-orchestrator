-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('pending', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" UUID NOT NULL,
    "charge_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "AttemptStatus" NOT NULL,
    "external_reference" TEXT NOT NULL,
    "instructions" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "version" INTEGER NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_attempts_charge_id_created_at_idx" ON "payment_attempts"("charge_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_attempts_provider_external_reference_key" ON "payment_attempts"("provider", "external_reference");

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- At most one succeeded attempt per charge (partial unique index; not expressible in schema.prisma).
CREATE UNIQUE INDEX "payment_attempts_one_succeeded_per_charge" ON "payment_attempts"("charge_id") WHERE "status" = 'succeeded';

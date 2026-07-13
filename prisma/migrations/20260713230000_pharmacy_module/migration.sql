-- Pharmacy module: Add facilityId to Medication, pharmacy reorder support, and related changes

-- Create enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PharmacyReorderStatus') THEN
    CREATE TYPE "PharmacyReorderStatus" AS ENUM ('REQUESTED', 'ORDERED', 'RECEIVED', 'CANCELLED');
  END IF;
END $$;

-- Add facilityId to Medication if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Medication' AND column_name = 'facilityId'
  ) THEN
    ALTER TABLE "Medication" ADD COLUMN "facilityId" TEXT;
    DROP INDEX IF EXISTS "Medication_code_key";

    -- Backfill with default facility
    UPDATE "Medication"
    SET "facilityId" = (
      SELECT "id" FROM "Facility" WHERE "code" = 'SDA-KWADASO' LIMIT 1
    )
    WHERE "facilityId" IS NULL;

    ALTER TABLE "Medication" ALTER COLUMN "facilityId" SET NOT NULL;
    CREATE UNIQUE INDEX "Medication_facilityId_code_key" ON "Medication"("facilityId", "code");
    CREATE INDEX "Medication_facilityId_idx" ON "Medication"("facilityId");
    ALTER TABLE "Medication" ADD CONSTRAINT "Medication_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Add cancellation fields to Prescription if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Prescription' AND column_name = 'cancellationReason'
  ) THEN
    ALTER TABLE "Prescription"
      ADD COLUMN "cancellationReason" TEXT,
      ADD COLUMN "cancelledAt" TIMESTAMP(3),
      ADD COLUMN "cancelledById" TEXT;
    CREATE INDEX "Prescription_cancelledById_idx" ON "Prescription"("cancelledById");
    ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_cancelledById_fkey"
      FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add fields to Dispensing if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Dispensing' AND column_name = 'notes'
  ) THEN
    DROP INDEX IF EXISTS "Dispensing_prescriptionId_key";
    ALTER TABLE "Dispensing"
      ADD COLUMN "notes" TEXT,
      ADD COLUMN "partialDispenseReason" TEXT,
      ADD COLUMN "cancellationReason" TEXT,
      ADD COLUMN "cancelledAt" TIMESTAMP(3),
      ADD COLUMN "cancelledById" TEXT;
    CREATE INDEX "Dispensing_prescriptionId_idx" ON "Dispensing"("prescriptionId");
    ALTER TABLE "Dispensing" ADD CONSTRAINT "Dispensing_cancelledById_fkey"
      FOREIGN KEY ("cancelledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add stockId to DispenseItem if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'DispenseItem' AND column_name = 'stockId'
  ) THEN
    ALTER TABLE "DispenseItem" ADD COLUMN "stockId" TEXT;
    CREATE INDEX "DispenseItem_stockId_idx" ON "DispenseItem"("stockId");
    ALTER TABLE "DispenseItem" ADD CONSTRAINT "DispenseItem_stockId_fkey"
      FOREIGN KEY ("stockId") REFERENCES "MedicationStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add reversalOfId to StockMovement if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'StockMovement' AND column_name = 'reversalOfId'
  ) THEN
    ALTER TABLE "StockMovement" ADD COLUMN "reversalOfId" TEXT;
    CREATE UNIQUE INDEX "StockMovement_reversalOfId_key" ON "StockMovement"("reversalOfId");
    ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reversalOfId_fkey"
      FOREIGN KEY ("reversalOfId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Create PharmacyReorder table if not exists
CREATE TABLE IF NOT EXISTS "PharmacyReorder" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "medicationId" TEXT NOT NULL,
  "stockId" TEXT,
  "requestedQuantity" INTEGER NOT NULL,
  "status" "PharmacyReorderStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes" TEXT,
  "createdById" TEXT,
  "receivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PharmacyReorder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PharmacyReorder_reference_key" ON "PharmacyReorder"("reference");
CREATE INDEX IF NOT EXISTS "PharmacyReorder_facilityId_idx" ON "PharmacyReorder"("facilityId");
CREATE INDEX IF NOT EXISTS "PharmacyReorder_medicationId_idx" ON "PharmacyReorder"("medicationId");
CREATE INDEX IF NOT EXISTS "PharmacyReorder_stockId_idx" ON "PharmacyReorder"("stockId");
CREATE INDEX IF NOT EXISTS "PharmacyReorder_status_idx" ON "PharmacyReorder"("status");
CREATE INDEX IF NOT EXISTS "PharmacyReorder_createdAt_idx" ON "PharmacyReorder"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PharmacyReorder_facilityId_fkey'
  ) THEN
    ALTER TABLE "PharmacyReorder" ADD CONSTRAINT "PharmacyReorder_facilityId_fkey"
      FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "PharmacyReorder" ADD CONSTRAINT "PharmacyReorder_medicationId_fkey"
      FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    ALTER TABLE "PharmacyReorder" ADD CONSTRAINT "PharmacyReorder_stockId_fkey"
      FOREIGN KEY ("stockId") REFERENCES "MedicationStock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    ALTER TABLE "PharmacyReorder" ADD CONSTRAINT "PharmacyReorder_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

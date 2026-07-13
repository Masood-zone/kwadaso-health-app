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

    -- Build the complete set of facilities where each existing medication is
    -- already used. Prescriptions without an encounter inherit the patient's
    -- registered facility. Stock-linked records use the owning stock facility.
    CREATE TEMP TABLE "_MedicationFacilityUsage" (
      "medicationId" TEXT NOT NULL,
      "facilityId" TEXT NOT NULL,
      PRIMARY KEY ("medicationId", "facilityId")
    ) ON COMMIT DROP;

    INSERT INTO "_MedicationFacilityUsage" ("medicationId", "facilityId")
    SELECT DISTINCT "medicationId", "facilityId"
    FROM "MedicationStock"
    ON CONFLICT DO NOTHING;

    INSERT INTO "_MedicationFacilityUsage" ("medicationId", "facilityId")
    SELECT DISTINCT pi."medicationId", COALESCE(e."facilityId", ptn."registeredFacilityId")
    FROM "PrescriptionItem" pi
    JOIN "Prescription" p ON p."id" = pi."prescriptionId"
    JOIN "Patient" ptn ON ptn."id" = p."patientId"
    LEFT JOIN "Encounter" e ON e."id" = p."encounterId"
    WHERE pi."medicationId" IS NOT NULL
      AND COALESCE(e."facilityId", ptn."registeredFacilityId") IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO "_MedicationFacilityUsage" ("medicationId", "facilityId")
    SELECT DISTINCT di."medicationId", COALESCE(e."facilityId", ptn."registeredFacilityId")
    FROM "DispenseItem" di
    JOIN "Dispensing" d ON d."id" = di."dispensingId"
    JOIN "Prescription" p ON p."id" = d."prescriptionId"
    JOIN "Patient" ptn ON ptn."id" = d."patientId"
    LEFT JOIN "Encounter" e ON e."id" = p."encounterId"
    WHERE di."medicationId" IS NOT NULL
      AND COALESCE(e."facilityId", ptn."registeredFacilityId") IS NOT NULL
    ON CONFLICT DO NOTHING;

    INSERT INTO "_MedicationFacilityUsage" ("medicationId", "facilityId")
    SELECT DISTINCT sm."medicationId", ms."facilityId"
    FROM "StockMovement" sm
    JOIN "MedicationStock" ms ON ms."id" = sm."stockId"
    ON CONFLICT DO NOTHING;

    -- Preserve otherwise-unused catalog entries at the deterministic first
    -- facility instead of dropping them during ownership enforcement.
    INSERT INTO "_MedicationFacilityUsage" ("medicationId", "facilityId")
    SELECT m."id", (SELECT f."id" FROM "Facility" f ORDER BY f."createdAt", f."id" LIMIT 1)
    FROM "Medication" m
    WHERE NOT EXISTS (
      SELECT 1 FROM "_MedicationFacilityUsage" u WHERE u."medicationId" = m."id"
    )
    ON CONFLICT DO NOTHING;

    CREATE TEMP TABLE "_MedicationFacilityMap" ON COMMIT DROP AS
    SELECT
      u."medicationId" AS "sourceMedicationId",
      u."facilityId",
      CASE
        WHEN u."facilityId" = MIN(u."facilityId") OVER (PARTITION BY u."medicationId")
          THEN u."medicationId"
        ELSE 'phm_' || md5(u."medicationId" || ':' || u."facilityId")
      END AS "targetMedicationId",
      u."facilityId" = MIN(u."facilityId") OVER (PARTITION BY u."medicationId") AS "usesOriginal"
    FROM "_MedicationFacilityUsage" u;

    UPDATE "Medication" m
    SET "facilityId" = map."facilityId"
    FROM "_MedicationFacilityMap" map
    WHERE map."sourceMedicationId" = m."id" AND map."usesOriginal";

    INSERT INTO "Medication" (
      "id", "facilityId", "code", "name", "genericName", "category",
      "dosageForm", "strength", "unit", "reorderLevel", "isActive",
      "createdAt", "updatedAt"
    )
    SELECT
      map."targetMedicationId", map."facilityId", m."code", m."name",
      m."genericName", m."category", m."dosageForm", m."strength", m."unit",
      m."reorderLevel", m."isActive", m."createdAt", m."updatedAt"
    FROM "_MedicationFacilityMap" map
    JOIN "Medication" m ON m."id" = map."sourceMedicationId"
    WHERE NOT map."usesOriginal";

    UPDATE "MedicationStock" ms
    SET "medicationId" = map."targetMedicationId"
    FROM "_MedicationFacilityMap" map
    WHERE map."sourceMedicationId" = ms."medicationId"
      AND map."facilityId" = ms."facilityId";

    UPDATE "PrescriptionItem" pi
    SET "medicationId" = map."targetMedicationId"
    FROM "Prescription" p
    JOIN "Patient" ptn ON ptn."id" = p."patientId"
    LEFT JOIN "Encounter" e ON e."id" = p."encounterId"
    JOIN "_MedicationFacilityMap" map
      ON map."facilityId" = COALESCE(e."facilityId", ptn."registeredFacilityId")
    WHERE p."id" = pi."prescriptionId"
      AND map."sourceMedicationId" = pi."medicationId";

    UPDATE "DispenseItem" di
    SET "medicationId" = map."targetMedicationId"
    FROM "Dispensing" d
    JOIN "Prescription" p ON p."id" = d."prescriptionId"
    JOIN "Patient" ptn ON ptn."id" = d."patientId"
    LEFT JOIN "Encounter" e ON e."id" = p."encounterId"
    JOIN "_MedicationFacilityMap" map
      ON map."facilityId" = COALESCE(e."facilityId", ptn."registeredFacilityId")
    WHERE d."id" = di."dispensingId"
      AND map."sourceMedicationId" = di."medicationId";

    UPDATE "StockMovement" sm
    SET "medicationId" = map."targetMedicationId"
    FROM "MedicationStock" ms
    JOIN "_MedicationFacilityMap" map ON map."facilityId" = ms."facilityId"
    WHERE ms."id" = sm."stockId"
      AND map."sourceMedicationId" = sm."medicationId";

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
    UPDATE "DispenseItem" di
    SET "stockId" = (
      SELECT sm."stockId"
      FROM "Dispensing" d
      JOIN "StockMovement" sm
        ON sm."reference" = d."dispenseNo"
       AND sm."type" = 'DISPENSE'
       AND sm."medicationId" = di."medicationId"
      WHERE d."id" = di."dispensingId"
      ORDER BY sm."createdAt"
      LIMIT 1
    )
    WHERE EXISTS (
      SELECT 1
      FROM "Dispensing" d
      JOIN "StockMovement" sm
        ON sm."reference" = d."dispenseNo"
       AND sm."type" = 'DISPENSE'
       AND sm."medicationId" = di."medicationId"
      WHERE d."id" = di."dispensingId"
    );
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
  "updatedAt" TIMESTAMP(3) NOT NULL,
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

-- Scope the laboratory catalog to a facility and backfill the existing single-hospital catalog.
ALTER TABLE "LabTestCatalog" ADD COLUMN "facilityId" TEXT;

UPDATE "LabTestCatalog"
SET "facilityId" = (
  SELECT "id" FROM "Facility" WHERE "code" = 'SDA-KWADASO' LIMIT 1
)
WHERE "facilityId" IS NULL;

ALTER TABLE "LabTestCatalog" ALTER COLUMN "facilityId" SET NOT NULL;
DROP INDEX IF EXISTS "LabTestCatalog_code_key";
CREATE UNIQUE INDEX "LabTestCatalog_facilityId_code_key" ON "LabTestCatalog"("facilityId", "code");
CREATE INDEX "LabTestCatalog_facilityId_idx" ON "LabTestCatalog"("facilityId");

ALTER TABLE "LabTestCatalog"
ADD CONSTRAINT "LabTestCatalog_facilityId_fkey"
FOREIGN KEY ("facilityId") REFERENCES "Facility"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Define reusable, facility-owned test parameters and thresholds.
CREATE TABLE "LabTestParameterDefinition" (
  "id" TEXT NOT NULL,
  "labTestCatalogId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT,
  "referenceRange" TEXT,
  "referenceLow" DECIMAL(18,6),
  "referenceHigh" DECIMAL(18,6),
  "criticalLow" DECIMAL(18,6),
  "criticalHigh" DECIMAL(18,6),
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LabTestParameterDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LabTestParameterDefinition_labTestCatalogId_name_key"
ON "LabTestParameterDefinition"("labTestCatalogId", "name");
CREATE INDEX "LabTestParameterDefinition_labTestCatalogId_idx"
ON "LabTestParameterDefinition"("labTestCatalogId");
CREATE INDEX "LabTestParameterDefinition_isActive_idx"
ON "LabTestParameterDefinition"("isActive");

ALTER TABLE "LabTestParameterDefinition"
ADD CONSTRAINT "LabTestParameterDefinition_labTestCatalogId_fkey"
FOREIGN KEY ("labTestCatalogId") REFERENCES "LabTestCatalog"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Link results to their specimen and preserve validation/parameter metadata.
ALTER TABLE "LabResult" ADD COLUMN "labSampleId" TEXT;
ALTER TABLE "LabResult" ADD COLUMN "validationNote" TEXT;
CREATE INDEX "LabResult_labSampleId_idx" ON "LabResult"("labSampleId");
ALTER TABLE "LabResult"
ADD CONSTRAINT "LabResult_labSampleId_fkey"
FOREIGN KEY ("labSampleId") REFERENCES "LabSample"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LabResultItem" ADD COLUMN "parameterDefinitionId" TEXT;
ALTER TABLE "LabResultItem" ADD COLUMN "isCritical" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LabResultItem" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX "LabResultItem_parameterDefinitionId_idx" ON "LabResultItem"("parameterDefinitionId");
ALTER TABLE "LabResultItem"
ADD CONSTRAINT "LabResultItem_parameterDefinitionId_fkey"
FOREIGN KEY ("parameterDefinitionId") REFERENCES "LabTestParameterDefinition"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

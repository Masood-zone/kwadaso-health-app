-- Historical compatibility migration. This migration was previously recorded
-- in the database after schema prototyping, so every operation is guarded to
-- keep both the existing database and clean database bootstraps safe.
ALTER TABLE "LabResult" DROP CONSTRAINT IF EXISTS "LabResult_labSampleId_fkey";
ALTER TABLE "LabResultItem" DROP CONSTRAINT IF EXISTS "LabResultItem_parameterDefinitionId_fkey";
ALTER TABLE "LabTestCatalog" DROP CONSTRAINT IF EXISTS "LabTestCatalog_facilityId_fkey";
ALTER TABLE IF EXISTS "LabTestParameterDefinition" DROP CONSTRAINT IF EXISTS "LabTestParameterDefinition_labTestCatalogId_fkey";

DROP INDEX IF EXISTS "LabResult_labSampleId_idx";
DROP INDEX IF EXISTS "LabResultItem_parameterDefinitionId_idx";
DROP INDEX IF EXISTS "LabTestCatalog_facilityId_code_key";
DROP INDEX IF EXISTS "LabTestCatalog_facilityId_idx";

ALTER TABLE "LabResult" DROP COLUMN IF EXISTS "labSampleId";
ALTER TABLE "LabResult" DROP COLUMN IF EXISTS "validationNote";
ALTER TABLE "LabResultItem" DROP COLUMN IF EXISTS "isCritical";
ALTER TABLE "LabResultItem" DROP COLUMN IF EXISTS "parameterDefinitionId";
ALTER TABLE "LabResultItem" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "LabTestCatalog" DROP COLUMN IF EXISTS "facilityId";

DROP TABLE IF EXISTS "LabTestParameterDefinition";
CREATE UNIQUE INDEX IF NOT EXISTS "LabTestCatalog_code_key" ON "LabTestCatalog"("code");

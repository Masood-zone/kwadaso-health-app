-- Existing result items needed a temporary default while the column was added.
-- Prisma manages @updatedAt values after the backfill, so remove database defaults.
ALTER TABLE "LabResultItem" ALTER COLUMN "updatedAt" DROP DEFAULT;
ALTER TABLE "LabTestParameterDefinition" ALTER COLUMN "updatedAt" DROP DEFAULT;

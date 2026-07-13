ALTER TYPE "PrescriptionStatus" ADD VALUE IF NOT EXISTS 'EXTERNALLY_RELEASED';

ALTER TABLE "Prescription"
ADD COLUMN "externalReleaseReason" TEXT,
ADD COLUMN "externallyReleasedAt" TIMESTAMP(3),
ADD COLUMN "externallyReleasedById" TEXT;

CREATE INDEX "Prescription_externallyReleasedById_idx"
ON "Prescription"("externallyReleasedById");

ALTER TABLE "Prescription"
ADD CONSTRAINT "Prescription_externallyReleasedById_fkey"
FOREIGN KEY ("externallyReleasedById") REFERENCES "user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

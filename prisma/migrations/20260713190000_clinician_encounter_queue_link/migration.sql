-- Link a clinical encounter to the exact queue entry that originated it.
ALTER TABLE "Encounter" ADD COLUMN "queueId" TEXT;

CREATE UNIQUE INDEX "Encounter_queueId_key" ON "Encounter"("queueId");
CREATE INDEX "Encounter_queueId_idx" ON "Encounter"("queueId");

ALTER TABLE "Encounter"
ADD CONSTRAINT "Encounter_queueId_fkey"
FOREIGN KEY ("queueId") REFERENCES "PatientQueue"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

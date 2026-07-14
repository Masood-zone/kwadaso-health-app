CREATE INDEX "user_facilityId_status_defaultRole_idx"
ON "user"("facilityId", "status", "defaultRole");

CREATE INDEX "Patient_registeredFacilityId_status_createdAt_idx"
ON "Patient"("registeredFacilityId", "status", "createdAt");

CREATE INDEX "Appointment_facilityId_status_scheduledAt_idx"
ON "Appointment"("facilityId", "status", "scheduledAt");

CREATE INDEX "PatientQueue_departmentId_status_priority_arrivedAt_idx"
ON "PatientQueue"("departmentId", "status", "priority", "arrivedAt");

CREATE INDEX "Encounter_facilityId_status_startedAt_idx"
ON "Encounter"("facilityId", "status", "startedAt");

CREATE INDEX "LabRequest_status_requestedAt_idx"
ON "LabRequest"("status", "requestedAt");

CREATE INDEX "LabResult_status_criticalFlag_releasedAt_idx"
ON "LabResult"("status", "criticalFlag", "releasedAt");

CREATE INDEX "Prescription_status_issuedAt_idx"
ON "Prescription"("status", "issuedAt");

CREATE INDEX "MedicationStock_facilityId_expiryDate_idx"
ON "MedicationStock"("facilityId", "expiryDate");

CREATE INDEX "Invoice_facilityId_status_issuedAt_idx"
ON "Invoice"("facilityId", "status", "issuedAt");

CREATE INDEX "Notification_facilityId_status_createdAt_idx"
ON "Notification"("facilityId", "status", "createdAt");

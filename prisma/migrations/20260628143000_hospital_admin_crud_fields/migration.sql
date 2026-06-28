-- AlterTable
ALTER TABLE "Department" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "PatientQueue"
ADD COLUMN "assignedToId" TEXT,
ADD COLUMN "cancelledAt" TIMESTAMP(3),
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "reason" TEXT;

-- AlterTable
ALTER TABLE "ReportExport"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'REQUESTED',
ADD COLUMN "dateFrom" TIMESTAMP(3),
ADD COLUMN "dateTo" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification"
ADD COLUMN "facilityId" TEXT,
ADD COLUMN "createdById" TEXT,
ADD COLUMN "targetRole" "StaffRole",
ADD COLUMN "targetDepartmentId" TEXT,
ADD COLUMN "priority" "MessagePriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "PatientQueue_assignedToId_idx" ON "PatientQueue"("assignedToId");

-- CreateIndex
CREATE INDEX "Notification_facilityId_idx" ON "Notification"("facilityId");

-- CreateIndex
CREATE INDEX "Notification_createdById_idx" ON "Notification"("createdById");

-- CreateIndex
CREATE INDEX "Notification_targetDepartmentId_idx" ON "Notification"("targetDepartmentId");

-- CreateIndex
CREATE INDEX "Notification_targetRole_idx" ON "Notification"("targetRole");

-- CreateIndex
CREATE INDEX "Notification_priority_idx" ON "Notification"("priority");

-- CreateIndex
CREATE INDEX "ReportExport_status_idx" ON "ReportExport"("status");

-- CreateIndex
CREATE INDEX "ReportExport_dateFrom_idx" ON "ReportExport"("dateFrom");

-- CreateIndex
CREATE INDEX "ReportExport_dateTo_idx" ON "ReportExport"("dateTo");

-- AddForeignKey
ALTER TABLE "PatientQueue" ADD CONSTRAINT "PatientQueue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_targetDepartmentId_fkey" FOREIGN KEY ("targetDepartmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

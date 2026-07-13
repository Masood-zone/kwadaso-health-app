import type { NextRequest } from "next/server"
import { pharmacyOk, withPharmacy } from "@/lib/pharmacy"
import { DispenseStatus, NotificationStatus, NotificationType, PharmacyReorderStatus, PrescriptionStatus, StockMovementType } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const [medications, clinicians, departments, pharmacists] = await Promise.all([
      prisma.medication.findMany({ where: { facilityId: actor.facilityId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { facilityId: actor.facilityId, status: "ACTIVE", defaultRole: { in: ["DOCTOR", "PHYSICIAN_ASSISTANT"] } }, orderBy: { name: "asc" } }),
      prisma.department.findMany({ where: { facilityId: actor.facilityId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { facilityId: actor.facilityId, status: "ACTIVE", defaultRole: "PHARMACIST" }, orderBy: { name: "asc" } }),
    ])
    return pharmacyOk({ medications: medications.map(({ id, name, genericName, category, dosageForm, strength }) => ({ id, name, genericName, category, dosageForm, strength })), clinicians: clinicians.map(({ id, name }) => ({ id, name })), departments: departments.map(({ id, name }) => ({ id, name })), pharmacists: pharmacists.map(({ id, name }) => ({ id, name })), prescriptionStatuses: Object.values(PrescriptionStatus), dispenseStatuses: Object.values(DispenseStatus), movementTypes: Object.values(StockMovementType), reorderStatuses: Object.values(PharmacyReorderStatus), notificationTypes: Object.values(NotificationType), notificationStatuses: Object.values(NotificationStatus) })
  })
}


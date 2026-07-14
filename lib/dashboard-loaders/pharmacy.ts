import type { AuthenticatedStaff } from "@/lib/auth-session"
import {
  decimal,
  isExpired,
  pharmacyDispensingInclude,
  serializeDispensing,
} from "@/lib/pharmacy"
import { prisma } from "@/lib/prisma"
import type { PharmacyDashboardSummary } from "@/types/pharmacy"

type PharmacySummaryRow = {
  newPrescriptions: bigint
  pending: bigint
  partial: bigint
  dispensedToday: bigint
}

export async function loadPharmacyDashboard(
  actor: AuthenticatedStaff,
  now = new Date()
): Promise<PharmacyDashboardSummary> {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const soon = new Date(now.getTime() + 30 * 86_400_000)
  const facilityId = actor.facilityId

  const [summaryRows, stocks, recentDispensing] = await Promise.all([
    prisma.$queryRaw<PharmacySummaryRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "Prescription" p
          JOIN "Patient" pt ON pt."id" = p."patientId"
          LEFT JOIN "Encounter" e ON e."id" = p."encounterId"
          WHERE pt."registeredFacilityId" = ${facilityId}
            AND (p."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND p."issuedAt" >= ${today}) AS "newPrescriptions",
        (SELECT COUNT(*) FROM "Prescription" p
          JOIN "Patient" pt ON pt."id" = p."patientId"
          LEFT JOIN "Encounter" e ON e."id" = p."encounterId"
          WHERE pt."registeredFacilityId" = ${facilityId}
            AND (p."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND p."status" = 'ISSUED') AS pending,
        (SELECT COUNT(*) FROM "Prescription" p
          JOIN "Patient" pt ON pt."id" = p."patientId"
          LEFT JOIN "Encounter" e ON e."id" = p."encounterId"
          WHERE pt."registeredFacilityId" = ${facilityId}
            AND (p."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND p."status" = 'PARTIALLY_DISPENSED') AS partial,
        (SELECT COUNT(*) FROM "Dispensing" d
          JOIN "Patient" pt ON pt."id" = d."patientId"
          WHERE pt."registeredFacilityId" = ${facilityId}
            AND d."dispensedAt" >= ${today}
            AND d."status" IN ('PARTIAL', 'COMPLETED')) AS "dispensedToday"
    `,
    prisma.medicationStock.findMany({
      where: { facilityId },
      include: { medication: true },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "desc" }],
    }),
    prisma.dispensing.findMany({
      where: { patient: { registeredFacilityId: facilityId } },
      include: pharmacyDispensingInclude,
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ])

  const summary = summaryRows[0]
  const low = stocks.filter(
    (stock) => stock.quantityOnHand <= stock.medication.reorderLevel
  )
  const expired = stocks.filter(
    (stock) => stock.expiryDate && stock.expiryDate < now
  )
  const expiring = stocks.filter(
    (stock) => stock.expiryDate && stock.expiryDate >= now && stock.expiryDate <= soon
  )
  const value = stocks.reduce(
    (sum, stock) =>
      sum + stock.quantityOnHand * Number(stock.unitCost?.toString() ?? 0),
    0
  )

  return {
    metrics: [
      { label: "New prescriptions", value: Number(summary?.newPrescriptions ?? 0), detail: "Issued today", tone: "orange" },
      { label: "Pending prescriptions", value: Number(summary?.pending ?? 0), detail: "Awaiting dispensing", tone: "orange" },
      { label: "Partially dispensed", value: Number(summary?.partial ?? 0), detail: "Remaining items", tone: "orange" },
      { label: "Dispensed today", value: Number(summary?.dispensedToday ?? 0), detail: "Released sessions", tone: "green" },
      { label: "Low stock", value: low.length, detail: "At or below reorder level", tone: low.length ? "red" : "green" },
      { label: "Expiring soon", value: expiring.length, detail: "Within 30 days", tone: "orange" },
      { label: "Expired", value: expired.length, detail: "Requires action", tone: expired.length ? "red" : "green" },
      { label: "Stock value", value: `GH₵ ${value.toFixed(2)}`, detail: `${stocks.length} stock batches`, tone: "blue" },
    ],
    recentDispensing: recentDispensing.map(serializeDispensing),
    lowStock: low.slice(0, 6).map((stock) => ({
      id: stock.id,
      medicationId: stock.medicationId,
      medicationName: stock.medication.name,
      genericName: stock.medication.genericName,
      category: stock.medication.category,
      batchNumber: stock.batchNumber,
      expiryDate: stock.expiryDate?.toISOString() ?? null,
      quantityOnHand: stock.quantityOnHand,
      reorderLevel: stock.medication.reorderLevel,
      unitCost: decimal(stock.unitCost),
      sellingPrice: decimal(stock.sellingPrice),
      stockStatus: isExpired(stock.expiryDate, now)
        ? "EXPIRED"
        : stock.quantityOnHand <= 0
          ? "OUT"
          : "LOW",
    })),
  }
}

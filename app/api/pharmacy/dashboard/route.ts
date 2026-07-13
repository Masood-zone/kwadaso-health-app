import type { NextRequest } from "next/server"

import { pharmacyDispensingInclude, pharmacyOk, serializeDispensing, serializeStock, withPharmacy } from "@/lib/pharmacy"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const soon = new Date(Date.now() + 30 * 86400000)
    const scope = { patient: { registeredFacilityId: actor.facilityId }, AND: [{ OR: [{ encounterId: null }, { encounter: { facilityId: actor.facilityId } }] }] }
    const [newPrescriptions, pending, partial, dispensedToday, stocks, recentDispensing] = await Promise.all([
      prisma.prescription.count({ where: { ...scope, issuedAt: { gte: today } } }),
      prisma.prescription.count({ where: { ...scope, status: "ISSUED" } }),
      prisma.prescription.count({ where: { ...scope, status: "PARTIALLY_DISPENSED" } }),
      prisma.dispensing.count({ where: { patient: { registeredFacilityId: actor.facilityId }, dispensedAt: { gte: today }, status: { in: ["PARTIAL", "COMPLETED"] } } }),
      prisma.medicationStock.findMany({ where: { facilityId: actor.facilityId }, include: { medication: true, movements: { include: { performedBy: true }, orderBy: { createdAt: "desc" } } } }),
      prisma.dispensing.findMany({ where: { patient: { registeredFacilityId: actor.facilityId } }, include: pharmacyDispensingInclude, orderBy: { createdAt: "desc" }, take: 8 }),
    ])
    const low = stocks.filter((stock) => stock.quantityOnHand <= stock.medication.reorderLevel)
    const expired = stocks.filter((stock) => stock.expiryDate && stock.expiryDate < new Date())
    const expiring = stocks.filter((stock) => stock.expiryDate && stock.expiryDate >= new Date() && stock.expiryDate <= soon)
    const value = stocks.reduce((sum, stock) => sum + stock.quantityOnHand * Number(stock.unitCost?.toString() ?? 0), 0)
    return pharmacyOk({
      metrics: [
        { label: "New prescriptions", value: newPrescriptions, detail: "Issued today", tone: "orange" },
        { label: "Pending prescriptions", value: pending, detail: "Awaiting dispensing", tone: "orange" },
        { label: "Partially dispensed", value: partial, detail: "Remaining items", tone: "orange" },
        { label: "Dispensed today", value: dispensedToday, detail: "Released sessions", tone: "green" },
        { label: "Low stock", value: low.length, detail: "At or below reorder level", tone: low.length ? "red" : "green" },
        { label: "Expiring soon", value: expiring.length, detail: "Within 30 days", tone: "orange" },
        { label: "Expired", value: expired.length, detail: "Requires action", tone: expired.length ? "red" : "green" },
        { label: "Stock value", value: `GH₵ ${value.toFixed(2)}`, detail: `${stocks.length} stock batches`, tone: "blue" },
      ],
      recentDispensing: recentDispensing.map(serializeDispensing),
      lowStock: low.slice(0, 6).map(serializeStock),
    })
  })
}


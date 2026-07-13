import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

import { auditMeta, canTransitionReorder, generateDispenseNo, generateReorderReference, isExpired, isExpiringSoon, normalizeMedicine, parsePharmacyPagination, reconcileLowStockNotification, serializePrescriptionDetail } from "@/lib/pharmacy"

describe("pharmacy safety and workflow helpers", () => {
  it("normalizes only structured medicine names for deterministic matching", () => {
    expect(normalizeMedicine(" Amoxicillin 500-mg (Capsule) ")).toBe("amoxicillin 500 mg capsule")
  })

  it("treats exactly the next 30 days as expiring soon and past dates as expired", () => {
    const at = new Date("2026-07-13T12:00:00.000Z")
    expect(isExpired(new Date("2026-07-12T23:59:59.000Z"), at)).toBe(true)
    expect(isExpiringSoon(new Date("2026-08-12T12:00:00.000Z"), at)).toBe(true)
    expect(isExpiringSoon(new Date("2026-08-13T12:00:01.000Z"), at)).toBe(false)
  })

  it("caps pagination and generates collision-resistant pharmacy references", () => {
    expect(parsePharmacyPagination(new URLSearchParams("page=-2&pageSize=999"))).toEqual({ page: 1, pageSize: 100, skip: 0 })
    expect(generateDispenseNo()).toMatch(/^DSP-\d{14}-[A-F0-9]{8}$/)
    expect(generateDispenseNo()).not.toBe(generateDispenseNo())
    expect(generateReorderReference()).toMatch(/^REQ-\d{8}-[A-F0-9]{6}$/)
  })

  it("enforces the lightweight reorder lifecycle", () => {
    expect(canTransitionReorder("REQUESTED", "ORDERED")).toBe(true)
    expect(canTransitionReorder("ORDERED", "RECEIVED")).toBe(true)
    expect(canTransitionReorder("REQUESTED", "RECEIVED")).toBe(false)
    expect(canTransitionReorder("RECEIVED", "REQUESTED")).toBe(false)
    expect(canTransitionReorder("CANCELLED", "ORDERED")).toBe(false)
  })

  it("captures auditable request origin", () => {
    const request = new NextRequest("https://khms.test/api/pharmacy/stock", { headers: { "x-forwarded-for": "192.0.2.15, 10.0.0.1", "user-agent": "vitest" } })
    expect(auditMeta(request)).toEqual({ ipAddress: "192.0.2.15", userAgent: "vitest" })
  })

  it("deduplicates unresolved low-stock notifications and archives resolved ones", async () => {
    const client = { notification: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() } }
    client.notification.findFirst.mockResolvedValue({ id: "existing" })
    await reconcileLowStockNotification(client as never, { id: "stock-1", facilityId: "facility-1", quantityOnHand: 2, medication: { name: "Paracetamol", reorderLevel: 10 } }, "pharmacist-1")
    expect(client.notification.create).not.toHaveBeenCalled()
    await reconcileLowStockNotification(client as never, { id: "stock-1", facilityId: "facility-1", quantityOnHand: 20, medication: { name: "Paracetamol", reorderLevel: 10 } }, "pharmacist-1")
    expect(client.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "ARCHIVED" } }))
  })

  it("calculates cumulative remaining quantities across immutable dispensing sessions", async () => {
    const record = {
      id: "rx-1", prescriptionNo: "RX-1", patientId: "patient-1", encounterId: null, prescribedById: "doctor-1", status: "PARTIALLY_DISPENSED", notes: null, issuedAt: new Date("2026-07-12"), cancellationReason: null, cancelledAt: null, cancelledById: null, createdAt: new Date("2026-07-12"), updatedAt: new Date("2026-07-12"),
      patient: { id: "patient-1", patientNo: "P-1", firstName: "Akua", otherNames: null, lastName: "Mensah", gender: "FEMALE", registeredFacilityId: "facility-1", allergies: [], chronicConditions: [], medicationHistory: [] }, encounter: null, prescribedBy: { name: "Dr Test" },
      items: [{ id: "item-1", prescriptionId: "rx-1", medicationId: "med-1", medicineName: "Paracetamol", dosage: null, frequency: null, duration: null, quantity: 20, instructions: null, createdAt: new Date(), medication: { id: "med-1", name: "Paracetamol", genericName: "Paracetamol" } }],
      dispensings: [
        { id: "d-1", dispenseNo: "DSP-1", prescriptionId: "rx-1", patientId: "patient-1", status: "PARTIAL", dispensedById: "p-1", dispensedAt: new Date(), counsellingNotes: null, notes: null, partialDispenseReason: "Limited stock", cancellationReason: null, cancelledAt: null, cancelledById: null, createdAt: new Date(), updatedAt: new Date(), prescription: { prescriptionNo: "RX-1" }, patient: { firstName: "Akua", otherNames: null, lastName: "Mensah" }, dispensedBy: { name: "Pharmacist" }, items: [{ prescriptionItemId: "item-1", quantityDispensed: 5 }] },
        { id: "d-2", dispenseNo: "DSP-2", prescriptionId: "rx-1", patientId: "patient-1", status: "PARTIAL", dispensedById: "p-1", dispensedAt: new Date(), counsellingNotes: null, notes: null, partialDispenseReason: "Limited stock", cancellationReason: null, cancelledAt: null, cancelledById: null, createdAt: new Date(), updatedAt: new Date(), prescription: { prescriptionNo: "RX-1" }, patient: { firstName: "Akua", otherNames: null, lastName: "Mensah" }, dispensedBy: { name: "Pharmacist" }, items: [{ prescriptionItemId: "item-1", quantityDispensed: 4 }] },
      ],
    }
    const client = { medicationStock: { findMany: vi.fn().mockResolvedValue([]) }, prescription: { findMany: vi.fn().mockResolvedValue([]) } }
    const detail = await serializePrescriptionDetail(record as never, client as never)
    expect(detail.items[0]).toMatchObject({ dispensedQuantity: 9, remainingQuantity: 11 })
    expect(detail.dispensings).toHaveLength(2)
  })
})

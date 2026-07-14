import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), ensurePrescription: vi.fn(), serializeDetail: vi.fn(), serializeDispensing: vi.fn(), reconcile: vi.fn(), audit: vi.fn(), withPharmacy: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }))
vi.mock("@/lib/pharmacy", () => ({
  pharmacyDispensingInclude: {},
  ensurePharmacyPrescription: mocks.ensurePrescription,
  generateDispenseNo: () => "DSP-TEST-001",
  isExpired: (date: Date | null) => Boolean(date && date < new Date()),
  pharmacyOk: (data: unknown, message?: string, status = 200) => Response.json({ success: true, data, message }, { status }),
  reconcileLowStockNotification: mocks.reconcile,
  serializeDispensing: mocks.serializeDispensing,
  serializePrescriptionDetail: mocks.serializeDetail,
  withPharmacy: mocks.withPharmacy,
  writePharmacyAuditLog: mocks.audit,
}))

import { POST } from "@/app/api/pharmacy/prescriptions/[id]/dispense/route"

const actor = { id: "pharmacist-1", facilityId: "facility-1" }
const prescription = { id: "rx-1", prescriptionNo: "RX-1", patientId: "patient-1", status: "ISSUED", encounterId: "encounter-1", encounter: { queueId: "queue-1" }, items: [{ id: "item-1", medicationId: "med-1", medicineName: "Paracetamol" }] }
const detail = { items: [{ id: "item-1", medicationId: "med-1", remainingQuantity: 5 }], warnings: [] }
function request(payload: unknown) { return new NextRequest("https://khms.test/api/pharmacy/prescriptions/rx-1/dispense", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }) }
function payload(overrides: Record<string, unknown> = {}) { return { items: [{ prescriptionItemId: "item-1", medicationId: "med-1", stockId: "stock-1", quantityDispensed: 5 }], ...overrides } }

describe("pharmacy dispensing route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withPharmacy.mockImplementation(async (_request, handler) => { try { return await handler(actor) } catch (error) { return Response.json({ success: false, message: error instanceof Error ? error.message : "failed" }, { status: 409 }) } })
    mocks.ensurePrescription.mockResolvedValue(prescription)
    mocks.serializeDetail.mockResolvedValue(detail)
    mocks.serializeDispensing.mockReturnValue({ id: "dispensing-1", status: "COMPLETED" })
  })

  it("returns the facility guard response before starting a transaction", async () => {
    mocks.withPharmacy.mockResolvedValueOnce(Response.json({ success: false, code: "FORBIDDEN" }, { status: 403 }))
    const response = await POST(request(payload()), { params: Promise.resolve({ id: "rx-1" }) })
    expect(response.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("requires an explicit partial-fill reason before creating a session", async () => {
    mocks.serializeDetail.mockResolvedValue({ ...detail, items: [{ ...detail.items[0], remainingQuantity: 10 }] })
    const tx = { dispensing: { create: vi.fn() } }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))
    const response = await POST(request(payload()), { params: Promise.resolve({ id: "rx-1" }) })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ message: "PARTIAL_REASON_REQUIRED" })
    expect(tx.dispensing.create).not.toHaveBeenCalled()
  })

  it("requires documented allergy and duplicate-medication overrides", async () => {
    mocks.serializeDetail.mockResolvedValue({ ...detail, warnings: [{ type: "ALLERGY", prescriptionItemId: "item-1", requiresReason: true }] })
    const tx = { dispensing: { create: vi.fn() } }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))
    const response = await POST(request(payload()), { params: Promise.resolve({ id: "rx-1" }) })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ message: "SAFETY_OVERRIDE_REQUIRED" })
    expect(tx.dispensing.create).not.toHaveBeenCalled()
  })

  it("conditionally decrements the facility batch and completes the pharmacy workflow atomically", async () => {
    const tx = {
      dispensing: { create: vi.fn().mockResolvedValue({ id: "dispensing-1", dispenseNo: "DSP-TEST-001", status: "COMPLETED" }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "dispensing-1", items: [] }) },
      medicationStock: { findFirst: vi.fn().mockResolvedValue({ id: "stock-1", medicationId: "med-1", expiryDate: new Date("2027-01-01"), medication: { name: "Paracetamol" } }), updateMany: vi.fn().mockResolvedValue({ count: 1 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "stock-1", facilityId: "facility-1", quantityOnHand: 15, medication: { name: "Paracetamol", reorderLevel: 5 } }) },
      dispenseItem: { create: vi.fn() }, stockMovement: { create: vi.fn() }, prescription: { update: vi.fn() }, encounter: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) }, patientQueue: { updateMany: vi.fn() },
      notification: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "billing-notification-1" }) },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))
    const response = await POST(request(payload()), { params: Promise.resolve({ id: "rx-1" }) })
    expect(response.status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { maxWait: 10_000, timeout: 30_000 }
    )
    expect(tx.medicationStock.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: "stock-1", quantityOnHand: { gte: 5 } }), data: { quantityOnHand: { decrement: 5 } } }))
    expect(tx.stockMovement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "DISPENSE", quantity: 5, reference: "DSP-TEST-001" }) })
    expect(tx.prescription.update).toHaveBeenCalledWith({ where: { id: "rx-1" }, data: { status: "DISPENSED" } })
    expect(tx.encounter.updateMany).toHaveBeenCalledWith({ where: { id: "encounter-1", status: "AWAITING_PHARMACY" }, data: { status: "COMPLETED", completedAt: expect.any(Date) } })
    expect(tx.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ targetRole: "BILLING_OFFICER", type: "BILLING", entityType: "Dispensing" }) }))
    expect(mocks.audit).toHaveBeenCalled()
  })
})

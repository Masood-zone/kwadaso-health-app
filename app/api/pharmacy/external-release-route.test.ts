import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  ensurePrescription: vi.fn(),
  serializeDetail: vi.fn(),
  audit: vi.fn(),
  withPharmacy: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}))

vi.mock("@/lib/pharmacy", () => ({
  ensurePharmacyPrescription: mocks.ensurePrescription,
  pharmacyOk: (data: unknown, message?: string, status = 200) =>
    Response.json({ success: true, data, message }, { status }),
  prescriptionScope: (facilityId: string) => ({
    patient: { registeredFacilityId: facilityId },
  }),
  serializePrescriptionDetail: mocks.serializeDetail,
  withPharmacy: mocks.withPharmacy,
  writePharmacyAuditLog: mocks.audit,
}))

import { POST } from "@/app/api/pharmacy/prescriptions/[id]/external-release/route"

const actor = { id: "pharmacist-1", facilityId: "facility-1" }
const prescription = {
  id: "rx-1",
  prescriptionNo: "RX-001",
  patientId: "patient-1",
  encounterId: "encounter-1",
  prescribedById: "clinician-1",
  status: "PARTIALLY_DISPENSED",
  encounter: { queueId: "queue-1" },
  items: [
    { id: "item-1", medicineName: "Rifampicin/Isoniazid FDC", quantity: 10 },
    { id: "item-2", medicineName: "Paracetamol 500mg", quantity: 2 },
  ],
  dispensings: [
    {
      items: [{ prescriptionItemId: "item-2", quantityDispensed: 2 }],
    },
  ],
}

function request(reason = "Medicine unavailable in facility stock") {
  return new NextRequest(
    "https://khms.test/api/pharmacy/prescriptions/rx-1/external-release",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    }
  )
}

describe("pharmacy external prescription release", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.withPharmacy.mockImplementation(async (_request, handler) => {
      try {
        return await handler(actor)
      } catch (error) {
        return Response.json(
          {
            success: false,
            message: error instanceof Error ? error.message : "failed",
          },
          { status: 409 }
        )
      }
    })
    mocks.ensurePrescription
      .mockResolvedValueOnce(prescription)
      .mockResolvedValueOnce({ ...prescription, status: "EXTERNALLY_RELEASED" })
    mocks.serializeDetail.mockResolvedValue({
      id: "rx-1",
      status: "EXTERNALLY_RELEASED",
    })
  })

  it("releases only the unfilled remainder without fabricating stock activity", async () => {
    const tx = {
      prescription: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      encounter: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      patientQueue: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      notification: { create: vi.fn() },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const response = await POST(request(), {
      params: Promise.resolve({ id: "rx-1" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 30_000,
    })
    expect(tx.prescription.updateMany).toHaveBeenCalledWith({
      where: {
        id: "rx-1",
        status: "PARTIALLY_DISPENSED",
        patient: { registeredFacilityId: "facility-1" },
      },
      data: {
        status: "EXTERNALLY_RELEASED",
        externalReleaseReason: "Medicine unavailable in facility stock",
        externallyReleasedAt: expect.any(Date),
        externallyReleasedById: "pharmacist-1",
      },
    })
    expect(tx.encounter.updateMany).toHaveBeenCalledWith({
      where: {
        id: "encounter-1",
        facilityId: "facility-1",
        status: "AWAITING_PHARMACY",
      },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    })
    expect(tx.patientQueue.updateMany).toHaveBeenCalledWith({
      where: { id: "queue-1", status: "AWAITING_PHARMACY" },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    })
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        after: expect.objectContaining({
          remainingItems: [
            {
              prescriptionItemId: "item-1",
              medicineName: "Rifampicin/Isoniazid FDC",
              quantity: 10,
            },
          ],
        }),
      })
    )
    expect(tx).not.toHaveProperty("medicationStock")
    expect(tx).not.toHaveProperty("stockMovement")
    expect(tx).not.toHaveProperty("dispensing")
  })

  it("requires a documented external-release reason", async () => {
    const response = await POST(request(""), {
      params: Promise.resolve({ id: "rx-1" }),
    })

    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

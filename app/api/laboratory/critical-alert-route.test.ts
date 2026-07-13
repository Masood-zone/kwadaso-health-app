import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const transaction = vi.fn()
  const findUniqueOrThrow = vi.fn()
  return {
    transaction,
    findUniqueOrThrow,
    requireLaboratoryApi: vi.fn(),
    ensureLaboratoryResult: vi.fn(),
    serializeLabResult: vi.fn(),
    writeLaboratoryAuditLog: vi.fn(),
  }
})

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    labResult: { findUniqueOrThrow: mocks.findUniqueOrThrow },
  },
}))

vi.mock("@/lib/laboratory", () => ({
  laboratoryResultInclude: {},
  requireLaboratoryApi: mocks.requireLaboratoryApi,
  ensureLaboratoryResult: mocks.ensureLaboratoryResult,
  serializeLabResult: mocks.serializeLabResult,
  writeLaboratoryAuditLog: mocks.writeLaboratoryAuditLog,
}))

import { POST } from "@/app/api/laboratory/results/[id]/critical-alert/route"

function request(payload: unknown) {
  return new NextRequest("https://khms.test/api/laboratory/results/result-1/critical-alert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
}

describe("critical alert route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireLaboratoryApi.mockResolvedValue({
      staff: { id: "tech-1", facilityId: "facility-1" },
      response: null,
    })
    mocks.findUniqueOrThrow.mockResolvedValue({ id: "result-1" })
    mocks.serializeLabResult.mockResolvedValue({ id: "result-1", criticalAlert: { sent: true } })
  })

  it("returns the facility guard response before touching laboratory data", async () => {
    mocks.requireLaboratoryApi.mockResolvedValue({
      staff: null,
      response: Response.json({ success: false, code: "FORBIDDEN" }, { status: 403 }),
    })
    const response = await POST(request({ confirmed: true, reason: "Critical potassium" }), {
      params: Promise.resolve({ id: "result-1" }),
    })
    expect(response.status).toBe(403)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("rejects an unconfirmed alert without starting a transaction", async () => {
    const response = await POST(request({ confirmed: false, reason: "Critical potassium" }), {
      params: Promise.resolve({ id: "result-1" }),
    })
    expect(response.status).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it("is idempotent when the ordering clinician already has the alert", async () => {
    const tx = {
      notification: {
        findFirst: vi.fn().mockResolvedValue({ id: "existing-alert" }),
        createMany: vi.fn(),
      },
      labResult: { update: vi.fn() },
    }
    mocks.ensureLaboratoryResult.mockResolvedValue({
      id: "result-1",
      requestTest: { labRequest: { requestedById: "clinician-1" } },
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const response = await POST(request({ confirmed: true, reason: "Critical potassium" }), {
      params: Promise.resolve({ id: "result-1" }),
    })
    expect(response.status).toBe(200)
    expect(tx.labResult.update).not.toHaveBeenCalled()
    expect(tx.notification.createMany).not.toHaveBeenCalled()
    expect(mocks.writeLaboratoryAuditLog).not.toHaveBeenCalled()
  })
})

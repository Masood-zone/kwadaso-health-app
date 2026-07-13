import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findSample: vi.fn(),
  findSampleDetail: vi.fn(),
  requireLaboratoryApi: vi.fn(),
  serializeLabSampleDetail: vi.fn(),
  writeLaboratoryAuditLog: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    labSample: {
      findFirst: mocks.findSample,
      findUniqueOrThrow: mocks.findSampleDetail,
    },
  },
}))

vi.mock("@/lib/laboratory", () => ({
  canTransitionSample: (from: string, to: string) =>
    from === "COLLECTED" && to === "RECEIVED",
  ensureLaboratorySample: vi.fn(),
  laboratoryRequestScope: (facilityId: string) => ({
    patient: { registeredFacilityId: facilityId },
  }),
  laboratorySampleInclude: {},
  requireLaboratoryApi: mocks.requireLaboratoryApi,
  serializeLabSampleDetail: mocks.serializeLabSampleDetail,
  writeLaboratoryAuditLog: mocks.writeLaboratoryAuditLog,
}))

import { PATCH } from "@/app/api/laboratory/samples/[sampleId]/route"

function request(status = "RECEIVED") {
  return new NextRequest("https://khms.test/api/laboratory/samples/sample-1", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  })
}

describe("laboratory sample status route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireLaboratoryApi.mockResolvedValue({
      staff: { id: "tech-1", facilityId: "facility-1" },
      response: null,
    })
    mocks.findSample.mockResolvedValue({
      id: "sample-1",
      status: "COLLECTED",
      notes: null,
      sampleNo: "SMP-TEST-001",
      labRequestId: "request-1",
      labRequest: { requestedById: "clinician-1" },
    })
    mocks.findSampleDetail.mockResolvedValue({ id: "sample-1" })
    mocks.serializeLabSampleDetail.mockResolvedValue({
      id: "sample-1",
      labRequestId: "request-1",
      status: "RECEIVED",
    })
  })

  it("marks a facility sample received in a short bounded transaction", async () => {
    const tx = {
      labSample: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const response = await PATCH(request(), {
      params: Promise.resolve({ sampleId: "sample-1" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5_000,
      timeout: 15_000,
    })
    expect(tx.labSample.updateMany).toHaveBeenCalledWith({
      where: {
        id: "sample-1",
        status: "COLLECTED",
        labRequest: {
          patient: { registeredFacilityId: "facility-1" },
        },
      },
      data: {
        status: "RECEIVED",
        notes: undefined,
        receivedById: "tech-1",
        receivedAt: expect.any(Date),
      },
    })
    expect(mocks.writeLaboratoryAuditLog).toHaveBeenCalledTimes(1)
    expect(mocks.findSampleDetail).toHaveBeenCalledWith({
      where: { id: "sample-1" },
      include: {},
    })
    expect(mocks.findSampleDetail.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.transaction.mock.invocationCallOrder[0]
    )
  })

  it("returns a stable public code for unexpected database failures", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.findSample.mockRejectedValue(
      new Error("Transaction API error: internal database details")
    )

    const response = await PATCH(request(), {
      params: Promise.resolve({ sampleId: "sample-1" }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      success: false,
      message: "Sample could not be updated.",
      code: "SAMPLE_UPDATE_FAILED",
    })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

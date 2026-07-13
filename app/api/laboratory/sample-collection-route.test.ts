import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findRequest: vi.fn(),
  findSample: vi.fn(),
  requireLaboratoryApi: vi.fn(),
  serializeLabSample: vi.fn(),
  writeLaboratoryAuditLog: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    labRequest: { findFirst: mocks.findRequest },
    labSample: { findUniqueOrThrow: mocks.findSample },
  },
}))

vi.mock("@/lib/laboratory", () => ({
  generateSampleNo: () => "SMP-TEST-001",
  laboratoryRequestScope: (facilityId: string) => ({
    patient: { registeredFacilityId: facilityId },
  }),
  laboratorySampleInclude: {},
  requireLaboratoryApi: mocks.requireLaboratoryApi,
  serializeLabSample: mocks.serializeLabSample,
  writeLaboratoryAuditLog: mocks.writeLaboratoryAuditLog,
}))

import { POST } from "@/app/api/laboratory/requests/[id]/samples/route"

function request() {
  return new NextRequest(
    "https://khms.test/api/laboratory/requests/request-1/samples",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sampleType: "Whole Blood EDTA", notes: null }),
    }
  )
}

describe("laboratory sample collection route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireLaboratoryApi.mockResolvedValue({
      staff: { id: "tech-1", facilityId: "facility-1" },
      response: null,
    })
    mocks.findRequest.mockResolvedValue({
      requestNo: "LAB-001",
      status: "REQUESTED",
    })
    mocks.findSample.mockResolvedValue({ id: "sample-1" })
    mocks.serializeLabSample.mockReturnValue({
      id: "sample-1",
      sampleNo: "SMP-TEST-001",
    })
  })

  it("commits only the status, sample, and audits with a bounded timeout", async () => {
    const tx = {
      labRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      labSample: {
        create: vi.fn().mockResolvedValue({
          id: "sample-1",
          sampleNo: "SMP-TEST-001",
          status: "COLLECTED",
          sampleType: "Whole Blood EDTA",
        }),
      },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const response = await POST(request(), {
      params: Promise.resolve({ id: "request-1" }),
    })

    expect(response.status).toBe(201)
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5_000,
      timeout: 15_000,
    })
    expect(tx.labRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "request-1",
        status: "REQUESTED",
        patient: { registeredFacilityId: "facility-1" },
      },
      data: { status: "SAMPLE_COLLECTED" },
    })
    expect(mocks.writeLaboratoryAuditLog).toHaveBeenCalledTimes(2)
    expect(mocks.findSample).toHaveBeenCalledWith({
      where: { id: "sample-1" },
      include: {},
    })
    expect(mocks.findSample.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.transaction.mock.invocationCallOrder[0]
    )
  })

  it("does not expose internal database errors to the client", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.findRequest.mockRejectedValue(
      new Error("Transaction API error: database connection details")
    )

    const response = await POST(request(), {
      params: Promise.resolve({ id: "request-1" }),
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      success: false,
      message: "Sample could not be collected.",
      code: "SAMPLE_COLLECTION_FAILED",
    })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})

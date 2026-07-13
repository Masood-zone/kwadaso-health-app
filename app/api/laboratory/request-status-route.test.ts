import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findRequest: vi.fn(),
  findRequestDetail: vi.fn(),
  requireLaboratoryApi: vi.fn(),
  serializeLabRequest: vi.fn(),
  writeLaboratoryAuditLog: vi.fn(),
  reconcileEncounter: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    labRequest: {
      findFirst: mocks.findRequest,
      findUniqueOrThrow: mocks.findRequestDetail,
    },
  },
}))

vi.mock("@/lib/laboratory", () => ({
  canTransitionRequest: (from: string, to: string) =>
    from === "SAMPLE_COLLECTED" && to === "PROCESSING",
  ensureLaboratoryRequest: vi.fn(),
  laboratoryRequestScope: (facilityId: string) => ({
    patient: { registeredFacilityId: facilityId },
  }),
  laboratoryRequestInclude: {},
  reconcileEncounterAfterLaboratory: mocks.reconcileEncounter,
  requireLaboratoryApi: mocks.requireLaboratoryApi,
  serializeLabRequest: mocks.serializeLabRequest,
  writeLaboratoryAuditLog: mocks.writeLaboratoryAuditLog,
}))

import { PATCH } from "@/app/api/laboratory/requests/[id]/route"

function request() {
  return new NextRequest(
    "https://khms.test/api/laboratory/requests/request-1",
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "PROCESSING" }),
    }
  )
}

describe("laboratory request status route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireLaboratoryApi.mockResolvedValue({
      staff: { id: "tech-1", facilityId: "facility-1" },
      response: null,
    })
    mocks.findRequest.mockResolvedValue({
      status: "SAMPLE_COLLECTED",
      requestNo: "LAB-001",
      encounterId: "encounter-1",
      samples: [{ status: "RECEIVED" }],
    })
    mocks.findRequestDetail.mockResolvedValue({ id: "request-1" })
    mocks.serializeLabRequest.mockResolvedValue({
      id: "request-1",
      status: "PROCESSING",
    })
  })

  it("starts processing in a short facility-scoped transaction", async () => {
    const tx = {
      labRequest: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const response = await PATCH(request(), {
      params: Promise.resolve({ id: "request-1" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 5_000,
      timeout: 15_000,
    })
    expect(tx.labRequest.updateMany).toHaveBeenCalledWith({
      where: {
        id: "request-1",
        status: "SAMPLE_COLLECTED",
        patient: { registeredFacilityId: "facility-1" },
      },
      data: { status: "PROCESSING" },
    })
    expect(mocks.writeLaboratoryAuditLog).toHaveBeenCalledTimes(1)
    expect(mocks.findRequestDetail).toHaveBeenCalledWith({
      where: { id: "request-1" },
      include: {},
    })
  })

  it("keeps processing blocked until a usable sample is received", async () => {
    mocks.findRequest.mockResolvedValue({
      status: "SAMPLE_COLLECTED",
      requestNo: "LAB-001",
      encounterId: "encounter-1",
      samples: [{ status: "COLLECTED" }],
    })

    const response = await PATCH(request(), {
      params: Promise.resolve({ id: "request-1" }),
    })

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: "SAMPLE_REQUIRED" })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
})

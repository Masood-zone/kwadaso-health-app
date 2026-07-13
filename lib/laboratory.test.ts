import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

import {
  calculateParameterFlags,
  canTransitionRequest,
  canTransitionSample,
  generateResultNo,
  generateSampleNo,
  getMissingRequiredParameters,
  hasLaboratoryPermission,
  laboratoryRequestScope,
  pageData,
  parsePagination,
  reconcileEncounterAfterLaboratory,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"

describe("laboratory workflow policies", () => {
  it("enforces request and sample lifecycle transitions", () => {
    expect(canTransitionRequest("REQUESTED", "SAMPLE_COLLECTED")).toBe(true)
    expect(canTransitionRequest("COMPLETED", "PROCESSING")).toBe(false)
    expect(canTransitionSample("COLLECTED", "REJECTED")).toBe(true)
    expect(canTransitionSample("STORED", "RECEIVED")).toBe(false)
  })

  it("derives abnormal and critical flags from numeric thresholds", () => {
    expect(
      calculateParameterFlags("7.2", {
        referenceLow: 3.5,
        referenceHigh: 5.1,
        criticalHigh: 6.5,
      })
    ).toEqual({ isAbnormal: true, isCritical: true })
    expect(calculateParameterFlags("negative", null, { isAbnormal: true })).toEqual({
      isAbnormal: true,
      isCritical: false,
    })
  })

  it("requires every active required catalog parameter", () => {
    const missing = getMissingRequiredParameters(
      [
        { id: "hgb", name: "Hemoglobin", isRequired: true, isActive: true },
        { id: "comment", name: "Comment", isRequired: false, isActive: true },
      ],
      [{ parameterDefinitionId: "hgb", parameterName: "Hemoglobin", value: "" }]
    )
    expect(missing).toEqual(["Hemoglobin"])
  })

  it("generates scanner-safe unique identifiers", () => {
    expect(generateSampleNo()).toMatch(/^SMP-\d{14}-[A-F0-9-]{8}$/)
    expect(generateResultNo()).toMatch(/^RES-\d{14}-[A-F0-9-]{8}$/)
    expect(generateSampleNo()).not.toBe(generateSampleNo())
  })

  it("wraps paginated data consistently", () => {
    expect(pageData(["one"], 3, 2, 1)).toEqual({
      items: ["one"],
      total: 3,
      page: 2,
      pageSize: 1,
    })
  })

  it("caps page size and rejects non-positive pagination values", () => {
    expect(parsePagination(new URLSearchParams("page=-4&pageSize=999"))).toEqual({
      page: 1,
      pageSize: 100,
      skip: 0,
    })
  })

  it("scopes requests through both registration and encounter facilities", () => {
    expect(laboratoryRequestScope("facility-1")).toEqual({
      patient: { registeredFacilityId: "facility-1" },
      AND: [{ OR: [{ encounterId: null }, { encounter: { facilityId: "facility-1" } }] }],
    })
  })

  it("checks nested role permissions for catalog management", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "role-permission-1" })
    const allowed = await hasLaboratoryPermission(
      {
        id: "tech-1",
        defaultRole: "LAB_TECHNICIAN",
        roles: [{ roleId: "lab-role" }],
      } as never,
      "laboratory.manage",
      { rolePermission: { findFirst } } as never
    )
    expect(allowed).toBe(true)
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        roleId: { in: ["lab-role"] },
        permission: { key: "laboratory.manage" },
      },
      select: { id: true },
    })
  })

  it("reconciles the encounter and queue only after the final active request closes", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit" })
    const updateEncounter = vi.fn().mockResolvedValue({})
    const updateQueue = vi.fn().mockResolvedValue({ count: 1 })
    const tx = {
      labRequest: { count: vi.fn().mockResolvedValue(0) },
      encounter: {
        findUnique: vi.fn().mockResolvedValue({ id: "enc-1", status: "AWAITING_LAB", queueId: "queue-1" }),
        update: updateEncounter,
      },
      patientQueue: { updateMany: updateQueue },
      auditLog: { create },
    }
    await reconcileEncounterAfterLaboratory(tx as never, "enc-1", {
      request: new NextRequest("https://khms.test/api/laboratory/results/result-1/release"),
      actor: { id: "tech-1" },
    })
    expect(updateEncounter).toHaveBeenCalledWith({ where: { id: "enc-1" }, data: { status: "IN_PROGRESS" } })
    expect(updateQueue).toHaveBeenCalledWith({
      where: { id: "queue-1", status: "AWAITING_LAB" },
      data: { status: "WITH_CLINICIAN" },
    })
    expect(create).toHaveBeenCalledTimes(2)
  })

  it("leaves the encounter awaiting laboratory while another request is active", async () => {
    const findUnique = vi.fn()
    await reconcileEncounterAfterLaboratory(
      {
        labRequest: { count: vi.fn().mockResolvedValue(1) },
        encounter: { findUnique },
      } as never,
      "enc-1",
      {
        request: new NextRequest("https://khms.test/api/laboratory/requests/request-1"),
        actor: { id: "tech-1" },
      }
    )
    expect(findUnique).not.toHaveBeenCalled()
  })

  it("writes actor and request metadata through the supplied transaction", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" })
    const request = new NextRequest("https://khms.test/api/laboratory/samples", {
      headers: { "x-forwarded-for": "192.0.2.20", "user-agent": "vitest" },
    })
    await writeLaboratoryAuditLog({
      client: { auditLog: { create } } as never,
      request,
      actor: { id: "tech-1" },
      action: "CREATE",
      entityType: "LabSample",
      entityId: "sample-1",
      description: "Collected sample",
    })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "tech-1",
        ipAddress: "192.0.2.20",
        userAgent: "vitest",
      }),
    })
  })
})

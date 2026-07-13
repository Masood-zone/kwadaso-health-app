import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"

import {
  canMutateAssignedRecord,
  canTransitionEncounter,
  canTransitionQueue,
  generateEncounterNo,
  getCompletionState,
  writeClinicianAuditLog,
} from "@/lib/clinician"

describe("clinician workflow policies", () => {
  it("allows only the claimed clinician to mutate a record", () => {
    expect(canMutateAssignedRecord(null, "doctor-1")).toBe(false)
    expect(canMutateAssignedRecord("doctor-1", "doctor-1")).toBe(true)
    expect(canMutateAssignedRecord("doctor-1", "doctor-2")).toBe(false)
  })

  it("enforces encounter and queue transition matrices", () => {
    expect(canTransitionEncounter("IN_PROGRESS", "AWAITING_LAB")).toBe(true)
    expect(canTransitionEncounter("COMPLETED", "IN_PROGRESS")).toBe(false)
    expect(canTransitionQueue("WITH_CLINICIAN", "AWAITING_PHARMACY")).toBe(true)
    expect(canTransitionQueue("COMPLETED", "WITH_CLINICIAN")).toBe(false)
  })

  it("requires a signed note and primary diagnosis for completion", () => {
    expect(
      getCompletionState({
        hasSignedNote: false,
        hasPrimaryDiagnosis: false,
        pendingLabCount: 1,
        hasFollowUp: false,
        hasReferral: false,
      })
    ).toEqual({
      blockers: [
        "A signed clinical note is required.",
        "A primary diagnosis is required.",
      ],
      warnings: [
        "1 laboratory request(s) are still pending.",
        "No follow-up appointment or referral has been recorded.",
      ],
      canComplete: false,
    })
    expect(
      getCompletionState({
        hasSignedNote: true,
        hasPrimaryDiagnosis: true,
        pendingLabCount: 0,
        hasFollowUp: true,
        hasReferral: false,
      }).canComplete
    ).toBe(true)
  })

  it("generates unique encounter identifiers", () => {
    expect(generateEncounterNo()).not.toBe(generateEncounterNo())
    expect(generateEncounterNo()).toMatch(/^ENC-\d{14}-[A-F0-9-]{8}$/)
  })

  it("writes actor and request metadata into audit records", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" })
    const request = new NextRequest(
      "https://khms.test/api/clinician/encounters",
      {
        headers: { "x-forwarded-for": "192.0.2.10", "user-agent": "vitest" },
      }
    )
    await writeClinicianAuditLog({
      client: { auditLog: { create } } as never,
      request,
      actor: { id: "doctor-1" } as never,
      action: "CREATE",
      entityType: "Encounter",
      entityId: "encounter-1",
      description: "Started encounter",
    })
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: "doctor-1",
        entityId: "encounter-1",
        ipAddress: "192.0.2.10",
        userAgent: "vitest",
      }),
    })
  })
})

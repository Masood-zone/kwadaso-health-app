import { beforeEach, describe, expect, it, vi } from "vitest"

const db = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  departmentFindMany: vi.fn(),
  auditLogFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: db.queryRaw,
    department: { findMany: db.departmentFindMany },
    auditLog: { findMany: db.auditLogFindMany },
  },
}))

import { loadHospitalAdminDashboard } from "@/lib/dashboard-loaders/hospital-admin"
import type { AuthenticatedStaff } from "@/lib/auth-session"

const actor = {
  id: "user-1",
  facilityId: "facility-1",
  facility: { id: "facility-1", name: "Kwadaso Hospital" },
} as AuthenticatedStaff

beforeEach(() => {
  vi.clearAllMocks()
  db.queryRaw.mockResolvedValue([])
  db.departmentFindMany.mockResolvedValue([])
  db.auditLogFindMany.mockResolvedValue([])
})

describe("hospital admin dashboard loader", () => {
  it("preserves the empty dashboard contract with three bounded calls", async () => {
    const result = await loadHospitalAdminDashboard(
      actor,
      new Date("2026-07-14T12:00:00.000Z")
    )

    expect(result.facilityName).toBe("Kwadaso Hospital")
    expect(result.metrics.map((metric) => metric.value)).toEqual([
      "0",
      "0",
      "0",
      "GHS 0",
    ])
    expect(result.departments).toEqual([])
    expect(db.queryRaw).toHaveBeenCalledTimes(1)
    expect(db.departmentFindMany).toHaveBeenCalledTimes(1)
    expect(db.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    )
  })

  it("scopes reads to the authenticated facility", async () => {
    await loadHospitalAdminDashboard(actor)

    expect(db.departmentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { facilityId: "facility-1", isActive: true } })
    )
    expect(db.auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { actor: { facilityId: "facility-1" } } })
    )
    expect(db.queryRaw.mock.calls[0]).toContain("facility-1")
  })
})

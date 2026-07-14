import "dotenv/config"

import { performance } from "node:perf_hooks"

import type { AuthenticatedStaff } from "@/lib/auth-session"
import { loadBillingDashboard } from "@/lib/dashboard-loaders/billing"
import { loadClinicianDashboard } from "@/lib/dashboard-loaders/clinician"
import { loadHospitalAdminDashboard } from "@/lib/dashboard-loaders/hospital-admin"
import { loadLaboratoryDashboard } from "@/lib/dashboard-loaders/laboratory"
import { loadNurseDashboard } from "@/lib/dashboard-loaders/nurse"
import { loadPharmacyDashboard } from "@/lib/dashboard-loaders/pharmacy"
import { loadRecordsOfficerDashboard } from "@/lib/dashboard-loaders/records-officer"
import { loadSuperAdminDashboardSummary } from "@/lib/dashboard-loaders/super-admin"
import { prisma } from "@/lib/prisma"
import type { StaffRole } from "@/lib/generated/prisma/enums"

type DashboardCase = {
  role: StaffRole
  expectedQueries: number
  load: (actor: AuthenticatedStaff) => Promise<unknown>
}

const dashboards: DashboardCase[] = [
  { role: "SUPER_ADMIN", expectedQueries: 4, load: loadSuperAdminDashboardSummary },
  { role: "HOSPITAL_ADMIN", expectedQueries: 3, load: loadHospitalAdminDashboard },
  { role: "RECORDS_OFFICER", expectedQueries: 4, load: loadRecordsOfficerDashboard },
  { role: "NURSE", expectedQueries: 4, load: loadNurseDashboard },
  { role: "DOCTOR", expectedQueries: 4, load: loadClinicianDashboard },
  { role: "LAB_TECHNICIAN", expectedQueries: 3, load: loadLaboratoryDashboard },
  { role: "PHARMACIST", expectedQueries: 3, load: loadPharmacyDashboard },
  { role: "BILLING_OFFICER", expectedQueries: 3, load: loadBillingDashboard },
]

const actorSelect = {
  id: true,
  staffId: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  otherNames: true,
  phone: true,
  jobTitle: true,
  defaultRole: true,
  status: true,
  facilityId: true,
  departmentId: true,
  facility: { select: { id: true, name: true } },
  department: { select: { id: true, name: true, type: true, isActive: true } },
  roles: { select: { roleId: true } },
} as const

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.ceil((percentileValue / 100) * sorted.length) - 1]
}

async function main() {
  const runs = Math.max(2, Number(process.env.PERF_RUNS ?? 5))
  const results = []
  const selectedRole = process.env.PERF_ROLE as StaffRole | undefined
  const selectedDashboards = selectedRole
    ? dashboards.filter((dashboard) => dashboard.role === selectedRole)
    : dashboards

  if (!selectedDashboards.length) {
    throw new Error(`Unknown PERF_ROLE: ${selectedRole}`)
  }

  for (const dashboard of selectedDashboards) {
    const actor = await prisma.user.findFirst({
      where: { defaultRole: dashboard.role, status: "ACTIVE" },
      select: actorSelect,
    })
    if (!actor) {
      results.push({ role: dashboard.role, skipped: "No active seeded user" })
      continue
    }

    const samples: number[] = []
    for (let iteration = 0; iteration < runs; iteration += 1) {
      const startedAt = performance.now()
      await dashboard.load(actor as unknown as AuthenticatedStaff)
      samples.push(Math.round((performance.now() - startedAt) * 10) / 10)
    }

    results.push({
      role: dashboard.role,
      coldMs: samples[0],
      warmP50Ms: percentile(samples.slice(1), 50),
      warmP95Ms: percentile(samples.slice(1), 95),
      expectedPrismaQueries: dashboard.expectedQueries,
      samples: samples.length,
    })
  }

  console.table(results)
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Dashboard benchmark failed")
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

import type { NextRequest } from "next/server"

import { billingOk, getBillingLookups, withBilling } from "@/lib/billing"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withBilling(request, async (actor) => {
    const [departments, billingOfficers, approvingOfficers] = await Promise.all([
      prisma.department.findMany({ where: { facilityId: actor.facilityId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { facilityId: actor.facilityId, status: "ACTIVE", defaultRole: "BILLING_OFFICER" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.user.findMany({ where: { facilityId: actor.facilityId, status: "ACTIVE", defaultRole: { in: ["HOSPITAL_ADMIN", "SUPER_ADMIN", "BILLING_OFFICER"] } }, select: { id: true, name: true, defaultRole: true }, orderBy: { name: "asc" } }),
    ])
    return billingOk({
      ...getBillingLookups(),
      departments,
      billingOfficers,
      approvingOfficers: approvingOfficers.map((item) => ({ id: item.id, name: item.name, role: item.defaultRole })),
    })
  })
}

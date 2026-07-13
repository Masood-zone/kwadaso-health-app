import type { NextRequest } from "next/server"
import type { Prisma } from "@/lib/generated/prisma/client"
import { pharmacyOk, pharmacyPage, parsePharmacyPagination, serializePharmacyNotification, withPharmacy } from "@/lib/pharmacy"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => { const params = request.nextUrl.searchParams; const { page, pageSize, skip } = parsePharmacyPagination(params); const status = params.get("status"); const where: Prisma.NotificationWhereInput = { facilityId: actor.facilityId, type: { in: ["MESSAGE", "STOCK", "SYSTEM"] }, ...(status ? { status: status as never } : {}), OR: [{ recipientId: actor.id }, { targetRole: "PHARMACIST" }, ...(actor.departmentId ? [{ targetDepartmentId: actor.departmentId }] : [])] }; const [rows, total] = await Promise.all([prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: pageSize }), prisma.notification.count({ where })]); return pharmacyOk(pharmacyPage(rows.map(serializePharmacyNotification), total, page, pageSize)) })
}


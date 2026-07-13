import type { NextRequest } from "next/server"
import type { Prisma } from "@/lib/generated/prisma/client"
import { pharmacyOk, pharmacyPage, parsePharmacyPagination, serializeMedication, withPharmacy, writePharmacyAuditLog } from "@/lib/pharmacy"
import { medicationCreateSchema } from "@/lib/pharmacy-schemas"
import { AuditAction } from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const params = request.nextUrl.searchParams; const { page, pageSize, skip } = parsePharmacyPagination(params)
    const search = params.get("search")?.trim(); const category = params.get("category"); const dosageForm = params.get("dosageForm"); const active = params.get("active")
    const where: Prisma.MedicationWhereInput = { facilityId: actor.facilityId, ...(search ? { OR: [{ code: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } }, { genericName: { contains: search, mode: "insensitive" } }] } : {}), ...(category ? { category } : {}), ...(dosageForm ? { dosageForm } : {}), ...(active === "true" || active === "false" ? { isActive: active === "true" } : {}) }
    const [rows, total] = await Promise.all([prisma.medication.findMany({ where, include: { stocks: { where: { facilityId: actor.facilityId } } }, orderBy: { name: "asc" }, skip, take: pageSize }), prisma.medication.count({ where })])
    return pharmacyOk(pharmacyPage(rows.map(serializeMedication), total, page, pageSize))
  })
}

export async function POST(request: NextRequest) {
  return withPharmacy(request, async (actor) => {
    const parsed = medicationCreateSchema.safeParse(await request.json())
    if (!parsed.success) return Response.json({ success: false, message: "Medication details are invalid.", errors: parsed.error.flatten().fieldErrors }, { status: 400 })
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.medication.create({ data: { facilityId: actor.facilityId, ...parsed.data }, include: { stocks: true } })
      await writePharmacyAuditLog({ client: tx, request, actor, action: AuditAction.CREATE, entityType: "Medication", entityId: created.id, description: `Created medication ${created.name}`, after: { code: created.code, name: created.name, reorderLevel: created.reorderLevel } })
      return created
    })
    return pharmacyOk(serializeMedication(row), "Medication created.", 201)
  })
}


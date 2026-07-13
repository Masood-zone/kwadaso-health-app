import { NextRequest } from "next/server"
import { z } from "zod"

import type { Prisma } from "@/lib/generated/prisma/client"
import {
  hasLaboratoryPermission,
  pageData,
  parsePagination,
  requireLaboratoryApi,
  serializeCatalog,
  writeLaboratoryAuditLog,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import { laboratoryCatalogSchema } from "@/lib/laboratory-schemas"
import type { ApiResponse } from "@/types"
import type { LabTestCatalogItem, LaboratoryPage } from "@/types/laboratory"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const params = request.nextUrl.searchParams
  const { page, pageSize, skip } = parsePagination(params)
  const search = params.get("search")?.trim()
  const category = params.get("category")
  const active = params.get("active")
  const where: Prisma.LabTestCatalogWhereInput = {
    facilityId: actor!.facilityId,
    ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { code: { contains: search, mode: "insensitive" } }] } : {}),
    ...(category ? { category } : {}),
    ...(active ? { isActive: active === "true" } : {}),
  }
  const [rows, total] = await Promise.all([
    prisma.labTestCatalog.findMany({
      where,
      include: { parameterDefinitions: true, _count: { select: { requestTests: true } } },
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.labTestCatalog.count({ where }),
  ])
  return Response.json({ success: true, data: pageData(rows.map(serializeCatalog), total, page, pageSize) } satisfies ApiResponse<LaboratoryPage<LabTestCatalogItem>>)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  if (!(await hasLaboratoryPermission(actor!, "laboratory.manage"))) {
    return Response.json({ success: false, message: "Catalog management permission is required.", code: "FORBIDDEN" }, { status: 403 })
  }
  const parsed = laboratoryCatalogSchema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ success: false, message: "Test catalog details are invalid.", errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 })
  try {
    const created = await prisma.$transaction(async (tx) => {
      const test = await tx.labTestCatalog.create({
        data: {
          facilityId: actor!.facilityId,
          code: parsed.data.code,
          name: parsed.data.name,
          category: parsed.data.category,
          sampleType: parsed.data.sampleType,
          unit: parsed.data.unit,
          referenceRange: parsed.data.referenceRange,
          price: parsed.data.price,
          turnaroundHours: parsed.data.turnaroundHours,
          isActive: parsed.data.isActive,
          parameterDefinitions: { create: parsed.data.parameters },
        },
      })
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: "CREATE",
        entityType: "LabTestCatalog",
        entityId: test.id,
        description: `Created laboratory test ${test.code} - ${test.name}`,
        after: { code: test.code, name: test.name, parameterCount: parsed.data.parameters.length, isActive: test.isActive },
      })
      return tx.labTestCatalog.findUniqueOrThrow({ where: { id: test.id }, include: { parameterDefinitions: true, _count: { select: { requestTests: true } } } })
    })
    return Response.json({ success: true, data: serializeCatalog(created) } satisfies ApiResponse<LabTestCatalogItem>, { status: 201 })
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "UNKNOWN"
    if (code === "P2002") return Response.json({ success: false, message: "A test with this code or parameter name already exists.", code: "DUPLICATE" }, { status: 409 })
    return Response.json({ success: false, message: "Test could not be created." }, { status: 500 })
  }
}

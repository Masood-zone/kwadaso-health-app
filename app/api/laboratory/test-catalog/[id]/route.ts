import { NextRequest } from "next/server"
import { z } from "zod"

import { hasLaboratoryPermission, requireLaboratoryApi, serializeCatalog, writeLaboratoryAuditLog } from "@/lib/laboratory"
import { laboratoryCatalogSchema } from "@/lib/laboratory-schemas"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LabTestCatalogItem } from "@/types/laboratory"

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  if (!(await hasLaboratoryPermission(actor!, "laboratory.manage"))) {
    return Response.json({ success: false, message: "Catalog management permission is required.", code: "FORBIDDEN" }, { status: 403 })
  }
  const { id } = await context.params
  const parsed = laboratoryCatalogSchema.partial().safeParse(await request.json())
  if (!parsed.success) return Response.json({ success: false, message: "Test catalog update is invalid.", errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 })
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.labTestCatalog.findFirst({
        where: { id, facilityId: actor!.facilityId },
        include: { parameterDefinitions: true },
      })
      if (!before) throw new Error("NOT_FOUND")
      await tx.labTestCatalog.update({
        where: { id },
        data: {
          code: parsed.data.code,
          name: parsed.data.name,
          category: parsed.data.category,
          sampleType: parsed.data.sampleType,
          unit: parsed.data.unit,
          referenceRange: parsed.data.referenceRange,
          price: parsed.data.price,
          turnaroundHours: parsed.data.turnaroundHours,
          isActive: parsed.data.isActive,
        },
      })
      if (parsed.data.parameters) {
        await tx.labTestParameterDefinition.deleteMany({ where: { labTestCatalogId: id } })
        if (parsed.data.parameters.length) {
          await tx.labTestParameterDefinition.createMany({
            data: parsed.data.parameters.map((item) => ({ ...item, labTestCatalogId: id })),
          })
        }
      }
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: "UPDATE",
        entityType: "LabTestCatalog",
        entityId: id,
        description: `Updated laboratory test ${before.code} - ${before.name}`,
        before: { code: before.code, name: before.name, isActive: before.isActive, parameterCount: before.parameterDefinitions.length },
        after: { code: parsed.data.code ?? before.code, name: parsed.data.name ?? before.name, isActive: parsed.data.isActive ?? before.isActive, parameterCount: parsed.data.parameters?.length ?? before.parameterDefinitions.length },
      })
      return tx.labTestCatalog.findUniqueOrThrow({ where: { id }, include: { parameterDefinitions: true, _count: { select: { requestTests: true } } } })
    })
    return Response.json({ success: true, data: serializeCatalog(updated) } satisfies ApiResponse<LabTestCatalogItem>)
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    if (code === "NOT_FOUND") return Response.json({ success: false, message: "Test was not found." }, { status: 404 })
    const prismaCode = typeof error === "object" && error && "code" in error ? String(error.code) : null
    if (prismaCode === "P2002") return Response.json({ success: false, message: "A test with this code or parameter name already exists." }, { status: 409 })
    return Response.json({ success: false, message: "Test could not be updated." }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  if (!(await hasLaboratoryPermission(actor!, "laboratory.manage"))) {
    return Response.json({ success: false, message: "Catalog management permission is required.", code: "FORBIDDEN" }, { status: 403 })
  }
  const { id } = await context.params
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.labTestCatalog.findFirst({ where: { id, facilityId: actor!.facilityId } })
      if (!before) throw new Error("NOT_FOUND")
      const changed = await tx.labTestCatalog.updateMany({
        where: { id, facilityId: actor!.facilityId, isActive: true },
        data: { isActive: false },
      })
      if (!changed.count && before.isActive) throw new Error("STALE")
      await writeLaboratoryAuditLog({
        client: tx,
        request,
        actor: actor!,
        action: "DELETE",
        entityType: "LabTestCatalog",
        entityId: id,
        description: `Deactivated laboratory test ${before.code} - ${before.name}`,
        before: { isActive: before.isActive },
        after: { isActive: false, softDelete: true },
      })
      return tx.labTestCatalog.findUniqueOrThrow({ where: { id }, include: { parameterDefinitions: true, _count: { select: { requestTests: true } } } })
    })
    return Response.json({ success: true, data: serializeCatalog(updated) } satisfies ApiResponse<LabTestCatalogItem>)
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN"
    if (code === "NOT_FOUND") return Response.json({ success: false, message: "Test was not found." }, { status: 404 })
    if (code === "STALE") return Response.json({ success: false, message: "The test changed while it was being deactivated." }, { status: 409 })
    return Response.json({ success: false, message: "Test could not be deactivated." }, { status: 500 })
  }
}

import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireHospitalAdminApi,
  serializeHospitalAdminDepartment,
  writeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const departmentSchema = z.object({
  code: z.string().trim().min(2).max(24),
  name: z.string().trim().min(2),
  description: z.string().trim().optional().nullable(),
  type: z.enum([
    "ADMINISTRATION",
    "RECORDS",
    "OPD",
    "EMERGENCY",
    "TRIAGE",
    "GENERAL_CONSULTATION",
    "MATERNAL_CHILD_HEALTH",
    "LABORATORY",
    "PHARMACY",
    "BILLING",
    "PUBLIC_HEALTH",
    "OTHER",
  ]),
  isActive: z.boolean(),
})

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const { id } = await context.params
  const parsed = departmentSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Department details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.department.findFirst({
    where: { id, facilityId: actor!.facilityId },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Department was not found." },
      { status: 404 }
    )
  }

  const values = parsed.data
  try {
    const department = await prisma.department.update({
      where: { id },
      data: {
        ...values,
        code: values.code.toUpperCase(),
        description: values.description || null,
      },
      include: { _count: { select: { staff: true } } },
    })

    await writeHospitalAdminAuditLog({
      request,
      actor: actor!,
      action: "UPDATE",
      entityType: "Department",
      entityId: department.id,
      description: `Updated department ${department.name}`,
      before: {
        code: before.code,
        name: before.name,
        description: before.description,
        type: before.type,
        isActive: before.isActive,
      },
      after: {
        code: department.code,
        name: department.name,
        description: department.description,
        type: department.type,
        isActive: department.isActive,
      },
    })

    return Response.json({
      success: true,
      data: serializeHospitalAdminDepartment(department),
    } satisfies ApiResponse)
  } catch (error) {
    console.error("Failed to update hospital department", error)
    return Response.json(
      {
        success: false,
        message: "Department could not be updated. Code must be unique.",
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
}

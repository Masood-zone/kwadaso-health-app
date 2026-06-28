import { NextRequest } from "next/server"
import { z } from "zod"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { serializeDepartment, writeAuditLog } from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

const updateDepartmentSchema = z.object({
  code: z.string().trim().min(2).max(24),
  name: z.string().trim().min(2),
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
  const { staff: actor, response } = await requireRoleApi(request, [
    "SUPER_ADMIN",
  ])
  if (response) return response

  const { id } = await context.params
  const parsed = updateDepartmentSchema.safeParse(await request.json())
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

  const before = await prisma.department.findUnique({ where: { id } })
  if (!before) {
    return Response.json(
      { success: false, message: "Department was not found." },
      { status: 404 }
    )
  }

  try {
    const department = await prisma.department.update({
      where: { id },
      data: { ...parsed.data, code: parsed.data.code.toUpperCase() },
      include: { _count: { select: { staff: true } } },
    })

    await writeAuditLog({
      request,
      actor: actor!,
      action: "UPDATE",
      entityType: "Department",
      entityId: department.id,
      description: `Updated department ${department.name}`,
      before: {
        code: before.code,
        name: before.name,
        type: before.type,
        isActive: before.isActive,
      },
      after: {
        code: department.code,
        name: department.name,
        type: department.type,
        isActive: department.isActive,
      },
    })

    return Response.json({
      success: true,
      data: serializeDepartment(department),
    } satisfies ApiResponse)
  } catch (error) {
    console.error("Failed to update department", error)
    return Response.json(
      {
        success: false,
        message: "Department could not be updated. Check that the code is unique.",
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
}

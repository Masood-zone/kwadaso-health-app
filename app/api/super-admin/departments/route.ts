import { NextRequest } from "next/server"
import { z } from "zod"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import { getPrimaryFacility, serializeDepartment, writeAuditLog } from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

const departmentSchema = z.object({
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
  isActive: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  const facility = await getPrimaryFacility()
  if (!facility) {
    return Response.json({ success: true, data: [] } satisfies ApiResponse)
  }

  const departments = await prisma.department.findMany({
    where: { facilityId: facility.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { staff: true } } },
  })

  return Response.json({
    success: true,
    data: departments.map(serializeDepartment),
  } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireRoleApi(request, [
    "SUPER_ADMIN",
  ])
  if (response) return response

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

  const facility = await getPrimaryFacility()
  if (!facility) {
    return Response.json(
      { success: false, message: "Primary facility is not configured." },
      { status: 500 }
    )
  }

  try {
    const department = await prisma.department.create({
      data: {
        ...parsed.data,
        code: parsed.data.code.toUpperCase(),
        facilityId: facility.id,
      },
      include: { _count: { select: { staff: true } } },
    })

    await writeAuditLog({
      request,
      actor: actor!,
      action: "CREATE",
      entityType: "Department",
      entityId: department.id,
      description: `Created department ${department.name}`,
      after: {
        code: department.code,
        name: department.name,
        type: department.type,
        isActive: department.isActive,
      },
    })

    return Response.json(
      { success: true, data: serializeDepartment(department) } satisfies ApiResponse,
      { status: 201 }
    )
  } catch (error) {
    console.error("Failed to create department", error)
    return Response.json(
      {
        success: false,
        message: "Department could not be created. Check that the code is unique.",
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
}

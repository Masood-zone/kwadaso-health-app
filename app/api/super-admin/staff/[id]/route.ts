import { NextRequest } from "next/server"
import { z } from "zod"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import {
  serializeStaff,
  syncUserPrimaryRole,
  writeAuditLog,
} from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

const updateStaffSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  otherNames: z.string().trim().optional().nullable(),
  email: z.email(),
  phone: z.string().trim().optional().nullable(),
  jobTitle: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().optional().nullable(),
  defaultRole: z.enum([
    "SUPER_ADMIN",
    "HOSPITAL_ADMIN",
    "MUNICIPAL_HEALTH_DIRECTOR",
    "M_AND_E_OFFICER",
    "RECORDS_OFFICER",
    "FRONT_DESK",
    "DOCTOR",
    "PHYSICIAN_ASSISTANT",
    "NURSE",
    "LAB_TECHNICIAN",
    "PHARMACIST",
    "BILLING_OFFICER",
  ]),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]),
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  const { id } = await context.params
  const staff = await prisma.user.findUnique({
    where: { id },
    include: { department: true, facility: true },
  })

  if (!staff) {
    return Response.json(
      { success: false, message: "Staff account was not found." },
      { status: 404 }
    )
  }

  return Response.json({
    success: true,
    data: {
      ...serializeStaff(staff),
      firstName: staff.firstName,
      lastName: staff.lastName,
      otherNames: staff.otherNames,
    },
  } satisfies ApiResponse)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRoleApi(request, [
    "SUPER_ADMIN",
  ])
  if (response) return response

  const { id } = await context.params
  const parsed = updateStaffSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Staff details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await prisma.user.findUnique({
    where: { id },
    include: { department: true, facility: true },
  })

  if (!before) {
    return Response.json(
      { success: false, message: "Staff account was not found." },
      { status: 404 }
    )
  }

  const values = parsed.data
  const name = [values.firstName, values.otherNames, values.lastName]
    .filter(Boolean)
    .join(" ")

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName: values.firstName,
        lastName: values.lastName,
        otherNames: values.otherNames || null,
        name,
        email: values.email,
        phone: values.phone || null,
        jobTitle: values.jobTitle || null,
        departmentId: values.departmentId || null,
        defaultRole: values.defaultRole,
        status: values.status,
      },
      include: { department: true, facility: true },
    })

    await syncUserPrimaryRole(updated.id, values.defaultRole)
    await writeAuditLog({
      request,
      actor: actor!,
      action: "UPDATE",
      entityType: "User",
      entityId: updated.id,
      description: `Updated staff account for ${updated.name}`,
      before: {
        staffId: before.staffId,
        email: before.email,
        defaultRole: before.defaultRole,
        status: before.status,
        departmentId: before.departmentId,
      },
      after: {
        staffId: updated.staffId,
        email: updated.email,
        defaultRole: updated.defaultRole,
        status: updated.status,
        departmentId: updated.departmentId,
      },
    })

    return Response.json({
      success: true,
      data: serializeStaff(updated),
    } satisfies ApiResponse)
  } catch (error) {
    console.error("Failed to update staff", error)
    return Response.json(
      {
        success: false,
        message:
          "Staff account could not be updated. Check the email address and try again.",
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
}

import { hashPassword } from "better-auth/crypto"
import { NextRequest } from "next/server"
import { z } from "zod"

import {
  assertNotSuperAdmin,
  hospitalAdminAssignableRoles,
  requireHospitalAdminApi,
  serializeHospitalAdminStaff,
  writeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import { syncUserPrimaryRole } from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

const staffUpdateSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  otherNames: z.string().trim().optional().nullable(),
  email: z.email(),
  phone: z.string().trim().min(1),
  jobTitle: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().min(1),
  role: z.enum(hospitalAdminAssignableRoles),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]),
  temporaryPassword: z.string().min(8).optional(),
})

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const { id } = await context.params
  const staff = await prisma.user.findFirst({
    where: { id, facilityId: actor!.facilityId },
    include: { department: true },
  })

  if (!staff) {
    return Response.json(
      { success: false, message: "Staff account was not found." },
      { status: 404 }
    )
  }

  return Response.json({
    success: true,
    data: serializeHospitalAdminStaff(staff),
  } satisfies ApiResponse)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireHospitalAdminApi(request, {
    forceFreshSession: true,
  })
  if (response) return response

  const { id } = await context.params
  const parsed = staffUpdateSchema.safeParse(await request.json())
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

  const before = await prisma.user.findFirst({
    where: { id, facilityId: actor!.facilityId },
    include: { department: true },
  })
  if (!before) {
    return Response.json(
      { success: false, message: "Staff account was not found." },
      { status: 404 }
    )
  }

  const values = parsed.data
  if (!assertNotSuperAdmin(values.role)) {
    return Response.json(
      { success: false, message: "Hospital Admin cannot assign Super Admin." },
      { status: 403 }
    )
  }

  const department = await prisma.department.findFirst({
    where: { id: values.departmentId, facilityId: actor!.facilityId },
  })
  if (!department) {
    return Response.json(
      { success: false, message: "Department was not found in this facility." },
      { status: 400 }
    )
  }

  const name = [values.firstName, values.otherNames, values.lastName]
    .filter(Boolean)
    .join(" ")
  const passwordHash = values.temporaryPassword
    ? await hashPassword(values.temporaryPassword)
    : null

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName: values.firstName,
        lastName: values.lastName,
        otherNames: values.otherNames || null,
        name,
        email: values.email,
        phone: values.phone,
        jobTitle: values.jobTitle || null,
        departmentId: values.departmentId,
        defaultRole: values.role,
        status: values.status,
        ...(passwordHash
          ? { passwordHash, passwordChangedAt: new Date() }
          : {}),
      },
      include: { department: true },
    })

    if (passwordHash) {
      await prisma.account.upsert({
        where: { id: `credential:${updated.id}` },
        update: {
          accountId: updated.id,
          providerId: "credential",
          password: passwordHash,
        },
        create: {
          id: `credential:${updated.id}`,
          accountId: updated.id,
          providerId: "credential",
          userId: updated.id,
          password: passwordHash,
        },
      })
    }

    await syncUserPrimaryRole(updated.id, values.role)
    await writeHospitalAdminAuditLog({
      request,
      actor: actor!,
      action: "UPDATE",
      entityType: "User",
      entityId: updated.id,
      description: `Updated staff account for ${updated.name}`,
      before: {
        staffId: before.staffId,
        email: before.email,
        role: before.defaultRole,
        status: before.status,
        departmentId: before.departmentId,
      },
      after: {
        staffId: updated.staffId,
        email: updated.email,
        role: updated.defaultRole,
        status: updated.status,
        departmentId: updated.departmentId,
        passwordReset: Boolean(passwordHash),
      },
    })

    return Response.json({
      success: true,
      data: serializeHospitalAdminStaff(updated),
    } satisfies ApiResponse)
  } catch (error) {
    console.error("Failed to update hospital admin staff", error)
    return Response.json(
      {
        success: false,
        message:
          "Staff could not be updated. Check the email address and try again.",
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
}

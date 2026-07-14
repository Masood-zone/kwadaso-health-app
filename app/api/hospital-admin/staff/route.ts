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
import { generateStaffId } from "@/lib/identifiers"
import { prisma } from "@/lib/prisma"
import { syncUserPrimaryRole } from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

const staffCreateSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  otherNames: z.string().trim().optional().nullable(),
  email: z.email(),
  phone: z.string().trim().min(1),
  jobTitle: z.string().trim().optional().nullable(),
  departmentId: z.string().trim().min(1),
  role: z.enum(hospitalAdminAssignableRoles),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "LOCKED"]),
  temporaryPassword: z.string().min(8),
})

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get("search")?.trim()
  const status = searchParams.get("status")
  const role = searchParams.get("role")
  const departmentId = searchParams.get("departmentId")

  const staff = await prisma.user.findMany({
    where: {
      facilityId: actor!.facilityId,
      ...(status ? { status: status as never } : {}),
      ...(role ? { defaultRole: role as never } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { staffId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { department: true },
  })

  return Response.json({
    success: true,
    data: staff.map(serializeHospitalAdminStaff),
  } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request, {
    forceFreshSession: true,
  })
  if (response) return response

  const parsed = staffCreateSchema.safeParse(await request.json())
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

  const passwordHash = await hashPassword(values.temporaryPassword)
  const staffId = await generateStaffId(values.role)
  const name = [values.firstName, values.otherNames, values.lastName]
    .filter(Boolean)
    .join(" ")

  try {
    const user = await prisma.user.create({
      data: {
        staffId,
        email: values.email,
        passwordHash,
        firstName: values.firstName,
        lastName: values.lastName,
        otherNames: values.otherNames || null,
        name,
        phone: values.phone,
        jobTitle: values.jobTitle || null,
        defaultRole: values.role,
        status: values.status,
        facilityId: actor!.facilityId,
        departmentId: values.departmentId,
        emailVerified: true,
      },
      include: { department: true },
    })

    await prisma.account.upsert({
      where: { id: `credential:${user.id}` },
      update: {
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      },
      create: {
        id: `credential:${user.id}`,
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    })
    await syncUserPrimaryRole(user.id, values.role)
    await writeHospitalAdminAuditLog({
      request,
      actor: actor!,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: `Created staff account for ${user.name}`,
      after: {
        staffId: user.staffId,
        email: user.email,
        role: user.defaultRole,
        status: user.status,
        departmentId: user.departmentId,
      },
    })

    return Response.json(
      {
        success: true,
        data: serializeHospitalAdminStaff(user),
      } satisfies ApiResponse,
      { status: 201 }
    )
  } catch (error) {
    console.error("Failed to create hospital admin staff", error)
    return Response.json(
      {
        success: false,
        message:
          "Staff could not be created. Check the email address and try again.",
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
}

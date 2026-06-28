import { hashPassword } from "better-auth/crypto"
import { NextRequest } from "next/server"
import { z } from "zod"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import {
  getPrimaryFacility,
  serializeStaff,
  syncUserPrimaryRole,
  writeAuditLog,
} from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

const staffSchema = z.object({
  staffId: z.string().trim().min(2),
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
  temporaryPassword: z.string().min(8),
})

export async function GET(request: NextRequest) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get("search")?.trim()
  const status = searchParams.get("status")
  const role = searchParams.get("role")

  const staff = await prisma.user.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(role ? { defaultRole: role as never } : {}),
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
    include: { department: true, facility: true },
  })

  return Response.json({
    success: true,
    data: staff.map(serializeStaff),
  } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireRoleApi(request, [
    "SUPER_ADMIN",
  ])
  if (response) return response

  const parsed = staffSchema.safeParse(await request.json())
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

  const facility = await getPrimaryFacility()
  if (!facility) {
    return Response.json(
      { success: false, message: "Primary facility is not configured." },
      { status: 500 }
    )
  }

  const values = parsed.data
  const passwordHash = await hashPassword(values.temporaryPassword)
  const name = [values.firstName, values.otherNames, values.lastName]
    .filter(Boolean)
    .join(" ")

  try {
    const user = await prisma.user.create({
      data: {
        staffId: values.staffId,
        email: values.email,
        passwordHash,
        firstName: values.firstName,
        lastName: values.lastName,
        otherNames: values.otherNames || null,
        name,
        phone: values.phone || null,
        jobTitle: values.jobTitle || null,
        defaultRole: values.defaultRole,
        status: values.status,
        facilityId: facility.id,
        departmentId: values.departmentId || null,
        emailVerified: true,
      },
      include: { department: true, facility: true },
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

    await syncUserPrimaryRole(user.id, values.defaultRole)
    await writeAuditLog({
      request,
      actor: actor!,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: `Created staff account for ${user.name}`,
      after: {
        staffId: user.staffId,
        email: user.email,
        defaultRole: user.defaultRole,
        status: user.status,
      },
    })

    return Response.json(
      { success: true, data: serializeStaff(user) } satisfies ApiResponse,
      { status: 201 }
    )
  } catch (error) {
    console.error("Failed to create staff", error)
    return Response.json(
      {
        success: false,
        message: "Staff account could not be created. Check unique email and staff ID.",
      } satisfies ApiResponse,
      { status: 400 }
    )
  }
}

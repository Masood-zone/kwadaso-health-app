import { NextRequest } from "next/server"
import { z } from "zod"

import { requireRoleApi } from "@/lib/auth-session"
import { prisma } from "@/lib/prisma"
import {
  getPrimaryFacility,
  getSettingsData,
  systemSettingDefaults,
  writeAuditLog,
} from "@/lib/super-admin"
import type { ApiResponse } from "@/types"

const settingsSchema = z.object({
  facility: z.object({
    code: z.string().trim().min(2),
    name: z.string().trim().min(2),
    type: z.enum([
      "HOSPITAL",
      "HEALTH_CENTRE",
      "CHPS_COMPOUND",
      "CLINIC",
      "MUNICIPAL_DIRECTORATE",
      "LABORATORY",
      "PHARMACY",
    ]),
    phone: z.string().trim().optional().nullable(),
    email: z.union([z.email(), z.literal("")]).optional().nullable(),
    address: z.string().trim().optional().nullable(),
    municipality: z.string().trim().optional().nullable(),
    region: z.string().trim().optional().nullable(),
    isActive: z.boolean(),
  }),
  system: z.object({
    "session.timeoutMinutes": z.coerce.number().int().min(5).max(1440),
    "audit.retentionDays": z.coerce.number().int().min(30).max(3650),
    "patient.numberPrefix": z.string().trim().min(2).max(24),
    "invoice.numberPrefix": z.string().trim().min(2).max(24),
    "appointment.defaultSlotMinutes": z.coerce.number().int().min(5).max(240),
  }),
})

export async function GET(request: NextRequest) {
  const { response } = await requireRoleApi(request, ["SUPER_ADMIN"])
  if (response) return response

  return Response.json({
    success: true,
    data: await getSettingsData(),
  } satisfies ApiResponse)
}

export async function PATCH(request: NextRequest) {
  const { staff: actor, response } = await requireRoleApi(request, [
    "SUPER_ADMIN",
  ])
  if (response) return response

  const parsed = settingsSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Hospital settings are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const before = await getSettingsData()
  const facility = await getPrimaryFacility()
  if (!facility) {
    return Response.json(
      { success: false, message: "Primary facility is not configured." },
      { status: 500 }
    )
  }

  const values = parsed.data
  await prisma.facility.update({
    where: { id: facility.id },
    data: {
      ...values.facility,
      email: values.facility.email || null,
      phone: values.facility.phone || null,
      address: values.facility.address || null,
      municipality: values.facility.municipality || null,
      region: values.facility.region || null,
    },
  })

  await Promise.all(
    Object.keys(systemSettingDefaults).map((key) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: {
          value: values.system[key as keyof typeof systemSettingDefaults],
          updatedById: actor!.id,
        },
        create: {
          key,
          value: values.system[key as keyof typeof systemSettingDefaults],
          description: key.replaceAll(".", " "),
          isPublic: false,
          updatedById: actor!.id,
        },
      })
    )
  )

  const after = await getSettingsData()
  await writeAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "SystemSetting",
    entityId: facility.id,
    description: "Updated hospital profile and core system settings",
    before,
    after,
  })

  return Response.json({
    success: true,
    data: after,
  } satisfies ApiResponse)
}

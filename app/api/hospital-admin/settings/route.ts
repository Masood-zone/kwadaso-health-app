import { NextRequest } from "next/server"
import { z } from "zod"

import {
  getHospitalAdminSettings,
  hospitalAdminSystemSettingDefaults,
  requireHospitalAdminApi,
  writeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const settingsSchema = z.object({
  facility: z.object({
    name: z.string().trim().min(2),
    phone: z.string().trim().optional().nullable(),
    email: z
      .union([z.email(), z.literal("")])
      .optional()
      .nullable(),
    address: z.string().trim().optional().nullable(),
    municipality: z.string().trim().optional().nullable(),
    region: z.string().trim().optional().nullable(),
  }),
  system: z.object({
    "patient.numberPrefix": z.string().trim().min(2).max(24),
    "invoice.numberPrefix": z.string().trim().min(2).max(24),
    "appointment.defaultSlotMinutes": z.coerce.number().int().min(5).max(240),
  }),
})

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  return Response.json({
    success: true,
    data: await getHospitalAdminSettings(actor!.facilityId),
  } satisfies ApiResponse)
}

export async function PATCH(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
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

  const before = await getHospitalAdminSettings(actor!.facilityId)
  const values = parsed.data

  await prisma.facility.update({
    where: { id: actor!.facilityId },
    data: {
      name: values.facility.name,
      phone: values.facility.phone || null,
      email: values.facility.email || null,
      address: values.facility.address || null,
      municipality: values.facility.municipality || null,
      region: values.facility.region || null,
    },
  })

  await Promise.all(
    Object.keys(hospitalAdminSystemSettingDefaults).map((key) =>
      prisma.systemSetting.upsert({
        where: { key },
        update: {
          value:
            values.system[
              key as keyof typeof hospitalAdminSystemSettingDefaults
            ],
          updatedById: actor!.id,
        },
        create: {
          key,
          value:
            values.system[
              key as keyof typeof hospitalAdminSystemSettingDefaults
            ],
          description: key.replaceAll(".", " "),
          isPublic: false,
          updatedById: actor!.id,
        },
      })
    )
  )

  const after = await getHospitalAdminSettings(actor!.facilityId)
  await writeHospitalAdminAuditLog({
    request,
    actor: actor!,
    action: "UPDATE",
    entityType: "SystemSetting",
    entityId: actor!.facilityId,
    description: "Updated hospital profile and operational settings",
    before,
    after,
  })

  return Response.json({ success: true, data: after } satisfies ApiResponse)
}

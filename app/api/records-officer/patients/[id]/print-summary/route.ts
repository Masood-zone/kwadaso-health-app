import { NextRequest } from "next/server"
import { z } from "zod"

import {
  getRecordsPatientProfile,
  requireRecordsOfficerApi,
  writeRecordsOfficerAuditLog,
} from "@/lib/records-officer"
import type { ApiResponse } from "@/types"

const printSchema = z.object({
  action: z.enum(["PRINT", "EXPORT"]),
  sections: z.array(z.string()).default(["biodata", "appointments", "documents"]),
})

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { staff: actor, response } = await requireRecordsOfficerApi(request)
  if (response) return response

  const { id } = await context.params
  const parsed = printSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Print/export request is invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const profile = await getRecordsPatientProfile(id, actor!.facilityId)
  if (!profile) {
    return Response.json({ success: false, message: "Patient was not found." }, { status: 404 })
  }

  await writeRecordsOfficerAuditLog({
    request,
    actor: actor!,
    action: parsed.data.action,
    entityType: "Patient",
    entityId: id,
    description: `${parsed.data.action === "PRINT" ? "Printed" : "Exported"} patient summary ${profile.patientNo}`,
    after: { patientNo: profile.patientNo, sections: parsed.data.sections },
  })

  return Response.json({
    success: true,
    data: { patient: profile, sections: parsed.data.sections, generatedAt: new Date().toISOString() },
  } satisfies ApiResponse)
}

import { NextRequest } from "next/server"
import { z } from "zod"

import {
  requireHospitalAdminApi,
  serializeHospitalAdminReportExport,
  writeHospitalAdminAuditLog,
} from "@/lib/hospital-admin"
import type { Prisma } from "@/lib/generated/prisma/client"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

const reportExportSchema = z.object({
  type: z.enum([
    "HMIS",
    "MORBIDITY",
    "IMMUNIZATION",
    "FINANCIAL",
    "APPOINTMENT",
    "AUDIT",
    "LABORATORY",
    "PHARMACY",
  ]),
  title: z.string().trim().min(2),
  dateFrom: z.string().datetime().optional().nullable(),
  dateTo: z.string().datetime().optional().nullable(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  rowCount: z.coerce.number().int().min(0).optional().nullable(),
  status: z.string().trim().min(2).default("REQUESTED"),
})

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const searchParams = request.nextUrl.searchParams
  const type = searchParams.get("type")
  const createdBy = searchParams.get("createdBy")
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")

  const reports = await prisma.reportExport.findMany({
    where: {
      facilityId: actor!.facilityId,
      ...(type ? { type: type as never } : {}),
      ...(createdBy ? { generatedById: createdBy } : {}),
      ...(dateFrom || dateTo
        ? {
            generatedAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    },
    orderBy: { generatedAt: "desc" },
    include: { generatedBy: true },
  })

  return Response.json({
    success: true,
    data: reports.map(serializeHospitalAdminReportExport),
  } satisfies ApiResponse)
}

export async function POST(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const parsed = reportExportSchema.safeParse(await request.json())
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        message: "Report export details are invalid.",
        errors: z.flattenError(parsed.error).fieldErrors,
      } satisfies ApiResponse,
      { status: 400 }
    )
  }

  const values = parsed.data
  const report = await prisma.reportExport.create({
    data: {
      type: values.type,
      title: values.title,
      facilityId: actor!.facilityId,
      generatedById: actor!.id,
      parameters: (values.parameters ?? {}) as Prisma.InputJsonValue,
      rowCount: values.rowCount ?? 0,
      status: values.status,
      dateFrom: values.dateFrom ? new Date(values.dateFrom) : null,
      dateTo: values.dateTo ? new Date(values.dateTo) : null,
    },
    include: { generatedBy: true },
  })

  await writeHospitalAdminAuditLog({
    request,
    actor: actor!,
    action: "EXPORT",
    entityType: "ReportExport",
    entityId: report.id,
    description: `Requested ${report.type} report export`,
    after: {
      type: report.type,
      title: report.title,
      status: report.status,
      dateFrom: report.dateFrom,
      dateTo: report.dateTo,
    },
  })

  return Response.json(
    {
      success: true,
      data: serializeHospitalAdminReportExport(report),
    } satisfies ApiResponse,
    { status: 201 }
  )
}

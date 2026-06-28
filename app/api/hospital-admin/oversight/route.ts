import { NextRequest } from "next/server"

import { requireHospitalAdminApi } from "@/lib/hospital-admin"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"

export async function GET(request: NextRequest) {
  const { staff: actor, response } = await requireHospitalAdminApi(request)
  if (response) return response

  const facilityId = actor!.facilityId
  const [
    invoices,
    payments,
    referrals,
    encounters,
    diagnoses,
    labRequests,
    labResults,
    medicationStocks,
    stockRows,
    syncJobs,
  ] = await Promise.all([
    prisma.invoice.count({ where: { facilityId } }),
    prisma.payment.count({ where: { invoice: { facilityId } } }),
    prisma.referral.count({
      where: {
        OR: [{ fromFacilityId: facilityId }, { toFacilityId: facilityId }],
      },
    }),
    prisma.encounter.count({ where: { facilityId } }),
    prisma.diagnosis.count({ where: { encounter: { facilityId } } }),
    prisma.labRequest.count({
      where: { patient: { registeredFacilityId: facilityId } },
    }),
    prisma.labResult.count({
      where: { patient: { registeredFacilityId: facilityId } },
    }),
    prisma.medicationStock.count({ where: { facilityId } }),
    prisma.medicationStock.findMany({
      where: { facilityId },
      select: {
        quantityOnHand: true,
        medication: { select: { reorderLevel: true } },
      },
    }),
    prisma.offlineSyncJob.groupBy({
      by: ["status"],
      where: { facilityId },
      _count: { _all: true },
    }),
  ])

  return Response.json({
    success: true,
    data: {
      billing: { invoices, payments },
      referrals: { total: referrals },
      clinical: { encounters, diagnoses },
      laboratory: { requests: labRequests, results: labResults },
      pharmacy: {
        stockBatches: medicationStocks,
        lowStock: stockRows.filter(
          (stock) => stock.quantityOnHand <= stock.medication.reorderLevel
        ).length,
      },
      sync: syncJobs.map((item) => ({
        status: item.status,
        count: item._count._all,
      })),
    },
  } satisfies ApiResponse)
}

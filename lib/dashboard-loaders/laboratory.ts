import type { AuthenticatedStaff } from "@/lib/auth-session"
import {
  laboratoryRequestScope,
  serializeLabRequestQueueItem,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { LaboratoryDashboardSummary } from "@/types/laboratory"

type LaboratorySummaryRow = {
  newRequests: bigint
  awaitingCollection: bigint
  collectedToday: bigint
  processing: bigint
  awaitingValidation: bigint
  critical: bigint
  releasedToday: bigint
  averageTurnaroundMinutes: unknown
  sampleTotal: bigint
  receivedTotal: bigint
  resultsTotal: bigint
  validatedTotal: bigint
}

type LaboratoryCategoryRow = {
  category: string
  count: bigint
}

export async function loadLaboratoryDashboard(
  actor: AuthenticatedStaff,
  now = new Date()
): Promise<LaboratoryDashboardSummary> {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  const facilityId = actor.facilityId
  const requestScope = laboratoryRequestScope(facilityId)

  const [summaryRows, delayed, categories] = await Promise.all([
    prisma.$queryRaw<LaboratorySummaryRow[]>`
      SELECT
        (SELECT COUNT(*) FROM "LabRequest" lr
          JOIN "Patient" p ON p."id" = lr."patientId"
          LEFT JOIN "Encounter" e ON e."id" = lr."encounterId"
          WHERE p."registeredFacilityId" = ${facilityId}
            AND (lr."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND lr."status" = 'REQUESTED'
            AND lr."requestedAt" >= ${start} AND lr."requestedAt" < ${end}) AS "newRequests",
        (SELECT COUNT(*) FROM "LabRequest" lr
          JOIN "Patient" p ON p."id" = lr."patientId"
          LEFT JOIN "Encounter" e ON e."id" = lr."encounterId"
          WHERE p."registeredFacilityId" = ${facilityId}
            AND (lr."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND lr."status" = 'REQUESTED') AS "awaitingCollection",
        (SELECT COUNT(*) FROM "LabSample" s JOIN "LabRequest" lr ON lr."id" = s."labRequestId"
          JOIN "Patient" p ON p."id" = lr."patientId"
          LEFT JOIN "Encounter" e ON e."id" = lr."encounterId"
          WHERE p."registeredFacilityId" = ${facilityId}
            AND (lr."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND s."collectedAt" >= ${start} AND s."collectedAt" < ${end}) AS "collectedToday",
        (SELECT COUNT(*) FROM "LabRequest" lr
          JOIN "Patient" p ON p."id" = lr."patientId"
          LEFT JOIN "Encounter" e ON e."id" = lr."encounterId"
          WHERE p."registeredFacilityId" = ${facilityId}
            AND (lr."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND lr."status" = 'PROCESSING') AS processing,
        (SELECT COUNT(*) FROM "LabResult" r
          JOIN "Patient" p ON p."id" = r."patientId"
          JOIN "LabTestCatalog" t ON t."id" = r."testId"
          LEFT JOIN "Encounter" e ON e."id" = r."encounterId"
          WHERE p."registeredFacilityId" = ${facilityId} AND t."facilityId" = ${facilityId}
            AND (r."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND r."status" = 'ENTERED') AS "awaitingValidation",
        (SELECT COUNT(*) FROM "LabResult" r
          JOIN "Patient" p ON p."id" = r."patientId"
          JOIN "LabTestCatalog" t ON t."id" = r."testId"
          LEFT JOIN "Encounter" e ON e."id" = r."encounterId"
          WHERE p."registeredFacilityId" = ${facilityId} AND t."facilityId" = ${facilityId}
            AND (r."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND r."criticalFlag" = true AND r."status" <> 'RELEASED') AS critical,
        (SELECT COUNT(*) FROM "LabResult" r
          JOIN "Patient" p ON p."id" = r."patientId"
          JOIN "LabTestCatalog" t ON t."id" = r."testId"
          LEFT JOIN "Encounter" e ON e."id" = r."encounterId"
          WHERE p."registeredFacilityId" = ${facilityId} AND t."facilityId" = ${facilityId}
            AND (r."encounterId" IS NULL OR e."facilityId" = ${facilityId})
            AND r."status" = 'RELEASED'
            AND r."releasedAt" >= ${start} AND r."releasedAt" < ${end}) AS "releasedToday",
        (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (r."releasedAt" - lr."requestedAt")) / 60), 0)
          FROM "LabResult" r
          JOIN "LabRequestTest" rt ON rt."id" = r."labRequestTestId"
          JOIN "LabRequest" lr ON lr."id" = rt."labRequestId"
          JOIN "Patient" p ON p."id" = r."patientId"
          JOIN "LabTestCatalog" t ON t."id" = r."testId"
          WHERE p."registeredFacilityId" = ${facilityId} AND t."facilityId" = ${facilityId}
            AND r."status" = 'RELEASED' AND r."releasedAt" IS NOT NULL) AS "averageTurnaroundMinutes",
        (SELECT COUNT(*) FROM "LabSample" s JOIN "LabRequest" lr ON lr."id" = s."labRequestId"
          JOIN "Patient" p ON p."id" = lr."patientId"
          WHERE p."registeredFacilityId" = ${facilityId}) AS "sampleTotal",
        (SELECT COUNT(*) FROM "LabSample" s JOIN "LabRequest" lr ON lr."id" = s."labRequestId"
          JOIN "Patient" p ON p."id" = lr."patientId"
          WHERE p."registeredFacilityId" = ${facilityId}
            AND s."status" IN ('RECEIVED', 'PROCESSING', 'STORED', 'DISPOSED')) AS "receivedTotal",
        (SELECT COUNT(*) FROM "LabResult" r JOIN "LabTestCatalog" t ON t."id" = r."testId"
          WHERE t."facilityId" = ${facilityId}) AS "resultsTotal",
        (SELECT COUNT(*) FROM "LabResult" r JOIN "LabTestCatalog" t ON t."id" = r."testId"
          WHERE t."facilityId" = ${facilityId} AND r."status" IN ('VALIDATED', 'RELEASED')) AS "validatedTotal"
    `,
    prisma.labRequest.findMany({
      where: { ...requestScope, status: { notIn: ["COMPLETED", "CANCELLED"] } },
      select: {
        id: true,
        requestNo: true,
        patientId: true,
        requestedById: true,
        priority: true,
        status: true,
        requestedAt: true,
        completedAt: true,
        patient: { select: { id: true, patientNo: true, firstName: true, lastName: true, otherNames: true } },
        requestedBy: { select: { name: true } },
        tests: { select: { test: { select: { name: true } } } },
      },
      orderBy: [{ priority: "desc" }, { requestedAt: "asc" }],
      take: 8,
    }),
    prisma.$queryRaw<LaboratoryCategoryRow[]>`
      SELECT COALESCE(t."category", 'Uncategorized') AS category, COUNT(*) AS count
      FROM "LabRequestTest" rt
      JOIN "LabRequest" lr ON lr."id" = rt."labRequestId"
      JOIN "Patient" p ON p."id" = lr."patientId"
      JOIN "LabTestCatalog" t ON t."id" = rt."testId"
      LEFT JOIN "Encounter" e ON e."id" = lr."encounterId"
      WHERE p."registeredFacilityId" = ${facilityId}
        AND t."facilityId" = ${facilityId}
        AND (lr."encounterId" IS NULL OR e."facilityId" = ${facilityId})
      GROUP BY COALESCE(t."category", 'Uncategorized')
      ORDER BY COUNT(*) DESC
      LIMIT 8
    `,
  ])

  const summary = summaryRows[0]
  const processing = Number(summary?.processing ?? 0)
  const sampleTotal = Number(summary?.sampleTotal ?? 0)
  const receivedTotal = Number(summary?.receivedTotal ?? 0)
  const resultsTotal = Number(summary?.resultsTotal ?? 0)
  const validatedTotal = Number(summary?.validatedTotal ?? 0)
  const averageTurnaroundMinutes = Number(summary?.averageTurnaroundMinutes ?? 0)

  return {
    facilityName: actor.facility.name,
    metrics: [
      { label: "New Requests", value: String(summary?.newRequests ?? 0), detail: "Received today", tone: "green" },
      { label: "Awaiting Collection", value: String(summary?.awaitingCollection ?? 0), detail: "Requests without a collected sample", tone: "orange" },
      { label: "Collected Today", value: String(summary?.collectedToday ?? 0), detail: "Samples collected today", tone: "green" },
      { label: "In Progress", value: String(processing), detail: "Tests currently processing", tone: "blue" },
      { label: "Awaiting Validation", value: String(summary?.awaitingValidation ?? 0), detail: "Entered results pending review", tone: "orange" },
      { label: "Critical Results", value: String(summary?.critical ?? 0), detail: "Immediate action required", tone: "red" },
      { label: "Released Today", value: String(summary?.releasedToday ?? 0), detail: "Available to clinicians", tone: "green" },
      { label: "Average TAT", value: `${Math.round(averageTurnaroundMinutes / 6) / 10}h`, detail: "Request to result release", tone: "blue" },
    ],
    delayedRequests: delayed.map(serializeLabRequestQueueItem),
    categoryVolume: categories.map((item) => ({ category: item.category, count: Number(item.count) })),
    workflowEfficiency: {
      sampleReception: sampleTotal ? Math.round((receivedTotal / sampleTotal) * 100) : 100,
      processing: processing ? Math.max(0, Math.min(100, 100 - processing * 2)) : 100,
      validation: resultsTotal ? Math.round((validatedTotal / resultsTotal) * 100) : 100,
    },
  }
}

import { NextRequest } from "next/server"

import {
  ensurePatientInLaboratoryFacility,
  laboratoryRequestScope,
  laboratoryResultInclude,
  laboratoryResultScope,
  laboratorySampleInclude,
  requireLaboratoryApi,
  serializeLabRequestQueueItem,
  serializeLabResultList,
  serializeLabSample,
} from "@/lib/laboratory"
import { prisma } from "@/lib/prisma"
import type { ApiResponse } from "@/types"
import type { LaboratoryPatientHistory } from "@/types/laboratory"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { staff: actor, response } = await requireLaboratoryApi(request)
  if (response) return response
  const { id } = await context.params
  const patient = await ensurePatientInLaboratoryFacility(id, actor!.facilityId)
  if (!patient) return Response.json({ success: false, message: "Patient was not found." }, { status: 404 })
  const [profile, requests, samples, results] = await Promise.all([
    prisma.patient.findUniqueOrThrow({ where: { id }, include: { allergies: true, chronicConditions: true } }),
    prisma.labRequest.findMany({ where: { patientId: id, ...laboratoryRequestScope(actor!.facilityId) }, include: { patient: true, requestedBy: true, tests: { include: { test: true } } }, orderBy: { requestedAt: "desc" } }),
    prisma.labSample.findMany({ where: { labRequest: { patientId: id, ...laboratoryRequestScope(actor!.facilityId) } }, include: laboratorySampleInclude, orderBy: { createdAt: "desc" } }),
    prisma.labResult.findMany({ where: { patientId: id, ...laboratoryResultScope(actor!.facilityId), status: { in: ["VALIDATED", "RELEASED"] } }, include: laboratoryResultInclude, orderBy: { createdAt: "desc" } }),
  ])
  const trendMap = new Map<string, LaboratoryPatientHistory["trends"][number]>()
  for (const result of [...results].reverse()) {
    for (const item of result.items) {
      const value = Number(item.value)
      if (!Number.isFinite(value)) continue
      const key = `${result.testId}:${item.parameterName}`
      const trend = trendMap.get(key) ?? { testName: result.test.name, parameterName: item.parameterName, points: [] }
      trend.points.push({ date: (result.releasedAt ?? result.validatedAt ?? result.createdAt).toISOString(), value, referenceRange: item.referenceRange })
      trendMap.set(key, trend)
    }
  }
  const data: LaboratoryPatientHistory = {
    patient: {
      id: profile.id,
      patientNo: profile.patientNo,
      name: [profile.firstName, profile.otherNames, profile.lastName].filter(Boolean).join(" "),
      gender: profile.gender,
      age: profile.estimatedAge,
      bloodGroup: profile.bloodGroup,
      allergies: profile.allergies.map((item) => ({ allergen: item.allergen, severity: item.severity, reaction: item.reaction })),
      chronicConditions: profile.chronicConditions.map((item) => ({ name: item.name, status: item.status })),
    },
    requests: requests.map(serializeLabRequestQueueItem),
    samples: samples.map(serializeLabSample),
    results: results.map(serializeLabResultList),
    trends: [...trendMap.values()],
  }
  return Response.json({ success: true, data } satisfies ApiResponse<LaboratoryPatientHistory>)
}

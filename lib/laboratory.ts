import type { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import type { AuthenticatedStaff } from "@/lib/auth-session"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
  AuditAction,
  LabPriority,
  LabRequestStatus,
  LabResultStatus,
  NotificationStatus,
  NotificationType,
  SampleStatus,
  StaffRole,
} from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import type {
  LabRequestDetail,
  LabRequestQueueItem,
  LabResultDetail,
  LabResultListItem,
  LabResultParameterPayload,
  LabSampleDetail,
  LabSampleListItem,
  LabTestCatalogItem,
  LabTestParameterDefinitionInput,
  LaboratoryNotificationItem,
  LaboratoryPage,
} from "@/types/laboratory"

export const laboratoryRequestInclude = {
  patient: {
    include: { allergies: true, chronicConditions: true },
  },
  encounter: {
    include: {
      appointment: true,
      diagnoses: true,
      invoices: { take: 1, orderBy: { createdAt: "desc" as const } },
      prescriptions: { include: { items: true }, orderBy: { createdAt: "desc" as const } },
    },
  },
  requestedBy: true,
  tests: {
    include: {
      test: { include: { parameterDefinitions: { orderBy: { sortOrder: "asc" as const } } } },
      result: {
        include: {
          items: { orderBy: { createdAt: "asc" as const } },
          enteredBy: true,
          validatedBy: true,
          labSample: true,
        },
      },
    },
  },
  samples: { include: { collectedBy: true, receivedBy: true }, orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.LabRequestInclude

export const laboratorySampleInclude = {
  collectedBy: true,
  receivedBy: true,
  labRequest: {
    include: {
      patient: true,
      requestedBy: true,
      tests: { include: { test: true } },
    },
  },
  results: {
    include: {
      patient: true,
      test: true,
      requestTest: { include: { labRequest: { include: { requestedBy: true } } } },
      enteredBy: true,
      validatedBy: true,
      labSample: true,
    },
  },
} satisfies Prisma.LabSampleInclude

export const laboratoryResultInclude = {
  patient: { include: { allergies: true, chronicConditions: true } },
  encounter: {
    include: {
      diagnoses: true,
      prescriptions: { include: { items: true }, orderBy: { createdAt: "desc" as const } },
    },
  },
  test: { include: { parameterDefinitions: { orderBy: { sortOrder: "asc" as const } } } },
  requestTest: { include: { labRequest: { include: { requestedBy: true } } } },
  enteredBy: true,
  validatedBy: true,
  labSample: true,
  items: { orderBy: { createdAt: "asc" as const } },
} satisfies Prisma.LabResultInclude

type RequestRecord = Prisma.LabRequestGetPayload<{ include: typeof laboratoryRequestInclude }>
type SampleRecord = Prisma.LabSampleGetPayload<{ include: typeof laboratorySampleInclude }>
type ResultRecord = Prisma.LabResultGetPayload<{ include: typeof laboratoryResultInclude }>
type CatalogRecord = Prisma.LabTestCatalogGetPayload<{
  include: { parameterDefinitions: true; _count: { select: { requestTests: true } } }
}>

type DbClient = Prisma.TransactionClient | typeof prisma

export async function requireLaboratoryApi(request: NextRequest) {
  const result = await requireRoleApi(request, [StaffRole.LAB_TECHNICIAN])
  if (result.response) return result
  if (!result.staff?.facilityId) {
    return {
      staff: result.staff,
      response: Response.json(
        { success: false, message: "Laboratory Technician is not assigned to a facility.", code: "FACILITY_REQUIRED" },
        { status: 403 }
      ),
    }
  }
  return result
}

export async function hasLaboratoryPermission(
  actor: AuthenticatedStaff,
  permissionKey: string,
  client: DbClient = prisma
) {
  if (actor.defaultRole === StaffRole.SUPER_ADMIN) return true
  return Boolean(
    await client.rolePermission.findFirst({
      where: {
        roleId: { in: actor.roles.map((item) => item.roleId) },
        permission: { key: permissionKey },
      },
      select: { id: true },
    })
  )
}

export function laboratoryRequestScope(facilityId: string): Prisma.LabRequestWhereInput {
  return {
    patient: { registeredFacilityId: facilityId },
    AND: [{ OR: [{ encounterId: null }, { encounter: { facilityId } }] }],
  }
}

export function laboratoryResultScope(facilityId: string): Prisma.LabResultWhereInput {
  return {
    patient: { registeredFacilityId: facilityId },
    test: { facilityId },
    AND: [{ OR: [{ encounterId: null }, { encounter: { facilityId } }] }],
  }
}

export async function ensurePatientInLaboratoryFacility(patientId: string, facilityId: string, client: DbClient = prisma) {
  return client.patient.findFirst({ where: { id: patientId, registeredFacilityId: facilityId } })
}

export async function ensureLaboratoryRequest(id: string, facilityId: string, client: DbClient = prisma) {
  return client.labRequest.findFirst({
    where: { id, ...laboratoryRequestScope(facilityId) },
    include: laboratoryRequestInclude,
  })
}

export async function ensureLaboratorySample(id: string, facilityId: string, client: DbClient = prisma) {
  return client.labSample.findFirst({
    where: { id, labRequest: laboratoryRequestScope(facilityId) },
    include: laboratorySampleInclude,
  })
}

export async function ensureLaboratoryResult(id: string, facilityId: string, client: DbClient = prisma) {
  return client.labResult.findFirst({
    where: { id, ...laboratoryResultScope(facilityId) },
    include: laboratoryResultInclude,
  })
}

export function getRequestAuditMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  }
}

export async function writeLaboratoryAuditLog({
  client = prisma,
  request,
  actor,
  action,
  entityType,
  entityId,
  description,
  before,
  after,
}: {
  client?: DbClient
  request: NextRequest
  actor: Pick<AuthenticatedStaff, "id">
  action: AuditAction
  entityType: string
  entityId?: string | null
  description: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}) {
  const meta = getRequestAuditMeta(request)
  return client.auditLog.create({
    data: {
      actorId: actor.id,
      action,
      entityType,
      entityId,
      description,
      before,
      after,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  })
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page")) || 1)
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || 25))
  return { page, pageSize, skip: (page - 1) * pageSize }
}

export function pageData<T>(items: T[], total: number, page: number, pageSize: number): LaboratoryPage<T> {
  return { items, total, page, pageSize }
}

export function parseDateRange(searchParams: URLSearchParams, field: string) {
  const dateFrom = searchParams.get("dateFrom")
  const dateTo = searchParams.get("dateTo")
  if (!dateFrom && !dateTo) return {}
  return {
    [field]: {
      ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
      ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
    },
  }
}

function serialPart() {
  return crypto.randomUUID().slice(0, 8).toUpperCase()
}

function timestampPart() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14)
}

export function generateSampleNo() {
  return `SMP-${timestampPart()}-${serialPart()}`
}

export function generateResultNo() {
  return `RES-${timestampPart()}-${serialPart()}`
}

export const requestTransitions: Record<LabRequestStatus, LabRequestStatus[]> = {
  REQUESTED: [LabRequestStatus.SAMPLE_COLLECTED, LabRequestStatus.CANCELLED],
  SAMPLE_COLLECTED: [LabRequestStatus.PROCESSING],
  PROCESSING: [LabRequestStatus.PARTIAL_RESULT],
  PARTIAL_RESULT: [LabRequestStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
}

export const sampleTransitions: Record<SampleStatus, SampleStatus[]> = {
  PENDING_COLLECTION: [SampleStatus.COLLECTED],
  COLLECTED: [SampleStatus.RECEIVED, SampleStatus.REJECTED],
  RECEIVED: [SampleStatus.PROCESSING, SampleStatus.REJECTED],
  REJECTED: [],
  PROCESSING: [SampleStatus.STORED, SampleStatus.DISPOSED],
  STORED: [SampleStatus.DISPOSED],
  DISPOSED: [],
}

export function canTransitionRequest(from: LabRequestStatus, to: LabRequestStatus) {
  return requestTransitions[from].includes(to)
}

export function canTransitionSample(from: SampleStatus, to: SampleStatus) {
  return sampleTransitions[from].includes(to)
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function decimalOrNull(value: unknown) {
  if (value === null || value === undefined) return null
  return Number(value.toString())
}

export function calculateParameterFlags(
  value: string | null | undefined,
  definition?: {
    referenceLow?: unknown
    referenceHigh?: unknown
    criticalLow?: unknown
    criticalHigh?: unknown
  } | null,
  manual?: { isAbnormal?: boolean; isCritical?: boolean }
) {
  const numeric = numberOrNull(value)
  const referenceLow = decimalOrNull(definition?.referenceLow)
  const referenceHigh = decimalOrNull(definition?.referenceHigh)
  const criticalLow = decimalOrNull(definition?.criticalLow)
  const criticalHigh = decimalOrNull(definition?.criticalHigh)
  const thresholdAbnormal =
    numeric !== null &&
    ((referenceLow !== null && numeric < referenceLow) ||
      (referenceHigh !== null && numeric > referenceHigh))
  const thresholdCritical =
    numeric !== null &&
    ((criticalLow !== null && numeric < criticalLow) ||
      (criticalHigh !== null && numeric > criticalHigh))
  return {
    isAbnormal: Boolean(manual?.isAbnormal || thresholdAbnormal || thresholdCritical),
    isCritical: Boolean(manual?.isCritical || thresholdCritical),
  }
}

export function getMissingRequiredParameters(
  definitions: { id: string; name: string; isRequired: boolean; isActive: boolean }[],
  parameters: LabResultParameterPayload[]
) {
  return definitions
    .filter((item) => item.isRequired && item.isActive)
    .filter(
      (definition) =>
        !parameters.some(
          (parameter) =>
            (parameter.parameterDefinitionId === definition.id || parameter.parameterName === definition.name) &&
            Boolean(parameter.value?.trim())
        )
    )
    .map((item) => item.name)
}

export async function reconcileEncounterAfterLaboratory(
  client: Prisma.TransactionClient,
  encounterId: string | null,
  context: {
    request: NextRequest
    actor: Pick<AuthenticatedStaff, "id">
  }
) {
  if (!encounterId) return
  const remaining = await client.labRequest.count({
    where: { encounterId, status: { notIn: [LabRequestStatus.COMPLETED, LabRequestStatus.CANCELLED] } },
  })
  if (remaining) return
  const encounter = await client.encounter.findUnique({ where: { id: encounterId } })
  if (!encounter || encounter.status !== "AWAITING_LAB") return
  await client.encounter.update({ where: { id: encounterId }, data: { status: "IN_PROGRESS" } })
  await writeLaboratoryAuditLog({
    client,
    request: context.request,
    actor: context.actor,
    action: AuditAction.UPDATE,
    entityType: "Encounter",
    entityId: encounterId,
    description: "Returned encounter to clinician after laboratory work closed",
    before: { status: "AWAITING_LAB" },
    after: { status: "IN_PROGRESS" },
  })
  if (encounter.queueId) {
    const changed = await client.patientQueue.updateMany({
      where: { id: encounter.queueId, status: "AWAITING_LAB" },
      data: { status: "WITH_CLINICIAN" },
    })
    if (changed.count) {
      await writeLaboratoryAuditLog({
        client,
        request: context.request,
        actor: context.actor,
        action: AuditAction.UPDATE,
        entityType: "PatientQueue",
        entityId: encounter.queueId,
        description: "Returned patient queue entry to clinician after laboratory work closed",
        before: { status: "AWAITING_LAB" },
        after: { status: "WITH_CLINICIAN" },
      })
    }
  }
}

function fullName(person: { firstName: string; lastName: string; otherNames?: string | null }) {
  return [person.firstName, person.otherNames, person.lastName].filter(Boolean).join(" ")
}

function getAge(dateOfBirth: Date | null, estimatedAge: number | null) {
  if (estimatedAge) return estimatedAge
  if (!dateOfBirth) return null
  const now = new Date()
  let age = now.getFullYear() - dateOfBirth.getFullYear()
  const delta = now.getMonth() - dateOfBirth.getMonth()
  if (delta < 0 || (delta === 0 && now.getDate() < dateOfBirth.getDate())) age -= 1
  return age
}

function requestQueueItem(request: {
  id: string
  requestNo: string
  patientId: string
  patient: { firstName: string; lastName: string; otherNames?: string | null; patientNo: string }
  tests: { test: { name: string } }[]
  requestedById: string | null
  requestedBy: { name: string } | null
  priority: LabPriority
  status: LabRequestStatus
  requestedAt: Date
  completedAt: Date | null
}): LabRequestQueueItem {
  return {
    id: request.id,
    requestNo: request.requestNo,
    patientId: request.patientId,
    patientName: fullName(request.patient),
    patientNo: request.patient.patientNo,
    requestedTests: request.tests.map((item) => item.test.name),
    requestedById: request.requestedById,
    requestedByName: request.requestedBy?.name ?? null,
    priority: request.priority,
    status: request.status,
    requestedAt: request.requestedAt.toISOString(),
    completedAt: request.completedAt?.toISOString() ?? null,
    turnaroundMinutes: request.completedAt
      ? Math.max(0, Math.round((request.completedAt.getTime() - request.requestedAt.getTime()) / 60000))
      : null,
  }
}

export const serializeLabRequestQueueItem = requestQueueItem

export function serializeLabSample(sample: SampleRecord): LabSampleListItem {
  return {
    id: sample.id,
    sampleNo: sample.sampleNo,
    labRequestId: sample.labRequestId,
    requestNo: sample.labRequest.requestNo,
    patientId: sample.labRequest.patientId,
    patientName: fullName(sample.labRequest.patient),
    patientNo: sample.labRequest.patient.patientNo,
    sampleType: sample.sampleType,
    status: sample.status,
    collectedByName: sample.collectedBy?.name ?? null,
    collectedAt: sample.collectedAt?.toISOString() ?? null,
    receivedByName: sample.receivedBy?.name ?? null,
    receivedAt: sample.receivedAt?.toISOString() ?? null,
    rejectionReason: sample.rejectionReason,
    notes: sample.notes,
  }
}

export function serializeLabResultList(result: ResultRecord): LabResultListItem {
  return {
    id: result.id,
    resultNo: result.resultNo,
    requestId: result.requestTest.labRequest.id,
    requestNo: result.requestTest.labRequest.requestNo,
    requestTestId: result.labRequestTestId,
    patientId: result.patientId,
    patientName: fullName(result.patient),
    patientNo: result.patient.patientNo,
    testId: result.testId,
    testName: result.test.name,
    sampleId: result.labSampleId,
    sampleNo: result.labSample?.sampleNo ?? null,
    status: result.status,
    resultText: result.resultText,
    abnormalFlag: result.abnormalFlag,
    criticalFlag: result.criticalFlag,
    enteredByName: result.enteredBy?.name ?? null,
    enteredAt: result.enteredAt?.toISOString() ?? null,
    validatedByName: result.validatedBy?.name ?? null,
    validatedAt: result.validatedAt?.toISOString() ?? null,
    releasedAt: result.releasedAt?.toISOString() ?? null,
    requestedByName: result.requestTest.labRequest.requestedBy?.name ?? null,
  }
}

export function serializeDefinition(definition: {
  id: string
  name: string
  unit: string | null
  referenceRange: string | null
  referenceLow: unknown
  referenceHigh: unknown
  criticalLow: unknown
  criticalHigh: unknown
  isRequired: boolean
  sortOrder: number
  isActive: boolean
}): LabTestParameterDefinitionInput {
  return {
    id: definition.id,
    name: definition.name,
    unit: definition.unit,
    referenceRange: definition.referenceRange,
    referenceLow: decimalOrNull(definition.referenceLow),
    referenceHigh: decimalOrNull(definition.referenceHigh),
    criticalLow: decimalOrNull(definition.criticalLow),
    criticalHigh: decimalOrNull(definition.criticalHigh),
    isRequired: definition.isRequired,
    sortOrder: definition.sortOrder,
    isActive: definition.isActive,
  }
}

export function serializeCatalog(test: CatalogRecord): LabTestCatalogItem {
  return {
    id: test.id,
    facilityId: test.facilityId,
    code: test.code,
    name: test.name,
    category: test.category,
    sampleType: test.sampleType,
    unit: test.unit,
    referenceRange: test.referenceRange,
    price: decimalOrNull(test.price),
    turnaroundHours: test.turnaroundHours,
    isActive: test.isActive,
    parameters: test.parameterDefinitions.sort((a, b) => a.sortOrder - b.sortOrder).map(serializeDefinition),
    requestCount: test._count.requestTests,
  }
}

export async function serializeLabResult(result: ResultRecord, client: DbClient = prisma): Promise<LabResultDetail> {
  const alert = await client.notification.findFirst({
    where: { entityType: "LabResult", entityId: result.id, type: NotificationType.CRITICAL_ALERT, recipientId: { not: null } },
    orderBy: { createdAt: "desc" },
  })
  return {
    ...serializeLabResultList(result),
    notes: result.notes,
    validationNote: result.validationNote,
    parameters: result.items.map((item) => ({
      id: item.id,
      parameterDefinitionId: item.parameterDefinitionId,
      parameterName: item.parameterName,
      value: item.value,
      unit: item.unit,
      referenceRange: item.referenceRange,
      isAbnormal: item.isAbnormal,
      isCritical: item.isCritical,
    })),
    parameterDefinitions: result.test.parameterDefinitions.map(serializeDefinition),
    clinicalContext: {
      allergies: result.patient.allergies.map((item) => item.allergen),
      chronicConditions: result.patient.chronicConditions.map((item) => item.name),
      diagnoses: result.encounter?.diagnoses.map((item) => item.name) ?? [],
      medications:
        result.encounter?.prescriptions.flatMap((prescription) =>
          prescription.items.map((item) => item.medicineName)
        ) ?? [],
    },
    criticalAlert: {
      sent: Boolean(alert),
      acknowledged: alert?.status === NotificationStatus.READ || alert?.status === NotificationStatus.ARCHIVED,
      sentAt: alert?.createdAt.toISOString() ?? null,
    },
  }
}

export async function serializeLabRequest(request: RequestRecord, client: DbClient = prisma): Promise<LabRequestDetail> {
  const queue = requestQueueItem(request)
  const resultRecords = request.tests.flatMap((item) => (item.result ? [item.result] : []))
  const resultTimelineRecords = request.tests.flatMap((item) =>
    item.result ? [{ result: item.result, testName: item.test.name }] : []
  )
  const fullResults = await Promise.all(
    resultRecords.map((result) =>
      client.labResult.findUniqueOrThrow({ where: { id: result.id }, include: laboratoryResultInclude })
    )
  )
  const sampleRecords = await Promise.all(
    request.samples.map((sample) =>
      client.labSample.findUniqueOrThrow({ where: { id: sample.id }, include: laboratorySampleInclude })
    )
  )
  const timeline = [
    { label: "Request created", at: request.requestedAt.toISOString(), detail: request.requestedBy?.name, tone: "green" as const },
    ...request.samples.flatMap((sample) => [
      ...(sample.collectedAt ? [{ label: `Sample ${sample.sampleNo} collected`, at: sample.collectedAt.toISOString(), detail: sample.collectedBy?.name, tone: "orange" as const }] : []),
      ...(sample.receivedAt ? [{ label: `Sample ${sample.sampleNo} received`, at: sample.receivedAt.toISOString(), detail: sample.receivedBy?.name, tone: "blue" as const }] : []),
    ]),
    ...resultTimelineRecords.flatMap(({ result, testName }) => [
      ...(result.enteredAt ? [{ label: `${testName} entered`, at: result.enteredAt.toISOString(), tone: "orange" as const }] : []),
      ...(result.validatedAt ? [{ label: `${testName} validated`, at: result.validatedAt.toISOString(), tone: "blue" as const }] : []),
      ...(result.releasedAt ? [{ label: `${testName} released`, at: result.releasedAt.toISOString(), tone: "green" as const }] : []),
    ]),
  ].sort((a, b) => a.at.localeCompare(b.at))
  return {
    ...queue,
    clinicalNotes: request.clinicalNotes,
    cancellationReason: request.cancellationReason,
    patient: {
      id: request.patient.id,
      patientNo: request.patient.patientNo,
      name: fullName(request.patient),
      gender: request.patient.gender,
      age: getAge(request.patient.dateOfBirth, request.patient.estimatedAge),
      bloodGroup: request.patient.bloodGroup,
      allergies: request.patient.allergies.map((item) => ({ allergen: item.allergen, severity: item.severity, reaction: item.reaction })),
      chronicConditions: request.patient.chronicConditions.map((item) => ({ name: item.name, status: item.status })),
    },
    encounter: request.encounter
      ? {
          id: request.encounter.id,
          encounterNo: request.encounter.encounterNo,
          status: request.encounter.status,
          chiefComplaint: request.encounter.chiefComplaint,
          appointmentNo: request.encounter.appointment?.appointmentNo ?? null,
          billingStatus: request.encounter.invoices[0]?.status ?? null,
        }
      : null,
    tests: request.tests.map((item) => ({
      id: item.id,
      testId: item.testId,
      code: item.test.code,
      name: item.test.name,
      category: item.test.category,
      sampleType: item.test.sampleType,
      notes: item.notes,
      resultId: item.result?.id ?? null,
      resultStatus: item.result?.status ?? null,
      parameterDefinitions: item.test.parameterDefinitions.map(serializeDefinition),
    })),
    samples: sampleRecords.map(serializeLabSample),
    results: await Promise.all(fullResults.map((item) => serializeLabResult(item, client))),
    timeline,
  }
}

export function serializeLabSampleDetail(sample: SampleRecord): LabSampleDetail {
  const request = requestQueueItem(sample.labRequest)
  return {
    ...serializeLabSample(sample),
    request,
    relatedResults: sample.results.map((item) => serializeLabResultList(item as ResultRecord)),
    timeline: [
      { label: "Sample record created", at: sample.createdAt.toISOString(), tone: "neutral" },
      ...(sample.collectedAt ? [{ label: "Collected", at: sample.collectedAt.toISOString(), detail: sample.collectedBy?.name, tone: "orange" as const }] : []),
      ...(sample.receivedAt ? [{ label: "Received", at: sample.receivedAt.toISOString(), detail: sample.receivedBy?.name, tone: "blue" as const }] : []),
      ...(sample.status === SampleStatus.REJECTED ? [{ label: "Rejected", at: sample.updatedAt.toISOString(), detail: sample.rejectionReason, tone: "red" as const }] : []),
    ],
  }
}

export function serializeLaboratoryNotification(notification: {
  id: string
  type: NotificationType
  status: NotificationStatus
  priority: string
  title: string
  body: string | null
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
  readAt: Date | null
  createdAt: Date
}): LaboratoryNotificationItem {
  return {
    id: notification.id,
    type: notification.type,
    status: notification.status,
    priority: notification.priority,
    title: notification.title,
    body: notification.body,
    actionUrl: notification.actionUrl,
    entityType: notification.entityType,
    entityId: notification.entityId,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }
}

export function getLaboratoryLookups() {
  return {
    priorities: Object.values(LabPriority),
    requestStatuses: Object.values(LabRequestStatus),
    sampleStatuses: Object.values(SampleStatus),
    resultStatuses: Object.values(LabResultStatus),
    notificationStatuses: Object.values(NotificationStatus),
  }
}

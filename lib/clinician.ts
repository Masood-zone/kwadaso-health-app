import type { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import type { AuthenticatedStaff } from "@/lib/auth-session"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
  AuditAction,
  EncounterStatus,
  QueueStatus,
  StaffRole,
} from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"

export const clinicianRoles = [
  StaffRole.DOCTOR,
  StaffRole.PHYSICIAN_ASSISTANT,
] as const

export const editableEncounterStatuses = new Set<EncounterStatus>([
  EncounterStatus.DRAFT,
  EncounterStatus.IN_PROGRESS,
  EncounterStatus.AWAITING_LAB,
  EncounterStatus.AWAITING_PHARMACY,
])

const encounterTransitions = new Set([
  "DRAFT->IN_PROGRESS",
  "DRAFT->CANCELLED",
  "IN_PROGRESS->AWAITING_LAB",
  "IN_PROGRESS->AWAITING_PHARMACY",
  "IN_PROGRESS->COMPLETED",
  "IN_PROGRESS->CANCELLED",
  "AWAITING_LAB->IN_PROGRESS",
  "AWAITING_LAB->AWAITING_PHARMACY",
  "AWAITING_LAB->COMPLETED",
  "AWAITING_LAB->CANCELLED",
  "AWAITING_PHARMACY->IN_PROGRESS",
  "AWAITING_PHARMACY->AWAITING_LAB",
  "AWAITING_PHARMACY->COMPLETED",
  "AWAITING_PHARMACY->CANCELLED",
])

const queueTransitions = new Set([
  "IN_TRIAGE->WITH_CLINICIAN",
  "WITH_CLINICIAN->AWAITING_LAB",
  "WITH_CLINICIAN->AWAITING_PHARMACY",
  "WITH_CLINICIAN->COMPLETED",
  "WITH_CLINICIAN->CANCELLED",
  "AWAITING_LAB->WITH_CLINICIAN",
  "AWAITING_LAB->AWAITING_PHARMACY",
  "AWAITING_LAB->COMPLETED",
  "AWAITING_LAB->CANCELLED",
  "AWAITING_PHARMACY->WITH_CLINICIAN",
  "AWAITING_PHARMACY->AWAITING_LAB",
  "AWAITING_PHARMACY->COMPLETED",
  "AWAITING_PHARMACY->CANCELLED",
])

export async function requireClinicianApi(request: NextRequest) {
  const result = await requireRoleApi(request, [...clinicianRoles])
  if (result.response) return result

  if (!result.staff?.facilityId) {
    return {
      staff: result.staff,
      response: Response.json(
        {
          success: false,
          message: "Clinician is not assigned to a facility.",
          code: "FACILITY_REQUIRED",
        },
        { status: 403 }
      ),
    }
  }

  return result
}

export function getAge(dateOfBirth: Date | null, estimatedAge: number | null) {
  if (estimatedAge !== null) return estimatedAge
  if (!dateOfBirth) return null
  const today = new Date()
  let age = today.getFullYear() - dateOfBirth.getFullYear()
  const monthDelta = today.getMonth() - dateOfBirth.getMonth()
  if (
    monthDelta < 0 ||
    (monthDelta === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age -= 1
  }
  return age
}

export function fullName(person: {
  firstName: string
  lastName: string
  otherNames?: string | null
}) {
  return [person.firstName, person.otherNames, person.lastName]
    .filter(Boolean)
    .join(" ")
}

export function toNumber(
  value: { toString(): string } | number | null | undefined
) {
  if (value === null || value === undefined) return null
  return Number(value)
}

export function canTransitionEncounter(
  from: EncounterStatus,
  to: EncounterStatus
) {
  return from === to || encounterTransitions.has(`${from}->${to}`)
}

export function canTransitionQueue(from: QueueStatus, to: QueueStatus) {
  return from === to || queueTransitions.has(`${from}->${to}`)
}

export function canMutateAssignedRecord(
  assignedClinicianId: string | null,
  actorId: string
) {
  return assignedClinicianId === actorId
}

export function getCompletionState(input: {
  hasSignedNote: boolean
  hasPrimaryDiagnosis: boolean
  pendingLabCount: number
  hasFollowUp: boolean
  hasReferral: boolean
}) {
  const blockers: string[] = []
  const warnings: string[] = []
  if (!input.hasSignedNote) blockers.push("A signed clinical note is required.")
  if (!input.hasPrimaryDiagnosis)
    blockers.push("A primary diagnosis is required.")
  if (input.pendingLabCount > 0) {
    warnings.push(
      `${input.pendingLabCount} laboratory request(s) are still pending.`
    )
  }
  if (!input.hasFollowUp && !input.hasReferral) {
    warnings.push("No follow-up appointment or referral has been recorded.")
  }
  return { blockers, warnings, canComplete: blockers.length === 0 }
}

export async function ensurePatientInFacility(
  patientId: string,
  facilityId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  return client.patient.findFirst({
    where: { id: patientId, registeredFacilityId: facilityId },
  })
}

export async function ensureDepartmentInFacility(
  departmentId: string,
  facilityId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  return client.department.findFirst({
    where: { id: departmentId, facilityId, isActive: true },
  })
}

export async function ensureEncounterInFacility(
  encounterId: string,
  facilityId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  return client.encounter.findFirst({
    where: { id: encounterId, facilityId },
    include: {
      queue: true,
      patient: true,
      department: true,
      appointment: true,
    },
  })
}

export async function ensureMutableEncounter(
  encounterId: string,
  actor: AuthenticatedStaff,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  const encounter = await ensureEncounterInFacility(
    encounterId,
    actor.facilityId,
    client
  )
  if (!encounter) {
    return { encounter: null, error: "Encounter was not found.", status: 404 }
  }
  if (!canMutateAssignedRecord(encounter.clinicianId, actor.id)) {
    return {
      encounter,
      error: "This encounter is assigned to another clinician.",
      status: 403,
    }
  }
  if (!editableEncounterStatuses.has(encounter.status)) {
    return {
      encounter,
      error: "Completed or cancelled encounters are locked.",
      status: 409,
    }
  }
  return { encounter, error: null, status: 200 }
}

export function auditMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  }
}

export async function writeClinicianAuditLog({
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
  client?: Prisma.TransactionClient | typeof prisma
  request: NextRequest
  actor: AuthenticatedStaff
  action: AuditAction
  entityType: string
  entityId?: string | null
  description: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}) {
  const meta = auditMeta(request)
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

function generatedNumber(prefix: string) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14)
  return `${prefix}-${stamp}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
}

export function generateEncounterNo() {
  return generatedNumber("ENC")
}

export function generatePrescriptionNo() {
  return generatedNumber("RX")
}

export function generateLabRequestNo() {
  return generatedNumber("LAB")
}

export function generateReferralNo() {
  return generatedNumber("REF")
}

export function generateAppointmentNo() {
  return generatedNumber("APT")
}

export function apiError(message: string, status = 400, code?: string) {
  return Response.json(
    { success: false, message, ...(code ? { code } : {}) },
    { status }
  )
}

export function invalidFields(error: { flatten(): { fieldErrors: unknown } }) {
  return Response.json(
    {
      success: false,
      message: "The submitted clinical data is invalid.",
      errors: error.flatten().fieldErrors,
    },
    { status: 400 }
  )
}

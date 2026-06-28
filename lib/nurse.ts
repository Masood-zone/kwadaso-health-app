import type { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import type { AuthenticatedStaff } from "@/lib/auth-session"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
  AppointmentStatus,
  AuditAction,
  BloodGroup,
  Gender,
  PatientStatus,
  QueueStatus,
  StaffRole,
  TriagePriority,
  VisitType,
} from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import type {
  NurseImmunizationListItem,
  NurseNotificationItem,
  NurseTriageQueueItem,
  NurseVitalSignsListItem,
  PatientTriageProfile,
} from "@/types/nurse"

export async function requireNurseApi(request: NextRequest) {
  const result = await requireRoleApi(request, [StaffRole.NURSE])
  if (result.response) return result

  if (!result.staff?.facilityId) {
    return {
      staff: result.staff,
      response: Response.json(
        {
          success: false,
          message: "Nurse is not assigned to a facility.",
          code: "FACILITY_REQUIRED",
        },
        { status: 403 }
      ),
    }
  }

  return result
}

export function getAge(dateOfBirth: Date | null, estimatedAge: number | null) {
  if (estimatedAge) return estimatedAge
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

export function getRequestAuditMeta(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip"),
    userAgent: request.headers.get("user-agent"),
  }
}

export async function writeNurseAuditLog({
  request,
  actor,
  action,
  entityType,
  entityId,
  description,
  before,
  after,
}: {
  request: NextRequest
  actor: AuthenticatedStaff
  action: AuditAction
  entityType: string
  entityId?: string | null
  description: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
}) {
  const meta = getRequestAuditMeta(request)
  await prisma.auditLog.create({
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

export async function ensurePatientInFacility(patientId: string, facilityId: string) {
  return prisma.patient.findFirst({
    where: { id: patientId, registeredFacilityId: facilityId },
  })
}

export async function ensureQueueInFacility(queueId: string, facilityId: string) {
  return prisma.patientQueue.findFirst({
    where: { id: queueId, department: { facilityId } },
    include: { patient: true, department: true },
  })
}

export function calculateBmi(weightKg?: number | null, heightCm?: number | null) {
  if (!weightKg || !heightCm || heightCm <= 0) return null
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 100) / 100
}

function toNumber(value: { toString(): string } | number | null | undefined) {
  if (value === null || value === undefined) return null
  return Number(value)
}

export function serializeVitalSigns(vital: {
  id: string
  patientId: string
  encounterId: string | null
  temperatureC: { toString(): string } | number | null
  systolicBp: number | null
  diastolicBp: number | null
  pulseRate: number | null
  respiratoryRate: number | null
  oxygenSaturation: number | null
  weightKg: { toString(): string } | number | null
  heightCm: { toString(): string } | number | null
  bmi: { toString(): string } | number | null
  painScore: number | null
  triagePriority: TriagePriority
  notes: string | null
  capturedAt: Date
  patient: { firstName: string; lastName: string; patientNo: string }
  capturedBy?: { name: string } | null
}): NurseVitalSignsListItem {
  return {
    id: vital.id,
    patientId: vital.patientId,
    patientName: `${vital.patient.firstName} ${vital.patient.lastName}`,
    patientNo: vital.patient.patientNo,
    encounterId: vital.encounterId,
    temperatureC: toNumber(vital.temperatureC),
    systolicBp: vital.systolicBp,
    diastolicBp: vital.diastolicBp,
    pulseRate: vital.pulseRate,
    respiratoryRate: vital.respiratoryRate,
    oxygenSaturation: vital.oxygenSaturation,
    weightKg: toNumber(vital.weightKg),
    heightCm: toNumber(vital.heightCm),
    bmi: toNumber(vital.bmi),
    painScore: vital.painScore,
    triagePriority: vital.triagePriority,
    notes: vital.notes,
    capturedByName: vital.capturedBy?.name ?? null,
    capturedAt: vital.capturedAt.toISOString(),
  }
}

export function serializeQueueEntry(queue: {
  id: string
  queueNo: string
  patientId: string
  appointmentId: string | null
  departmentId: string
  priority: TriagePriority
  status: QueueStatus
  reason: string | null
  notes: string | null
  arrivedAt: Date
  calledAt: Date | null
  cancelledAt: Date | null
  cancellationReason: string | null
  patient: {
    firstName: string
    lastName: string
    patientNo: string
    gender: Gender
    dateOfBirth: Date | null
    estimatedAge: number | null
    vitalSigns?: {
      id: string
      temperatureC: { toString(): string } | number | null
      systolicBp: number | null
      diastolicBp: number | null
      pulseRate: number | null
      oxygenSaturation: number | null
      triagePriority: TriagePriority
      capturedAt: Date
    }[]
  }
  department: { name: string }
  vitalSigns?: {
    id: string
    temperatureC: { toString(): string } | number | null
    systolicBp: number | null
    diastolicBp: number | null
    pulseRate: number | null
    oxygenSaturation: number | null
    triagePriority: TriagePriority
    capturedAt: Date
  }[]
}): NurseTriageQueueItem {
  const latest = queue.vitalSigns?.[0] ?? queue.patient.vitalSigns?.[0]
  return {
    id: queue.id,
    queueNo: queue.queueNo,
    patientId: queue.patientId,
    patientName: `${queue.patient.firstName} ${queue.patient.lastName}`,
    patientNo: queue.patient.patientNo,
    gender: queue.patient.gender,
    age: getAge(queue.patient.dateOfBirth, queue.patient.estimatedAge),
    departmentId: queue.departmentId,
    departmentName: queue.department.name,
    appointmentId: queue.appointmentId,
    priority: queue.priority,
    status: queue.status,
    reason: queue.reason,
    notes: queue.notes,
    arrivedAt: queue.arrivedAt.toISOString(),
    calledAt: queue.calledAt?.toISOString() ?? null,
    cancelledAt: queue.cancelledAt?.toISOString() ?? null,
    cancellationReason: queue.cancellationReason,
    waitingMinutes: Math.max(
      0,
      Math.floor((Date.now() - queue.arrivedAt.getTime()) / 60000)
    ),
    latestVitals: latest
      ? {
          id: latest.id,
          temperatureC: toNumber(latest.temperatureC),
          systolicBp: latest.systolicBp,
          diastolicBp: latest.diastolicBp,
          pulseRate: latest.pulseRate,
          oxygenSaturation: latest.oxygenSaturation,
          triagePriority: latest.triagePriority,
          capturedAt: latest.capturedAt.toISOString(),
        }
      : null,
  }
}

export function serializeImmunization(record: {
  id: string
  patientId: string
  vaccineName: string
  dose: string | null
  batchNumber: string | null
  administeredAt: Date
  nextDueAt: Date | null
  notes: string | null
  createdAt: Date
  patient: { firstName: string; lastName: string; patientNo: string }
  administeredBy?: { name: string } | null
}): NurseImmunizationListItem {
  return {
    id: record.id,
    patientId: record.patientId,
    patientName: `${record.patient.firstName} ${record.patient.lastName}`,
    patientNo: record.patient.patientNo,
    vaccineName: record.vaccineName,
    dose: record.dose,
    batchNumber: record.batchNumber,
    administeredAt: record.administeredAt.toISOString(),
    nextDueAt: record.nextDueAt?.toISOString() ?? null,
    notes: record.notes,
    administeredByName: record.administeredBy?.name ?? null,
    createdAt: record.createdAt.toISOString(),
  }
}

export function serializeNotification(notification: {
  id: string
  type: NurseNotificationItem["type"]
  priority: NurseNotificationItem["priority"]
  status: NurseNotificationItem["status"]
  title: string
  body: string | null
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
  createdAt: Date
  readAt: Date | null
}): NurseNotificationItem {
  return {
    ...notification,
    createdAt: notification.createdAt.toISOString(),
    readAt: notification.readAt?.toISOString() ?? null,
  }
}

export async function getPatientTriageProfile(
  patientId: string,
  facilityId: string
): Promise<PatientTriageProfile | null> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, registeredFacilityId: facilityId },
    include: {
      allergies: { orderBy: { createdAt: "desc" } },
      chronicConditions: { orderBy: { createdAt: "desc" } },
      medicationHistory: { orderBy: { createdAt: "desc" } },
      vitalSigns: {
        take: 20,
        orderBy: { capturedAt: "desc" },
        include: { patient: true, capturedBy: true },
      },
      immunizations: {
        take: 20,
        orderBy: { administeredAt: "desc" },
        include: { patient: true, administeredBy: true },
      },
      appointments: {
        where: { status: { in: ["SCHEDULED", "CHECKED_IN", "IN_PROGRESS"] } },
        take: 1,
        orderBy: { scheduledAt: "asc" },
        include: { department: true },
      },
      queueEntries: {
        take: 20,
        orderBy: { arrivedAt: "desc" },
        include: {
          department: true,
          patient: {
            include: {
              vitalSigns: {
                take: 1,
                orderBy: { capturedAt: "desc" },
              },
            },
          },
        },
      },
      encounters: {
        take: 1,
        orderBy: { startedAt: "desc" },
        include: { department: true, clinician: true },
      },
      labRequests: { take: 1, orderBy: { requestedAt: "desc" } },
      prescriptions: { take: 1, orderBy: { createdAt: "desc" } },
      invoices: { take: 1, orderBy: { createdAt: "desc" } },
    },
  })

  if (!patient) return null
  const activeQueue = patient.queueEntries.find((entry) =>
    ["WAITING", "IN_TRIAGE", "WITH_CLINICIAN"].includes(entry.status)
  )
  const latestEncounter = patient.encounters[0]

  return {
    id: patient.id,
    patientNo: patient.patientNo,
    firstName: patient.firstName,
    lastName: patient.lastName,
    otherNames: patient.otherNames,
    name: [patient.firstName, patient.otherNames, patient.lastName]
      .filter(Boolean)
      .join(" "),
    gender: patient.gender,
    age: getAge(patient.dateOfBirth, patient.estimatedAge),
    dateOfBirth: patient.dateOfBirth?.toISOString() ?? null,
    bloodGroup: patient.bloodGroup,
    status: patient.status,
    phone: patient.phone,
    community: patient.community,
    residentialAddress: patient.residentialAddress,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    emergencyContactRelation: patient.emergencyContactRelation,
    allergies: patient.allergies.map((item) => ({
      id: item.id,
      allergen: item.allergen,
      reaction: item.reaction,
      severity: item.severity,
      notes: item.notes,
    })),
    chronicConditions: patient.chronicConditions.map((item) => ({
      id: item.id,
      name: item.name,
      status: item.status,
      diagnosedAt: item.diagnosedAt?.toISOString() ?? null,
      notes: item.notes,
    })),
    medicationHistory: patient.medicationHistory.map((item) => ({
      id: item.id,
      medicationName: item.medicationName,
      dosage: item.dosage,
      frequency: item.frequency,
      startDate: item.startDate?.toISOString() ?? null,
      endDate: item.endDate?.toISOString() ?? null,
      notes: item.notes,
    })),
    previousVitals: patient.vitalSigns.map(serializeVitalSigns),
    immunizations: patient.immunizations.map(serializeImmunization),
    activeAppointment: patient.appointments[0]
      ? {
          id: patient.appointments[0].id,
          appointmentNo: patient.appointments[0].appointmentNo,
          status: patient.appointments[0].status,
          scheduledAt: patient.appointments[0].scheduledAt.toISOString(),
          departmentName: patient.appointments[0].department?.name ?? null,
        }
      : null,
    activeQueueEntry: activeQueue ? serializeQueueEntry(activeQueue) : null,
    queueHistory: patient.queueEntries.map(serializeQueueEntry),
    latestEncounterSummary: latestEncounter
      ? {
          id: latestEncounter.id,
          encounterNo: latestEncounter.encounterNo,
          visitType: latestEncounter.visitType,
          status: latestEncounter.status,
          departmentName: latestEncounter.department.name,
          clinicianName: latestEncounter.clinician?.name ?? null,
          chiefComplaint: latestEncounter.chiefComplaint,
          startedAt: latestEncounter.startedAt.toISOString(),
        }
      : null,
    readOnlyClinicalStatus: {
      latestLabStatus: patient.labRequests[0]?.status ?? null,
      latestPrescriptionStatus: patient.prescriptions[0]?.status ?? null,
      billingStatus: patient.invoices[0]?.status ?? null,
    },
  }
}

export function getNurseLookups() {
  return {
    genders: Object.values(Gender),
    bloodGroups: Object.values(BloodGroup),
    patientStatuses: Object.values(PatientStatus),
    visitTypes: Object.values(VisitType),
    appointmentStatuses: Object.values(AppointmentStatus),
    queueStatuses: Object.values(QueueStatus),
    triagePriorities: Object.values(TriagePriority),
  }
}

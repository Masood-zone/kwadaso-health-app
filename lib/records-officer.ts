import type { NextRequest } from "next/server"

import { requireRoleApi } from "@/lib/auth-session"
import type { AuthenticatedStaff } from "@/lib/auth-session"
import type { Prisma } from "@/lib/generated/prisma/client"
import {
  AppointmentStatus,
  AuditAction,
  BloodGroup,
  DocumentType,
  Gender,
  MaritalStatus,
  PatientStatus,
  QueueStatus,
  StaffRole,
  TriagePriority,
  VisitType,
} from "@/lib/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
export { generatePatientNo } from "@/lib/identifiers"
import type {
  RecordsOfficerAppointmentListItem,
  RecordsOfficerPatientDocumentListItem,
  RecordsOfficerPatientListItem,
  RecordsOfficerPatientProfile,
  RecordsOfficerQueueListItem,
  RecordsOfficerTimelineItem,
  RecordsOfficerVisitHistoryItem,
} from "@/types/records-officer"

export const recordsOfficerRoles = [
  StaffRole.RECORDS_OFFICER,
  StaffRole.FRONT_DESK,
] as const

export async function requireRecordsOfficerApi(request: NextRequest) {
  const result = await requireRoleApi(request, [...recordsOfficerRoles])
  if (result.response) return result

  if (!result.staff?.facilityId) {
    return {
      staff: result.staff,
      response: Response.json(
        {
          success: false,
          message: "Records Officer is not assigned to a facility.",
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

export async function writeRecordsOfficerAuditLog({
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

export async function generateAppointmentNo() {
  return `APT-SDA-${Date.now()}`
}

export async function generateQueueNo(departmentId: string) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  const count = await prisma.patientQueue.count({
    where: { departmentId, arrivedAt: { gte: start, lte: end } },
  })
  return `Q-${String(count + 1).padStart(3, "0")}`
}

export function serializeRecordsPatient(patient: {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: Gender
  dateOfBirth: Date | null
  estimatedAge: number | null
  phone: string | null
  community: string | null
  nhisNumber: string | null
  nationalIdNumber: string | null
  status: PatientStatus
  createdAt: Date
  updatedAt: Date
}): RecordsOfficerPatientListItem {
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
    phone: patient.phone,
    community: patient.community,
    nhisNumber: patient.nhisNumber,
    nationalIdNumber: patient.nationalIdNumber,
    status: patient.status,
    registeredAt: patient.createdAt.toISOString(),
    updatedAt: patient.updatedAt.toISOString(),
  }
}

export function serializeRecordsAppointment(appointment: {
  id: string
  appointmentNo: string
  patientId: string
  departmentId: string | null
  clinicianId: string | null
  title: string | null
  reason: string | null
  notes: string | null
  scheduledAt: Date
  durationMinutes: number
  status: AppointmentStatus
  checkedInAt: Date | null
  cancelledAt: Date | null
  cancellationReason: string | null
  patient: { firstName: string; lastName: string; patientNo: string }
  department?: { name: string } | null
  clinician?: { name: string } | null
}): RecordsOfficerAppointmentListItem {
  return {
    id: appointment.id,
    appointmentNo: appointment.appointmentNo,
    patientId: appointment.patientId,
    patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
    patientNo: appointment.patient.patientNo,
    departmentId: appointment.departmentId,
    departmentName: appointment.department?.name ?? null,
    clinicianId: appointment.clinicianId,
    clinicianName: appointment.clinician?.name ?? null,
    title: appointment.title,
    reason: appointment.reason,
    notes: appointment.notes,
    scheduledAt: appointment.scheduledAt.toISOString(),
    durationMinutes: appointment.durationMinutes,
    status: appointment.status,
    checkedInAt: appointment.checkedInAt?.toISOString() ?? null,
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    cancellationReason: appointment.cancellationReason,
  }
}

export function serializeRecordsQueue(queue: {
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
  cancelledAt: Date | null
  cancellationReason: string | null
  patient: { firstName: string; lastName: string; patientNo: string }
  department: { name: string }
}): RecordsOfficerQueueListItem {
  return {
    id: queue.id,
    queueNo: queue.queueNo,
    patientId: queue.patientId,
    patientName: `${queue.patient.firstName} ${queue.patient.lastName}`,
    patientNo: queue.patient.patientNo,
    appointmentId: queue.appointmentId,
    departmentId: queue.departmentId,
    departmentName: queue.department.name,
    priority: queue.priority,
    status: queue.status,
    reason: queue.reason,
    notes: queue.notes,
    arrivedAt: queue.arrivedAt.toISOString(),
    cancelledAt: queue.cancelledAt?.toISOString() ?? null,
    cancellationReason: queue.cancellationReason,
  }
}

export function serializeRecordsDocument(document: {
  id: string
  patientId: string
  type: DocumentType
  title: string
  fileUrl: string
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  createdAt: Date
  uploadedBy?: { name: string } | null
}): RecordsOfficerPatientDocumentListItem {
  return {
    id: document.id,
    patientId: document.patientId,
    type: document.type,
    title: document.title,
    fileUrl: document.fileUrl,
    fileName: document.fileName,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    uploadedByName: document.uploadedBy?.name ?? null,
    createdAt: document.createdAt.toISOString(),
  }
}

export function serializeVisitHistory(encounter: {
  id: string
  encounterNo: string
  visitType: VisitType
  status: string
  chiefComplaint: string | null
  startedAt: Date
  completedAt: Date | null
  department: { name: string }
  clinician?: { name: string } | null
}): RecordsOfficerVisitHistoryItem {
  return {
    id: encounter.id,
    encounterNo: encounter.encounterNo,
    visitType: encounter.visitType,
    status: encounter.status,
    departmentName: encounter.department.name,
    clinicianName: encounter.clinician?.name ?? null,
    chiefComplaint: encounter.chiefComplaint,
    startedAt: encounter.startedAt.toISOString(),
    completedAt: encounter.completedAt?.toISOString() ?? null,
  }
}

export function serializeTimelineItem(
  id: string,
  type: string,
  title: string,
  description: string | null,
  status: string | null,
  occurredAt: Date
): RecordsOfficerTimelineItem {
  return {
    id,
    type,
    title,
    description,
    status,
    occurredAt: occurredAt.toISOString(),
  }
}

export async function getRecordsPatientProfile(
  patientId: string,
  facilityId: string
): Promise<RecordsOfficerPatientProfile | null> {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, registeredFacilityId: facilityId },
    include: {
      registeredBy: true,
      appointments: {
        orderBy: { scheduledAt: "desc" },
        take: 20,
        include: { patient: true, department: true, clinician: true },
      },
      queueEntries: {
        orderBy: { arrivedAt: "desc" },
        take: 20,
        include: { patient: true, department: true },
      },
      documents: {
        orderBy: { createdAt: "desc" },
        include: { uploadedBy: true },
      },
      encounters: {
        orderBy: { startedAt: "desc" },
        take: 20,
        include: { department: true, clinician: true },
      },
      diagnoses: { orderBy: { createdAt: "desc" }, take: 1 },
      labRequests: { orderBy: { requestedAt: "desc" }, take: 1 },
      prescriptions: { orderBy: { createdAt: "desc" }, take: 1 },
      invoices: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  })

  if (!patient) return null

  return {
    ...serializeRecordsPatient(patient),
    email: patient.email,
    residentialAddress: patient.residentialAddress,
    maritalStatus: patient.maritalStatus,
    bloodGroup: patient.bloodGroup,
    occupation: patient.occupation,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactPhone: patient.emergencyContactPhone,
    emergencyContactRelation: patient.emergencyContactRelation,
    registeredByName: patient.registeredBy?.name ?? null,
    appointments: patient.appointments.map(serializeRecordsAppointment),
    queueHistory: patient.queueEntries.map(serializeRecordsQueue),
    documents: patient.documents.map(serializeRecordsDocument),
    visitHistory: patient.encounters.map(serializeVisitHistory),
    summary: {
      lastEncounter: patient.encounters[0]?.encounterNo ?? null,
      lastDiagnosis: patient.diagnoses[0]?.name ?? null,
      latestLabStatus: patient.labRequests[0]?.status ?? null,
      latestPrescriptionStatus: patient.prescriptions[0]?.status ?? null,
      outstandingInvoiceStatus: patient.invoices[0]?.status ?? null,
    },
  }
}

export function getRecordsLookups() {
  return {
    genders: Object.values(Gender),
    maritalStatuses: Object.values(MaritalStatus),
    bloodGroups: Object.values(BloodGroup),
    patientStatuses: Object.values(PatientStatus),
    appointmentStatuses: Object.values(AppointmentStatus),
    queueStatuses: Object.values(QueueStatus),
    triagePriorities: Object.values(TriagePriority),
    documentTypes: Object.values(DocumentType),
    visitTypes: Object.values(VisitType),
  }
}

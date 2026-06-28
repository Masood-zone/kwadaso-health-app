import type {
  AppointmentStatus,
  BloodGroup,
  DocumentType,
  Gender,
  MaritalStatus,
  PatientStatus,
  QueueStatus,
  TriagePriority,
  VisitType,
} from "@/lib/generated/prisma/enums"
import type { DashboardMetric } from "@/types/dashboard"

export type RecordsOfficerDashboardSummary = {
  facilityName: string
  metrics: DashboardMetric[]
  recentPatients: RecordsOfficerPatientListItem[]
  todayAppointments: RecordsOfficerAppointmentListItem[]
  activeQueue: RecordsOfficerQueueListItem[]
  duplicateWarnings: RecordsOfficerDuplicatePatientMatch[]
}

export type RecordsOfficerPatientListItem = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  otherNames: string | null
  name: string
  gender: Gender
  age: number | null
  dateOfBirth: string | null
  phone: string | null
  community: string | null
  nhisNumber: string | null
  nationalIdNumber: string | null
  status: PatientStatus
  registeredAt: string
  updatedAt: string
}

export type RecordsOfficerPatientCreatePayload = {
  firstName: string
  lastName: string
  otherNames?: string | null
  gender: Gender
  dateOfBirth?: string | null
  estimatedAge?: number | null
  maritalStatus?: MaritalStatus
  bloodGroup?: BloodGroup
  occupation?: string | null
  phone?: string | null
  email?: string | null
  residentialAddress?: string | null
  community?: string | null
  nhisNumber?: string | null
  nationalIdNumber?: string | null
  emergencyContactName?: string | null
  emergencyContactPhone?: string | null
  emergencyContactRelation?: string | null
}

export type RecordsOfficerPatientUpdatePayload =
  RecordsOfficerPatientCreatePayload & {
    status?: PatientStatus
    updateReason?: string | null
  }

export type RecordsOfficerPatientFilters = {
  search?: string
  patientNo?: string
  nhisNumber?: string
  nationalIdNumber?: string
  phone?: string
  gender?: Gender | ""
  status?: PatientStatus | ""
  community?: string
  registeredFrom?: string
  registeredTo?: string
}

export type RecordsOfficerPatientProfile = RecordsOfficerPatientListItem & {
  email: string | null
  residentialAddress: string | null
  maritalStatus: MaritalStatus
  bloodGroup: BloodGroup
  occupation: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
  registeredByName: string | null
  appointments: RecordsOfficerAppointmentListItem[]
  queueHistory: RecordsOfficerQueueListItem[]
  documents: RecordsOfficerPatientDocumentListItem[]
  visitHistory: RecordsOfficerVisitHistoryItem[]
  summary: {
    lastEncounter: string | null
    lastDiagnosis: string | null
    latestLabStatus: string | null
    latestPrescriptionStatus: string | null
    outstandingInvoiceStatus: string | null
  }
}

export type RecordsOfficerPatientDocumentPayload = {
  type: DocumentType
  title: string
  fileUrl: string
  fileName?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
}

export type RecordsOfficerPatientDocumentListItem = {
  id: string
  patientId: string
  type: DocumentType
  title: string
  fileUrl: string
  fileName: string | null
  mimeType: string | null
  sizeBytes: number | null
  uploadedByName: string | null
  createdAt: string
}

export type RecordsOfficerDuplicatePatientMatch = {
  id: string
  patient: RecordsOfficerPatientListItem
  match: RecordsOfficerPatientListItem
  score: number
  matchingFields: string[]
}

export type RecordsOfficerAppointmentListItem = {
  id: string
  appointmentNo: string
  patientId: string
  patientName: string
  patientNo: string
  departmentId: string | null
  departmentName: string | null
  clinicianId: string | null
  clinicianName: string | null
  title: string | null
  reason: string | null
  notes: string | null
  scheduledAt: string
  durationMinutes: number
  status: AppointmentStatus
  checkedInAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
}

export type RecordsOfficerAppointmentCreatePayload = {
  patientId: string
  departmentId: string
  clinicianId?: string | null
  scheduledAt: string
  durationMinutes: number
  title?: string | null
  reason?: string | null
  notes?: string | null
}

export type RecordsOfficerAppointmentUpdatePayload =
  RecordsOfficerAppointmentCreatePayload & {
    status: AppointmentStatus
    cancellationReason?: string | null
  }

export type RecordsOfficerAppointmentFilters = {
  dateFrom?: string
  dateTo?: string
  status?: AppointmentStatus | ""
  departmentId?: string
  clinicianId?: string
  patientSearch?: string
}

export type RecordsOfficerCheckInPayload = {
  patientId: string
  appointmentId?: string | null
  departmentId: string
  priority: TriagePriority
  reason?: string | null
  notes?: string | null
}

export type RecordsOfficerQueueCreatePayload = RecordsOfficerCheckInPayload

export type RecordsOfficerQueueUpdatePayload = {
  priority: TriagePriority
  status: "WAITING" | "IN_TRIAGE" | "CANCELLED"
  notes?: string | null
  cancellationReason?: string | null
}

export type RecordsOfficerQueueListItem = {
  id: string
  queueNo: string
  patientId: string
  patientName: string
  patientNo: string
  appointmentId: string | null
  departmentId: string
  departmentName: string
  priority: TriagePriority
  status: QueueStatus
  reason: string | null
  notes: string | null
  arrivedAt: string
  cancelledAt: string | null
  cancellationReason: string | null
}

export type RecordsOfficerQueueFilters = {
  date?: string
  departmentId?: string
  status?: QueueStatus | ""
  priority?: TriagePriority | ""
}

export type RecordsOfficerVisitHistoryItem = {
  id: string
  encounterNo: string
  visitType: VisitType
  status: string
  departmentName: string
  clinicianName: string | null
  chiefComplaint: string | null
  startedAt: string
  completedAt: string | null
}

export type RecordsOfficerTimelineItem = {
  id: string
  type: string
  title: string
  description: string | null
  status: string | null
  occurredAt: string
}

export type RecordsOfficerPrintExportPayload = {
  action: "PRINT" | "EXPORT"
  sections: string[]
}

export type RecordsOfficerPrintExportResponse = {
  patient: RecordsOfficerPatientProfile
  sections: string[]
  generatedAt: string
}

export type RecordsOfficerLookups = {
  genders: Gender[]
  maritalStatuses: MaritalStatus[]
  bloodGroups: BloodGroup[]
  patientStatuses: PatientStatus[]
  appointmentStatuses: AppointmentStatus[]
  queueStatuses: QueueStatus[]
  triagePriorities: TriagePriority[]
  documentTypes: DocumentType[]
  visitTypes: VisitType[]
  departments: { id: string; name: string; code: string }[]
  clinicians: { id: string; name: string; role: string }[]
}

import type {
  AppointmentStatus,
  BloodGroup,
  Gender,
  MessagePriority,
  NotificationStatus,
  NotificationType,
  PatientStatus,
  QueueStatus,
  TriagePriority,
  VisitType,
} from "@/lib/generated/prisma/enums"
import type { DashboardMetric } from "@/types/dashboard"

export type NurseDashboardSummary = {
  facilityName: string
  departmentName: string
  metrics: DashboardMetric[]
  triageQueue: NurseTriageQueueItem[]
  emergencyPatients: NurseTriageQueueItem[]
  recentVitals: NurseVitalSignsListItem[]
  recentImmunizations: NurseImmunizationListItem[]
}

export type NurseTriageQueueItem = {
  id: string
  queueNo: string
  patientId: string
  patientName: string
  patientNo: string
  gender: Gender
  age: number | null
  departmentId: string
  departmentName: string
  appointmentId: string | null
  priority: TriagePriority
  status: QueueStatus
  reason: string | null
  notes: string | null
  arrivedAt: string
  calledAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  waitingMinutes: number
  latestVitals: NurseVitalsSnapshot | null
}

export type NurseTriageQueueFilters = {
  departmentId?: string
  status?: QueueStatus | ""
  priority?: TriagePriority | ""
  search?: string
  queueNo?: string
  date?: string
}

export type NurseQueueUpdatePayload = {
  status?: "WAITING" | "IN_TRIAGE" | "WITH_CLINICIAN" | "CANCELLED"
  priority?: TriagePriority
  notes?: string | null
  cancellationReason?: string | null
}

export type NurseVitalsSnapshot = {
  id: string
  temperatureC: number | null
  systolicBp: number | null
  diastolicBp: number | null
  pulseRate: number | null
  oxygenSaturation: number | null
  triagePriority: TriagePriority
  capturedAt: string
}

export type NurseVitalSignsCreatePayload = {
  encounterId?: string | null
  queueId?: string | null
  temperatureC?: number | null
  systolicBp?: number | null
  diastolicBp?: number | null
  pulseRate?: number | null
  respiratoryRate?: number | null
  oxygenSaturation?: number | null
  weightKg?: number | null
  heightCm?: number | null
  painScore?: number | null
  triagePriority: TriagePriority
  notes?: string | null
}

export type NurseVitalSignsUpdatePayload = NurseVitalSignsCreatePayload

export type NurseVitalSignsListItem = {
  id: string
  patientId: string
  patientName: string
  patientNo: string
  encounterId: string | null
  temperatureC: number | null
  systolicBp: number | null
  diastolicBp: number | null
  pulseRate: number | null
  respiratoryRate: number | null
  oxygenSaturation: number | null
  weightKg: number | null
  heightCm: number | null
  bmi: number | null
  painScore: number | null
  triagePriority: TriagePriority
  notes: string | null
  capturedByName: string | null
  capturedAt: string
}

export type PatientTriageProfile = {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  otherNames: string | null
  name: string
  gender: Gender
  age: number | null
  dateOfBirth: string | null
  bloodGroup: BloodGroup
  status: PatientStatus
  phone: string | null
  community: string | null
  residentialAddress: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  emergencyContactRelation: string | null
  allergies: {
    id: string
    allergen: string
    reaction: string | null
    severity: string
    notes: string | null
  }[]
  chronicConditions: {
    id: string
    name: string
    status: string | null
    diagnosedAt: string | null
    notes: string | null
  }[]
  medicationHistory: {
    id: string
    medicationName: string
    dosage: string | null
    frequency: string | null
    startDate: string | null
    endDate: string | null
    notes: string | null
  }[]
  previousVitals: NurseVitalSignsListItem[]
  immunizations: NurseImmunizationListItem[]
  activeAppointment: {
    id: string
    appointmentNo: string
    status: AppointmentStatus
    scheduledAt: string
    departmentName: string | null
  } | null
  activeQueueEntry: NurseTriageQueueItem | null
  queueHistory: NurseTriageQueueItem[]
  latestEncounterSummary: {
    id: string
    encounterNo: string
    visitType: VisitType
    status: string
    departmentName: string
    clinicianName: string | null
    chiefComplaint: string | null
    startedAt: string
  } | null
  readOnlyClinicalStatus: {
    latestLabStatus: string | null
    latestPrescriptionStatus: string | null
    billingStatus: string | null
  }
}

export type NurseEmergencyFlagPayload = {
  reason: string
  notes?: string | null
  vitalSigns?: Partial<NurseVitalSignsCreatePayload> | null
  notifyClinician?: boolean
}

export type NurseImmunizationCreatePayload = {
  vaccineName: string
  dose?: string | null
  batchNumber?: string | null
  administeredAt: string
  nextDueAt?: string | null
  notes?: string | null
}

export type NurseImmunizationUpdatePayload = NurseImmunizationCreatePayload

export type NurseImmunizationListItem = {
  id: string
  patientId: string
  patientName: string
  patientNo: string
  vaccineName: string
  dose: string | null
  batchNumber: string | null
  administeredAt: string
  nextDueAt: string | null
  notes: string | null
  administeredByName: string | null
  createdAt: string
}

export type NurseImmunizationFilters = {
  search?: string
  vaccineName?: string
  dateFrom?: string
  dateTo?: string
  nextDueFrom?: string
  nextDueTo?: string
  administeredById?: string
}

export type NurseObservationPayload = {
  notes?: string | null
}

export type NurseHandoverSummaryItem = {
  id: string
  patientName: string
  queueNo: string
  priority: TriagePriority
  status: QueueStatus
  latestVitals: NurseVitalsSnapshot | null
  notes: string | null
}

export type NurseNotificationItem = {
  id: string
  type: NotificationType
  priority: MessagePriority
  status: NotificationStatus
  title: string
  body: string | null
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
  createdAt: string
  readAt: string | null
}

export type NurseNotificationUpdatePayload = {
  status: "READ" | "ARCHIVED"
}

export type NurseLookups = {
  genders: Gender[]
  bloodGroups: BloodGroup[]
  patientStatuses: PatientStatus[]
  visitTypes: VisitType[]
  appointmentStatuses: AppointmentStatus[]
  queueStatuses: QueueStatus[]
  triagePriorities: TriagePriority[]
  departments: { id: string; name: string; code: string }[]
}

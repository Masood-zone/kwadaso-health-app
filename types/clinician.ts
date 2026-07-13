import type {
  AppointmentStatus,
  BloodGroup,
  EncounterStatus,
  Gender,
  LabPriority,
  LabRequestStatus,
  LabResultStatus,
  MessagePriority,
  NotificationStatus,
  NotificationType,
  PrescriptionStatus,
  QueueStatus,
  ReferralStatus,
  TriagePriority,
  VisitType,
} from "@/lib/generated/prisma/enums"

export type ClinicianMetric = {
  label: string
  value: number
  detail: string
  tone: "green" | "orange" | "red" | "blue"
}

export type ClinicianDashboardSummary = {
  facilityName: string
  clinicianName: string
  metrics: ClinicianMetric[]
  queue: ConsultationQueueItem[]
  criticalResults: ClinicianLabResult[]
  notifications: ClinicianNotificationItem[]
}

export type ClinicianVitalsSnapshot = {
  id: string
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
  capturedAt: string
}

export type ConsultationQueueItem = {
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
  assignedToId: string | null
  assignedToName: string | null
  priority: TriagePriority
  status: QueueStatus
  reason: string | null
  notes: string | null
  arrivedAt: string
  waitingMinutes: number
  allergies: { id: string; allergen: string; severity: string }[]
  latestVitals: ClinicianVitalsSnapshot | null
  encounter: ClinicianEncounterListItem | null
}

export type ConsultationQueueFilters = {
  search?: string
  queueNo?: string
  departmentId?: string
  priority?: TriagePriority | ""
  status?: QueueStatus | ""
  date?: string
}

export type ClinicianEncounterListItem = {
  id: string
  encounterNo: string
  patientId: string
  patientName: string
  patientNo: string
  appointmentId: string | null
  queueId: string | null
  facilityId: string
  departmentId: string
  departmentName: string
  clinicianId: string | null
  clinicianName: string | null
  visitType: VisitType
  status: EncounterStatus
  chiefComplaint: string | null
  startedAt: string
  completedAt: string | null
  canEdit: boolean
}

export type EncounterCreatePayload = {
  patientId: string
  appointmentId?: string | null
  departmentId: string
  visitType: VisitType
  chiefComplaint?: string | null
  queueId?: string | null
}

export type EncounterUpdatePayload = Partial<
  Pick<EncounterCreatePayload, "departmentId" | "visitType" | "chiefComplaint">
> & { status?: EncounterStatus }

export type ClinicalNotePayload = {
  subjective?: string | null
  objective?: string | null
  assessment?: string | null
  plan?: string | null
  notes?: string | null
  sign?: boolean
}

export type ClinicianClinicalNote = ClinicalNotePayload & {
  id: string
  patientId: string
  encounterId: string
  authoredById: string | null
  authoredByName: string | null
  signedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DiagnosisPayload = {
  code?: string | null
  name: string
  isPrimary?: boolean
  notes?: string | null
}

export type ClinicianDiagnosis = DiagnosisPayload & {
  id: string
  patientId: string
  encounterId: string
  diagnosedById: string | null
  diagnosedByName: string | null
  createdAt: string
}

export type LabRequestTestPayload = { testId: string; notes?: string | null }
export type LabRequestPayload = {
  priority: LabPriority
  clinicalNotes?: string | null
  tests: LabRequestTestPayload[]
}

export type ClinicianLabRequest = {
  id: string
  requestNo: string
  patientId: string
  patientName: string
  encounterId: string | null
  requestedById: string | null
  requestedByName: string | null
  priority: LabPriority
  status: LabRequestStatus
  clinicalNotes: string | null
  requestedAt: string
  completedAt: string | null
  cancelledAt: string | null
  tests: {
    id: string
    testId: string
    name: string
    notes: string | null
    resultId: string | null
  }[]
}

export type ClinicianLabResult = {
  id: string
  resultNo: string
  patientId: string
  patientName: string
  encounterId: string | null
  testName: string
  status: LabResultStatus
  resultText: string | null
  abnormalFlag: boolean
  criticalFlag: boolean
  releasedAt: string | null
  validatedAt: string | null
  notes: string | null
  items: {
    id: string
    parameterName: string
    value: string | null
    unit: string | null
    referenceRange: string | null
    isAbnormal: boolean
  }[]
}

export type PrescriptionItemPayload = {
  medicationId?: string | null
  medicineName: string
  dosage?: string | null
  frequency?: string | null
  duration?: string | null
  quantity?: number | null
  instructions?: string | null
}

export type PrescriptionPayload = {
  status: "DRAFT" | "ISSUED"
  notes?: string | null
  items: PrescriptionItemPayload[]
}

export type ClinicianPrescription = {
  id: string
  prescriptionNo: string
  patientId: string
  patientName: string
  encounterId: string | null
  prescribedById: string | null
  prescribedByName: string | null
  status: PrescriptionStatus
  notes: string | null
  issuedAt: string | null
  createdAt: string
  items: (PrescriptionItemPayload & { id: string })[]
}

export type FollowUpAppointmentPayload = {
  scheduledAt: string
  durationMinutes: number
  departmentId: string
  clinicianId?: string | null
  title?: string | null
  reason: string
}

export type ClinicianFollowUp = {
  id: string
  appointmentNo: string
  patientId: string
  patientName: string
  departmentName: string | null
  clinicianName: string | null
  scheduledAt: string
  durationMinutes: number
  title: string | null
  reason: string | null
  status: AppointmentStatus
}

export type ReferralPayload = {
  toDepartmentId?: string | null
  toFacilityId?: string | null
  reason: string
  clinicalSummary?: string | null
  urgency: TriagePriority
}

export type ClinicianReferral = ReferralPayload & {
  id: string
  referralNo: string
  patientId: string
  patientName: string
  encounterId: string | null
  fromDepartmentName: string | null
  toDepartmentName: string | null
  toFacilityName: string | null
  referredByName: string | null
  status: ReferralStatus
  sentAt: string | null
  createdAt: string
}

export type PatientClinicalProfile = {
  id: string
  patientNo: string
  name: string
  firstName: string
  lastName: string
  otherNames: string | null
  gender: Gender
  age: number | null
  dateOfBirth: string | null
  bloodGroup: BloodGroup
  phone: string | null
  community: string | null
  residentialAddress: string | null
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
  immunizations: {
    id: string
    vaccineName: string
    dose: string | null
    administeredAt: string
    nextDueAt: string | null
  }[]
  vitalSigns: ClinicianVitalsSnapshot[]
  encounters: ClinicianEncounterListItem[]
  diagnoses: ClinicianDiagnosis[]
  clinicalNotes: ClinicianClinicalNote[]
  labRequests: ClinicianLabRequest[]
  labResults: ClinicianLabResult[]
  prescriptions: ClinicianPrescription[]
  referrals: ClinicianReferral[]
  appointments: ClinicianFollowUp[]
  queueHistory: ConsultationQueueItem[]
  activeQueue: ConsultationQueueItem | null
  billingStatus: string | null
  dispensingStatus: string | null
}

export type ClinicianPatientListItem = Pick<
  PatientClinicalProfile,
  "id" | "patientNo" | "name" | "gender" | "age" | "phone" | "community"
> & {
  latestEncounterStatus: EncounterStatus | null
  activeQueueStatus: QueueStatus | null
}

export type ClinicianEncounterDetail = ClinicianEncounterListItem & {
  patient: PatientClinicalProfile
  clinicalNotes: ClinicianClinicalNote[]
  diagnoses: ClinicianDiagnosis[]
  labRequests: ClinicianLabRequest[]
  prescriptions: ClinicianPrescription[]
  referrals: ClinicianReferral[]
  followUps: ClinicianFollowUp[]
  completion: { blockers: string[]; warnings: string[]; canComplete: boolean }
}

export type ClinicianNotificationItem = {
  id: string
  type: NotificationType
  priority: MessagePriority
  status: NotificationStatus
  title: string
  body: string | null
  actionUrl: string | null
  createdAt: string
}

export type ClinicianMessageThread = {
  id: string
  subject: string
  patientId: string | null
  patientName: string | null
  encounterId: string | null
  priority: MessagePriority
  isClosed: boolean
  participants: { id: string; name: string; role: string }[]
  messages: {
    id: string
    senderId: string | null
    senderName: string | null
    body: string
    sentAt: string
  }[]
  updatedAt: string
}

export type ClinicianLookups = {
  departments: { id: string; name: string; type: string }[]
  clinicians: {
    id: string
    name: string
    role: string
    departmentId: string | null
  }[]
  staff: {
    id: string
    name: string
    role: string
    departmentId: string | null
  }[]
  labTests: {
    id: string
    code: string
    name: string
    category: string | null
    sampleType: string | null
  }[]
  medications: {
    id: string
    code: string | null
    name: string
    genericName: string | null
    strength: string | null
    dosageForm: string | null
  }[]
  facilities: { id: string; name: string }[]
}

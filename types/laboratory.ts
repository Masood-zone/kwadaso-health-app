import type {
  LabPriority,
  LabRequestStatus,
  LabResultStatus,
  NotificationStatus,
  NotificationType,
  SampleStatus,
} from "@/lib/generated/prisma/enums"

export type LaboratoryTone = "green" | "orange" | "red" | "blue" | "neutral"

export type LaboratoryMetric = {
  label: string
  value: string
  detail: string
  tone: LaboratoryTone
}

export type LaboratoryDashboardSummary = {
  facilityName: string
  metrics: LaboratoryMetric[]
  delayedRequests: LabRequestQueueItem[]
  categoryVolume: { category: string; count: number }[]
  workflowEfficiency: {
    sampleReception: number
    processing: number
    validation: number
  }
}

export type LaboratoryPage<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export type LabRequestFilters = {
  search?: string
  requestNo?: string
  priority?: LabPriority
  status?: LabRequestStatus
  testId?: string
  clinicianId?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type LabRequestQueueItem = {
  id: string
  requestNo: string
  patientId: string
  patientName: string
  patientNo: string
  requestedTests: string[]
  requestedById: string | null
  requestedByName: string | null
  priority: LabPriority
  status: LabRequestStatus
  requestedAt: string
  completedAt: string | null
  turnaroundMinutes: number | null
}

export type LabRequestTimelineItem = {
  label: string
  at: string
  detail?: string | null
  tone: LaboratoryTone
}

export type LabRequestDetail = LabRequestQueueItem & {
  clinicalNotes: string | null
  cancellationReason: string | null
  patient: {
    id: string
    patientNo: string
    name: string
    gender: string
    age: number | null
    bloodGroup: string
    allergies: { allergen: string; severity: string; reaction: string | null }[]
    chronicConditions: { name: string; status: string | null }[]
  }
  encounter: {
    id: string
    encounterNo: string
    status: string
    chiefComplaint: string | null
    appointmentNo: string | null
    billingStatus: string | null
  } | null
  tests: LabRequestTestDetail[]
  samples: LabSampleListItem[]
  results: LabResultDetail[]
  timeline: LabRequestTimelineItem[]
}

export type LabRequestTestDetail = {
  id: string
  testId: string
  code: string
  name: string
  category: string | null
  sampleType: string | null
  notes: string | null
  resultId: string | null
  resultStatus: LabResultStatus | null
  parameterDefinitions: LabTestParameterDefinitionInput[]
}

export type LabRequestStatusUpdatePayload = {
  status: LabRequestStatus
  cancellationReason?: string | null
}

export type LabSampleFilters = {
  search?: string
  status?: SampleStatus
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type LabSampleCreatePayload = {
  sampleType: string
  notes?: string | null
}

export type LabSampleUpdatePayload = {
  status: SampleStatus
  notes?: string | null
  rejectionReason?: string | null
}

export type LabSampleListItem = {
  id: string
  sampleNo: string
  labRequestId: string
  requestNo: string
  patientId: string
  patientName: string
  patientNo: string
  sampleType: string
  status: SampleStatus
  collectedByName: string | null
  collectedAt: string | null
  receivedByName: string | null
  receivedAt: string | null
  rejectionReason: string | null
  notes: string | null
}

export type LabSampleDetail = LabSampleListItem & {
  request: LabRequestQueueItem
  relatedResults: LabResultListItem[]
  timeline: LabRequestTimelineItem[]
}

export type LabResultParameterPayload = {
  id?: string
  parameterDefinitionId?: string | null
  parameterName: string
  value?: string | null
  unit?: string | null
  referenceRange?: string | null
  isAbnormal?: boolean
  isCritical?: boolean
}

export type LabResultCreatePayload = {
  labSampleId: string
  resultText?: string | null
  notes?: string | null
  status: "DRAFT" | "ENTERED"
  abnormalFlag?: boolean
  criticalFlag?: boolean
  parameters: LabResultParameterPayload[]
}

export type LabResultUpdatePayload = Partial<LabResultCreatePayload>

export type LabResultFilters = {
  search?: string
  status?: LabResultStatus
  testId?: string
  clinicianId?: string
  abnormal?: boolean
  critical?: boolean
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export type LabResultListItem = {
  id: string
  resultNo: string
  requestId: string
  requestNo: string
  requestTestId: string
  patientId: string
  patientName: string
  patientNo: string
  testId: string
  testName: string
  sampleId: string | null
  sampleNo: string | null
  status: LabResultStatus
  resultText: string | null
  abnormalFlag: boolean
  criticalFlag: boolean
  enteredByName: string | null
  enteredAt: string | null
  validatedByName: string | null
  validatedAt: string | null
  releasedAt: string | null
  requestedByName: string | null
  criticalAlert?: {
    sent: boolean
    acknowledged: boolean
    sentAt: string | null
  }
}

export type LabResultDetail = LabResultListItem & {
  notes: string | null
  validationNote: string | null
  parameters: (LabResultParameterPayload & {
    id: string
    isAbnormal: boolean
    isCritical: boolean
  })[]
  parameterDefinitions: LabTestParameterDefinitionInput[]
  clinicalContext: {
    allergies: string[]
    chronicConditions: string[]
    diagnoses: string[]
    medications: string[]
  }
  criticalAlert: {
    sent: boolean
    acknowledged: boolean
    sentAt: string | null
  }
}

export type ResultValidationPayload = {
  decision: "VALIDATE" | "REJECT"
  note?: string | null
  criticalConfirmed?: boolean
}

export type ResultReleasePayload = { note?: string | null }
export type CriticalResultAlertPayload = { confirmed: true; reason: string }

export type LabTestParameterDefinitionInput = {
  id?: string
  name: string
  unit?: string | null
  referenceRange?: string | null
  referenceLow?: number | null
  referenceHigh?: number | null
  criticalLow?: number | null
  criticalHigh?: number | null
  isRequired: boolean
  sortOrder: number
  isActive: boolean
}

export type LabTestCatalogItem = {
  id: string
  facilityId: string
  code: string
  name: string
  category: string | null
  sampleType: string | null
  unit: string | null
  referenceRange: string | null
  price: number | null
  turnaroundHours: number | null
  isActive: boolean
  parameters: LabTestParameterDefinitionInput[]
  requestCount?: number
}

export type LabTestCreatePayload = Omit<LabTestCatalogItem, "id" | "facilityId" | "requestCount">
export type LabTestUpdatePayload = Partial<LabTestCreatePayload>

export type LaboratoryReportFilters = {
  dateFrom?: string
  dateTo?: string
  testId?: string
  status?: LabRequestStatus
  priority?: LabPriority
}

export type LaboratoryReportData = {
  metrics: LaboratoryMetric[]
  byCategory: { label: string; count: number }[]
  byClinician: { label: string; count: number }[]
  byDate: { label: string; requested: number; completed: number }[]
  rows: LabRequestQueueItem[]
  exports: LaboratoryReportExport[]
}

export type LaboratoryReportExport = {
  id: string
  title: string
  status: string
  rowCount: number | null
  dateFrom: string | null
  dateTo: string | null
  generatedAt: string
}

export type LaboratoryNotificationItem = {
  id: string
  type: NotificationType
  status: NotificationStatus
  priority: string
  title: string
  body: string | null
  actionUrl: string | null
  entityType: string | null
  entityId: string | null
  readAt: string | null
  createdAt: string
}

export type LaboratoryNotificationUpdatePayload = {
  status: Extract<NotificationStatus, "READ" | "ARCHIVED">
}

export type LaboratoryPatientHistory = {
  patient: LabRequestDetail["patient"]
  requests: LabRequestQueueItem[]
  samples: LabSampleListItem[]
  results: LabResultListItem[]
  trends: {
    testName: string
    parameterName: string
    points: { date: string; value: number; referenceRange: string | null }[]
  }[]
}

export type LaboratoryLookups = {
  priorities: LabPriority[]
  requestStatuses: LabRequestStatus[]
  sampleStatuses: SampleStatus[]
  resultStatuses: LabResultStatus[]
  notificationStatuses: NotificationStatus[]
  tests: LabTestCatalogItem[]
  clinicians: { id: string; name: string }[]
  canManageCatalog: boolean
}

import type { SuperAdminManagementData } from "@/types/super-admin"

export type DashboardMetric = {
  label: string
  value: string
  detail: string
  tone: "green" | "orange" | "red" | "blue"
}

export type ActivityItem = {
  id: string
  label: string
  detail: string
  timestamp: string
}

export type SuperAdminDashboardData = {
  facilityName: string
  metrics: DashboardMetric[]
  roleOverview: {
    role: string
    users: number
    permissions: number
  }[]
  auditLogs: ActivityItem[]
  departments: {
    id: string
    name: string
    type: string
    staffCount: number
  }[]
  management: SuperAdminManagementData
}

export type HospitalAdminDashboardData = {
  facilityName: string
  metrics: DashboardMetric[]
  patientFlow: {
    label: string
    value: number
  }[]
  departments: {
    id: string
    name: string
    staffCount: number
    openEncounters: number
    queueCount: number
  }[]
  staffActivity: ActivityItem[]
}

export type HospitalAdminPatientFlowData = {
  facilityName: string
  metrics: DashboardMetric[]
  movement: {
    label: string
    arrivals: number
    completed: number
  }[]
  activeEncounters: {
    id: string
    encounterNo: string
    patientName: string
    patientNo: string
    departmentName: string
    status: string
    startedAt: string
  }[]
}

export type HospitalAdminDepartmentActivityData = {
  facilityName: string
  departments: {
    id: string
    name: string
    type: string
    staffCount: number
    appointmentsToday: number
    queueCount: number
    openEncounters: number
    loadPercent: number
    status: string
  }[]
}

export type HospitalAdminAppointmentSummaryData = {
  facilityName: string
  metrics: DashboardMetric[]
  statusBreakdown: {
    status: string
    count: number
  }[]
  upcoming: {
    id: string
    appointmentNo: string
    patientName: string
    departmentName: string
    clinicianName: string
    status: string
    scheduledAt: string
  }[]
}

export type HospitalAdminBillingSummaryData = {
  facilityName: string
  metrics: DashboardMetric[]
  paymentMethods: {
    method: string
    amount: number
  }[]
  recentInvoices: {
    id: string
    invoiceNo: string
    patientName: string
    status: string
    totalAmount: number
    amountPaid: number
    balanceDue: number
    createdAt: string
  }[]
}

export type HospitalAdminReportsData = {
  facilityName: string
  metrics: DashboardMetric[]
  exportsByType: {
    type: string
    count: number
  }[]
  morbidity: {
    diagnosis: string
    count: number
  }[]
  recentExports: {
    id: string
    title: string
    type: string
    rowCount: number
    generatedBy: string
    generatedAt: string
  }[]
}

export type HospitalAdminDailyActivityData = {
  facilityName: string
  metrics: DashboardMetric[]
  queueEvents: {
    id: string
    queueNo: string
    patientName: string
    departmentName: string
    priority: string
    status: string
    arrivedAt: string
  }[]
  auditEvents: ActivityItem[]
}

export type NurseDashboardData = {
  facilityName: string
  departmentName: string
  metrics: DashboardMetric[]
  triageQueue: {
    id: string
    queueNo: string
    patientName: string
    patientNo: string
    priority: string
    status: string
    arrivedAt: string
  }[]
  recentVitals: {
    id: string
    patientName: string
    temperatureC: number | null
    pulseRate: number | null
    systolicBp: number | null
    diastolicBp: number | null
    capturedAt: string
  }[]
}

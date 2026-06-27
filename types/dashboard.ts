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

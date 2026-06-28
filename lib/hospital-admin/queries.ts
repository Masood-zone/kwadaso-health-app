import { prisma } from "@/lib/prisma"
import type {
  HospitalAdminAppointmentSummaryData,
  HospitalAdminBillingSummaryData,
  HospitalAdminDailyActivityData,
  HospitalAdminDepartmentActivityData,
  HospitalAdminPatientFlowData,
  HospitalAdminReportsData,
} from "@/types/dashboard"

const ACTIVE_QUEUE_STATUSES = [
  "WAITING",
  "IN_TRIAGE",
  "WITH_CLINICIAN",
] as const
const OPEN_ENCOUNTER_STATUSES = [
  "DRAFT",
  "IN_PROGRESS",
  "AWAITING_LAB",
] as const

function startOfDay(date = new Date()) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function endOfDay(date = new Date()) {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

function daysAgo(days: number) {
  const date = startOfDay()
  date.setDate(date.getDate() - days)
  return date
}

function money(value: unknown) {
  return Number(value ?? 0)
}

export async function getFacilityName(facilityId: string) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: { name: true },
  })

  return facility?.name ?? "SDA Hospital Kwadaso"
}

export async function getPatientFlowOverview(
  facilityId: string
): Promise<HospitalAdminPatientFlowData> {
  const today = startOfDay()
  const now = new Date()
  const sevenDaysAgo = daysAgo(6)
  const facilityName = await getFacilityName(facilityId)

  const [
    arrivals,
    checkedInAppointments,
    completedEncounters,
    activeQueue,
    queueEntries,
    openEncounters,
  ] = await Promise.all([
    prisma.patientQueue.count({
      where: {
        department: { facilityId },
        arrivedAt: { gte: today, lte: now },
      },
    }),
    prisma.appointment.count({
      where: {
        facilityId,
        status: "CHECKED_IN",
        checkedInAt: { gte: today, lte: now },
      },
    }),
    prisma.encounter.count({
      where: {
        facilityId,
        status: "COMPLETED",
        completedAt: { gte: today, lte: now },
      },
    }),
    prisma.patientQueue.count({
      where: {
        department: { facilityId },
        status: { in: [...ACTIVE_QUEUE_STATUSES] },
      },
    }),
    prisma.patientQueue.findMany({
      where: { department: { facilityId }, arrivedAt: { gte: sevenDaysAgo } },
      orderBy: { arrivedAt: "asc" },
      select: { arrivedAt: true, status: true },
    }),
    prisma.encounter.findMany({
      take: 8,
      where: { facilityId, status: { in: [...OPEN_ENCOUNTER_STATUSES] } },
      orderBy: { startedAt: "desc" },
      select: {
        id: true,
        encounterNo: true,
        status: true,
        startedAt: true,
        department: { select: { name: true } },
        patient: {
          select: { firstName: true, lastName: true, patientNo: true },
        },
      },
    }),
  ])

  const movement = Array.from({ length: 7 }).map((_, index) => {
    const date = daysAgo(6 - index)
    const key = date.toISOString().slice(0, 10)
    const dayEntries = queueEntries.filter(
      (entry) => entry.arrivedAt.toISOString().slice(0, 10) === key
    )

    return {
      label: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      arrivals: dayEntries.length,
      completed: dayEntries.filter((entry) => entry.status === "COMPLETED")
        .length,
    }
  })

  return {
    facilityName,
    metrics: [
      {
        label: "Arrivals Today",
        value: arrivals.toString(),
        detail: "Patients entered into queues",
        tone: "green",
      },
      {
        label: "Checked In",
        value: checkedInAppointments.toString(),
        detail: "Appointments checked in today",
        tone: "blue",
      },
      {
        label: "Completed Visits",
        value: completedEncounters.toString(),
        detail: "Encounters closed today",
        tone: "green",
      },
      {
        label: "Current Queue",
        value: activeQueue.toString(),
        detail: "Waiting, triage, or clinician",
        tone: activeQueue > 30 ? "orange" : "blue",
      },
    ],
    movement,
    activeEncounters: openEncounters.map((encounter) => ({
      id: encounter.id,
      encounterNo: encounter.encounterNo,
      patientName: `${encounter.patient.firstName} ${encounter.patient.lastName}`,
      patientNo: encounter.patient.patientNo,
      departmentName: encounter.department.name,
      status: encounter.status,
      startedAt: encounter.startedAt.toISOString(),
    })),
  }
}

export async function getDepartmentActivity(
  facilityId: string
): Promise<HospitalAdminDepartmentActivityData> {
  const facilityName = await getFacilityName(facilityId)
  const departments = await prisma.department.findMany({
    where: { facilityId, isActive: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          staff: true,
          appointments: { where: { scheduledAt: { gte: startOfDay() } } },
          encounters: {
            where: { status: { in: [...OPEN_ENCOUNTER_STATUSES] } },
          },
          queues: { where: { status: { in: [...ACTIVE_QUEUE_STATUSES] } } },
        },
      },
    },
  })

  return {
    facilityName,
    departments: departments.map((department) => {
      const load =
        department._count.queues +
        department._count.encounters +
        Math.ceil(department._count.appointments / 2)
      const capacity = Math.max(department._count.staff * 4, 8)
      const loadPercent = Math.min(Math.round((load / capacity) * 100), 100)

      return {
        id: department.id,
        name: department.name,
        type: department.type,
        staffCount: department._count.staff,
        appointmentsToday: department._count.appointments,
        queueCount: department._count.queues,
        openEncounters: department._count.encounters,
        loadPercent,
        status:
          loadPercent >= 80
            ? "Critical"
            : loadPercent >= 55
              ? "Busy"
              : "Stable",
      }
    }),
  }
}

export async function getAppointmentSummary(
  facilityId: string
): Promise<HospitalAdminAppointmentSummaryData> {
  const today = startOfDay()
  const endToday = endOfDay()
  const facilityName = await getFacilityName(facilityId)
  const [appointments, recent] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { facilityId, scheduledAt: { gte: today, lte: endToday } },
      _count: { _all: true },
    }),
    prisma.appointment.findMany({
      take: 10,
      where: { facilityId, scheduledAt: { gte: today } },
      orderBy: { scheduledAt: "asc" },
      include: {
        patient: true,
        department: true,
        clinician: true,
      },
    }),
  ])

  const totals = appointments.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = item._count._all
    return acc
  }, {})

  return {
    facilityName,
    metrics: [
      {
        label: "Scheduled",
        value: String(totals.SCHEDULED ?? 0),
        detail: "Still expected today",
        tone: "blue",
      },
      {
        label: "Checked In",
        value: String(totals.CHECKED_IN ?? 0),
        detail: "Already arrived",
        tone: "green",
      },
      {
        label: "In Progress",
        value: String(totals.IN_PROGRESS ?? 0),
        detail: "With clinical teams",
        tone: "orange",
      },
      {
        label: "Missed",
        value: String(totals.MISSED ?? 0),
        detail: "Require follow-up",
        tone: "red",
      },
    ],
    statusBreakdown: appointments.map((item) => ({
      status: item.status,
      count: item._count._all,
    })),
    upcoming: recent.map((appointment) => ({
      id: appointment.id,
      appointmentNo: appointment.appointmentNo,
      patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      departmentName: appointment.department?.name ?? "Unassigned",
      clinicianName: appointment.clinician?.name ?? "Not assigned",
      status: appointment.status,
      scheduledAt: appointment.scheduledAt.toISOString(),
    })),
  }
}

export async function getBillingSummary(
  facilityId: string
): Promise<HospitalAdminBillingSummaryData> {
  const today = startOfDay()
  const facilityName = await getFacilityName(facilityId)
  const [invoiceTotals, paymentsToday, recentInvoices, methodTotals] =
    await Promise.all([
      prisma.invoice.aggregate({
        where: { facilityId },
        _sum: { totalAmount: true, amountPaid: true, balanceDue: true },
      }),
      prisma.payment.aggregate({
        where: {
          status: "SUCCESSFUL",
          paidAt: { gte: today },
          invoice: { facilityId },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.invoice.findMany({
        take: 8,
        where: { facilityId },
        orderBy: { createdAt: "desc" },
        include: { patient: true },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { status: "SUCCESSFUL", invoice: { facilityId } },
        _sum: { amount: true },
      }),
    ])

  return {
    facilityName,
    metrics: [
      {
        label: "Total Billed",
        value: `GHS ${money(invoiceTotals._sum.totalAmount).toLocaleString()}`,
        detail: "All issued invoices",
        tone: "blue",
      },
      {
        label: "Collected",
        value: `GHS ${money(invoiceTotals._sum.amountPaid).toLocaleString()}`,
        detail: "Recorded invoice payments",
        tone: "green",
      },
      {
        label: "Outstanding",
        value: `GHS ${money(invoiceTotals._sum.balanceDue).toLocaleString()}`,
        detail: "Open balances",
        tone: "orange",
      },
      {
        label: "Today",
        value: `GHS ${money(paymentsToday._sum.amount).toLocaleString()}`,
        detail: `${paymentsToday._count._all} successful payments`,
        tone: "green",
      },
    ],
    paymentMethods: methodTotals.map((item) => ({
      method: item.method,
      amount: money(item._sum.amount),
    })),
    recentInvoices: recentInvoices.map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      patientName: `${invoice.patient.firstName} ${invoice.patient.lastName}`,
      status: invoice.status,
      totalAmount: money(invoice.totalAmount),
      amountPaid: money(invoice.amountPaid),
      balanceDue: money(invoice.balanceDue),
      createdAt: invoice.createdAt.toISOString(),
    })),
  }
}

export async function getReportsDashboard(
  facilityId: string
): Promise<HospitalAdminReportsData> {
  const facilityName = await getFacilityName(facilityId)
  const [exportsByType, recentExports, diagnoses, immunizations] =
    await Promise.all([
      prisma.reportExport.groupBy({
        by: ["type"],
        where: { facilityId },
        _count: { _all: true },
      }),
      prisma.reportExport.findMany({
        take: 8,
        where: { facilityId },
        orderBy: { generatedAt: "desc" },
        include: { generatedBy: true },
      }),
      prisma.diagnosis.groupBy({
        by: ["name"],
        where: { encounter: { facilityId }, createdAt: { gte: daysAgo(29) } },
        _count: { _all: true },
        orderBy: { _count: { name: "desc" } },
        take: 6,
      }),
      prisma.immunizationRecord.count({
        where: {
          administeredAt: { gte: daysAgo(29) },
          patient: { registeredFacilityId: facilityId },
        },
      }),
    ])

  return {
    facilityName,
    metrics: [
      {
        label: "Exports",
        value: String(recentExports.length),
        detail: "Recent report files",
        tone: "blue",
      },
      {
        label: "Morbidity Items",
        value: String(diagnoses.length),
        detail: "Top diagnoses this month",
        tone: "green",
      },
      {
        label: "Immunizations",
        value: String(immunizations),
        detail: "Administered in 30 days",
        tone: "orange",
      },
      {
        label: "Report Types",
        value: String(exportsByType.length),
        detail: "Configured export categories",
        tone: "blue",
      },
    ],
    exportsByType: exportsByType.map((item) => ({
      type: item.type,
      count: item._count._all,
    })),
    morbidity: diagnoses.map((item) => ({
      diagnosis: item.name,
      count: item._count._all,
    })),
    recentExports: recentExports.map((item) => ({
      id: item.id,
      title: item.title,
      type: item.type,
      rowCount: item.rowCount ?? 0,
      generatedBy: item.generatedBy?.name ?? "System",
      generatedAt: item.generatedAt.toISOString(),
    })),
  }
}

export async function getDailyHospitalActivity(
  facilityId: string
): Promise<HospitalAdminDailyActivityData> {
  const today = startOfDay()
  const facilityName = await getFacilityName(facilityId)
  const [registrations, appointments, encounters, invoices, queues, logs] =
    await Promise.all([
      prisma.patient.count({
        where: { registeredFacilityId: facilityId, createdAt: { gte: today } },
      }),
      prisma.appointment.count({
        where: { facilityId, scheduledAt: { gte: today } },
      }),
      prisma.encounter.count({
        where: { facilityId, startedAt: { gte: today } },
      }),
      prisma.invoice.count({
        where: { facilityId, createdAt: { gte: today } },
      }),
      prisma.patientQueue.findMany({
        take: 12,
        where: { department: { facilityId }, arrivedAt: { gte: today } },
        orderBy: { arrivedAt: "desc" },
        include: { patient: true, department: true },
      }),
      prisma.auditLog.findMany({
        take: 8,
        where: { actor: { facilityId } },
        orderBy: { createdAt: "desc" },
        include: { actor: true },
      }),
    ])

  return {
    facilityName,
    metrics: [
      {
        label: "Registrations",
        value: String(registrations),
        detail: "New patient records today",
        tone: "green",
      },
      {
        label: "Appointments",
        value: String(appointments),
        detail: "Scheduled for today",
        tone: "blue",
      },
      {
        label: "Encounters",
        value: String(encounters),
        detail: "Clinical visits started",
        tone: "orange",
      },
      {
        label: "Invoices",
        value: String(invoices),
        detail: "Billing activity today",
        tone: "blue",
      },
    ],
    queueEvents: queues.map((queue) => ({
      id: queue.id,
      queueNo: queue.queueNo,
      patientName: `${queue.patient.firstName} ${queue.patient.lastName}`,
      departmentName: queue.department.name,
      priority: queue.priority,
      status: queue.status,
      arrivedAt: queue.arrivedAt.toISOString(),
    })),
    auditEvents: logs.map((log) => ({
      id: log.id,
      label: `${log.action} ${log.entityType}`,
      detail: log.description || `By ${log.actor?.name ?? "System"}`,
      timestamp: log.createdAt.toISOString(),
    })),
  }
}

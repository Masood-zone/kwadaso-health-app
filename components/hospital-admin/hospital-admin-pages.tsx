"use client"

import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import {
  DashboardError,
  MetricCard,
  StatusBadge,
} from "@/components/dashboard/dashboard-widgets"
import {
  formatEnum,
  PageHeader,
  ResponsiveTable,
} from "@/components/super-admin/super-admin-ui"
import {
  useHospitalAdminAppointmentSummary,
  useHospitalAdminBillingSummary,
  useHospitalAdminDailyActivity,
  useHospitalAdminDepartmentActivity,
  useHospitalAdminPatientFlow,
  useHospitalAdminReports,
} from "@/services/hospital-admin/dashboard"
import type { DashboardMetric } from "@/types/dashboard"

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="khms-card h-32 animate-pulse bg-muted" />
      ))}
    </div>
  )
}

function Metrics({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </section>
  )
}

function PanelHeader({
  icon,
  title,
  eyebrow,
}: {
  icon: string
  title: string
  eyebrow: string
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
      <MaterialSymbol icon={icon} className="text-[22px] text-primary" />
      <div>
        <p className="khms-label">{eyebrow}</p>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
      </div>
    </div>
  )
}

function money(value: number) {
  return `GHS ${value.toLocaleString()}`
}

function time(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function PatientFlowOverviewPage() {
  const { data, isLoading, isError } = useHospitalAdminPatientFlow()

  if (isLoading) return <LoadingGrid />
  if (isError || !data)
    return <DashboardError message="Patient flow could not be loaded." />

  const maxMovement = Math.max(
    ...data.movement.map((item) => Math.max(item.arrivals, item.completed)),
    1
  )

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Patient Flow"
        title="Patient Flow Overview"
        description="Track arrivals, completed encounters, queue pressure, and active clinical movement."
      />
      <Metrics metrics={data.metrics} />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="khms-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <MaterialSymbol
              icon="bar_chart"
              className="text-[24px] text-primary"
            />
            <div>
              <p className="khms-label">7-Day Movement</p>
              <h2 className="font-heading text-xl font-semibold">
                Arrivals vs Completed
              </h2>
            </div>
          </div>
          <div className="flex h-72 items-end gap-3">
            {data.movement.map((item) => (
              <div
                key={item.label}
                className="flex flex-1 flex-col justify-end gap-2"
              >
                <div className="flex h-56 items-end gap-1">
                  <div
                    className="w-full rounded-t bg-primary"
                    style={{
                      height: `${(item.arrivals / maxMovement) * 100}%`,
                    }}
                    title={`${item.arrivals} arrivals`}
                  />
                  <div
                    className="w-full rounded-t bg-chart-2"
                    style={{
                      height: `${(item.completed / maxMovement) * 100}%`,
                    }}
                    title={`${item.completed} completed`}
                  />
                </div>
                <span className="text-center text-xs font-semibold text-muted-foreground">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="khms-card overflow-hidden">
          <PanelHeader
            icon="stethoscope"
            eyebrow="Active Care"
            title="Open Encounters"
          />
          <div className="divide-y divide-border-subtle">
            {data.activeEncounters.map((encounter) => (
              <div key={encounter.id} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{encounter.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {encounter.patientNo} / {encounter.departmentName}
                    </p>
                  </div>
                  <StatusBadge value={formatEnum(encounter.status)} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {encounter.encounterNo} / Started {time(encounter.startedAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export function DepartmentActivityPage() {
  const { data, isLoading, isError } = useHospitalAdminDepartmentActivity()

  if (isLoading) return <LoadingGrid />
  if (isError || !data)
    return <DashboardError message="Department activity could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Departments"
        title="Department Activity"
        description="Compare department queue load, open encounters, appointments, and available staff."
      />
      <div className="khms-card overflow-hidden">
        <PanelHeader
          icon="clinical_notes"
          eyebrow="Live Department Load"
          title="Workload Snapshot"
        />
        <ResponsiveTable minWidth="820px">
          <thead className="bg-accent-blue text-left">
            <tr>
              <th className="khms-label px-4 py-3">Department</th>
              <th className="khms-label px-4 py-3">Staff</th>
              <th className="khms-label px-4 py-3">Appointments</th>
              <th className="khms-label px-4 py-3">Queue</th>
              <th className="khms-label px-4 py-3">Open Encounters</th>
              <th className="khms-label px-4 py-3">Load</th>
            </tr>
          </thead>
          <tbody>
            {data.departments.map((department) => (
              <tr key={department.id} className="border-t border-border-subtle">
                <td className="px-4 py-3">
                  <p className="khms-table-data font-semibold">
                    {department.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatEnum(department.type)}
                  </p>
                </td>
                <td className="khms-table-data px-4 py-3">
                  {department.staffCount}
                </td>
                <td className="khms-table-data px-4 py-3">
                  {department.appointmentsToday}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={`${department.queueCount} waiting`} />
                </td>
                <td className="khms-table-data px-4 py-3">
                  {department.openEncounters}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${department.loadPercent}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold">
                      {department.status}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </ResponsiveTable>
      </div>
    </div>
  )
}

export function AppointmentSummaryPage() {
  const { data, isLoading, isError } = useHospitalAdminAppointmentSummary()

  if (isLoading) return <LoadingGrid />
  if (isError || !data)
    return <DashboardError message="Appointment summary could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Appointments"
        title="Appointment Summary"
        description="Monitor today's schedule, check-ins, missed appointments, and next clinic visits."
      />
      <Metrics metrics={data.metrics} />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="khms-card p-4">
          <PanelHeader icon="donut_large" eyebrow="Status Mix" title="Today" />
          <div className="mt-4 space-y-3">
            {data.statusBreakdown.map((item) => (
              <div
                key={item.status}
                className="flex items-center justify-between rounded border border-border-subtle p-3"
              >
                <span className="text-sm font-semibold">
                  {formatEnum(item.status)}
                </span>
                <StatusBadge value={`${item.count}`} />
              </div>
            ))}
          </div>
        </div>
        <div className="khms-card overflow-hidden">
          <PanelHeader
            icon="event_available"
            eyebrow="Clinic Schedule"
            title="Upcoming Appointments"
          />
          <ResponsiveTable minWidth="760px">
            <thead className="bg-accent-blue text-left">
              <tr>
                <th className="khms-label px-4 py-3">Appointment</th>
                <th className="khms-label px-4 py-3">Patient</th>
                <th className="khms-label px-4 py-3">Department</th>
                <th className="khms-label px-4 py-3">Clinician</th>
                <th className="khms-label px-4 py-3">Time</th>
                <th className="khms-label px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.upcoming.map((appointment) => (
                <tr
                  key={appointment.id}
                  className="border-t border-border-subtle"
                >
                  <td className="khms-table-data px-4 py-3 font-semibold">
                    {appointment.appointmentNo}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {appointment.patientName}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {appointment.departmentName}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {appointment.clinicianName}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {time(appointment.scheduledAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={formatEnum(appointment.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
      </section>
    </div>
  )
}

export function BillingSummaryPage() {
  const { data, isLoading, isError } = useHospitalAdminBillingSummary()

  if (isLoading) return <LoadingGrid />
  if (isError || !data)
    return <DashboardError message="Billing summary could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Billing"
        title="Billing Summary"
        description="Review collections, outstanding balances, payment methods, and recent invoices."
      />
      <Metrics metrics={data.metrics} />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="khms-card p-4">
          <PanelHeader
            icon="payments"
            eyebrow="Collections"
            title="Payment Methods"
          />
          <div className="mt-4 space-y-3">
            {data.paymentMethods.map((item) => (
              <div
                key={item.method}
                className="flex items-center justify-between rounded border border-border-subtle p-3"
              >
                <span className="text-sm font-semibold">
                  {formatEnum(item.method)}
                </span>
                <span className="text-sm font-bold text-primary">
                  {money(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="khms-card overflow-hidden">
          <PanelHeader
            icon="receipt_long"
            eyebrow="Recent Billing"
            title="Invoices"
          />
          <ResponsiveTable minWidth="760px">
            <thead className="bg-accent-blue text-left">
              <tr>
                <th className="khms-label px-4 py-3">Invoice</th>
                <th className="khms-label px-4 py-3">Patient</th>
                <th className="khms-label px-4 py-3">Total</th>
                <th className="khms-label px-4 py-3">Paid</th>
                <th className="khms-label px-4 py-3">Balance</th>
                <th className="khms-label px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.recentInvoices.map((invoice) => (
                <tr key={invoice.id} className="border-t border-border-subtle">
                  <td className="khms-table-data px-4 py-3 font-semibold">
                    {invoice.invoiceNo}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {invoice.patientName}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {money(invoice.totalAmount)}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {money(invoice.amountPaid)}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {money(invoice.balanceDue)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={formatEnum(invoice.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
      </section>
    </div>
  )
}

export function ReportsDashboardPage() {
  const { data, isLoading, isError } = useHospitalAdminReports()

  if (isLoading) return <LoadingGrid />
  if (isError || !data)
    return <DashboardError message="Reports dashboard could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Reports"
        title="Reports Dashboard"
        description="Use morbidity, immunization, HMIS, and financial exports to track hospital performance."
      />
      <Metrics metrics={data.metrics} />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="khms-card p-4">
          <PanelHeader
            icon="sick"
            eyebrow="Clinical Reporting"
            title="Morbidity Snapshot"
          />
          <div className="mt-4 space-y-3">
            {data.morbidity.map((item) => (
              <div
                key={item.diagnosis}
                className="flex items-center justify-between rounded border border-border-subtle p-3"
              >
                <span className="text-sm font-semibold">{item.diagnosis}</span>
                <StatusBadge value={`${item.count} cases`} />
              </div>
            ))}
          </div>
        </div>
        <div className="khms-card overflow-hidden">
          <PanelHeader
            icon="file_save"
            eyebrow="Generated Files"
            title="Recent Exports"
          />
          <ResponsiveTable minWidth="620px">
            <thead className="bg-accent-blue text-left">
              <tr>
                <th className="khms-label px-4 py-3">Report</th>
                <th className="khms-label px-4 py-3">Type</th>
                <th className="khms-label px-4 py-3">Rows</th>
                <th className="khms-label px-4 py-3">Generated</th>
              </tr>
            </thead>
            <tbody>
              {data.recentExports.map((report) => (
                <tr key={report.id} className="border-t border-border-subtle">
                  <td className="khms-table-data px-4 py-3 font-semibold">
                    {report.title}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {formatEnum(report.type)}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {report.rowCount}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {time(report.generatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
      </section>
    </div>
  )
}

export function DailyHospitalActivityPage() {
  const { data, isLoading, isError } = useHospitalAdminDailyActivity()

  if (isLoading) return <LoadingGrid />
  if (isError || !data)
    return <DashboardError message="Daily activity could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Daily Activity"
        title="Daily Hospital Activity"
        description="A daybook of queue events, patient movement, billing actions, and staff audit activity."
      />
      <Metrics metrics={data.metrics} />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="khms-card overflow-hidden">
          <PanelHeader icon="queue" eyebrow="Today" title="Queue Events" />
          <ResponsiveTable minWidth="700px">
            <thead className="bg-accent-blue text-left">
              <tr>
                <th className="khms-label px-4 py-3">Ticket</th>
                <th className="khms-label px-4 py-3">Patient</th>
                <th className="khms-label px-4 py-3">Department</th>
                <th className="khms-label px-4 py-3">Priority</th>
                <th className="khms-label px-4 py-3">Status</th>
                <th className="khms-label px-4 py-3">Arrived</th>
              </tr>
            </thead>
            <tbody>
              {data.queueEvents.map((event) => (
                <tr key={event.id} className="border-t border-border-subtle">
                  <td className="khms-table-data px-4 py-3 font-semibold">
                    {event.queueNo}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {event.patientName}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {event.departmentName}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {formatEnum(event.priority)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={formatEnum(event.status)} />
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {time(event.arrivedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
        <div className="khms-card p-4">
          <PanelHeader
            icon="history"
            eyebrow="Audit Trail"
            title="Recent Staff Actions"
          />
          <div className="mt-4 space-y-3">
            {data.auditEvents.map((event) => (
              <div key={event.id} className="border-l-2 border-primary pl-3">
                <p className="text-sm font-semibold">{event.label}</p>
                <p className="text-xs text-muted-foreground">{event.detail}</p>
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                  {time(event.timestamp)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

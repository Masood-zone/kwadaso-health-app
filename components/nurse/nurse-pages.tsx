"use client"

import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { toast } from "sonner"

import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import {
  DashboardError,
  MetricCard,
  StatusBadge,
} from "@/components/dashboard/dashboard-widgets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  PageHeader,
  ResponsiveTable,
  formatEnum,
} from "@/components/super-admin/super-admin-ui"
import {
  useCreateNurseImmunization,
  useCreateNurseVitals,
  useEmergencyFlag,
  useNurseDashboard,
  useNurseImmunizations,
  useNurseLookups,
  useNurseNotifications,
  useNurseTriageQueue,
  usePatientTriageProfile,
  useUpdateNurseImmunization,
  useUpdateNurseNotification,
  useUpdateNurseQueue,
} from "@/services/nurse/nurse"
import type {
  NurseImmunizationCreatePayload,
  NurseImmunizationListItem,
  NurseQueueUpdatePayload,
  NurseTriageQueueFilters,
  NurseTriageQueueItem,
  NurseVitalSignsCreatePayload,
} from "@/types/nurse"

const blankVitals: NurseVitalSignsCreatePayload = {
  queueId: "",
  encounterId: "",
  temperatureC: null,
  systolicBp: null,
  diastolicBp: null,
  pulseRate: null,
  respiratoryRate: null,
  oxygenSaturation: null,
  weightKg: null,
  heightCm: null,
  painScore: null,
  triagePriority: "ROUTINE",
  notes: "",
}

const blankImmunization: NurseImmunizationCreatePayload = {
  vaccineName: "",
  dose: "",
  batchNumber: "",
  administeredAt: new Date().toISOString().slice(0, 10),
  nextDueAt: "",
  notes: "",
}

function LoadingPanel() {
  return <div className="khms-card h-80 animate-pulse bg-muted" />
}

function EmptyState({ label }: { label: string }) {
  return <div className="p-6 text-center text-sm text-muted-foreground">{label}</div>
}

function formatDate(value?: string | null) {
  if (!value) return "Not set"
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toDateInput(value?: string | null) {
  if (!value) return ""
  return new Date(value).toISOString().slice(0, 10)
}

function priorityClass(priority: string) {
  if (priority === "EMERGENCY") return "bg-emergency-soft text-emergency-dark"
  if (priority === "URGENT") return "bg-pending-soft text-tertiary-container"
  if (priority === "PRIORITY") return "bg-accent-blue text-primary"
  return "bg-medical-green-soft text-deep-forest"
}

function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`khms-badge ${priorityClass(priority)}`}>{formatEnum(priority)}</span>
}

function SelectField({
  label,
  value,
  onChange,
  options,
  includeBlank,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  includeBlank?: string
}) {
  return (
    <Field label={label}>
      <select className="khms-input w-full" value={value} onChange={(event) => onChange(event.target.value)}>
        {includeBlank ? <option value="">{includeBlank}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

function QueueActionButtons({ item }: { item: NurseTriageQueueItem }) {
  const router = useRouter()
  const updateQueue = useUpdateNurseQueue()
  const emergency = useEmergencyFlag()

  async function update(payload: NurseQueueUpdatePayload, message: string) {
    try {
      await updateQueue.mutateAsync({ id: item.id, payload })
      toast.success(message)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Queue update failed")
    }
  }

  async function flagEmergency() {
    const reason = item.notes || item.reason || "Emergency flagged by triage nurse"
    try {
      await emergency.mutateAsync({ id: item.id, payload: { reason, notifyClinician: true } })
      toast.success("Emergency flag sent")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Emergency flag failed")
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {item.status === "WAITING" ? (
        <Button size="sm" onClick={() => update({ status: "IN_TRIAGE", priority: item.priority }, "Triage started")}>
          Start
        </Button>
      ) : null}
      {item.status === "IN_TRIAGE" ? (
        <Button size="sm" onClick={() => update({ status: "WITH_CLINICIAN", priority: item.priority }, "Sent to clinician")}>
          Send
        </Button>
      ) : null}
      <Button size="sm" variant="outline" onClick={() => router.push(`/nurse/vitals/capture?queueId=${item.id}`)}>
        Vitals
      </Button>
      <Button size="sm" variant="destructive" onClick={flagEmergency}>
        Flag
      </Button>
      {["WAITING", "IN_TRIAGE"].includes(item.status) ? (
        <Button size="sm" variant="outline" onClick={() => update({ status: "CANCELLED", priority: item.priority, notes: item.notes, cancellationReason: "Cancelled by triage nurse" }, "Queue item cancelled")}>
          Cancel
        </Button>
      ) : null}
      <Button size="sm" variant="outline" asChild>
        <Link href={`/nurse/patients/${item.patientId}`}>Profile</Link>
      </Button>
    </div>
  )
}

function QueueTable({ queue }: { queue: NurseTriageQueueItem[] }) {
  return (
    <div className="khms-card overflow-hidden">
      <ResponsiveTable minWidth="1080px">
        <thead className="bg-accent-blue text-left">
          <tr>
            {["Queue", "Patient", "Gender/Age", "Department", "Priority", "Status", "Arrival", "Wait", "Actions"].map((header) => (
              <th key={header} className="khms-label px-4 py-3">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {queue.map((item) => (
            <tr key={item.id} className="border-t border-border-subtle">
              <td className="khms-table-data px-4 py-3 font-semibold">{item.queueNo}</td>
              <td className="px-4 py-3">
                <p className="font-semibold">{item.patientName}</p>
                <p className="text-xs text-muted-foreground">{item.patientNo}</p>
              </td>
              <td className="khms-table-data px-4 py-3">{formatEnum(item.gender)} / {item.age ?? "N/A"}</td>
              <td className="khms-table-data px-4 py-3">{item.departmentName}</td>
              <td className="px-4 py-3"><PriorityBadge priority={item.priority} /></td>
              <td className="px-4 py-3"><StatusBadge value={formatEnum(item.status)} /></td>
              <td className="khms-table-data px-4 py-3">{formatDate(item.arrivedAt)}</td>
              <td className="khms-table-data px-4 py-3">{item.waitingMinutes}m</td>
              <td className="px-4 py-3"><QueueActionButtons item={item} /></td>
            </tr>
          ))}
          {!queue.length ? <tr><td colSpan={9}><EmptyState label="No queue entries found." /></td></tr> : null}
        </tbody>
      </ResponsiveTable>
    </div>
  )
}

export function NurseDashboardPage() {
  const { data, isLoading, isError } = useNurseDashboard()
  if (isLoading) return <LoadingPanel />
  if (isError || !data) return <DashboardError message="Nursing dashboard could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={data.departmentName}
        title="Triage & Nursing Station"
        description="Monitor waiting patients, emergency flags, captured vitals, and handoffs to clinicians."
        actions={
          <>
            <Button asChild><Link href="/nurse/triage-queue"><MaterialSymbol icon="queue" /> Open Queue</Link></Button>
            <Button variant="outline" asChild><Link href="/nurse/vitals/capture"><MaterialSymbol icon="vital_signs" /> Capture Vitals</Link></Button>
          </>
        }
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <QueueTable queue={data.triageQueue} />
        </div>
        <aside className="space-y-5">
          <section className="khms-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <MaterialSymbol icon="emergency" className="text-[24px] text-emergency-dark" />
              <h2 className="font-heading text-xl font-semibold">Emergency Watch</h2>
            </div>
            <div className="space-y-3">
              {data.emergencyPatients.map((item) => (
                <Link key={item.id} href={`/nurse/patients/${item.patientId}`} className="block rounded border border-emergency-dark/20 bg-emergency-soft p-3">
                  <p className="font-semibold text-emergency-dark">{item.queueNo} - {item.patientName}</p>
                  <p className="text-xs text-muted-foreground">{item.waitingMinutes}m waiting / {item.departmentName}</p>
                </Link>
              ))}
              {!data.emergencyPatients.length ? <EmptyState label="No emergency flags right now." /> : null}
            </div>
          </section>
          <section className="khms-card p-4">
            <h2 className="font-heading text-xl font-semibold">Recent Vitals</h2>
            <div className="mt-3 space-y-3">
              {data.recentVitals.map((vital) => (
                <div key={vital.id} className="rounded border border-border-subtle p-3">
                  <p className="text-sm font-semibold">{vital.patientName}</p>
                  <p className="text-xs text-muted-foreground">BP {vital.systolicBp ?? "--"}/{vital.diastolicBp ?? "--"} / Temp {vital.temperatureC ?? "--"}C</p>
                </div>
              ))}
              {!data.recentVitals.length ? <EmptyState label="No vitals captured yet." /> : null}
            </div>
          </section>
        </aside>
      </section>
    </div>
  )
}

export function NurseTriageQueuePage() {
  const [filters, setFilters] = useState<NurseTriageQueueFilters>({ search: "", status: "", priority: "" })
  const { data: lookups } = useNurseLookups()
  const { data: queue = [], isLoading, isError } = useNurseTriageQueue(filters)
  if (isError) return <DashboardError message="Triage queue could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Nurse / Triage Queue" title="Live Triage Queue" description="Start triage, capture vitals, flag emergencies, and send patients to clinicians." />
      <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <Input placeholder="Search patient or queue no." value={filters.search ?? ""} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
        <Input type="date" value={filters.date ?? ""} onChange={(event) => setFilters({ ...filters, date: event.target.value })} />
        <select className="khms-input" value={filters.departmentId ?? ""} onChange={(event) => setFilters({ ...filters, departmentId: event.target.value })}>
          <option value="">All departments</option>
          {lookups?.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
        </select>
        <select className="khms-input" value={filters.priority ?? ""} onChange={(event) => setFilters({ ...filters, priority: event.target.value as never })}>
          <option value="">All priorities</option>
          {lookups?.triagePriorities.map((priority) => <option key={priority} value={priority}>{formatEnum(priority)}</option>)}
        </select>
        <select className="khms-input" value={filters.status ?? ""} onChange={(event) => setFilters({ ...filters, status: event.target.value as never })}>
          <option value="">Active default</option>
          {lookups?.queueStatuses.map((status) => <option key={status} value={status}>{formatEnum(status)}</option>)}
        </select>
      </section>
      {isLoading ? <LoadingPanel /> : <QueueTable queue={queue} />}
    </div>
  )
}

export function NurseVitalsCapturePage({ queueId: propQueueId }: { queueId?: string }) {
  const searchParams = useSearchParams()
  const queueId = propQueueId ?? searchParams.get("queueId") ?? ""
  const router = useRouter()
  const { data: queue = [] } = useNurseTriageQueue({ status: "" })
  const selected = queue.find((item) => item.id === queueId) ?? queue.find((item) => ["WAITING", "IN_TRIAGE"].includes(item.status))
  const [selectedQueueId, setSelectedQueueId] = useState(queueId)
  const activeQueue = queue.find((item) => item.id === selectedQueueId) ?? selected
  const [form, setForm] = useState<NurseVitalSignsCreatePayload>({ ...blankVitals, queueId: activeQueue?.id ?? "" })
  const createVitals = useCreateNurseVitals(activeQueue?.patientId ?? "")
  const updateQueue = useUpdateNurseQueue()

  const bmi = useMemo(() => {
    if (!form.weightKg || !form.heightCm) return null
    const heightM = form.heightCm / 100
    return Math.round((form.weightKg / (heightM * heightM)) * 100) / 100
  }, [form.heightCm, form.weightKg])

  async function save(sendToClinician = false) {
    if (!activeQueue) {
      toast.error("Select a queue patient first")
      return
    }
    try {
      await createVitals.mutateAsync({ ...form, queueId: activeQueue.id })
      if (sendToClinician) {
        await updateQueue.mutateAsync({
          id: activeQueue.id,
          payload: { status: "WITH_CLINICIAN", priority: form.triagePriority, notes: form.notes },
        })
      }
      toast.success(sendToClinician ? "Vitals saved and patient sent to clinician" : "Vitals saved")
      router.push(sendToClinician ? "/nurse/triage-queue" : `/nurse/patients/${activeQueue.patientId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Vitals save failed")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Nurse / Vitals" title="Capture Vital Signs" description="Record triage vitals, calculate BMI, assign priority, and hand off to the clinician queue." />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="khms-card p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <SelectField label="Queue Patient" value={activeQueue?.id ?? ""} onChange={(id) => { setSelectedQueueId(id); setForm({ ...form, queueId: id }) }} includeBlank="Select patient" options={queue.map((item) => ({ label: `${item.queueNo} - ${item.patientName}`, value: item.id }))} />
            <Field label="Temperature (C)"><Input type="number" step="0.1" value={form.temperatureC ?? ""} onChange={(event) => setForm({ ...form, temperatureC: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Pulse Rate"><Input type="number" value={form.pulseRate ?? ""} onChange={(event) => setForm({ ...form, pulseRate: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Systolic BP"><Input type="number" value={form.systolicBp ?? ""} onChange={(event) => setForm({ ...form, systolicBp: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Diastolic BP"><Input type="number" value={form.diastolicBp ?? ""} onChange={(event) => setForm({ ...form, diastolicBp: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Respiratory Rate"><Input type="number" value={form.respiratoryRate ?? ""} onChange={(event) => setForm({ ...form, respiratoryRate: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Oxygen Saturation"><Input type="number" value={form.oxygenSaturation ?? ""} onChange={(event) => setForm({ ...form, oxygenSaturation: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Weight (kg)"><Input type="number" step="0.1" value={form.weightKg ?? ""} onChange={(event) => setForm({ ...form, weightKg: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Height (cm)"><Input type="number" step="0.1" value={form.heightCm ?? ""} onChange={(event) => setForm({ ...form, heightCm: event.target.value ? Number(event.target.value) : null })} /></Field>
            <Field label="Pain Score"><Input type="number" min={0} max={10} value={form.painScore ?? ""} onChange={(event) => setForm({ ...form, painScore: event.target.value ? Number(event.target.value) : null })} /></Field>
            <SelectField label="Triage Priority" value={form.triagePriority} onChange={(priority) => setForm({ ...form, triagePriority: priority as never })} options={["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"].map((item) => ({ label: formatEnum(item), value: item }))} />
            <Field label="BMI"><Input value={bmi ?? ""} readOnly /></Field>
            <div className="md:col-span-3">
              <Field label="Nursing Notes"><textarea className="khms-input min-h-24 w-full py-3" value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button onClick={() => save(false)} disabled={!activeQueue || createVitals.isPending}>Save Vitals</Button>
            <Button variant="outline" onClick={() => save(true)} disabled={!activeQueue || createVitals.isPending}>Save & Send To Clinician</Button>
          </div>
        </div>
        <aside className="space-y-5">
          <section className="khms-card p-4">
            <h2 className="font-heading text-xl font-semibold">Patient Summary</h2>
            {activeQueue ? (
              <div className="mt-3 space-y-2 text-sm">
                <p className="font-semibold">{activeQueue.patientName}</p>
                <p className="text-muted-foreground">{activeQueue.patientNo} / {formatEnum(activeQueue.gender)} / {activeQueue.age ?? "N/A"} yrs</p>
                <p><PriorityBadge priority={activeQueue.priority} /> <StatusBadge value={formatEnum(activeQueue.status)} /></p>
              </div>
            ) : <EmptyState label="No active queue patient selected." />}
          </section>
          <section className="khms-card p-4">
            <h2 className="font-heading text-xl font-semibold">Previous Vitals</h2>
            {activeQueue?.latestVitals ? (
              <p className="mt-3 text-sm text-muted-foreground">BP {activeQueue.latestVitals.systolicBp ?? "--"}/{activeQueue.latestVitals.diastolicBp ?? "--"} / Temp {activeQueue.latestVitals.temperatureC ?? "--"}C</p>
            ) : <EmptyState label="No previous vitals in queue context." />}
          </section>
        </aside>
      </section>
    </div>
  )
}

export function NurseEmergencyPage() {
  const { data: queue = [], isLoading } = useNurseTriageQueue({ priority: "EMERGENCY", status: "" })
  const emergency = queue.filter((item) => item.priority === "EMERGENCY")
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Nurse / Emergency" title="Emergency Cases" description="Track critical patients, notify clinicians, and move stabilized cases to clinician review." />
      {isLoading ? <LoadingPanel /> : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {emergency.map((item) => (
            <div key={item.id} className="khms-card border-emergency-dark/30 bg-emergency-soft p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="khms-label text-emergency-dark">Emergency Flag</p>
                  <h2 className="font-heading text-2xl font-bold">{item.queueNo} - {item.patientName}</h2>
                  <p className="text-sm text-muted-foreground">{item.patientNo} / {item.departmentName} / {item.waitingMinutes}m waiting</p>
                </div>
                <PriorityBadge priority={item.priority} />
              </div>
              <p className="mt-4 text-sm">{item.notes ?? item.reason ?? "No emergency notes recorded."}</p>
              {item.latestVitals ? <p className="mt-2 text-sm font-semibold">Latest BP {item.latestVitals.systolicBp ?? "--"}/{item.latestVitals.diastolicBp ?? "--"} / SpO2 {item.latestVitals.oxygenSaturation ?? "--"}%</p> : null}
              <div className="mt-4"><QueueActionButtons item={item} /></div>
            </div>
          ))}
          {!emergency.length ? <div className="xl:col-span-2"><EmptyState label="No emergency cases are active." /></div> : null}
        </div>
      )}
    </div>
  )
}

export function NurseQueueBoardPage() {
  const { data: queue = [], isLoading } = useNurseTriageQueue({ status: "" })
  const columns = [
    { label: "Waiting", statuses: ["WAITING"] },
    { label: "In Triage", statuses: ["IN_TRIAGE"] },
    { label: "With Clinician", statuses: ["WITH_CLINICIAN"] },
    { label: "Emergency", emergency: true },
    { label: "Cancelled", statuses: ["CANCELLED"] },
  ]
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Nurse / Queue Board" title="Patient Queue Status Board" description="Visual queue board for active triage movement and handover awareness." />
      {isLoading ? <LoadingPanel /> : (
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-5">
          {columns.map((column) => {
            const items = queue.filter((item) => column.emergency ? item.priority === "EMERGENCY" : column.statuses?.includes(item.status))
            return (
              <div key={column.label} className="khms-card min-h-80 p-3">
                <h2 className="font-heading text-lg font-semibold">{column.label}</h2>
                <div className="mt-3 space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="rounded border border-border-subtle bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{item.queueNo}</p>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <p className="mt-1 text-sm font-medium">{item.patientName}</p>
                      <p className="text-xs text-muted-foreground">{item.age ?? "N/A"} yrs / {formatEnum(item.gender)} / {item.departmentName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Latest vitals: {item.latestVitals ? "Captured" : "Pending"}</p>
                      <div className="mt-3"><QueueActionButtons item={item} /></div>
                    </div>
                  ))}
                  {!items.length ? <EmptyState label="No patients." /> : null}
                </div>
              </div>
            )
          })}
        </section>
      )}
    </div>
  )
}

export function NurseVitalsHistoryPage() {
  const { data: queue = [], isLoading } = useNurseTriageQueue({ status: "" })
  const patientsWithVitals = queue.filter((item) => item.latestVitals)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Nurse / Vitals History"
        title="Patient Vitals History"
        description="Review the latest captured vitals from current facility queue patients."
      />
      {isLoading ? (
        <LoadingPanel />
      ) : (
        <SimpleTable
          headers={["Patient", "Queue", "BP", "Temperature", "Pulse", "SpO2", "Priority", "Captured"]}
          rows={patientsWithVitals.map((item) => [
            `${item.patientName} / ${item.patientNo}`,
            item.queueNo,
            `${item.latestVitals?.systolicBp ?? "--"}/${item.latestVitals?.diastolicBp ?? "--"}`,
            `${item.latestVitals?.temperatureC ?? "--"}C`,
            String(item.latestVitals?.pulseRate ?? "--"),
            `${item.latestVitals?.oxygenSaturation ?? "--"}%`,
            formatEnum(item.latestVitals?.triagePriority ?? item.priority),
            formatDate(item.latestVitals?.capturedAt),
          ])}
        />
      )}
    </div>
  )
}

export function NursePatientProfilePage() {
  const params = useParams<{ id: string }>()
  const [tab, setTab] = useState("Overview")
  const { data: patient, isLoading, isError } = usePatientTriageProfile(params.id)
  if (isLoading) return <LoadingPanel />
  if (isError || !patient) return <DashboardError message="Patient profile could not be loaded." />
  const tabs = ["Overview", "Vitals", "Allergies", "Chronic Conditions", "Medication History", "Immunizations", "Queue History"]
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Nurse / Patient" title={patient.name} description={`${patient.patientNo} / ${formatEnum(patient.gender)} / ${patient.age ?? "N/A"} yrs`} actions={<Button asChild><Link href={`/nurse/vitals/capture?queueId=${patient.activeQueueEntry?.id ?? ""}`}><MaterialSymbol icon="vital_signs" /> Capture Vitals</Link></Button>} />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="khms-card p-4"><p className="khms-label">Blood Group</p><p className="mt-2 font-heading text-2xl font-bold">{formatEnum(patient.bloodGroup)}</p></div>
        <div className="khms-card p-4"><p className="khms-label">Active Queue</p><p className="mt-2 font-heading text-xl font-bold">{patient.activeQueueEntry?.queueNo ?? "None"}</p></div>
        <div className="khms-card p-4"><p className="khms-label">Lab Status</p><p className="mt-2 font-semibold">{patient.readOnlyClinicalStatus.latestLabStatus ? formatEnum(patient.readOnlyClinicalStatus.latestLabStatus) : "None"}</p></div>
        <div className="khms-card p-4"><p className="khms-label">Billing</p><p className="mt-2 font-semibold">{patient.readOnlyClinicalStatus.billingStatus ? formatEnum(patient.readOnlyClinicalStatus.billingStatus) : "None"}</p></div>
      </section>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((item) => <Button key={item} variant={tab === item ? "default" : "outline"} onClick={() => setTab(item)}>{item}</Button>)}
      </div>
      {tab === "Overview" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="khms-card p-5">
            <h2 className="font-heading text-xl font-semibold">Biodata & Emergency Contact</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <p>Phone: {patient.phone ?? "Not set"}</p>
              <p>Community: {patient.community ?? "Not set"}</p>
              <p>Address: {patient.residentialAddress ?? "Not set"}</p>
              <p>Emergency: {patient.emergencyContactName ?? "Not set"} / {patient.emergencyContactPhone ?? "No phone"}</p>
            </div>
          </div>
          <div className="khms-card p-5">
            <h2 className="font-heading text-xl font-semibold">Read-Only Clinical Summary</h2>
            <p className="mt-3 text-sm text-muted-foreground">Nurses can view summary status only. Diagnoses, doctor notes, prescriptions, lab results, and billing records are not editable here.</p>
            <p className="mt-3 text-sm">Latest encounter: {patient.latestEncounterSummary?.encounterNo ?? "None"} / {patient.latestEncounterSummary?.chiefComplaint ?? "No complaint recorded"}</p>
          </div>
        </section>
      ) : null}
      {tab === "Vitals" ? <SimpleTable headers={["Captured", "BP", "Temp", "Pulse", "BMI", "Priority", "Notes"]} rows={patient.previousVitals.map((v) => [formatDate(v.capturedAt), `${v.systolicBp ?? "--"}/${v.diastolicBp ?? "--"}`, `${v.temperatureC ?? "--"}C`, String(v.pulseRate ?? "--"), String(v.bmi ?? "--"), formatEnum(v.triagePriority), v.notes ?? ""])} /> : null}
      {tab === "Allergies" ? <SimpleTable headers={["Allergen", "Reaction", "Severity", "Notes"]} rows={patient.allergies.map((a) => [a.allergen, a.reaction ?? "", formatEnum(a.severity), a.notes ?? ""])} /> : null}
      {tab === "Chronic Conditions" ? <SimpleTable headers={["Condition", "Status", "Diagnosed", "Notes"]} rows={patient.chronicConditions.map((c) => [c.name, c.status ?? "", c.diagnosedAt ? formatDate(c.diagnosedAt) : "", c.notes ?? ""])} /> : null}
      {tab === "Medication History" ? <SimpleTable headers={["Medication", "Dosage", "Frequency", "Notes"]} rows={patient.medicationHistory.map((m) => [m.medicationName, m.dosage ?? "", m.frequency ?? "", m.notes ?? ""])} /> : null}
      {tab === "Immunizations" ? <SimpleTable headers={["Vaccine", "Dose", "Batch", "Administered", "Next Due"]} rows={patient.immunizations.map((i) => [i.vaccineName, i.dose ?? "", i.batchNumber ?? "", formatDate(i.administeredAt), i.nextDueAt ? formatDate(i.nextDueAt) : ""])} /> : null}
      {tab === "Queue History" ? <SimpleTable headers={["Queue", "Department", "Priority", "Status", "Arrived"]} rows={patient.queueHistory.map((q) => [q.queueNo, q.departmentName, formatEnum(q.priority), formatEnum(q.status), formatDate(q.arrivedAt)])} /> : null}
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="khms-card overflow-hidden">
      <ResponsiveTable minWidth="760px">
        <thead className="bg-accent-blue text-left"><tr>{headers.map((header) => <th key={header} className="khms-label px-4 py-3">{header}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, index) => <tr key={index} className="border-t border-border-subtle">{row.map((cell, cellIndex) => <td key={`${index}-${cellIndex}`} className="khms-table-data px-4 py-3">{cell}</td>)}</tr>)}
          {!rows.length ? <tr><td colSpan={headers.length}><EmptyState label="No records found." /></td></tr> : null}
        </tbody>
      </ResponsiveTable>
    </div>
  )
}

export function NurseImmunizationsPage({ patientId }: { patientId?: string }) {
  const [filters, setFilters] = useState({ search: "", vaccineName: "" })
  const { data: records = [], isLoading } = useNurseImmunizations(filters)
  const { data: queuePatients = [] } = useNurseTriageQueue({ status: "" })
  const [selectedPatientId, setSelectedPatientId] = useState(patientId ?? "")
  const [editing, setEditing] = useState<NurseImmunizationListItem | null>(null)
  const [form, setForm] = useState<NurseImmunizationCreatePayload>(blankImmunization)
  const create = useCreateNurseImmunization(patientId || selectedPatientId || editing?.patientId || "")
  const update = useUpdateNurseImmunization(editing?.patientId || patientId || "")

  async function save() {
    const targetPatientId = patientId || selectedPatientId || editing?.patientId
    if (!targetPatientId) {
      toast.error("Select a patient from the current facility queue first")
      return
    }
    try {
      if (editing) {
        await update.mutateAsync({ immunizationId: editing.id, payload: form })
        toast.success("Immunization updated")
      } else {
        await create.mutateAsync(form)
        toast.success("Immunization recorded")
      }
      setEditing(null)
      setForm(blankImmunization)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Immunization save failed")
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Nurse / Immunizations" title="Immunization Records" description="Record administered vaccines, due dates, batch numbers, and update nursing notes." />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Input placeholder="Search patient or vaccine" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
            <Input placeholder="Vaccine filter" value={filters.vaccineName} onChange={(event) => setFilters({ ...filters, vaccineName: event.target.value })} />
          </div>
          {isLoading ? <LoadingPanel /> : <SimpleTable headers={["Patient", "Vaccine", "Dose", "Batch", "Administered", "Next Due", "By"]} rows={records.map((record) => [record.patientName, record.vaccineName, record.dose ?? "", record.batchNumber ?? "", formatDate(record.administeredAt), record.nextDueAt ? formatDate(record.nextDueAt) : "", record.administeredByName ?? ""])} />}
          <div className="grid gap-2">
            {records.map((record) => <Button key={record.id} variant="outline" onClick={() => { setEditing(record); setForm({ vaccineName: record.vaccineName, dose: record.dose, batchNumber: record.batchNumber, administeredAt: toDateInput(record.administeredAt), nextDueAt: toDateInput(record.nextDueAt), notes: record.notes }) }}>Edit {record.vaccineName} - {record.patientName}</Button>)}
          </div>
        </div>
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">{editing ? "Edit Immunization" : "Add Immunization"}</h2>
          <div className="mt-4 grid gap-3">
            {!patientId && !editing ? (
              <SelectField
                label="Patient"
                value={selectedPatientId}
                onChange={setSelectedPatientId}
                includeBlank="Select queue patient"
                options={queuePatients.map((item) => ({
                  label: `${item.patientName} (${item.patientNo})`,
                  value: item.patientId,
                }))}
              />
            ) : null}
            <Field label="Vaccine Name"><Input value={form.vaccineName} onChange={(event) => setForm({ ...form, vaccineName: event.target.value })} /></Field>
            <Field label="Dose"><Input value={form.dose ?? ""} onChange={(event) => setForm({ ...form, dose: event.target.value })} /></Field>
            <Field label="Batch Number"><Input value={form.batchNumber ?? ""} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} /></Field>
            <Field label="Administered At"><Input type="date" value={form.administeredAt} onChange={(event) => setForm({ ...form, administeredAt: event.target.value })} /></Field>
            <Field label="Next Due"><Input type="date" value={form.nextDueAt ?? ""} onChange={(event) => setForm({ ...form, nextDueAt: event.target.value })} /></Field>
            <Field label="Notes"><textarea className="khms-input min-h-20 w-full py-3" value={form.notes ?? ""} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
            <Button onClick={save}>{editing ? "Update" : "Save"} Immunization</Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export function NurseNotificationsPage() {
  const { data: notifications = [], isLoading } = useNurseNotifications()
  const update = useUpdateNurseNotification()
  async function setStatus(id: string, status: "READ" | "ARCHIVED") {
    try {
      await update.mutateAsync({ id, payload: { status } })
      toast.success(status === "READ" ? "Marked as read" : "Notification archived")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Notification update failed")
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Nurse / Notifications" title="Notifications" description="View critical alerts, lab status alerts, referrals, and messages assigned to nursing." />
      <div className="khms-card overflow-hidden">
        {isLoading ? <LoadingPanel /> : (
          <div className="divide-y divide-border-subtle">
            {notifications.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={formatEnum(item.type)} />
                    <PriorityBadge priority={item.priority === "URGENT" ? "URGENT" : "ROUTINE"} />
                    <StatusBadge value={formatEnum(item.status)} />
                  </div>
                  <p className="mt-2 font-semibold">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.body ?? "No details"} / {formatDate(item.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStatus(item.id, "READ")}>Read</Button>
                  <Button size="sm" variant="outline" onClick={() => setStatus(item.id, "ARCHIVED")}>Archive</Button>
                </div>
              </div>
            ))}
            {!notifications.length ? <EmptyState label="No notifications found." /> : null}
          </div>
        )}
      </div>
    </div>
  )
}

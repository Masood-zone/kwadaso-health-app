"use client"

import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
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
  PageHeader,
  ResponsiveTable,
  formatEnum,
} from "@/components/super-admin/super-admin-ui"
import {
  useClinicianDashboard,
  useClinicianEncounters,
  useClinicianFollowUps,
  useClinicianLabRequests,
  useClinicianLabResults,
  useClinicianLookups,
  useClinicianMessages,
  useClinicianNotifications,
  useClinicianPatients,
  useClinicianPrescriptions,
  useClinicianReferrals,
  useConsultationQueue,
  useCreateEncounter,
  usePatientClinicalProfile,
  useSendClinicianMessage,
  useUpdateClinicianNotification,
  useUpdateConsultationQueue,
} from "@/services/clinician/clinician"
import type {
  ConsultationQueueFilters,
  PatientClinicalProfile,
} from "@/types/clinician"

function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="khms-card h-28 animate-pulse bg-muted" />
      ))}
    </div>
  )
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: string
  title: string
  detail: string
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-white p-8 text-center">
      <MaterialSymbol
        icon={icon}
        className="text-[40px] text-muted-foreground"
      />
      <p className="mt-3 font-heading text-lg font-semibold">{title}</p>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

function PageError({ message }: { message: string }) {
  return <DashboardError message={message} />
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function ActionError(error: unknown) {
  toast.error(
    error instanceof Error ? error.message : "Clinical action failed."
  )
}

export function ClinicianDashboardPage() {
  const query = useClinicianDashboard()
  const data = query.data
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinical command centre"
        title="Clinician Dashboard"
        description="Assigned work, critical results, and today's clinical activity."
        actions={
          <Button asChild>
            <Link href="/clinician/consultation-queue">
              <MaterialSymbol icon="play_arrow" /> Open consultation queue
            </Link>
          </Button>
        }
      />
      {query.isLoading ? (
        <LoadingCards count={8} />
      ) : query.isError ? (
        <PageError message="Clinician dashboard could not be loaded." />
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => (
              <MetricCard
                key={metric.label}
                {...metric}
                value={String(metric.value)}
              />
            ))}
          </section>
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="khms-card overflow-hidden">
              <div className="flex items-center justify-between border-b p-4">
                <div>
                  <p className="khms-label">Live queue</p>
                  <h2 className="font-heading text-xl font-semibold">
                    Ready for consultation
                  </h2>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/clinician/consultation-queue">View all</Link>
                </Button>
              </div>
              {data.queue.length ? (
                <QueueTable items={data.queue} compact />
              ) : (
                <EmptyState
                  icon="patient_list"
                  title="No assigned patients"
                  detail="New triaged patients will appear here when ready."
                />
              )}
            </div>
            <aside className="space-y-5">
              <div className="khms-card p-4">
                <p className="khms-label">Quick actions</p>
                <div className="mt-3 grid gap-2">
                  <Button asChild>
                    <Link href="/clinician/consultation-queue">
                      Start consultation
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/clinician/lab-requests">
                      Review lab result
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/clinician/prescriptions">Prescriptions</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/clinician/referrals">Create referral</Link>
                  </Button>
                </div>
              </div>
              <div className="khms-card p-4">
                <p className="khms-label text-emergency-dark">
                  Critical results
                </p>
                <div className="mt-3 space-y-3">
                  {data.criticalResults.length ? (
                    data.criticalResults.map((result) => (
                      <Link
                        key={result.id}
                        href="/clinician/lab-requests"
                        className="block rounded border border-emergency-dark/20 bg-emergency-soft p-3"
                      >
                        <p className="font-semibold text-emergency-dark">
                          {result.testName}
                        </p>
                        <p className="text-sm">{result.patientName}</p>
                      </Link>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No critical results awaiting attention.
                    </p>
                  )}
                </div>
              </div>
            </aside>
          </section>
        </>
      ) : null}
    </div>
  )
}

function QueueTable({
  items,
  compact = false,
}: {
  items: NonNullable<ReturnType<typeof useConsultationQueue>["data"]>
  compact?: boolean
}) {
  return (
    <ResponsiveTable minWidth="760px">
      <thead className="bg-accent-blue text-left">
        <tr>
          {[
            "Queue",
            "Patient",
            "Priority",
            "Status",
            "Waiting",
            "Vitals",
            "Action",
          ].map((label) => (
            <th key={label} className="khms-label px-4 py-3">
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-t">
            <td className="px-4 py-3 font-semibold">{item.queueNo}</td>
            <td className="px-4 py-3">
              <p className="font-semibold">{item.patientName}</p>
              <p className="text-xs text-muted-foreground">
                {item.patientNo} · {item.departmentName}
              </p>
              {item.allergies.length ? (
                <p className="mt-1 text-xs font-semibold text-emergency-dark">
                  Allergy: {item.allergies.map((a) => a.allergen).join(", ")}
                </p>
              ) : null}
            </td>
            <td className="px-4 py-3">
              <StatusBadge value={formatEnum(item.priority)} />
            </td>
            <td className="px-4 py-3">
              <StatusBadge value={formatEnum(item.status)} />
            </td>
            <td className="px-4 py-3 text-sm">{item.waitingMinutes} min</td>
            <td className="px-4 py-3 text-sm">
              {item.latestVitals
                ? `${item.latestVitals.systolicBp ?? "--"}/${item.latestVitals.diastolicBp ?? "--"} · ${item.latestVitals.pulseRate ?? "--"} bpm`
                : "Not captured"}
            </td>
            <td className="px-4 py-3">
              <Button size="sm" asChild>
                <Link
                  href={
                    item.encounter
                      ? `/clinician/encounters/${item.encounter.id}`
                      : `/clinician/consultation-queue/${item.id}`
                  }
                >
                  {item.encounter ? "Resume" : "Start"}
                </Link>
              </Button>
              {!compact ? (
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/clinician/patients/${item.patientId}`}>
                    Profile
                  </Link>
                </Button>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </ResponsiveTable>
  )
}

export function ConsultationQueuePage() {
  const [filters, setFilters] = useState<ConsultationQueueFilters>({})
  const query = useConsultationQueue(filters)
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Assigned clinical work"
        title="Consultation Queue"
        description="Claim, start, resume, and route triaged patients."
      />
      <div className="khms-card grid gap-3 p-4 md:grid-cols-4">
        <Input
          placeholder="Patient or folder number"
          value={filters.search ?? ""}
          onChange={(event) =>
            setFilters({ ...filters, search: event.target.value })
          }
        />
        <select
          className="khms-input"
          value={filters.priority ?? ""}
          onChange={(event) =>
            setFilters({
              ...filters,
              priority: event.target
                .value as ConsultationQueueFilters["priority"],
            })
          }
        >
          <option value="">All priorities</option>
          {["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.status ?? ""}
          onChange={(event) =>
            setFilters({
              ...filters,
              status: event.target.value as ConsultationQueueFilters["status"],
            })
          }
        >
          <option value="">Ready + awaiting lab</option>
          {[
            "IN_TRIAGE",
            "WITH_CLINICIAN",
            "AWAITING_LAB",
            "AWAITING_PHARMACY",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <Input
          type="date"
          value={filters.date ?? ""}
          onChange={(event) =>
            setFilters({ ...filters, date: event.target.value })
          }
        />
      </div>
      {query.isLoading ? (
        <LoadingCards />
      ) : query.isError ? (
        <PageError message="Consultation queue could not be loaded." />
      ) : query.data?.length ? (
        <div className="khms-card overflow-hidden">
          <QueueTable items={query.data} />
        </div>
      ) : (
        <EmptyState
          icon="queue"
          title="Queue is clear"
          detail="No patients match the current consultation filters."
        />
      )}
    </div>
  )
}

export function StartConsultationPage({ queueId }: { queueId: string }) {
  const router = useRouter()
  const queue = useConsultationQueue({})
  const lookups = useClinicianLookups()
  const create = useCreateEncounter()
  const updateQueue = useUpdateConsultationQueue()
  const item = queue.data?.find((entry) => entry.id === queueId)
  const [visitType, setVisitType] = useState("OPD")
  const [chiefComplaint, setChiefComplaint] = useState("")
  const [departmentId, setDepartmentId] = useState("")
  const effectiveDepartmentId = departmentId || item?.departmentId || ""
  async function submit() {
    if (!item) return
    try {
      const encounter = await create.mutateAsync({
        patientId: item.patientId,
        appointmentId: item.appointmentId,
        departmentId: effectiveDepartmentId,
        visitType: visitType as "OPD",
        chiefComplaint: chiefComplaint || item.reason,
        queueId: item.id,
      })
      toast.success("Consultation started.")
      router.push(`/clinician/encounters/${encounter.id}`)
    } catch (error) {
      ActionError(error)
    }
  }
  if (queue.isLoading || lookups.isLoading) return <LoadingCards />
  if (!item)
    return (
      <PageError message="Queue patient was not found or is no longer available." />
    )
  return (
    <div className="space-y-6">
      <PatientContext
        name={item.patientName}
        patientNo={item.patientNo}
        alerts={item.allergies.length}
      />
      <PageHeader
        eyebrow={`Queue ${item.queueNo}`}
        title="Start Consultation"
        description="Verify patient and clinical context before opening the encounter."
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="khms-card border-l-4 border-l-primary p-5">
            <div className="flex justify-between">
              <div>
                <h2 className="font-heading text-2xl font-semibold">
                  {item.patientName}
                </h2>
                <p className="text-muted-foreground">
                  {item.patientNo} ·{" "}
                  {formatEnum(item.patientName ? "ACTIVE" : "")}
                </p>
              </div>
              <StatusBadge value={formatEnum(item.priority)} />
            </div>
            {item.allergies.length ? (
              <div className="mt-4 rounded bg-emergency-soft p-3 font-semibold text-emergency-dark">
                Known allergies:{" "}
                {item.allergies.map((a) => a.allergen).join(", ")}
              </div>
            ) : null}
          </section>
          <section className="khms-card p-5">
            <p className="khms-label">Latest vitals</p>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [
                  "BP",
                  `${item.latestVitals?.systolicBp ?? "--"}/${item.latestVitals?.diastolicBp ?? "--"}`,
                ],
                ["Pulse", `${item.latestVitals?.pulseRate ?? "--"} bpm`],
                ["Temp", `${item.latestVitals?.temperatureC ?? "--"} °C`],
                ["SpO2", `${item.latestVitals?.oxygenSaturation ?? "--"}%`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded bg-surface-container-low p-3"
                >
                  <p className="khms-label">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="khms-card grid gap-4 p-5 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold">
              Visit type
              <select
                className="khms-input"
                value={visitType}
                onChange={(event) => setVisitType(event.target.value)}
              >
                {[
                  "OPD",
                  "EMERGENCY",
                  "FOLLOW_UP",
                  "MATERNAL_CHILD_HEALTH",
                  "REFERRAL",
                ].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Department
              <select
                className="khms-input"
                value={effectiveDepartmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
              >
                {lookups.data?.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold md:col-span-2">
              Chief complaint
              <textarea
                className="khms-input min-h-28 py-3"
                value={chiefComplaint}
                onChange={(event) => setChiefComplaint(event.target.value)}
                placeholder={item.reason ?? "Presenting complaint"}
              />
            </label>
          </section>
        </div>
        <aside className="space-y-4">
          <div className="khms-card bg-accent-blue p-5">
            <MaterialSymbol
              icon="play_circle"
              className="text-[48px] text-primary"
            />
            <h2 className="mt-3 font-heading text-2xl font-semibold text-primary">
              Ready to start?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Starting claims this queue item and opens the protected clinical
              record.
            </p>
            <Button
              className="mt-5 w-full"
              size="lg"
              disabled={create.isPending || !effectiveDepartmentId}
              onClick={submit}
            >
              Start encounter
            </Button>
          </div>
          <Button
            variant="outline"
            className="w-full"
            disabled={updateQueue.isPending}
            onClick={async () => {
              try {
                await updateQueue.mutateAsync({
                  id: item.id,
                  status: "CANCELLED",
                  cancellationReason: "Clinician cancelled before consultation",
                })
                router.push("/clinician/consultation-queue")
              } catch (error) {
                ActionError(error)
              }
            }}
          >
            Cancel queue visit
          </Button>
        </aside>
      </div>
    </div>
  )
}

function PatientContext({
  name,
  patientNo,
  alerts = 0,
}: {
  name: string
  patientNo: string
  alerts?: number
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-outline-variant bg-accent-blue px-4 py-3 text-primary">
      <div className="flex items-center gap-2 font-semibold">
        <MaterialSymbol icon="patient_list" /> Patient Context: {name}
        <span className="rounded bg-white px-2 py-1 text-xs">
          ID: {patientNo}
        </span>
      </div>
      {alerts ? (
        <span className="khms-badge bg-emergency-soft text-emergency-dark">
          Critical alerts ({alerts})
        </span>
      ) : null}
    </div>
  )
}

export function ActiveEncountersPage() {
  const query = useClinicianEncounters()
  const active = query.data?.filter(
    (item) => !["COMPLETED", "CANCELLED"].includes(item.status)
  )
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinical encounters"
        title="Active Encounters"
        description="Resume your assigned work or review facility encounter history."
      />
      {query.isLoading ? (
        <LoadingCards />
      ) : query.isError ? (
        <PageError message="Encounters could not be loaded." />
      ) : active?.length ? (
        <div className="khms-card overflow-hidden">
          <ResponsiveTable minWidth="760px">
            <thead className="bg-accent-blue text-left">
              <tr>
                {[
                  "Encounter",
                  "Patient",
                  "Department",
                  "Started",
                  "Status",
                  "Ownership",
                  "Action",
                ].map((label) => (
                  <th key={label} className="khms-label px-4 py-3">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {active.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="px-4 py-3 font-semibold">
                    {item.encounterNo}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{item.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.patientNo}
                    </p>
                  </td>
                  <td className="px-4 py-3">{item.departmentName}</td>
                  <td className="px-4 py-3 text-sm">
                    {formatDate(item.startedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={formatEnum(item.status)} />
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.canEdit
                      ? "Assigned to you"
                      : (item.clinicianName ?? "Unassigned")}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant={item.canEdit ? "default" : "outline"}
                      asChild
                    >
                      <Link href={`/clinician/encounters/${item.id}`}>
                        {item.canEdit ? "Resume" : "Review"}
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
      ) : (
        <EmptyState
          icon="clinical_notes"
          title="No active encounters"
          detail="Start a consultation from the assigned queue."
        />
      )}
    </div>
  )
}

export function ClinicianPatientsPage() {
  const [search, setSearch] = useState("")
  const query = useClinicianPatients(search)
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Facility clinical records"
        title="Patients"
        description="Search facility patients and review authorized clinical history."
      />
      <div className="khms-card p-4">
        <Input
          placeholder="Search by name, folder number, or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {query.isLoading ? (
        <LoadingCards />
      ) : query.isError ? (
        <PageError message="Patient records could not be loaded." />
      ) : query.data?.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {query.data.map((patient) => (
            <Link
              key={patient.id}
              href={`/clinician/patients/${patient.id}`}
              className="khms-card border-l-4 border-l-primary p-4 transition hover:bg-surface-container-low"
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-heading text-lg font-semibold">
                    {patient.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {patient.patientNo} · {formatEnum(patient.gender)} ·{" "}
                    {patient.age ?? "—"} yrs
                  </p>
                </div>
                <MaterialSymbol icon="arrow_forward" />
              </div>
              <div className="mt-4 flex gap-2">
                {patient.activeQueueStatus ? (
                  <StatusBadge value={formatEnum(patient.activeQueueStatus)} />
                ) : null}
                {patient.latestEncounterStatus ? (
                  <StatusBadge
                    value={formatEnum(patient.latestEncounterStatus)}
                  />
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="person_search"
          title="No patients found"
          detail="Try another name or folder number."
        />
      )}
    </div>
  )
}

const profileTabs = [
  "Overview",
  "Vitals",
  "Encounters",
  "Diagnoses",
  "Clinical Notes",
  "Lab Results",
  "Prescriptions",
  "Medication History",
  "Referrals",
  "Timeline",
] as const

export function PatientClinicalProfilePage() {
  const params = useParams<{ id: string }>()
  const query = usePatientClinicalProfile(params.id)
  const [tab, setTab] = useState<(typeof profileTabs)[number]>("Overview")
  if (query.isLoading) return <LoadingCards />
  if (query.isError || !query.data)
    return <PageError message="Patient clinical profile could not be loaded." />
  const patient = query.data
  return (
    <div className="space-y-5">
      <PatientContext
        name={patient.name}
        patientNo={patient.patientNo}
        alerts={patient.allergies.length}
      />
      <section className="khms-card border-l-4 border-l-primary p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row">
          <div>
            <h1 className="font-heading text-3xl font-bold">{patient.name}</h1>
            <p className="mt-1 text-muted-foreground">
              {patient.patientNo} · {patient.age ?? "—"} yrs ·{" "}
              {formatEnum(patient.gender)} · Blood{" "}
              {formatEnum(patient.bloodGroup)}
            </p>
          </div>
          <div className="flex gap-2">
            {patient.activeQueue ? (
              <Button asChild>
                <Link
                  href={
                    patient.activeQueue.encounter
                      ? `/clinician/encounters/${patient.activeQueue.encounter.id}`
                      : `/clinician/consultation-queue/${patient.activeQueue.id}`
                  }
                >
                  {patient.activeQueue.encounter
                    ? "Resume consultation"
                    : "Start consultation"}
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        {patient.allergies.length ? (
          <div className="mt-4 rounded bg-emergency-soft p-3 text-sm font-semibold text-emergency-dark">
            Allergies:{" "}
            {patient.allergies
              .map((item) => `${item.allergen} (${formatEnum(item.severity)})`)
              .join(", ")}
          </div>
        ) : null}
        {patient.chronicConditions.length ? (
          <div className="mt-2 rounded bg-pending-soft p-3 text-sm font-semibold text-tertiary-container">
            Chronic conditions:{" "}
            {patient.chronicConditions.map((item) => item.name).join(", ")}
          </div>
        ) : null}
      </section>
      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {profileTabs.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={tab === item ? "default" : "ghost"}
            onClick={() => setTab(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      <ProfileTab patient={patient} tab={tab} />
    </div>
  )
}

function ProfileTab({
  patient,
  tab,
}: {
  patient: PatientClinicalProfile
  tab: (typeof profileTabs)[number]
}) {
  if (tab === "Overview")
    return (
      <div className="grid gap-5 lg:grid-cols-3">
        <section className="khms-card p-4 lg:col-span-2">
          <p className="khms-label">Latest vitals</p>
          {patient.vitalSigns[0] ? (
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [
                  "Blood pressure",
                  `${patient.vitalSigns[0].systolicBp ?? "--"}/${patient.vitalSigns[0].diastolicBp ?? "--"}`,
                ],
                ["Pulse", patient.vitalSigns[0].pulseRate],
                ["Temperature", patient.vitalSigns[0].temperatureC],
                ["SpO2", patient.vitalSigns[0].oxygenSaturation],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded bg-surface-container-low p-3"
                >
                  <p className="khms-label">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value ?? "—"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No vitals captured.
            </p>
          )}
        </section>
        <section className="khms-card p-4">
          <p className="khms-label">Read-only operational status</p>
          <dl className="mt-3 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt>Billing</dt>
              <dd>
                {patient.billingStatus
                  ? formatEnum(patient.billingStatus)
                  : "None"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Dispensing</dt>
              <dd>
                {patient.dispensingStatus
                  ? formatEnum(patient.dispensingStatus)
                  : "None"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>Queue</dt>
              <dd>
                {patient.activeQueue
                  ? formatEnum(patient.activeQueue.status)
                  : "Not queued"}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    )
  const rows =
    tab === "Vitals"
      ? patient.vitalSigns.map((item) => ({
          title: `${item.systolicBp ?? "--"}/${item.diastolicBp ?? "--"} · ${item.pulseRate ?? "--"} bpm`,
          detail: `Temp ${item.temperatureC ?? "--"} °C · SpO2 ${item.oxygenSaturation ?? "--"}%`,
          date: item.capturedAt,
        }))
      : tab === "Encounters"
        ? patient.encounters.map((item) => ({
            title: `${item.encounterNo} · ${formatEnum(item.status)}`,
            detail: item.chiefComplaint ?? item.departmentName,
            date: item.startedAt,
          }))
        : tab === "Diagnoses"
          ? patient.diagnoses.map((item) => ({
              title: `${item.code ?? "Clinical"} · ${item.name}${item.isPrimary ? " (Primary)" : ""}`,
              detail: item.notes ?? "No notes",
              date: item.createdAt,
            }))
          : tab === "Clinical Notes"
            ? patient.clinicalNotes.map((item) => ({
                title: item.signedAt
                  ? "Signed clinical note"
                  : "Draft clinical note",
                detail: item.assessment ?? item.subjective ?? "No summary",
                date: item.createdAt,
              }))
            : tab === "Lab Results"
              ? patient.labResults.map((item) => ({
                  title: `${item.testName} · ${formatEnum(item.status)}`,
                  detail: item.resultText ?? "Structured result",
                  date: item.releasedAt ?? item.validatedAt,
                }))
              : tab === "Prescriptions"
                ? patient.prescriptions.map((item) => ({
                    title: `${item.prescriptionNo} · ${formatEnum(item.status)}`,
                    detail: item.items
                      .map((drug) => drug.medicineName)
                      .join(", "),
                    date: item.createdAt,
                  }))
                : tab === "Medication History"
                  ? patient.medicationHistory.map((item) => ({
                      title: item.medicationName,
                      detail: [item.dosage, item.frequency, item.notes]
                        .filter(Boolean)
                        .join(" · "),
                      date: item.startDate,
                    }))
                  : tab === "Referrals"
                    ? patient.referrals.map((item) => ({
                        title: `${item.referralNo} · ${formatEnum(item.status)}`,
                        detail: item.reason,
                        date: item.createdAt,
                      }))
                    : [
                        ...patient.encounters.map((item) => ({
                          title: `Encounter ${item.encounterNo}`,
                          detail: item.chiefComplaint ?? item.status,
                          date: item.startedAt,
                        })),
                        ...patient.appointments.map((item) => ({
                          title: `Appointment ${item.appointmentNo}`,
                          detail: item.reason ?? item.status,
                          date: item.scheduledAt,
                        })),
                        ...patient.queueHistory.map((item) => ({
                          title: `Queue ${item.queueNo}`,
                          detail: formatEnum(item.status),
                          date: item.arrivedAt,
                        })),
                      ].sort(
                        (a, b) =>
                          new Date(b.date ?? 0).getTime() -
                          new Date(a.date ?? 0).getTime()
                      )
  return rows.length ? (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <article key={`${row.title}-${index}`} className="khms-card p-4">
          <div className="flex justify-between gap-4">
            <div>
              <p className="font-semibold">{row.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {row.detail || "No additional detail"}
              </p>
            </div>
            <time className="shrink-0 text-xs text-muted-foreground">
              {formatDate(row.date)}
            </time>
          </div>
        </article>
      ))}
    </div>
  ) : (
    <EmptyState
      icon="clinical_notes"
      title={`No ${tab.toLowerCase()}`}
      detail="There are no records in this section."
    />
  )
}

export function LabRequestsPage() {
  const requests = useClinicianLabRequests()
  const results = useClinicianLabResults()
  const [tab, setTab] = useState<"requests" | "results">("requests")
  const loading = requests.isLoading || results.isLoading
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Laboratory coordination"
        title="Lab Requests & Results"
        description="Track requests and review validated or released results without changing laboratory data."
      />
      <div className="flex gap-2">
        <Button
          variant={tab === "requests" ? "default" : "outline"}
          onClick={() => setTab("requests")}
        >
          Requests
        </Button>
        <Button
          variant={tab === "results" ? "default" : "outline"}
          onClick={() => setTab("results")}
        >
          Released results
        </Button>
      </div>
      {loading ? (
        <LoadingCards />
      ) : tab === "requests" ? (
        requests.data?.length ? (
          <ClinicalList
            rows={requests.data.map((item) => ({
              id: item.id,
              title: `${item.requestNo} · ${item.patientName}`,
              detail: item.tests.map((test) => test.name).join(", "),
              status: item.status,
              date: item.requestedAt,
            }))}
          />
        ) : (
          <EmptyState
            icon="biotech"
            title="No lab requests"
            detail="Lab requests created during encounters will appear here."
          />
        )
      ) : results.data?.length ? (
        <ClinicalList
          rows={results.data.map((item) => ({
            id: item.id,
            title: `${item.testName} · ${item.patientName}`,
            detail:
              item.resultText ??
              item.items
                .map(
                  (result) =>
                    `${result.parameterName}: ${result.value ?? "—"} ${result.unit ?? ""}`
                )
                .join(" · "),
            status: item.criticalFlag
              ? "CRITICAL"
              : item.abnormalFlag
                ? "ABNORMAL"
                : item.status,
            date: item.releasedAt ?? item.validatedAt,
          }))}
        />
      ) : (
        <EmptyState
          icon="science"
          title="No released results"
          detail="Only validated or released laboratory results are shown."
        />
      )}
    </div>
  )
}

function ClinicalList({
  rows,
}: {
  rows: {
    id: string
    title: string
    detail: string
    status: string
    date: string | null
  }[]
}) {
  return (
    <div className="space-y-3">
      {rows.map((row) => (
        <article
          key={row.id}
          className="khms-card flex flex-col justify-between gap-3 border-l-4 border-l-primary p-4 md:flex-row md:items-center"
        >
          <div>
            <p className="font-semibold">{row.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.detail || "No additional detail"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge value={formatEnum(row.status)} />
            <time className="text-xs text-muted-foreground">
              {formatDate(row.date)}
            </time>
          </div>
        </article>
      ))}
    </div>
  )
}

export function PrescriptionsPage() {
  const query = useClinicianPrescriptions()
  return (
    <ResourceListPage
      eyebrow="Medication management"
      title="Prescriptions"
      description="Review prescriptions and read-only dispensing status."
      loading={query.isLoading}
      error={query.isError}
      empty="No prescriptions have been created."
      rows={query.data?.map((item) => ({
        id: item.id,
        title: `${item.prescriptionNo} · ${item.patientName}`,
        detail: item.items
          .map((drug) => `${drug.medicineName} ${drug.dosage ?? ""}`)
          .join(", "),
        status: item.status,
        date: item.issuedAt ?? item.createdAt,
      }))}
    />
  )
}
export function ReferralsPage() {
  const query = useClinicianReferrals()
  return (
    <ResourceListPage
      eyebrow="Care coordination"
      title="Referrals"
      description="Track internal and schema-backed facility referrals."
      loading={query.isLoading}
      error={query.isError}
      empty="No referrals have been created."
      rows={query.data?.map((item) => ({
        id: item.id,
        title: `${item.referralNo} · ${item.patientName}`,
        detail: `${item.toDepartmentName ?? item.toFacilityName ?? "Destination"} · ${item.reason}`,
        status: item.status,
        date: item.sentAt ?? item.createdAt,
      }))}
    />
  )
}
export function FollowUpsPage() {
  const query = useClinicianFollowUps()
  return (
    <ResourceListPage
      eyebrow="Continuity of care"
      title="Follow-Ups"
      description="Upcoming clinical appointments scheduled after encounters."
      loading={query.isLoading}
      error={query.isError}
      empty="No upcoming follow-ups."
      rows={query.data?.map((item) => ({
        id: item.id,
        title: `${item.patientName} · ${item.departmentName ?? "Clinical follow-up"}`,
        detail: item.reason ?? item.title ?? "Follow-up",
        status: item.status,
        date: item.scheduledAt,
      }))}
    />
  )
}

function ResourceListPage({
  eyebrow,
  title,
  description,
  loading,
  error,
  empty,
  rows,
}: {
  eyebrow: string
  title: string
  description: string
  loading: boolean
  error: boolean
  empty: string
  rows?: {
    id: string
    title: string
    detail: string
    status: string
    date: string | null
  }[]
}) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      {loading ? (
        <LoadingCards />
      ) : error ? (
        <PageError message={`${title} could not be loaded.`} />
      ) : rows?.length ? (
        <ClinicalList rows={rows} />
      ) : (
        <EmptyState
          icon="inventory_2"
          title={empty}
          detail="Create this record from an active encounter."
        />
      )}
    </div>
  )
}

export function MessagesPage() {
  const query = useClinicianMessages()
  const lookups = useClinicianLookups()
  const send = useSendClinicianMessage()
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [participantId, setParticipantId] = useState("")
  const [activeThread, setActiveThread] = useState("")
  async function submit() {
    try {
      await send.mutateAsync(
        activeThread
          ? { threadId: activeThread, body }
          : {
              subject,
              body,
              participantIds: participantId ? [participantId] : [],
            }
      )
      setBody("")
      setSubject("")
      toast.success("Clinical message sent.")
    } catch (error) {
      ActionError(error)
    }
  }
  const selected = query.data?.find((thread) => thread.id === activeThread)
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinical communication"
        title="Messages"
        description="Patient-linked communication with nursing, laboratory, and pharmacy staff."
      />
      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="khms-card overflow-hidden">
          <div className="border-b p-4">
            <Button className="w-full" onClick={() => setActiveThread("")}>
              New message
            </Button>
          </div>
          {query.data?.map((thread) => (
            <button
              key={thread.id}
              className={`w-full border-b p-4 text-left ${activeThread === thread.id ? "bg-accent-blue" : "hover:bg-muted"}`}
              onClick={() => setActiveThread(thread.id)}
            >
              <p className="font-semibold">{thread.subject}</p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {thread.messages.at(-1)?.body}
              </p>
            </button>
          ))}
        </aside>
        <section className="khms-card p-5">
          {selected ? (
            <>
              <h2 className="font-heading text-xl font-semibold">
                {selected.subject}
              </h2>
              <div className="my-4 max-h-[420px] space-y-3 overflow-y-auto">
                {selected.messages.map((message) => (
                  <div
                    key={message.id}
                    className="rounded bg-surface-container-low p-3"
                  >
                    <p className="text-xs font-semibold text-primary">
                      {message.senderName ?? "Former staff"}
                    </p>
                    <p className="mt-1 text-sm">{message.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(message.sentAt)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <h2 className="font-heading text-xl font-semibold">
                New clinical message
              </h2>
              <div className="mt-4 grid gap-3">
                <Input
                  placeholder="Subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
                <select
                  className="khms-input"
                  value={participantId}
                  onChange={(event) => setParticipantId(event.target.value)}
                >
                  <option value="">Select recipient</option>
                  {lookups.data?.staff.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {formatEnum(item.role)}
                      </option>
                    ))}
                </select>
              </div>
            </>
          )}
          <textarea
            className="khms-input mt-4 min-h-28 w-full py-3"
            placeholder="Clinical message"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
          <Button
            className="mt-3"
            disabled={
              !body.trim() ||
              (!selected && (!subject.trim() || !participantId)) ||
              send.isPending
            }
            onClick={submit}
          >
            Send message
          </Button>
        </section>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const query = useClinicianNotifications()
  const update = useUpdateClinicianNotification()
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clinical alerts"
        title="Notifications"
        description="Critical results, referrals, messages, and system alerts."
      />
      {query.isLoading ? (
        <LoadingCards />
      ) : query.isError ? (
        <PageError message="Notifications could not be loaded." />
      ) : query.data?.length ? (
        <div className="space-y-3">
          {query.data.map((item) => (
            <article
              key={item.id}
              className={`khms-card flex flex-col justify-between gap-3 p-4 md:flex-row md:items-center ${item.status === "UNREAD" ? "border-l-4 border-l-primary" : ""}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={formatEnum(item.priority)} />
                  <p className="font-semibold">{item.title}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {item.body}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(item.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {item.actionUrl ? (
                  <Button size="sm" variant="outline" asChild>
                    <Link href={item.actionUrl}>Open</Link>
                  </Button>
                ) : null}
                {item.status === "UNREAD" ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      update.mutate({ id: item.id, status: "READ" })
                    }
                  >
                    Mark read
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      update.mutate({ id: item.id, status: "ARCHIVED" })
                    }
                  >
                    Archive
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="notifications"
          title="No clinical notifications"
          detail="Critical alerts and care coordination updates will appear here."
        />
      )}
    </div>
  )
}

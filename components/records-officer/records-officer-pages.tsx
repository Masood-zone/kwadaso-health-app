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
  Field,
  formatEnum,
  PageHeader,
  ResponsiveTable,
} from "@/components/super-admin/super-admin-ui"
import {
  useCreateRecordsOfficerAppointment,
  useCreateRecordsOfficerDocument,
  useCreateRecordsOfficerPatient,
  useCreateRecordsOfficerQueue,
  useRecordsOfficerAppointments,
  useRecordsOfficerCheckIn,
  useRecordsOfficerDashboard,
  useRecordsOfficerDocuments,
  useRecordsOfficerDuplicates,
  useRecordsOfficerLookups,
  useRecordsOfficerPatient,
  useRecordsOfficerPatients,
  useRecordsOfficerPrintExport,
  useRecordsOfficerQueue,
  useRecordsOfficerTimeline,
  useRecordsOfficerVisitHistory,
  useUpdateRecordsOfficerAppointment,
  useUpdateRecordsOfficerPatient,
  useUpdateRecordsOfficerQueue,
} from "@/services/records-officer/records"
import type {
  RecordsOfficerAppointmentCreatePayload,
  RecordsOfficerAppointmentListItem,
  RecordsOfficerPatientCreatePayload,
  RecordsOfficerPatientDocumentPayload,
  RecordsOfficerPatientFilters,
  RecordsOfficerPatientListItem,
  RecordsOfficerQueueCreatePayload,
  RecordsOfficerQueueListItem,
} from "@/types/records-officer"

const blankPatient: RecordsOfficerPatientCreatePayload = {
  firstName: "",
  lastName: "",
  otherNames: "",
  gender: "UNKNOWN",
  dateOfBirth: null,
  estimatedAge: null,
  maritalStatus: "UNKNOWN",
  bloodGroup: "UNKNOWN",
  occupation: "",
  phone: "",
  email: "",
  residentialAddress: "",
  community: "",
  nhisNumber: "",
  nationalIdNumber: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  emergencyContactRelation: "",
}

const blankAppointment: RecordsOfficerAppointmentCreatePayload = {
  patientId: "",
  departmentId: "",
  clinicianId: "",
  scheduledAt: "",
  durationMinutes: 30,
  title: "",
  reason: "",
  notes: "",
}

const blankQueue: RecordsOfficerQueueCreatePayload = {
  patientId: "",
  appointmentId: "",
  departmentId: "",
  priority: "ROUTINE",
  reason: "",
  notes: "",
}

const blankDocument: RecordsOfficerPatientDocumentPayload = {
  type: "SCANNED_RECORD",
  title: "",
  fileUrl: "",
  fileName: "",
  mimeType: "",
  sizeBytes: null,
}

function LoadingPanel() {
  return <div className="khms-card h-80 animate-pulse bg-muted" />
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-6 text-center text-sm text-muted-foreground">{label}</div>
  )
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

function toDateTimeLocal(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : null
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
      <select
        className="khms-input w-full"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
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

function PatientCard({ patient }: { patient: RecordsOfficerPatientListItem }) {
  return (
    <div className="rounded border border-border-subtle bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded bg-medical-green-soft text-primary">
          <MaterialSymbol icon="patient_list" className="text-[24px]" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{patient.name}</p>
          <p className="text-xs font-semibold text-primary">
            {patient.patientNo}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatEnum(patient.gender)} /{" "}
            {patient.age ? `${patient.age} yrs` : "Age unknown"} /{" "}
            {patient.phone ?? "No phone"}
          </p>
        </div>
      </div>
    </div>
  )
}

function PatientPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string
  onSelect: (patient: RecordsOfficerPatientListItem) => void
}) {
  const [search, setSearch] = useState("")
  const { data: patients = [] } = useRecordsOfficerPatients({ search })
  const selected = patients.find((patient) => patient.id === selectedId)
  return (
    <div className="space-y-3">
      <Field label="Patient Search">
        <Input
          placeholder="Search patient name, folder number, phone, NHIS"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      {selected ? <PatientCard patient={selected} /> : null}
      {search ? (
        <div className="max-h-56 overflow-auto rounded border border-border-subtle bg-white">
          {patients.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className="flex w-full items-center justify-between border-b border-border-subtle px-3 py-2 text-left hover:bg-accent-blue"
              onClick={() => onSelect(patient)}
            >
              <span>
                <span className="block text-sm font-semibold">
                  {patient.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {patient.patientNo} / {patient.phone ?? "No phone"}
                </span>
              </span>
              <MaterialSymbol icon="add_circle" className="text-primary" />
            </button>
          ))}
          {!patients.length ? (
            <EmptyState label="No matching facility patients." />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function RecordsOfficerDashboardPage() {
  const { data, isLoading, isError } = useRecordsOfficerDashboard()
  if (isLoading) return <LoadingPanel />
  if (isError || !data)
    return <DashboardError message="Records dashboard could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office"
        title="Patient Records Desk"
        description="Register patients, find folders, manage appointments, and move patients into the care queue."
        actions={
          <>
            <Button asChild>
              <Link href="/records-officer/patients/register">
                <MaterialSymbol icon="person_add" />
                Register Patient
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/records-officer/check-in">
                <MaterialSymbol icon="how_to_reg" />
                Check In
              </Link>
            </Button>
          </>
        }
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="khms-card overflow-hidden">
          <div className="border-b border-border-subtle p-4">
            <p className="khms-label">Recently Updated</p>
            <h2 className="font-heading text-xl font-semibold">
              Patient Records
            </h2>
          </div>
          <div className="divide-y divide-border-subtle">
            {data.recentPatients.map((patient) => (
              <Link
                key={patient.id}
                href={`/records-officer/patients/${patient.id}`}
                className="block p-4 hover:bg-accent-blue"
              >
                <PatientCard patient={patient} />
              </Link>
            ))}
            {!data.recentPatients.length ? (
              <EmptyState label="No patient records yet." />
            ) : null}
          </div>
        </div>
        <div className="khms-card overflow-hidden">
          <div className="border-b border-border-subtle p-4">
            <p className="khms-label">Today</p>
            <h2 className="font-heading text-xl font-semibold">
              Appointments & Queue
            </h2>
          </div>
          <div className="grid gap-3 p-4">
            {data.todayAppointments.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="rounded border border-border-subtle p-3"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{item.patientName}</p>
                  <StatusBadge value={formatEnum(item.status)} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.patientNo} / {formatDate(item.scheduledAt)}
                </p>
              </div>
            ))}
            {data.activeQueue.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="rounded border border-orange-200 bg-orange-50 p-3"
              >
                <p className="font-semibold">
                  {item.queueNo} - {item.patientName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {item.departmentName} / {formatEnum(item.priority)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export function RecordsOfficerPatientDirectoryPage() {
  const [filters, setFilters] = useState<RecordsOfficerPatientFilters>({
    search: "",
    gender: "",
    status: "",
  })
  const { data: lookups } = useRecordsOfficerLookups()
  const {
    data: patients = [],
    isLoading,
    isError,
  } = useRecordsOfficerPatients(filters)
  if (isError) return <DashboardError message="Patients could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Patients"
        title="Patient Directory"
        description="Search patient folders, update biodata, print records, and launch care flow actions."
        actions={
          <Button asChild>
            <Link href="/records-officer/patients/register">
              <MaterialSymbol icon="person_add" />
              New Patient Registration
            </Link>
          </Button>
        }
      />
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Input
          placeholder="Search name, folder, phone, NHIS"
          value={filters.search}
          onChange={(event) =>
            setFilters({ ...filters, search: event.target.value })
          }
        />
        <select
          className="khms-input"
          value={filters.gender}
          onChange={(event) =>
            setFilters({ ...filters, gender: event.target.value as never })
          }
        >
          <option value="">All genders</option>
          {lookups?.genders.map((item) => (
            <option key={item} value={item}>
              {formatEnum(item)}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.status}
          onChange={(event) =>
            setFilters({ ...filters, status: event.target.value as never })
          }
        >
          <option value="">All statuses</option>
          {lookups?.patientStatuses.map((item) => (
            <option key={item} value={item}>
              {formatEnum(item)}
            </option>
          ))}
        </select>
        <Input
          placeholder="Community"
          value={filters.community ?? ""}
          onChange={(event) =>
            setFilters({ ...filters, community: event.target.value })
          }
        />
      </section>
      <div className="khms-card overflow-hidden">
        {isLoading ? (
          <LoadingPanel />
        ) : (
          <ResponsiveTable minWidth="980px">
            <thead className="bg-accent-blue text-left">
              <tr>
                <th className="khms-label px-4 py-3">Patient</th>
                <th className="khms-label px-4 py-3">Gender/Age</th>
                <th className="khms-label px-4 py-3">Contact</th>
                <th className="khms-label px-4 py-3">NHIS</th>
                <th className="khms-label px-4 py-3">Status</th>
                <th className="khms-label px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-t border-border-subtle">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{patient.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {patient.patientNo}
                    </p>
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {formatEnum(patient.gender)} / {patient.age ?? "N/A"}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {patient.phone ?? "No phone"}
                    <br />
                    {patient.community ?? "No community"}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {patient.nhisNumber ?? "Not set"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={formatEnum(patient.status)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/records-officer/patients/${patient.id}`}>
                          Profile
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          href={`/records-officer/appointments?patientId=${patient.id}`}
                        >
                          Book
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!patients.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState label="No patients found." />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </ResponsiveTable>
        )}
      </div>
    </div>
  )
}

export function RecordsOfficerRegisterPatientPage() {
  const router = useRouter()
  const [form, setForm] =
    useState<RecordsOfficerPatientCreatePayload>(blankPatient)
  const [created, setCreated] = useState<RecordsOfficerPatientListItem | null>(
    null
  )
  const { data: lookups } = useRecordsOfficerLookups()
  const createPatient = useCreateRecordsOfficerPatient()

  async function savePatient() {
    try {
      const patient = await createPatient.mutateAsync(form)
      setCreated(patient)
      toast.success(`Patient registered: ${patient.patientNo}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Patient registration failed"
      )
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Register"
        title="New Patient Registration"
        description="Create a facility-scoped patient folder and hospital number."
      />
      {created ? (
        <section className="khms-card mx-auto max-w-xl p-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded bg-medical-green-soft text-primary">
            <MaterialSymbol icon="task_alt" className="text-[32px]" />
          </div>
          <h2 className="mt-4 font-heading text-2xl font-bold">
            Registration Successful
          </h2>
          <p className="mt-2 text-muted-foreground">Generated patient number</p>
          <p className="mt-1 font-heading text-3xl font-bold text-primary">
            {created.patientNo}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() =>
                router.push(`/records-officer/patients/${created.id}`)
              }
            >
              View Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/records-officer/appointments")}
            >
              Book Appointment
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/records-officer/check-in")}
            >
              Send To Queue
            </Button>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="khms-card p-5">
            <div className="grid gap-5 md:grid-cols-2">
              <div className="grid gap-3">
                <h2 className="font-heading text-xl font-semibold">
                  Personal Information
                </h2>
                <Field label="First Name">
                  <Input
                    value={form.firstName}
                    onChange={(event) =>
                      setForm({ ...form, firstName: event.target.value })
                    }
                  />
                </Field>
                <Field label="Last Name">
                  <Input
                    value={form.lastName}
                    onChange={(event) =>
                      setForm({ ...form, lastName: event.target.value })
                    }
                  />
                </Field>
                <Field label="Other Names">
                  <Input
                    value={form.otherNames ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, otherNames: event.target.value })
                    }
                  />
                </Field>
                <SelectField
                  label="Gender"
                  value={form.gender}
                  onChange={(gender) =>
                    setForm({ ...form, gender: gender as never })
                  }
                  options={(lookups?.genders ?? []).map((item) => ({
                    label: formatEnum(item),
                    value: item,
                  }))}
                />
                <Field label="Date of Birth">
                  <Input
                    type="datetime-local"
                    value={toDateTimeLocal(form.dateOfBirth)}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        dateOfBirth: fromDateTimeLocal(event.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Estimated Age">
                  <Input
                    type="number"
                    value={form.estimatedAge ?? ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        estimatedAge: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-3">
                <h2 className="font-heading text-xl font-semibold">
                  Contact & Identification
                </h2>
                <Field label="Phone">
                  <Input
                    value={form.phone ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                  />
                </Field>
                <Field label="Email">
                  <Input
                    value={form.email ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                  />
                </Field>
                <Field label="Residential Address">
                  <Input
                    value={form.residentialAddress ?? ""}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        residentialAddress: event.target.value,
                      })
                    }
                  />
                </Field>
                <Field label="Community">
                  <Input
                    value={form.community ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, community: event.target.value })
                    }
                  />
                </Field>
                <Field label="NHIS Number">
                  <Input
                    value={form.nhisNumber ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, nhisNumber: event.target.value })
                    }
                  />
                </Field>
                <Field label="National ID">
                  <Input
                    value={form.nationalIdNumber ?? ""}
                    onChange={(event) =>
                      setForm({ ...form, nationalIdNumber: event.target.value })
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-3 md:col-span-2">
                <h2 className="font-heading text-xl font-semibold">
                  Emergency & Additional Details
                </h2>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Emergency Contact Name">
                    <Input
                      value={form.emergencyContactName ?? ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          emergencyContactName: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Emergency Contact Phone">
                    <Input
                      value={form.emergencyContactPhone ?? ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          emergencyContactPhone: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <Field label="Emergency Contact Relation">
                    <Input
                      value={form.emergencyContactRelation ?? ""}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          emergencyContactRelation: event.target.value,
                        })
                      }
                    />
                  </Field>
                  <SelectField
                    label="Marital Status"
                    value={form.maritalStatus ?? "UNKNOWN"}
                    onChange={(maritalStatus) =>
                      setForm({
                        ...form,
                        maritalStatus: maritalStatus as never,
                      })
                    }
                    options={(lookups?.maritalStatuses ?? []).map((item) => ({
                      label: formatEnum(item),
                      value: item,
                    }))}
                  />
                  <SelectField
                    label="Blood Group"
                    value={form.bloodGroup ?? "UNKNOWN"}
                    onChange={(bloodGroup) =>
                      setForm({ ...form, bloodGroup: bloodGroup as never })
                    }
                    options={(lookups?.bloodGroups ?? []).map((item) => ({
                      label: formatEnum(item),
                      value: item,
                    }))}
                  />
                  <Field label="Occupation">
                    <Input
                      value={form.occupation ?? ""}
                      onChange={(event) =>
                        setForm({ ...form, occupation: event.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>
          <aside className="khms-card p-5">
            <p className="khms-label">Registration Checklist</p>
            <h2 className="mt-1 font-heading text-xl font-semibold">
              Folder creation
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              A unique KHS patient number will be generated automatically after
              saving.
            </p>
            <Button
              className="mt-5 w-full"
              onClick={savePatient}
              disabled={createPatient.isPending}
            >
              <MaterialSymbol icon="save" />
              Register Patient
            </Button>
          </aside>
        </section>
      )}
    </div>
  )
}

export function RecordsOfficerPatientProfilePage() {
  const params = useParams<{ id: string }>()
  const patientId = params.id
  const [activeTab, setActiveTab] = useState("Overview")
  const {
    data: patient,
    isLoading,
    isError,
  } = useRecordsOfficerPatient(patientId)
  const { data: lookups } = useRecordsOfficerLookups()
  const updatePatient = useUpdateRecordsOfficerPatient()
  const createDocument = useCreateRecordsOfficerDocument(patientId)
  const printExport = useRecordsOfficerPrintExport(patientId)
  const { data: documents = [] } = useRecordsOfficerDocuments(patientId)
  const { data: visits = [] } = useRecordsOfficerVisitHistory(patientId)
  const { data: timeline = [] } = useRecordsOfficerTimeline(patientId)
  const [editForm, setEditForm] = useState<
    Partial<RecordsOfficerPatientCreatePayload>
  >({})
  const [docForm, setDocForm] = useState(blankDocument)

  async function saveEdit(status?: "ARCHIVED") {
    if (!patient) return
    const payload = {
      firstName: editForm.firstName ?? patient.firstName,
      lastName: editForm.lastName ?? patient.lastName,
      otherNames: editForm.otherNames ?? patient.otherNames ?? "",
      gender: editForm.gender ?? patient.gender,
      dateOfBirth: editForm.dateOfBirth ?? patient.dateOfBirth,
      estimatedAge: editForm.estimatedAge ?? patient.age,
      maritalStatus: editForm.maritalStatus ?? patient.maritalStatus,
      bloodGroup: editForm.bloodGroup ?? patient.bloodGroup,
      occupation: editForm.occupation ?? patient.occupation ?? "",
      phone: editForm.phone ?? patient.phone ?? "",
      email: editForm.email ?? patient.email ?? "",
      residentialAddress:
        editForm.residentialAddress ?? patient.residentialAddress ?? "",
      community: editForm.community ?? patient.community ?? "",
      nhisNumber: editForm.nhisNumber ?? patient.nhisNumber ?? "",
      nationalIdNumber:
        editForm.nationalIdNumber ?? patient.nationalIdNumber ?? "",
      emergencyContactName:
        editForm.emergencyContactName ?? patient.emergencyContactName ?? "",
      emergencyContactPhone:
        editForm.emergencyContactPhone ?? patient.emergencyContactPhone ?? "",
      emergencyContactRelation:
        editForm.emergencyContactRelation ??
        patient.emergencyContactRelation ??
        "",
      status: status ?? patient.status,
      updateReason: status ? "Archived by Records Officer" : "Biodata update",
    }
    try {
      await updatePatient.mutateAsync({
        id: patientId,
        payload,
      })
      toast.success("Patient updated")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Patient update failed"
      )
    }
  }

  async function uploadDocument() {
    try {
      await createDocument.mutateAsync(docForm)
      setDocForm(blankDocument)
      toast.success("Document metadata saved")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Document save failed"
      )
    }
  }

  async function printSummary(action: "PRINT" | "EXPORT") {
    try {
      await printExport.mutateAsync({
        action,
        sections: ["biodata", "appointments", "documents", "visit-history"],
      })
      toast.success(`${action === "PRINT" ? "Print" : "Export"} audit recorded`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Print/export failed"
      )
    }
  }

  if (isLoading) return <LoadingPanel />
  if (isError || !patient)
    return <DashboardError message="Patient profile could not be loaded." />

  const tabs = [
    "Overview",
    "Biodata",
    "Appointments",
    "Queue History",
    "Visit History",
    "Documents",
    "Timeline",
    "Print / Export",
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={`Patients / ${patient.patientNo}`}
        title={patient.name}
        description={`${formatEnum(patient.gender)} / ${patient.age ?? "Age unknown"} / ${patient.phone ?? "No phone"}`}
        actions={
          <>
            <Button variant="outline" onClick={() => printSummary("PRINT")}>
              <MaterialSymbol icon="print" /> Print
            </Button>
            <Button variant="outline" onClick={() => saveEdit("ARCHIVED")}>
              <MaterialSymbol icon="archive" /> Archive
            </Button>
          </>
        }
      />
      <section className="flex gap-2 overflow-x-auto rounded border border-border-subtle bg-white p-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`min-w-max rounded px-3 py-2 text-sm font-semibold ${activeTab === tab ? "bg-primary text-white" : "text-muted-foreground hover:bg-accent-blue"}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </section>
      {activeTab === "Overview" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="khms-card p-5">
            <h2 className="font-heading text-xl font-semibold">
              Patient Overview
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ["Patient Number", patient.patientNo],
                ["Phone", patient.phone ?? "Not set"],
                ["Community", patient.community ?? "Not set"],
                ["NHIS", patient.nhisNumber ?? "Not set"],
                ["Blood Group", formatEnum(patient.bloodGroup)],
                ["Status", formatEnum(patient.status)],
                [
                  "Emergency Contact",
                  patient.emergencyContactName ?? "Not set",
                ],
                ["Emergency Phone", patient.emergencyContactPhone ?? "Not set"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded border border-border-subtle p-3"
                >
                  <p className="khms-label">{label}</p>
                  <p className="mt-1 text-sm font-semibold">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <aside className="khms-card p-5">
            <p className="khms-label">Read-only clinical summary</p>
            <div className="mt-4 grid gap-3 text-sm">
              <p>Last encounter: {patient.summary.lastEncounter ?? "None"}</p>
              <p>Last diagnosis: {patient.summary.lastDiagnosis ?? "None"}</p>
              <p>Latest lab: {patient.summary.latestLabStatus ?? "None"}</p>
              <p>
                Prescription:{" "}
                {patient.summary.latestPrescriptionStatus ?? "None"}
              </p>
              <p>
                Invoice: {patient.summary.outstandingInvoiceStatus ?? "None"}
              </p>
            </div>
          </aside>
        </section>
      ) : null}
      {activeTab === "Biodata" ? (
        <section className="khms-card p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="First Name">
              <Input
                value={editForm.firstName ?? patient.firstName}
                onChange={(event) =>
                  setEditForm({ ...editForm, firstName: event.target.value })
                }
              />
            </Field>
            <Field label="Last Name">
              <Input
                value={editForm.lastName ?? patient.lastName}
                onChange={(event) =>
                  setEditForm({ ...editForm, lastName: event.target.value })
                }
              />
            </Field>
            <Field label="Phone">
              <Input
                value={editForm.phone ?? patient.phone ?? ""}
                onChange={(event) =>
                  setEditForm({ ...editForm, phone: event.target.value })
                }
              />
            </Field>
            <Field label="Community">
              <Input
                value={editForm.community ?? patient.community ?? ""}
                onChange={(event) =>
                  setEditForm({ ...editForm, community: event.target.value })
                }
              />
            </Field>
            <Field label="NHIS">
              <Input
                value={editForm.nhisNumber ?? patient.nhisNumber ?? ""}
                onChange={(event) =>
                  setEditForm({ ...editForm, nhisNumber: event.target.value })
                }
              />
            </Field>
            <Field label="National ID">
              <Input
                value={
                  editForm.nationalIdNumber ?? patient.nationalIdNumber ?? ""
                }
                onChange={(event) =>
                  setEditForm({
                    ...editForm,
                    nationalIdNumber: event.target.value,
                  })
                }
              />
            </Field>
          </div>
          <Button className="mt-4" onClick={() => saveEdit()}>
            <MaterialSymbol icon="save" /> Save Biodata
          </Button>
        </section>
      ) : null}
      {activeTab === "Appointments" ? (
        <RecordsTable
          rows={patient.appointments.map((item) => [
            item.appointmentNo,
            item.patientName,
            item.departmentName ?? "No department",
            formatDate(item.scheduledAt),
            formatEnum(item.status),
          ])}
          headers={["Appointment", "Patient", "Department", "Time", "Status"]}
        />
      ) : null}
      {activeTab === "Queue History" ? (
        <RecordsTable
          rows={patient.queueHistory.map((item) => [
            item.queueNo,
            item.patientName,
            item.departmentName,
            formatDate(item.arrivedAt),
            formatEnum(item.status),
          ])}
          headers={["Queue", "Patient", "Department", "Arrived", "Status"]}
        />
      ) : null}
      {activeTab === "Visit History" ? (
        <RecordsTable
          rows={visits.map((item) => [
            item.encounterNo,
            formatEnum(item.visitType),
            item.departmentName,
            item.clinicianName ?? "No clinician",
            formatDate(item.startedAt),
          ])}
          headers={["Encounter", "Type", "Department", "Clinician", "Started"]}
        />
      ) : null}
      {activeTab === "Documents" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="khms-card p-4">
            <h2 className="font-heading text-xl font-semibold">
              Upload Document
            </h2>
            <div className="mt-4 grid gap-3">
              <SelectField
                label="Type"
                value={docForm.type}
                onChange={(type) =>
                  setDocForm({ ...docForm, type: type as never })
                }
                options={(lookups?.documentTypes ?? []).map((item) => ({
                  label: formatEnum(item),
                  value: item,
                }))}
              />
              <Field label="Title">
                <Input
                  value={docForm.title}
                  onChange={(event) =>
                    setDocForm({ ...docForm, title: event.target.value })
                  }
                />
              </Field>
              <Field label="File URL">
                <Input
                  value={docForm.fileUrl}
                  onChange={(event) =>
                    setDocForm({ ...docForm, fileUrl: event.target.value })
                  }
                />
              </Field>
              <Field label="File Name">
                <Input
                  value={docForm.fileName ?? ""}
                  onChange={(event) =>
                    setDocForm({ ...docForm, fileName: event.target.value })
                  }
                />
              </Field>
              <Button onClick={uploadDocument}>Save Document</Button>
            </div>
          </div>
          <RecordsTable
            rows={documents.map((item) => [
              item.title,
              formatEnum(item.type),
              item.fileName ?? "No file name",
              formatDate(item.createdAt),
              item.uploadedByName ?? "Unknown",
            ])}
            headers={["Title", "Type", "File", "Uploaded", "By"]}
          />
        </section>
      ) : null}
      {activeTab === "Timeline" ? (
        <div className="khms-card p-5">
          <div className="grid gap-3">
            {timeline.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="rounded border border-border-subtle p-4"
              >
                <div className="flex justify-between gap-3">
                  <p className="font-semibold">{item.title}</p>
                  <StatusBadge
                    value={item.status ? formatEnum(item.status) : item.type}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {item.type} / {formatDate(item.occurredAt)}
                </p>
                <p className="mt-2 text-sm">
                  {item.description ?? "No details"}
                </p>
              </div>
            ))}
            {!timeline.length ? (
              <EmptyState label="No timeline events." />
            ) : null}
          </div>
        </div>
      ) : null}
      {activeTab === "Print / Export" ? (
        <section className="khms-card p-5">
          <h2 className="font-heading text-xl font-semibold">
            Print / Export Summary
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Biodata, emergency contact, appointment summary, visit summary, and
            document list only.
          </p>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => printSummary("PRINT")}>
              <MaterialSymbol icon="print" /> Print Summary
            </Button>
            <Button variant="outline" onClick={() => printSummary("EXPORT")}>
              <MaterialSymbol icon="download" /> Export Summary
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function RecordsTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="khms-card overflow-hidden">
      <ResponsiveTable minWidth="760px">
        <thead className="bg-accent-blue text-left">
          <tr>
            {headers.map((header) => (
              <th key={header} className="khms-label px-4 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-border-subtle">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${index}-${cellIndex}`}
                  className="khms-table-data px-4 py-3"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={headers.length}>
                <EmptyState label="No records found." />
              </td>
            </tr>
          ) : null}
        </tbody>
      </ResponsiveTable>
    </div>
  )
}

export function RecordsOfficerAppointmentsPage() {
  const [form, setForm] = useState(blankAppointment)
  const [editing, setEditing] =
    useState<RecordsOfficerAppointmentListItem | null>(null)
  const { data: lookups } = useRecordsOfficerLookups()
  const {
    data: appointments = [],
    isLoading,
    isError,
  } = useRecordsOfficerAppointments()
  const createAppointment = useCreateRecordsOfficerAppointment()
  const updateAppointment = useUpdateRecordsOfficerAppointment()

  async function save(status?: RecordsOfficerAppointmentListItem["status"]) {
    try {
      const payload = {
        ...form,
        scheduledAt: fromDateTimeLocal(form.scheduledAt) ?? "",
        status: status ?? "SCHEDULED",
      }
      if (editing) {
        await updateAppointment.mutateAsync({ id: editing.id, payload })
        toast.success("Appointment updated")
      } else {
        await createAppointment.mutateAsync(payload)
        toast.success("Appointment booked")
      }
      setEditing(null)
      setForm(blankAppointment)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Appointment save failed"
      )
    }
  }

  if (isError)
    return <DashboardError message="Appointments could not be loaded." />
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Appointments"
        title="Appointment Desk"
        description="Book, reschedule, cancel, mark missed, and check in patients."
      />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="khms-card overflow-hidden">
          {isLoading ? (
            <LoadingPanel />
          ) : (
            <ResponsiveTable minWidth="920px">
              <thead className="bg-accent-blue text-left">
                <tr>
                  {[
                    "Appointment",
                    "Patient",
                    "Department",
                    "Clinician",
                    "Time",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th key={h} className="khms-label px-4 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appointments.map((item) => (
                  <tr key={item.id} className="border-t border-border-subtle">
                    <td className="khms-table-data px-4 py-3 font-semibold">
                      {item.appointmentNo}
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {item.patientName}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {item.patientNo}
                      </span>
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {item.departmentName ?? "No department"}
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {item.clinicianName ?? "Unassigned"}
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {formatDate(item.scheduledAt)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={formatEnum(item.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(item)
                          setForm({
                            patientId: item.patientId,
                            departmentId: item.departmentId ?? "",
                            clinicianId: item.clinicianId ?? "",
                            scheduledAt: toDateTimeLocal(item.scheduledAt),
                            durationMinutes: item.durationMinutes,
                            title: item.title ?? "",
                            reason: item.reason ?? "",
                            notes: item.notes ?? "",
                          })
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          )}
        </div>
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">
            {editing ? "Update Appointment" : "Book Appointment"}
          </h2>
          <div className="mt-4 grid gap-3">
            <PatientPicker
              selectedId={form.patientId}
              onSelect={(patient) =>
                setForm({ ...form, patientId: patient.id })
              }
            />
            <SelectField
              label="Department"
              value={form.departmentId}
              onChange={(departmentId) => setForm({ ...form, departmentId })}
              includeBlank="Select department"
              options={(lookups?.departments ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
            <SelectField
              label="Clinician"
              value={form.clinicianId ?? ""}
              onChange={(clinicianId) => setForm({ ...form, clinicianId })}
              includeBlank="Unassigned"
              options={(lookups?.clinicians ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
            <Field label="Scheduled At">
              <Input
                type="datetime-local"
                value={form.scheduledAt}
                onChange={(event) =>
                  setForm({ ...form, scheduledAt: event.target.value })
                }
              />
            </Field>
            <Field label="Reason">
              <Input
                value={form.reason ?? ""}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save()}>Save</Button>
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => save("CHECKED_IN")}>
                    Check In
                  </Button>
                  <Button variant="outline" onClick={() => save("MISSED")}>
                    Missed
                  </Button>
                  <Button variant="outline" onClick={() => save("CANCELLED")}>
                    Cancel
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function RecordsOfficerQueuePage() {
  const [form, setForm] = useState(blankQueue)
  const [editing, setEditing] = useState<RecordsOfficerQueueListItem | null>(
    null
  )
  const { data: lookups } = useRecordsOfficerLookups()
  const { data: queue = [], isError } = useRecordsOfficerQueue()
  const createQueue = useCreateRecordsOfficerQueue()
  const updateQueue = useUpdateRecordsOfficerQueue()
  const active = queue.filter(
    (item) => !["COMPLETED", "CANCELLED"].includes(item.status)
  )

  async function save(status?: "WAITING" | "IN_TRIAGE" | "CANCELLED") {
    try {
      if (editing) {
        await updateQueue.mutateAsync({
          id: editing.id,
          payload: {
            priority: form.priority,
            status: status ?? "WAITING",
            notes: form.notes,
          },
        })
        toast.success("Queue item updated")
      } else {
        await createQueue.mutateAsync(form)
        toast.success("Patient added to queue")
      }
      setEditing(null)
      setForm(blankQueue)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Queue save failed")
    }
  }

  if (isError) return <DashboardError message="Queue could not be loaded." />
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Queue"
        title="Queue Monitor"
        description="Add walk-ins, update waiting priority, and cancel before clinical service starts."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border border-emerald-200 bg-emerald-50 p-5 md:col-span-2">
          <p className="khms-label">Active Queue</p>
          <p className="font-heading text-5xl font-bold text-primary">
            {active.length}
          </p>
          <p className="text-sm text-muted-foreground">
            patients waiting or in triage
          </p>
        </div>
        <div className="rounded border border-border-subtle bg-white p-5">
          <p className="khms-label">Next Patient</p>
          <p className="mt-2 font-heading text-2xl font-bold">
            {active[0]?.queueNo ?? "None"}
          </p>
          <p className="text-sm text-muted-foreground">
            {active[0]?.patientName ?? "No waiting patient"}
          </p>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <RecordsTable
          headers={["Queue", "Patient", "Department", "Priority", "Status"]}
          rows={queue.map((item) => [
            item.queueNo,
            `${item.patientName} / ${item.patientNo}`,
            item.departmentName,
            formatEnum(item.priority),
            formatEnum(item.status),
          ])}
        />
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">
            {editing ? "Update Queue Item" : "Add Walk-In"}
          </h2>
          <div className="mt-4 grid gap-3">
            <PatientPicker
              selectedId={form.patientId}
              onSelect={(patient) =>
                setForm({ ...form, patientId: patient.id })
              }
            />
            <SelectField
              label="Department"
              value={form.departmentId}
              onChange={(departmentId) => setForm({ ...form, departmentId })}
              includeBlank="Select department"
              options={(lookups?.departments ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(priority) =>
                setForm({ ...form, priority: priority as never })
              }
              options={(lookups?.triagePriorities ?? []).map((item) => ({
                label: formatEnum(item),
                value: item,
              }))}
            />
            <Field label="Reason">
              <Input
                value={form.reason ?? ""}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => save()}>Save</Button>
              {editing ? (
                <Button variant="outline" onClick={() => save("CANCELLED")}>
                  Cancel Queue
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export function RecordsOfficerCheckInPage() {
  const [form, setForm] = useState(blankQueue)
  const [result, setResult] = useState<RecordsOfficerQueueListItem | null>(null)
  const { data: lookups } = useRecordsOfficerLookups()
  const checkIn = useRecordsOfficerCheckIn()
  async function save() {
    try {
      const queue = await checkIn.mutateAsync(form)
      setResult(queue)
      toast.success(`Queue number generated: ${queue.queueNo}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Check-in failed")
    }
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Check-In"
        title="Patient Check-In"
        description="Confirm arrival, update appointment status, and generate a queue number."
      />
      <section className="khms-card mx-auto max-w-3xl p-6">
        {result ? (
          <div className="text-center">
            <MaterialSymbol
              icon="task_alt"
              className="text-[56px] text-primary"
            />
            <h2 className="mt-3 font-heading text-2xl font-bold">
              Check-In Successful
            </h2>
            <p className="khms-label mt-3">Queue Number</p>
            <p className="font-heading text-6xl font-bold text-primary">
              {result.queueNo}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {result.patientName} / {result.departmentName} /{" "}
              {formatEnum(result.priority)}
            </p>
            <Button
              className="mt-6"
              onClick={() => {
                setResult(null)
                setForm(blankQueue)
              }}
            >
              Start New Check-In
            </Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <PatientPicker
              selectedId={form.patientId}
              onSelect={(patient) =>
                setForm({ ...form, patientId: patient.id })
              }
            />
            <Field label="Appointment ID (optional)">
              <Input
                value={form.appointmentId ?? ""}
                onChange={(event) =>
                  setForm({ ...form, appointmentId: event.target.value })
                }
              />
            </Field>
            <SelectField
              label="Department"
              value={form.departmentId}
              onChange={(departmentId) => setForm({ ...form, departmentId })}
              includeBlank="Select department"
              options={(lookups?.departments ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(priority) =>
                setForm({ ...form, priority: priority as never })
              }
              options={(lookups?.triagePriorities ?? []).map((item) => ({
                label: formatEnum(item),
                value: item,
              }))}
            />
            <Field label="Reason / Notes">
              <Input
                value={form.reason ?? ""}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            </Field>
            <Button onClick={save} disabled={checkIn.isPending}>
              <MaterialSymbol icon="how_to_reg" /> Generate Queue Number
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

export function RecordsOfficerDuplicatesPage() {
  const [search, setSearch] = useState("")
  const { data: duplicates = [], isLoading } =
    useRecordsOfficerDuplicates(search)
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Patients"
        title="Duplicate Detection"
        description="Review possible duplicate records. No automatic merge is performed in this batch."
      />
      <Input
        className="max-w-md"
        placeholder="Search duplicates by name, phone, NHIS, or ID"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {isLoading ? (
        <LoadingPanel />
      ) : (
        <div className="grid gap-4">
          {duplicates.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 rounded border border-orange-200 bg-orange-50 p-4 md:grid-cols-[1fr_1fr_auto]"
            >
              <PatientCard patient={item.patient} />
              <PatientCard patient={item.match} />
              <div>
                <p className="font-heading text-2xl font-bold text-orange-700">
                  {item.score}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.matchingFields.join(", ")}
                </p>
              </div>
            </div>
          ))}
          {!duplicates.length ? (
            <EmptyState label="No duplicate warnings found." />
          ) : null}
        </div>
      )}
    </div>
  )
}

export function RecordsOfficerDocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Documents"
        title="Patient Documents"
        description="Open a patient profile and use the Documents tab to upload or update document metadata."
      />
      <Button asChild>
        <Link href="/records-officer/patients">
          <MaterialSymbol icon="patient_list" /> Find Patient
        </Link>
      </Button>
    </div>
  )
}

export function RecordsOfficerVisitHistoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Visit History"
        title="Visit History"
        description="Visit history is available from each patient profile as a read-only tab."
      />
      <Button asChild>
        <Link href="/records-officer/patients">
          <MaterialSymbol icon="search" /> Search Patient
        </Link>
      </Button>
    </div>
  )
}

export function RecordsOfficerPrintExportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Records Office / Print Export"
        title="Print / Export Patient Summary"
        description="Open a patient profile to print or export biodata, visit summary, and document list."
      />
      <Button asChild>
        <Link href="/records-officer/patients">
          <MaterialSymbol icon="patient_list" /> Select Patient
        </Link>
      </Button>
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { toast } from "sonner"

import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import {
  DashboardError,
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
  useCreateHospitalAdminAppointment,
  useCreateHospitalAdminDepartment,
  useCreateHospitalAdminNotification,
  useCreateHospitalAdminQueueItem,
  useCreateHospitalAdminReportExport,
  useCreateHospitalAdminStaff,
  useHospitalAdminAppointments,
  useHospitalAdminAuditLogs,
  useHospitalAdminDepartments,
  useHospitalAdminLookups,
  useHospitalAdminNotifications,
  useHospitalAdminOversight,
  useHospitalAdminPatientLookup,
  useHospitalAdminQueue,
  useHospitalAdminReportExports,
  useHospitalAdminSettings,
  useHospitalAdminStaff,
  useUpdateHospitalAdminAppointment,
  useUpdateHospitalAdminDepartment,
  useUpdateHospitalAdminNotification,
  useUpdateHospitalAdminQueueItem,
  useUpdateHospitalAdminSettings,
  useUpdateHospitalAdminStaff,
} from "@/services/hospital-admin/crud"
import type {
  HospitalAdminAppointmentCreatePayload,
  HospitalAdminAppointmentFilters,
  HospitalAdminAppointmentListItem,
  HospitalAdminDepartmentCreatePayload,
  HospitalAdminDepartmentListItem,
  HospitalAdminNotificationCreatePayload,
  HospitalAdminNotificationListItem,
  HospitalAdminPatientLookupItem,
  HospitalAdminQueueCreatePayload,
  HospitalAdminQueueFilters,
  HospitalAdminQueueItem,
  HospitalAdminReportExportCreatePayload,
  HospitalAdminSettingsPayload,
  HospitalAdminStaffCreatePayload,
  HospitalAdminStaffFilters,
  HospitalAdminStaffListItem,
} from "@/types/hospital-admin"

const blankStaff: HospitalAdminStaffCreatePayload = {
  firstName: "",
  lastName: "",
  otherNames: "",
  email: "",
  phone: "",
  jobTitle: "",
  role: "NURSE",
  departmentId: "",
  status: "ACTIVE",
  temporaryPassword: "ChangeMe123!",
}

const blankDepartment: HospitalAdminDepartmentCreatePayload = {
  code: "",
  name: "",
  description: "",
  type: "OTHER",
  isActive: true,
}

const blankAppointment: HospitalAdminAppointmentCreatePayload = {
  patientId: "",
  departmentId: "",
  clinicianId: "",
  scheduledAt: "",
  durationMinutes: 30,
  title: "",
  reason: "",
  notes: "",
  status: "SCHEDULED",
}

const blankQueue: HospitalAdminQueueCreatePayload = {
  patientId: "",
  appointmentId: "",
  departmentId: "",
  assignedToId: "",
  priority: "ROUTINE",
  reason: "",
  notes: "",
}

const blankReport: HospitalAdminReportExportCreatePayload = {
  type: "HMIS",
  title: "",
  status: "REQUESTED",
  rowCount: 0,
  parameters: {},
}

const blankNotification: HospitalAdminNotificationCreatePayload = {
  title: "",
  message: "",
  type: "SYSTEM",
  priority: "NORMAL",
  targetRole: null,
  targetDepartmentId: "",
  recipientUserId: "",
}

function LoadingPanel() {
  return <div className="khms-card h-80 animate-pulse bg-muted" />
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-6 text-center text-sm text-muted-foreground">{label}</div>
  )
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

function formatDate(value: string | null) {
  if (!value) return "Not set"
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function toDateTimeLocal(value: string) {
  if (!value) return ""
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function fromDateTimeLocal(value: string) {
  return value ? new Date(value).toISOString() : ""
}

function relativeTime(value: string | null) {
  if (!value) return "Not started"
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(value).getTime()) / 60000)
  )
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min ago`
}

function statusTone(value: string) {
  if (["CANCELLED", "MISSED", "EMERGENCY", "URGENT", "HIGH"].includes(value)) {
    return "border-red-200 bg-red-50 text-red-700"
  }
  if (
    ["CHECKED_IN", "WITH_CLINICIAN", "COMPLETED", "ACTIVE", "NORMAL"].includes(
      value
    )
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700"
  }
  if (["SCHEDULED", "WAITING", "PRIORITY", "LOW"].includes(value)) {
    return "border-orange-200 bg-orange-50 text-orange-700"
  }
  return "border-blue-200 bg-blue-50 text-blue-700"
}

function SoftBadge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(
        value
      )}`}
    >
      {formatEnum(value)}
    </span>
  )
}

function DesignBreadcrumb({
  items,
  title,
  description,
  actions,
}: {
  items: string[]
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="rounded border border-border-subtle bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {items.map((item, index) => (
              <span
                key={`${item}-${index}`}
                className="flex items-center gap-1"
              >
                <span>{item}</span>
                {index < items.length - 1 ? (
                  <MaterialSymbol icon="chevron_right" className="text-base" />
                ) : null}
              </span>
            ))}
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

function PatientIdentityCard({
  patient,
  fallback,
}: {
  patient?: HospitalAdminPatientLookupItem | null
  fallback?: { patientId: string; patientName: string; patientNo: string }
}) {
  if (!patient && !fallback) {
    return (
      <div className="rounded border border-dashed border-border-subtle bg-muted/40 p-4 text-sm text-muted-foreground">
        Search and select a facility patient to continue.
      </div>
    )
  }

  const display = patient
    ? {
        name: patient.name,
        patientNo: patient.patientNo,
        details: [
          patient.gender ? formatEnum(patient.gender) : null,
          patient.age ? `${patient.age} yrs` : null,
          patient.phone,
          patient.nhisNumber ? `NHIS ${patient.nhisNumber}` : null,
        ].filter(Boolean),
      }
    : {
        name: fallback!.patientName,
        patientNo: fallback!.patientNo,
        details: [fallback!.patientId],
      }

  return (
    <div className="rounded border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded bg-white text-primary shadow-sm">
          <MaterialSymbol icon="patient_list" className="text-[24px]" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{display.name}</p>
          <p className="text-xs font-semibold text-primary">
            {display.patientNo}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {display.details.join(" / ") || "No additional identity details"}
          </p>
        </div>
      </div>
    </div>
  )
}

function PatientSearchSelect({
  selectedId,
  selectedFallback,
  onSelect,
  disabled,
}: {
  selectedId: string
  selectedFallback?: {
    patientId: string
    patientName: string
    patientNo: string
  }
  onSelect: (patient: HospitalAdminPatientLookupItem) => void
  disabled?: boolean
}) {
  const [search, setSearch] = useState("")
  const { data: patients = [] } = useHospitalAdminPatientLookup(search)
  const selected = patients.find((patient) => patient.id === selectedId) ?? null

  return (
    <div className="space-y-3">
      <Field label="Patient Search">
        <Input
          placeholder="Search name, patient number, phone, or NHIS"
          value={search}
          disabled={disabled}
          onChange={(event) => setSearch(event.target.value)}
        />
      </Field>
      <PatientIdentityCard patient={selected} fallback={selectedFallback} />
      {!disabled && search ? (
        <div className="max-h-56 overflow-auto rounded border border-border-subtle bg-white">
          {patients.map((patient) => (
            <button
              key={patient.id}
              type="button"
              className="flex w-full items-center justify-between gap-3 border-b border-border-subtle px-3 py-2 text-left last:border-b-0 hover:bg-accent-blue"
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
            <div className="p-3 text-sm text-muted-foreground">
              No facility patients matched that search.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export function HospitalAdminStaffPage() {
  const [filters, setFilters] = useState<HospitalAdminStaffFilters>({
    search: "",
    status: "",
    role: "",
    departmentId: "",
  })
  const [editing, setEditing] = useState<HospitalAdminStaffListItem | null>(
    null
  )
  const [form, setForm] = useState<HospitalAdminStaffCreatePayload>(blankStaff)
  const { data: lookups } = useHospitalAdminLookups()
  const { data: departments = [] } = useHospitalAdminDepartments()
  const {
    data: staff = [],
    isLoading,
    isError,
  } = useHospitalAdminStaff(filters)
  const createStaff = useCreateHospitalAdminStaff()
  const updateStaff = useUpdateHospitalAdminStaff()

  function editStaff(item: HospitalAdminStaffListItem) {
    setEditing(item)
    setForm({
      firstName: item.firstName,
      lastName: item.lastName,
      otherNames: item.otherNames ?? "",
      email: item.email,
      phone: item.phone ?? "",
      jobTitle: item.jobTitle ?? "",
      role: item.role,
      departmentId: item.departmentId ?? "",
      status: item.status,
      temporaryPassword: "",
    })
  }

  async function saveStaff() {
    try {
      if (editing) {
        const { temporaryPassword, ...payload } = form
        await updateStaff.mutateAsync({
          id: editing.id,
          payload: temporaryPassword ? form : payload,
        })
        toast.success("Staff updated")
      } else {
        await createStaff.mutateAsync(form)
        toast.success("Staff created")
      }
      setEditing(null)
      setForm(blankStaff)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Staff save failed")
    }
  }

  if (isError) return <DashboardError message="Staff could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Staff"
        title="Staff Management"
        description="Create, update, deactivate, reactivate, and reset passwords for SDA Hospital Kwadaso staff."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setForm(blankStaff)
            }}
          >
            <MaterialSymbol icon="person_add" />
            New Staff
          </Button>
        }
      />
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Input
          placeholder="Search staff"
          value={filters.search}
          onChange={(event) =>
            setFilters({ ...filters, search: event.target.value })
          }
        />
        <select
          className="khms-input"
          value={filters.status}
          onChange={(event) =>
            setFilters({ ...filters, status: event.target.value as never })
          }
        >
          <option value="">All statuses</option>
          {lookups?.userStatuses.map((status) => (
            <option key={status} value={status}>
              {formatEnum(status)}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.role}
          onChange={(event) =>
            setFilters({ ...filters, role: event.target.value as never })
          }
        >
          <option value="">All roles</option>
          {lookups?.assignableStaffRoles.map((role) => (
            <option key={role} value={role}>
              {formatEnum(role)}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.departmentId}
          onChange={(event) =>
            setFilters({ ...filters, departmentId: event.target.value })
          }
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="khms-card overflow-hidden">
          {isLoading ? (
            <LoadingPanel />
          ) : (
            <ResponsiveTable minWidth="860px">
              <thead className="bg-accent-blue text-left">
                <tr>
                  <th className="khms-label px-4 py-3">Staff</th>
                  <th className="khms-label px-4 py-3">Role</th>
                  <th className="khms-label px-4 py-3">Department</th>
                  <th className="khms-label px-4 py-3">Status</th>
                  <th className="khms-label px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((item) => (
                  <tr key={item.id} className="border-t border-border-subtle">
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.staffId} / {item.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={formatEnum(item.role)} />
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {item.departmentName ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={formatEnum(item.status)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => editStaff(item)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {!staff.length ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState label="No staff found." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </ResponsiveTable>
          )}
        </div>
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">
            {editing ? "Edit Staff" : "Create Staff"}
          </h2>
          <div className="mt-4 grid gap-3">
            <Field label="Staff ID">
              <Input
                disabled
                value={editing?.staffId ?? "Assigned automatically when saved"}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <Field label="Email">
              <Input
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
              />
            </Field>
            <SelectField
              label="Department"
              value={form.departmentId}
              onChange={(departmentId) => setForm({ ...form, departmentId })}
              options={departments.map((department) => ({
                label: department.name,
                value: department.id,
              }))}
              includeBlank="Select department"
            />
            <SelectField
              label="Role"
              value={form.role}
              onChange={(role) => setForm({ ...form, role: role as never })}
              options={(lookups?.assignableStaffRoles ?? []).map((role) => ({
                label: formatEnum(role),
                value: role,
              }))}
            />
            <SelectField
              label="Status"
              value={form.status}
              onChange={(status) =>
                setForm({ ...form, status: status as never })
              }
              options={(lookups?.userStatuses ?? []).map((status) => ({
                label: formatEnum(status),
                value: status,
              }))}
            />
            <Field
              label={
                editing ? "Temporary Password Reset" : "Temporary Password"
              }
            >
              <Input
                value={form.temporaryPassword}
                onChange={(event) =>
                  setForm({ ...form, temporaryPassword: event.target.value })
                }
                placeholder={
                  editing ? "Leave blank to keep current password" : ""
                }
              />
            </Field>
            <Button
              onClick={saveStaff}
              disabled={createStaff.isPending || updateStaff.isPending}
            >
              <MaterialSymbol icon="save" />
              Save Staff
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export function HospitalAdminDepartmentsPage() {
  const [search, setSearch] = useState("")
  const [editing, setEditing] =
    useState<HospitalAdminDepartmentListItem | null>(null)
  const [form, setForm] =
    useState<HospitalAdminDepartmentCreatePayload>(blankDepartment)
  const { data: lookups } = useHospitalAdminLookups()
  const {
    data: departments = [],
    isLoading,
    isError,
  } = useHospitalAdminDepartments({ search })
  const createDepartment = useCreateHospitalAdminDepartment()
  const updateDepartment = useUpdateHospitalAdminDepartment()

  async function saveDepartment() {
    try {
      if (editing) {
        await updateDepartment.mutateAsync({ id: editing.id, payload: form })
        toast.success("Department updated")
      } else {
        await createDepartment.mutateAsync(form)
        toast.success("Department created")
      }
      setEditing(null)
      setForm(blankDepartment)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Department save failed"
      )
    }
  }

  if (isError)
    return <DashboardError message="Departments could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Departments"
        title="Department Management"
        description="Manage operational departments for SDA Hospital Kwadaso."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setForm(blankDepartment)
            }}
          >
            <MaterialSymbol icon="add" />
            New Department
          </Button>
        }
      />
      <Input
        className="max-w-md"
        placeholder="Search departments"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="khms-card overflow-hidden">
          {isLoading ? (
            <LoadingPanel />
          ) : (
            <ResponsiveTable minWidth="760px">
              <thead className="bg-accent-blue text-left">
                <tr>
                  <th className="khms-label px-4 py-3">Department</th>
                  <th className="khms-label px-4 py-3">Type</th>
                  <th className="khms-label px-4 py-3">Staff</th>
                  <th className="khms-label px-4 py-3">Status</th>
                  <th className="khms-label px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr
                    key={department.id}
                    className="border-t border-border-subtle"
                  >
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold">{department.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {department.code} /{" "}
                        {department.description ?? "No description"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={formatEnum(department.type)} />
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {department.staffCount}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        value={department.isActive ? "Active" : "Inactive"}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(department)
                          setForm({
                            code: department.code,
                            name: department.name,
                            description: department.description ?? "",
                            type: department.type,
                            isActive: department.isActive,
                          })
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {!departments.length ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState label="No departments found." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </ResponsiveTable>
          )}
        </div>
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">
            {editing ? "Edit Department" : "Create Department"}
          </h2>
          <div className="mt-4 grid gap-3">
            <Field label="Code">
              <Input
                value={form.code}
                onChange={(event) =>
                  setForm({ ...form, code: event.target.value })
                }
              />
            </Field>
            <Field label="Name">
              <Input
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </Field>
            <Field label="Description">
              <Input
                value={form.description ?? ""}
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </Field>
            <SelectField
              label="Type"
              value={form.type}
              onChange={(type) => setForm({ ...form, type: type as never })}
              options={(lookups?.departmentTypes ?? []).map((type) => ({
                label: formatEnum(type),
                value: type,
              }))}
            />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({ ...form, isActive: event.target.checked })
                }
              />
              Active
            </label>
            <Button
              onClick={saveDepartment}
              disabled={
                createDepartment.isPending || updateDepartment.isPending
              }
            >
              <MaterialSymbol icon="save" />
              Save Department
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export function HospitalAdminSettingsPage() {
  const { data, isLoading, isError } = useHospitalAdminSettings()
  const updateSettings = useUpdateHospitalAdminSettings()
  const [form, setForm] = useState<HospitalAdminSettingsPayload | null>(null)
  const currentSettings = form ?? data

  async function saveSettings() {
    if (!currentSettings) return
    try {
      await updateSettings.mutateAsync(currentSettings)
      toast.success("Settings saved")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Settings save failed"
      )
    }
  }

  if (isLoading || !currentSettings) return <LoadingPanel />
  if (isError) return <DashboardError message="Settings could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Settings"
        title="Hospital Settings"
        description="Update SDA Hospital Kwadaso profile and operational numbering defaults."
      />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">
            Facility Profile
          </h2>
          <div className="mt-4 grid gap-3">
            <Field label="Name">
              <Input
                value={currentSettings.facility.name}
                onChange={(event) =>
                  setForm({
                    ...currentSettings,
                    facility: {
                      ...currentSettings.facility,
                      name: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Phone">
              <Input
                value={currentSettings.facility.phone ?? ""}
                onChange={(event) =>
                  setForm({
                    ...currentSettings,
                    facility: {
                      ...currentSettings.facility,
                      phone: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Email">
              <Input
                value={currentSettings.facility.email ?? ""}
                onChange={(event) =>
                  setForm({
                    ...currentSettings,
                    facility: {
                      ...currentSettings.facility,
                      email: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Address">
              <Input
                value={currentSettings.facility.address ?? ""}
                onChange={(event) =>
                  setForm({
                    ...currentSettings,
                    facility: {
                      ...currentSettings.facility,
                      address: event.target.value,
                    },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Municipality">
                <Input
                  value={currentSettings.facility.municipality ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...currentSettings,
                      facility: {
                        ...currentSettings.facility,
                        municipality: event.target.value,
                      },
                    })
                  }
                />
              </Field>
              <Field label="Region">
                <Input
                  value={currentSettings.facility.region ?? ""}
                  onChange={(event) =>
                    setForm({
                      ...currentSettings,
                      facility: {
                        ...currentSettings.facility,
                        region: event.target.value,
                      },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        </div>
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">
            Operational Defaults
          </h2>
          <div className="mt-4 grid gap-3">
            <Field label="Patient Number Prefix">
              <Input
                value={currentSettings.system["patient.numberPrefix"]}
                onChange={(event) =>
                  setForm({
                    ...currentSettings,
                    system: {
                      ...currentSettings.system,
                      "patient.numberPrefix": event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Invoice Number Prefix">
              <Input
                value={currentSettings.system["invoice.numberPrefix"]}
                onChange={(event) =>
                  setForm({
                    ...currentSettings,
                    system: {
                      ...currentSettings.system,
                      "invoice.numberPrefix": event.target.value,
                    },
                  })
                }
              />
            </Field>
            <Field label="Default Appointment Slot">
              <Input
                type="number"
                value={currentSettings.system["appointment.defaultSlotMinutes"]}
                onChange={(event) =>
                  setForm({
                    ...currentSettings,
                    system: {
                      ...currentSettings.system,
                      "appointment.defaultSlotMinutes": Number(
                        event.target.value
                      ),
                    },
                  })
                }
              />
            </Field>
            <Button onClick={saveSettings} disabled={updateSettings.isPending}>
              <MaterialSymbol icon="save" />
              Save Settings
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export function HospitalAdminAppointmentsCrudPage() {
  const [filters, setFilters] = useState<HospitalAdminAppointmentFilters>({
    status: "",
    departmentId: "",
    clinicianId: "",
    patientSearch: "",
  })
  const [activeView, setActiveView] = useState<
    | "calendar"
    | "booking"
    | "details"
    | "analytics"
    | "missed"
    | "checkin"
    | "reschedule"
  >("calendar")
  const [editing, setEditing] =
    useState<HospitalAdminAppointmentListItem | null>(null)
  const [form, setForm] =
    useState<HospitalAdminAppointmentCreatePayload>(blankAppointment)
  const { data: lookups } = useHospitalAdminLookups()
  const { data: departments = [] } = useHospitalAdminDepartments()
  const { data: staff = [] } = useHospitalAdminStaff()
  const {
    data: appointments = [],
    isLoading,
    isError,
  } = useHospitalAdminAppointments(filters)
  const createAppointment = useCreateHospitalAdminAppointment()
  const updateAppointment = useUpdateHospitalAdminAppointment()
  const clinicians = staff.filter((item) =>
    ["DOCTOR", "PHYSICIAN_ASSISTANT", "NURSE"].includes(item.role)
  )
  const selectedAppointment = editing ?? appointments[0] ?? null
  const todayAppointments = appointments.filter(
    (item) =>
      new Date(item.scheduledAt).toDateString() === new Date().toDateString()
  )
  const missedAppointments = appointments.filter((item) =>
    ["MISSED", "CANCELLED"].includes(item.status)
  )
  const appointmentStats = useMemo(
    () => [
      {
        label: "Scheduled",
        value: appointments.filter((item) => item.status === "SCHEDULED")
          .length,
        icon: "event",
      },
      {
        label: "Checked In",
        value: appointments.filter((item) => item.status === "CHECKED_IN")
          .length,
        icon: "how_to_reg",
      },
      {
        label: "Completed",
        value: appointments.filter((item) => item.status === "COMPLETED")
          .length,
        icon: "task_alt",
      },
      {
        label: "Missed/Cancelled",
        value: missedAppointments.length,
        icon: "event_busy",
      },
    ],
    [appointments, missedAppointments.length]
  )

  function editAppointment(item: HospitalAdminAppointmentListItem) {
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
      status: item.status,
    })
    setActiveView("details")
  }

  async function saveAppointment(
    statusOverride?: HospitalAdminAppointmentCreatePayload["status"],
    cancellationReason?: string
  ) {
    try {
      const payload = {
        ...form,
        status: statusOverride ?? form.status,
        scheduledAt: fromDateTimeLocal(form.scheduledAt),
        ...(cancellationReason ? { cancellationReason } : {}),
      }
      if (editing) {
        await updateAppointment.mutateAsync({ id: editing.id, payload })
        toast.success("Appointment updated")
      } else {
        await createAppointment.mutateAsync(payload)
        toast.success("Appointment created")
      }
      setEditing(null)
      setForm(blankAppointment)
      setActiveView("calendar")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Appointment save failed"
      )
    }
  }

  const appointmentTabs = [
    { id: "calendar", label: "Calendar", icon: "calendar_month" },
    { id: "booking", label: "Book", icon: "event_available" },
    { id: "details", label: "Details", icon: "assignment" },
    { id: "analytics", label: "Analytics", icon: "monitoring" },
    { id: "missed", label: "Missed", icon: "event_busy" },
    { id: "checkin", label: "Check-in", icon: "how_to_reg" },
    { id: "reschedule", label: "Reschedule", icon: "edit_calendar" },
  ] as const

  if (isError)
    return <DashboardError message="Appointments could not be loaded." />

  return (
    <div className="space-y-6">
      <DesignBreadcrumb
        items={["Patient Care", "Appointments", formatEnum(activeView)]}
        title="Appointment Management"
        description="Calendar, booking, check-in, rescheduling, missed appointments, and operational appointment analytics."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => setActiveView("analytics")}
            >
              <MaterialSymbol icon="monitoring" />
              Analytics
            </Button>
            <Button
              onClick={() => {
                setEditing(null)
                setForm(blankAppointment)
                setActiveView("booking")
              }}
            >
              <MaterialSymbol icon="event_available" />
              New Appointment
            </Button>
          </>
        }
      />
      <section className="flex gap-2 overflow-x-auto rounded border border-border-subtle bg-white p-2 shadow-sm">
        {appointmentTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`inline-flex min-w-max items-center gap-2 rounded px-3 py-2 text-sm font-semibold transition ${
              activeView === tab.id
                ? "bg-primary text-white"
                : "text-muted-foreground hover:bg-accent-blue hover:text-foreground"
            }`}
            onClick={() => setActiveView(tab.id)}
          >
            <MaterialSymbol icon={tab.icon} className="text-[20px]" />
            {tab.label}
          </button>
        ))}
      </section>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Input
          placeholder="Patient search"
          value={filters.patientSearch}
          onChange={(event) =>
            setFilters({ ...filters, patientSearch: event.target.value })
          }
        />
        <select
          className="khms-input"
          value={filters.status}
          onChange={(event) =>
            setFilters({ ...filters, status: event.target.value as never })
          }
        >
          <option value="">All statuses</option>
          {lookups?.appointmentStatuses.map((status) => (
            <option key={status} value={status}>
              {formatEnum(status)}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.departmentId}
          onChange={(event) =>
            setFilters({ ...filters, departmentId: event.target.value })
          }
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.clinicianId}
          onChange={(event) =>
            setFilters({ ...filters, clinicianId: event.target.value })
          }
        >
          <option value="">All clinicians</option>
          {clinicians.map((clinician) => (
            <option key={clinician.id} value={clinician.id}>
              {clinician.name}
            </option>
          ))}
        </select>
      </section>
      {isLoading ? <LoadingPanel /> : null}
      {!isLoading && activeView === "calendar" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4 rounded border border-border-subtle bg-white p-4 shadow-sm">
            <div>
              <p className="khms-label">Today</p>
              <p className="font-heading text-3xl font-bold">
                {new Date().toLocaleDateString("en-US", { day: "2-digit" })}
              </p>
              <p className="text-sm text-muted-foreground">
                {new Date().toLocaleDateString("en-US", {
                  month: "long",
                  weekday: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="grid gap-2">
              {departments.slice(0, 6).map((department) => (
                <button
                  key={department.id}
                  type="button"
                  className="flex items-center justify-between rounded border border-border-subtle px-3 py-2 text-left text-sm hover:bg-accent-blue"
                  onClick={() =>
                    setFilters({ ...filters, departmentId: department.id })
                  }
                >
                  <span>{department.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {
                      appointments.filter(
                        (item) => item.departmentId === department.id
                      ).length
                    }
                  </span>
                </button>
              ))}
            </div>
          </aside>
          <div className="rounded border border-border-subtle bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-heading text-xl font-bold">
                  Appointment Calendar
                </h2>
                <p className="text-sm text-muted-foreground">
                  {todayAppointments.length} appointments scheduled for today
                </p>
              </div>
              <div className="rounded border border-border-subtle p-1">
                {["Day", "Week", "Month"].map((label) => (
                  <span
                    key={label}
                    className={`inline-block rounded px-3 py-1 text-xs font-semibold ${
                      label === "Week" ? "bg-primary text-white" : ""
                    }`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {appointments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="rounded border border-border-subtle bg-white p-4 text-left shadow-sm transition hover:border-primary"
                  onClick={() => editAppointment(item)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {formatDate(item.scheduledAt)}
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {item.patientName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.patientNo} /{" "}
                        {item.departmentName ?? "No department"}
                      </p>
                    </div>
                    <SoftBadge value={item.status} />
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {item.reason ?? item.title ?? "Routine appointment"}
                  </p>
                </button>
              ))}
              {!appointments.length ? (
                <div className="md:col-span-2 xl:col-span-3">
                  <EmptyState label="No appointments found." />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
      {!isLoading && activeView === "booking" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="rounded border border-border-subtle bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="khms-label">Drafting New Appointment</p>
                <h2 className="font-heading text-2xl font-bold">
                  Book Appointment
                </h2>
              </div>
              <SoftBadge value="SCHEDULED" />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded border border-border-subtle p-4">
                <p className="mb-3 font-semibold">Patient Identification</p>
                <PatientSearchSelect
                  selectedId={form.patientId}
                  onSelect={(patient) =>
                    setForm({ ...form, patientId: patient.id })
                  }
                />
              </div>
              <div className="rounded border border-border-subtle p-4">
                <p className="mb-3 font-semibold">Clinical Context</p>
                <div className="grid gap-3">
                  <SelectField
                    label="Department"
                    value={form.departmentId}
                    onChange={(departmentId) =>
                      setForm({ ...form, departmentId })
                    }
                    options={departments.map((department) => ({
                      label: department.name,
                      value: department.id,
                    }))}
                    includeBlank="Select department"
                  />
                  <SelectField
                    label="Clinician"
                    value={form.clinicianId ?? ""}
                    onChange={(clinicianId) =>
                      setForm({ ...form, clinicianId })
                    }
                    options={clinicians.map((clinician) => ({
                      label: clinician.name,
                      value: clinician.id,
                    }))}
                    includeBlank="No clinician"
                  />
                  <Field label="Visit Reason">
                    <Input
                      value={form.reason ?? ""}
                      onChange={(event) =>
                        setForm({ ...form, reason: event.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
              <div className="rounded border border-border-subtle p-4 lg:col-span-2">
                <p className="mb-3 font-semibold">Date & Time Allocation</p>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Scheduled At">
                    <Input
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(event) =>
                        setForm({ ...form, scheduledAt: event.target.value })
                      }
                    />
                  </Field>
                  <Field label="Duration">
                    <Input
                      type="number"
                      value={form.durationMinutes}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          durationMinutes: Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                  <Field label="Title">
                    <Input
                      value={form.title ?? ""}
                      onChange={(event) =>
                        setForm({ ...form, title: event.target.value })
                      }
                    />
                  </Field>
                </div>
              </div>
            </div>
          </div>
          <aside className="rounded border border-border-subtle bg-white p-5 shadow-sm">
            <p className="khms-label">Confirmation Summary</p>
            <h3 className="mt-1 font-heading text-xl font-bold">
              Ready to Schedule
            </h3>
            <div className="mt-4 space-y-3 text-sm">
              <p>
                <span className="font-semibold">Department:</span>{" "}
                {departments.find((item) => item.id === form.departmentId)
                  ?.name ?? "Not selected"}
              </p>
              <p>
                <span className="font-semibold">Clinician:</span>{" "}
                {clinicians.find((item) => item.id === form.clinicianId)
                  ?.name ?? "Unassigned"}
              </p>
              <p>
                <span className="font-semibold">Time:</span>{" "}
                {form.scheduledAt || "Not selected"}
              </p>
            </div>
            <Button
              className="mt-5 w-full"
              onClick={() => saveAppointment()}
              disabled={createAppointment.isPending}
            >
              <MaterialSymbol icon="event_available" />
              Book Appointment
            </Button>
          </aside>
        </section>
      ) : null}
      {!isLoading && activeView === "details" ? (
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded border border-border-subtle bg-white p-5 shadow-sm">
            {selectedAppointment ? (
              <>
                <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="khms-label">
                      {selectedAppointment.appointmentNo}
                    </p>
                    <h2 className="font-heading text-2xl font-bold">
                      Appointment Details
                    </h2>
                  </div>
                  <SoftBadge value={selectedAppointment.status} />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <PatientIdentityCard
                    fallback={{
                      patientId: selectedAppointment.patientId,
                      patientName: selectedAppointment.patientName,
                      patientNo: selectedAppointment.patientNo,
                    }}
                  />
                  <div className="rounded border border-border-subtle p-4">
                    <p className="khms-label">Visit Information</p>
                    <p className="mt-2 text-sm">
                      {selectedAppointment.departmentName ?? "No department"} /{" "}
                      {selectedAppointment.clinicianName ?? "No clinician"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(selectedAppointment.scheduledAt)} for{" "}
                      {selectedAppointment.durationMinutes} minutes
                    </p>
                  </div>
                  <div className="rounded border border-border-subtle p-4">
                    <p className="khms-label">Status Timeline</p>
                    <div className="mt-3 grid gap-2 text-sm">
                      <p>
                        Scheduled: {formatDate(selectedAppointment.scheduledAt)}
                      </p>
                      <p>
                        Checked in:{" "}
                        {formatDate(selectedAppointment.checkedInAt)}
                      </p>
                      <p>
                        Cancelled: {formatDate(selectedAppointment.cancelledAt)}
                      </p>
                    </div>
                  </div>
                  <div className="rounded border border-border-subtle p-4">
                    <p className="khms-label">Notes & Instructions</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {selectedAppointment.notes ??
                        selectedAppointment.reason ??
                        "No notes recorded for this appointment."}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState label="Select an appointment to view details." />
            )}
          </div>
          <aside className="rounded border border-border-subtle bg-white p-5 shadow-sm">
            <h3 className="font-heading text-xl font-bold">Actions</h3>
            <div className="mt-4 grid gap-2">
              {selectedAppointment ? (
                <>
                  <Button
                    onClick={() => {
                      editAppointment(selectedAppointment)
                      setActiveView("checkin")
                    }}
                  >
                    <MaterialSymbol icon="how_to_reg" />
                    Check In Patient
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      editAppointment(selectedAppointment)
                      setActiveView("reschedule")
                    }}
                  >
                    <MaterialSymbol icon="edit_calendar" />
                    Reschedule
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      saveAppointment(
                        "CANCELLED",
                        "Cancelled by hospital administrator"
                      )
                    }
                  >
                    <MaterialSymbol icon="event_busy" />
                    Cancel Appointment
                  </Button>
                </>
              ) : null}
            </div>
          </aside>
        </section>
      ) : null}
      {!isLoading && activeView === "analytics" ? (
        <section className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {appointmentStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded border border-border-subtle bg-white p-4 shadow-sm"
              >
                <MaterialSymbol
                  icon={stat.icon}
                  className="text-[28px] text-primary"
                />
                <p className="khms-label mt-3">{stat.label}</p>
                <p className="font-heading text-3xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="rounded border border-border-subtle bg-white p-5 shadow-sm">
            <h2 className="font-heading text-xl font-bold">Department Load</h2>
            <div className="mt-4 grid gap-3">
              {departments.map((department) => {
                const count = appointments.filter(
                  (item) => item.departmentId === department.id
                ).length
                return (
                  <div key={department.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{department.name}</span>
                      <span>{count}</span>
                    </div>
                    <div className="h-2 rounded bg-muted">
                      <div
                        className="h-2 rounded bg-primary"
                        style={{
                          width: `${Math.min(
                            100,
                            (count / Math.max(appointments.length, 1)) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}
      {!isLoading && activeView === "missed" ? (
        <section className="rounded border border-border-subtle bg-white p-5 shadow-sm">
          <h2 className="font-heading text-xl font-bold">
            Missed & Cancelled Appointments
          </h2>
          <div className="mt-4 grid gap-3">
            {missedAppointments.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded border border-red-100 bg-red-50 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-semibold">{item.patientName}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.appointmentNo} / {formatDate(item.scheduledAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <SoftBadge value={item.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => editAppointment(item)}
                  >
                    Review
                  </Button>
                </div>
              </div>
            ))}
            {!missedAppointments.length ? (
              <EmptyState label="No missed or cancelled appointments." />
            ) : null}
          </div>
        </section>
      ) : null}
      {!isLoading && ["checkin", "reschedule"].includes(activeView) ? (
        <section className="mx-auto max-w-3xl rounded border border-border-subtle bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded bg-medical-green-soft text-primary">
              <MaterialSymbol
                icon={activeView === "checkin" ? "how_to_reg" : "edit_calendar"}
                className="text-[30px]"
              />
            </div>
            <h2 className="mt-4 font-heading text-2xl font-bold">
              {activeView === "checkin"
                ? "Patient Check-in"
                : "Reschedule Appointment"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {editing
                ? `${editing.patientName} / ${editing.patientNo}`
                : "Select an appointment first."}
            </p>
          </div>
          {editing ? (
            <div className="mt-6 grid gap-4">
              <PatientIdentityCard
                fallback={{
                  patientId: editing.patientId,
                  patientName: editing.patientName,
                  patientNo: editing.patientNo,
                }}
              />
              {activeView === "reschedule" ? (
                <Field label="New Scheduled Time">
                  <Input
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(event) =>
                      setForm({ ...form, scheduledAt: event.target.value })
                    }
                  />
                </Field>
              ) : null}
              <Button
                onClick={() =>
                  activeView === "checkin"
                    ? saveAppointment("CHECKED_IN")
                    : saveAppointment("RESCHEDULED")
                }
                disabled={updateAppointment.isPending}
              >
                <MaterialSymbol icon="task_alt" />
                {activeView === "checkin"
                  ? "Generate Queue Number"
                  : "Save Reschedule"}
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

export function HospitalAdminQueuePage() {
  const [filters, setFilters] = useState<HospitalAdminQueueFilters>({
    departmentId: "",
    status: "",
    priority: "",
  })
  const [editing, setEditing] = useState<HospitalAdminQueueItem | null>(null)
  const [form, setForm] = useState<HospitalAdminQueueCreatePayload>(blankQueue)
  const { data: lookups } = useHospitalAdminLookups()
  const { data: departments = [] } = useHospitalAdminDepartments()
  const { data: staff = [] } = useHospitalAdminStaff()
  const {
    data: queue = [],
    isLoading,
    isError,
  } = useHospitalAdminQueue(filters)
  const createQueue = useCreateHospitalAdminQueueItem()
  const updateQueue = useUpdateHospitalAdminQueueItem()
  const activeQueue = queue.filter(
    (item) => !["COMPLETED", "CANCELLED"].includes(item.status)
  )
  const nowCalling =
    queue.find((item) => item.status === "WITH_CLINICIAN") ?? activeQueue[0]
  const upNext = activeQueue
    .filter((item) => item.id !== nowCalling?.id)
    .slice(0, 4)

  async function saveQueue(statusOverride?: HospitalAdminQueueItem["status"]) {
    try {
      if (editing) {
        await updateQueue.mutateAsync({
          id: editing.id,
          payload: {
            assignedToId: form.assignedToId,
            status: statusOverride ?? editing.status,
            priority: form.priority,
            reason: form.reason,
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
      <DesignBreadcrumb
        items={["Patient Care", "Queue", "Display Board"]}
        title="Queue Management"
        description="Monitor active visits, call patients forward, update urgency, and close completed queue entries."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setForm(blankQueue)
            }}
          >
            <MaterialSymbol icon="queue" />
            Add Queue Item
          </Button>
        }
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded border border-emerald-200 bg-emerald-50 p-5 md:col-span-2">
          <p className="khms-label">Now Calling</p>
          {nowCalling ? (
            <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-heading text-5xl font-bold text-primary">
                  {nowCalling.queueNo}
                </p>
                <p className="mt-1 text-lg font-semibold">
                  {nowCalling.patientName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {nowCalling.patientNo} / {nowCalling.departmentName}
                </p>
              </div>
              <SoftBadge value={nowCalling.status} />
            </div>
          ) : (
            <EmptyState label="No active queue item to call." />
          )}
        </div>
        <div className="rounded border border-border-subtle bg-white p-5 shadow-sm">
          <p className="khms-label">Queue Load</p>
          <p className="mt-2 font-heading text-4xl font-bold">
            {activeQueue.length}
          </p>
          <p className="text-sm text-muted-foreground">active patients today</p>
          <p className="mt-4 text-sm text-muted-foreground">
            Next: {upNext[0]?.queueNo ?? "No waiting patient"}
          </p>
        </div>
      </section>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select
          className="khms-input"
          value={filters.departmentId}
          onChange={(event) =>
            setFilters({ ...filters, departmentId: event.target.value })
          }
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
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
          {lookups?.queueStatuses.map((status) => (
            <option key={status} value={status}>
              {formatEnum(status)}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.priority}
          onChange={(event) =>
            setFilters({ ...filters, priority: event.target.value as never })
          }
        >
          <option value="">All priorities</option>
          {lookups?.triagePriorities.map((priority) => (
            <option key={priority} value={priority}>
              {formatEnum(priority)}
            </option>
          ))}
        </select>
      </section>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {upNext.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rounded border border-border-subtle bg-white p-4 text-left shadow-sm hover:border-primary"
            onClick={() => {
              setEditing(item)
              setForm({
                patientId: item.patientId,
                appointmentId: item.appointmentId ?? "",
                departmentId: item.departmentId,
                assignedToId: item.assignedToId ?? "",
                priority: item.priority,
                reason: item.reason ?? "",
                notes: item.notes ?? "",
              })
            }}
          >
            <div className="flex items-center justify-between">
              <p className="font-heading text-2xl font-bold">{item.queueNo}</p>
              <SoftBadge value={item.priority} />
            </div>
            <p className="mt-2 text-sm font-semibold">{item.patientName}</p>
            <p className="text-xs text-muted-foreground">
              Waiting {relativeTime(item.arrivedAt)}
            </p>
          </button>
        ))}
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="khms-card overflow-hidden">
          {isLoading ? (
            <LoadingPanel />
          ) : (
            <ResponsiveTable minWidth="860px">
              <thead className="bg-accent-blue text-left">
                <tr>
                  <th className="khms-label px-4 py-3">Ticket</th>
                  <th className="khms-label px-4 py-3">Patient</th>
                  <th className="khms-label px-4 py-3">Department</th>
                  <th className="khms-label px-4 py-3">Priority</th>
                  <th className="khms-label px-4 py-3">Status</th>
                  <th className="khms-label px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <tr key={item.id} className="border-t border-border-subtle">
                    <td className="khms-table-data px-4 py-3 font-semibold">
                      {item.queueNo}
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      <p className="font-semibold">{item.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.patientNo}
                      </p>
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {item.departmentName}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={formatEnum(item.priority)} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={formatEnum(item.status)} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(item)
                          setForm({
                            patientId: item.patientId,
                            appointmentId: item.appointmentId ?? "",
                            departmentId: item.departmentId,
                            assignedToId: item.assignedToId ?? "",
                            priority: item.priority,
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
                {!queue.length ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState label="No queue items found." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </ResponsiveTable>
          )}
        </div>
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">
            {editing ? "Update Queue Item" : "Add Patient To Queue"}
          </h2>
          <div className="mt-4 grid gap-3">
            <PatientSearchSelect
              selectedId={form.patientId}
              disabled={Boolean(editing)}
              selectedFallback={
                editing
                  ? {
                      patientId: editing.patientId,
                      patientName: editing.patientName,
                      patientNo: editing.patientNo,
                    }
                  : undefined
              }
              onSelect={(patient) =>
                setForm({ ...form, patientId: patient.id })
              }
            />
            <Field label="Appointment ID">
              <Input
                value={form.appointmentId ?? ""}
                disabled={Boolean(editing)}
                onChange={(event) =>
                  setForm({ ...form, appointmentId: event.target.value })
                }
              />
            </Field>
            <SelectField
              label="Department"
              value={form.departmentId}
              onChange={(departmentId) => setForm({ ...form, departmentId })}
              options={departments.map((department) => ({
                label: department.name,
                value: department.id,
              }))}
              includeBlank="Select department"
            />
            <SelectField
              label="Assigned Staff"
              value={form.assignedToId ?? ""}
              onChange={(assignedToId) => setForm({ ...form, assignedToId })}
              options={staff.map((item) => ({
                label: item.name,
                value: item.id,
              }))}
              includeBlank="Unassigned"
            />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(priority) =>
                setForm({ ...form, priority: priority as never })
              }
              options={(lookups?.triagePriorities ?? []).map((priority) => ({
                label: formatEnum(priority),
                value: priority,
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
              <Button onClick={() => saveQueue()}>Save</Button>
              {editing ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => saveQueue("WITH_CLINICIAN")}
                  >
                    Call
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => saveQueue("COMPLETED")}
                  >
                    Complete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => saveQueue("CANCELLED")}
                  >
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

export function HospitalAdminReportsPage() {
  const [form, setForm] =
    useState<HospitalAdminReportExportCreatePayload>(blankReport)
  const { data: lookups } = useHospitalAdminLookups()
  const {
    data: reports = [],
    isLoading,
    isError,
  } = useHospitalAdminReportExports()
  const createReport = useCreateHospitalAdminReportExport()

  async function saveReport() {
    try {
      await createReport.mutateAsync(form)
      setForm(blankReport)
      toast.success("Report export metadata created")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Report export failed"
      )
    }
  }

  if (isError) return <DashboardError message="Reports could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Reports"
        title="Reports Export"
        description="Create metadata records for hospital reports. File generation is deferred."
      />
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">Create Export</h2>
          <div className="mt-4 grid gap-3">
            <SelectField
              label="Report Type"
              value={form.type}
              onChange={(type) => setForm({ ...form, type: type as never })}
              options={(lookups?.reportTypes ?? [])
                .filter((type) =>
                  [
                    "HMIS",
                    "MORBIDITY",
                    "IMMUNIZATION",
                    "FINANCIAL",
                    "APPOINTMENT",
                    "AUDIT",
                    "LABORATORY",
                    "PHARMACY",
                  ].includes(type)
                )
                .map((type) => ({ label: formatEnum(type), value: type }))}
            />
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </Field>
            <Field label="Date From">
              <Input
                type="datetime-local"
                onChange={(event) =>
                  setForm({
                    ...form,
                    dateFrom: fromDateTimeLocal(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="Date To">
              <Input
                type="datetime-local"
                onChange={(event) =>
                  setForm({
                    ...form,
                    dateTo: fromDateTimeLocal(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="Row Count">
              <Input
                type="number"
                value={form.rowCount ?? 0}
                onChange={(event) =>
                  setForm({ ...form, rowCount: Number(event.target.value) })
                }
              />
            </Field>
            <Button onClick={saveReport} disabled={createReport.isPending}>
              <MaterialSymbol icon="file_save" />
              Create Export
            </Button>
          </div>
        </div>
        <div className="khms-card overflow-hidden">
          {isLoading ? (
            <LoadingPanel />
          ) : (
            <ResponsiveTable minWidth="760px">
              <thead className="bg-accent-blue text-left">
                <tr>
                  <th className="khms-label px-4 py-3">Report</th>
                  <th className="khms-label px-4 py-3">Type</th>
                  <th className="khms-label px-4 py-3">Status</th>
                  <th className="khms-label px-4 py-3">Rows</th>
                  <th className="khms-label px-4 py-3">Generated</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-t border-border-subtle">
                    <td className="khms-table-data px-4 py-3 font-semibold">
                      {report.title}
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {formatEnum(report.type)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={report.status} />
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {report.rowCount ?? 0}
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {formatDate(report.generatedAt)}
                    </td>
                  </tr>
                ))}
                {!reports.length ? (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState label="No report exports yet." />
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </ResponsiveTable>
          )}
        </div>
      </section>
    </div>
  )
}

export function HospitalAdminNotificationsPage() {
  const [form, setForm] =
    useState<HospitalAdminNotificationCreatePayload>(blankNotification)
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    targetRole: "",
  })
  const [editing, setEditing] =
    useState<HospitalAdminNotificationListItem | null>(null)
  const { data: lookups } = useHospitalAdminLookups()
  const { data: departments = [] } = useHospitalAdminDepartments()
  const {
    data: notifications = [],
    isLoading,
    isError,
  } = useHospitalAdminNotifications(filters)
  const createNotification = useCreateHospitalAdminNotification()
  const updateNotification = useUpdateHospitalAdminNotification()
  const urgentCount = notifications.filter((item) =>
    ["HIGH", "URGENT"].includes(item.priority)
  ).length
  const unreadCount = notifications.filter(
    (item) => item.status === "UNREAD"
  ).length

  async function saveNotification() {
    try {
      if (editing) {
        await updateNotification.mutateAsync({ id: editing.id, payload: form })
        toast.success("Notification updated")
      } else {
        await createNotification.mutateAsync(form)
        toast.success("Notification created")
      }
      setEditing(null)
      setForm(blankNotification)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Notification save failed"
      )
    }
  }

  async function updateStatus(id: string, status: "READ" | "ARCHIVED") {
    try {
      await updateNotification.mutateAsync({ id, payload: { status } })
      toast.success("Notification updated")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Notification update failed"
      )
    }
  }

  if (isError)
    return <DashboardError message="Notifications could not be loaded." />

  return (
    <div className="space-y-6">
      <DesignBreadcrumb
        items={["Hospital Operations", "Notifications", "Message Center"]}
        title="Operational Notifications"
        description="Create facility-scoped notices for roles, departments, individual staff, and operational groups."
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setForm(blankNotification)
            }}
          >
            <MaterialSymbol icon="add_alert" />
            New Notice
          </Button>
        }
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            label: "Active Notices",
            value: notifications.filter((item) => item.status !== "ARCHIVED")
              .length,
            icon: "notifications_active",
          },
          { label: "Unread", value: unreadCount, icon: "mark_email_unread" },
          { label: "High Priority", value: urgentCount, icon: "priority_high" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded border border-border-subtle bg-white p-4 shadow-sm"
          >
            <MaterialSymbol
              icon={card.icon}
              className="text-[28px] text-primary"
            />
            <p className="khms-label mt-3">{card.label}</p>
            <p className="font-heading text-3xl font-bold">{card.value}</p>
          </div>
        ))}
      </section>
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <select
          className="khms-input"
          value={filters.status}
          onChange={(event) =>
            setFilters({ ...filters, status: event.target.value })
          }
        >
          <option value="">All statuses</option>
          {lookups?.notificationStatuses.map((status) => (
            <option key={status} value={status}>
              {formatEnum(status)}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.priority}
          onChange={(event) =>
            setFilters({ ...filters, priority: event.target.value })
          }
        >
          <option value="">All priorities</option>
          {lookups?.messagePriorities.map((priority) => (
            <option key={priority} value={priority}>
              {formatEnum(priority)}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.targetRole}
          onChange={(event) =>
            setFilters({ ...filters, targetRole: event.target.value })
          }
        >
          <option value="">All roles</option>
          {lookups?.assignableStaffRoles.map((role) => (
            <option key={role} value={role}>
              {formatEnum(role)}
            </option>
          ))}
        </select>
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <div className="khms-card p-4">
          <h2 className="font-heading text-xl font-semibold">
            {editing ? "Update Notification" : "Create Notification"}
          </h2>
          <div className="mt-4 grid gap-3">
            <Field label="Title">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </Field>
            <Field label="Message">
              <Input
                value={form.message ?? ""}
                onChange={(event) =>
                  setForm({ ...form, message: event.target.value })
                }
              />
            </Field>
            <SelectField
              label="Type"
              value={form.type}
              onChange={(type) => setForm({ ...form, type: type as never })}
              options={(lookups?.notificationTypes ?? []).map((type) => ({
                label: formatEnum(type),
                value: type,
              }))}
            />
            <SelectField
              label="Priority"
              value={form.priority}
              onChange={(priority) =>
                setForm({ ...form, priority: priority as never })
              }
              options={(lookups?.messagePriorities ?? []).map((priority) => ({
                label: formatEnum(priority),
                value: priority,
              }))}
            />
            <SelectField
              label="Target Role"
              value={form.targetRole ?? ""}
              onChange={(targetRole) =>
                setForm({ ...form, targetRole: targetRole as never })
              }
              options={(lookups?.assignableStaffRoles ?? []).map((role) => ({
                label: formatEnum(role),
                value: role,
              }))}
              includeBlank="All roles"
            />
            <SelectField
              label="Target Department"
              value={form.targetDepartmentId ?? ""}
              onChange={(targetDepartmentId) =>
                setForm({ ...form, targetDepartmentId })
              }
              options={departments.map((department) => ({
                label: department.name,
                value: department.id,
              }))}
              includeBlank="All departments"
            />
            <Field label="Expires At">
              <Input
                type="datetime-local"
                value={form.expiresAt ? toDateTimeLocal(form.expiresAt) : ""}
                onChange={(event) =>
                  setForm({
                    ...form,
                    expiresAt: fromDateTimeLocal(event.target.value),
                  })
                }
              />
            </Field>
            <Button
              onClick={saveNotification}
              disabled={
                createNotification.isPending || updateNotification.isPending
              }
            >
              <MaterialSymbol icon="notifications" />
              {editing ? "Save Notification" : "Create Notification"}
            </Button>
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-white p-4 shadow-sm">
          {isLoading ? (
            <LoadingPanel />
          ) : (
            <div className="grid gap-3">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className="rounded border border-border-subtle p-4 transition hover:border-primary"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded bg-accent-blue text-primary">
                        <MaterialSymbol
                          icon="notifications"
                          className="text-[24px]"
                        />
                      </div>
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.message ?? "No message"}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Target:{" "}
                          {item.recipientName ??
                            item.targetDepartmentName ??
                            (item.targetRole
                              ? formatEnum(item.targetRole)
                              : "All staff")}{" "}
                          / Created {formatDate(item.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <SoftBadge value={item.priority} />
                      <SoftBadge value={item.status} />
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditing(item)
                        setForm({
                          title: item.title,
                          message: item.message,
                          type: item.type,
                          priority: item.priority,
                          targetRole: item.targetRole,
                          targetDepartmentId: item.targetDepartmentId ?? "",
                          recipientUserId: item.recipientUserId ?? "",
                          expiresAt: item.expiresAt,
                        })
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(item.id, "READ")}
                    >
                      Mark Read
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => updateStatus(item.id, "ARCHIVED")}
                    >
                      Archive
                    </Button>
                  </div>
                </div>
              ))}
              {!notifications.length ? (
                <EmptyState label="No notifications yet." />
              ) : null}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

export function HospitalAdminAuditLogsPage() {
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
    search: "",
  })
  const { data: lookups } = useHospitalAdminLookups()
  const {
    data: logs = [],
    isLoading,
    isError,
  } = useHospitalAdminAuditLogs(filters)
  const entityTypes = useMemo(
    () => Array.from(new Set(logs.map((log) => log.entityType))).sort(),
    [logs]
  )

  if (isError)
    return <DashboardError message="Audit logs could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Audit Logs"
        title="Facility Audit Logs"
        description="Read-only audit trail for SDA Hospital Kwadaso facility activity."
      />
      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Input
          placeholder="Search logs"
          value={filters.search}
          onChange={(event) =>
            setFilters({ ...filters, search: event.target.value })
          }
        />
        <select
          className="khms-input"
          value={filters.action}
          onChange={(event) =>
            setFilters({ ...filters, action: event.target.value })
          }
        >
          <option value="">All actions</option>
          {lookups?.auditActions.map((action) => (
            <option key={action} value={action}>
              {formatEnum(action)}
            </option>
          ))}
        </select>
        <select
          className="khms-input"
          value={filters.entityType}
          onChange={(event) =>
            setFilters({ ...filters, entityType: event.target.value })
          }
        >
          <option value="">All entities</option>
          {entityTypes.map((entityType) => (
            <option key={entityType} value={entityType}>
              {entityType}
            </option>
          ))}
        </select>
      </section>
      <div className="khms-card overflow-hidden">
        {isLoading ? (
          <LoadingPanel />
        ) : (
          <ResponsiveTable minWidth="920px">
            <thead className="bg-accent-blue text-left">
              <tr>
                <th className="khms-label px-4 py-3">When</th>
                <th className="khms-label px-4 py-3">Actor</th>
                <th className="khms-label px-4 py-3">Action</th>
                <th className="khms-label px-4 py-3">Entity</th>
                <th className="khms-label px-4 py-3">Description</th>
                <th className="khms-label px-4 py-3">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-t border-border-subtle align-top"
                >
                  <td className="khms-table-data px-4 py-3">
                    {formatDate(log.createdAt)}
                  </td>
                  <td className="khms-table-data px-4 py-3">{log.actorName}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={formatEnum(log.action)} />
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {log.entityType}
                  </td>
                  <td className="khms-table-data px-4 py-3">
                    {log.description ?? "No description"}
                  </td>
                  <td className="max-w-[320px] px-4 py-3 text-xs text-muted-foreground">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(
                        { before: log.before, after: log.after },
                        null,
                        2
                      )}
                    </pre>
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState label="No audit logs found." />
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

export function HospitalAdminOversightPage() {
  const { data, isLoading, isError } = useHospitalAdminOversight()

  if (isLoading) return <LoadingPanel />
  if (isError || !data)
    return <DashboardError message="Oversight data could not be loaded." />

  const cards = [
    {
      label: "Billing Activity",
      icon: "payments",
      value: `${data.billing.invoices} invoices`,
      detail: `${data.billing.payments} payment records`,
    },
    {
      label: "Referral Activity",
      icon: "send",
      value: `${data.referrals.total} referrals`,
      detail: "Inbound and outbound facility referrals",
    },
    {
      label: "Clinical Flow",
      icon: "stethoscope",
      value: `${data.clinical.encounters} encounters`,
      detail: `${data.clinical.diagnoses} diagnoses recorded`,
    },
    {
      label: "Lab Activity",
      icon: "labs",
      value: `${data.laboratory.requests} requests`,
      detail: `${data.laboratory.results} results recorded`,
    },
    {
      label: "Pharmacy Stock",
      icon: "medication",
      value: `${data.pharmacy.stockBatches} batches`,
      detail: `${data.pharmacy.lowStock} low-stock batches`,
    },
    {
      label: "Sync Jobs",
      icon: "sync",
      value: `${data.sync.reduce((total, item) => total + item.count, 0)} jobs`,
      detail: data.sync.length
        ? data.sync
            .map((item) => `${formatEnum(item.status)}: ${item.count}`)
            .join(", ")
        : "No sync jobs recorded",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Oversight"
        title="Read-Only Oversight"
        description="Specialized clinical, billing, lab, pharmacy, referral, and sync summaries without edit access."
      />
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="khms-card p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded bg-medical-green-soft text-primary">
                <MaterialSymbol icon={card.icon} className="text-[22px]" />
              </div>
              <p className="khms-label">{card.label}</p>
            </div>
            <p className="font-heading text-2xl font-bold">{card.value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{card.detail}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

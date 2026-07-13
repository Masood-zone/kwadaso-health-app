"use client"

import { useMemo, useState } from "react"
import {
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  SlidersHorizontal,
  UserX,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import {
  DashboardError,
  StatusBadge,
} from "@/components/dashboard/dashboard-widgets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AvatarInitials,
  Field,
  FormPanel,
  formatEnum,
  IconAction,
  PageHeader,
  ResponsiveTable,
  SectionHeader,
  StatTile,
} from "@/components/super-admin/super-admin-ui"
import { useSuperAdminDashboard } from "@/services/super-admin/dashboard"
import {
  type StaffFormPayload,
  useCreateStaff,
  useStaffList,
  useUpdateStaff,
} from "@/services/super-admin/staff"
import type { SuperAdminStaffSummary } from "@/types/super-admin"

const blankStaffForm: StaffFormPayload = {
  firstName: "",
  lastName: "",
  otherNames: "",
  email: "",
  phone: "",
  jobTitle: "",
  departmentId: "",
  defaultRole: "NURSE",
  status: "ACTIVE",
  temporaryPassword: "ChangeMe123!",
}

export function StaffManagementPage() {
  const { data: dashboard } = useSuperAdminDashboard()
  const { data: staff = [], isLoading, isError } = useStaffList()
  const createStaff = useCreateStaff()
  const updateStaff = useUpdateStaff()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<StaffFormPayload>(blankStaffForm)

  const departments = dashboard?.management.departments ?? []
  const activeDepartments = departments.filter(
    (department) => department.isActive
  )
  const roles = dashboard?.management.lookups.roles ?? []
  const statuses = dashboard?.management.lookups.statuses ?? []

  const stats = useMemo(() => {
    const activeStaff = staff.filter((item) => item.status === "ACTIVE").length
    const clinicalStaff = staff.filter((item) =>
      ["DOCTOR", "PHYSICIAN_ASSISTANT", "NURSE"].includes(item.defaultRole)
    ).length
    const restrictedStaff = staff.filter((item) =>
      ["SUSPENDED", "LOCKED", "INACTIVE"].includes(item.status)
    ).length

    return { activeStaff, clinicalStaff, restrictedStaff }
  }, [staff])

  function editStaff(item: SuperAdminStaffSummary) {
    const [firstName = "", ...rest] = item.name.split(" ")
    const lastName = rest.pop() ?? ""
    setEditingId(item.id)
    setForm({
      firstName,
      lastName,
      otherNames: rest.join(" "),
      email: item.email,
      phone: item.phone ?? "",
      jobTitle: item.jobTitle ?? "",
      departmentId: item.departmentId ?? "",
      defaultRole: item.defaultRole,
      status: item.status,
      temporaryPassword: "",
    })
  }

  async function saveStaff() {
    try {
      if (editingId) {
        await updateStaff.mutateAsync({ id: editingId, payload: form })
        toast.success("Staff account updated")
      } else {
        await createStaff.mutateAsync(form)
        toast.success("Staff account created")
      }
      setEditingId(null)
      setForm(blankStaffForm)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Staff change failed"
      )
    }
  }

  if (isError)
    return <DashboardError message="Staff accounts could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Staff Directory"
        title="Staff Management"
        description="Manage hospital personnel records, role assignment, and access status."
        actions={
          <>
            <Button variant="outline">
              <SlidersHorizontal className="size-4" />
              Filter
            </Button>
            <Button
              onClick={() => {
                setEditingId(null)
                setForm(blankStaffForm)
              }}
            >
              <Plus className="size-4" />
              New Staff
            </Button>
          </>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Total Staff"
          value={staff.length.toString()}
          tone="green"
          detail={`${stats.activeStaff} active`}
        />
        <StatTile
          label="Clinical Staff"
          value={stats.clinicalStaff.toString()}
          tone="blue"
          detail="Doctors, PAs, nurses"
        />
        <StatTile
          label="Departments"
          value={activeDepartments.length.toString()}
          tone="orange"
          detail="Active assignment pools"
        />
        <StatTile
          label="Restricted"
          value={stats.restrictedStaff.toString()}
          tone="red"
          detail="Inactive, suspended, locked"
        />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="khms-card overflow-hidden">
          <SectionHeader
            icon={Users}
            eyebrow="Staff Accounts"
            title="Personnel Directory"
          />
          {isLoading ? (
            <div className="h-96 animate-pulse bg-muted" />
          ) : (
            <ResponsiveTable minWidth="860px">
              <thead className="bg-accent-blue text-left">
                <tr>
                  <th className="khms-label px-4 py-3">Staff</th>
                  <th className="khms-label px-4 py-3">Staff ID</th>
                  <th className="khms-label px-4 py-3">Role</th>
                  <th className="khms-label px-4 py-3">Department</th>
                  <th className="khms-label px-4 py-3">Status</th>
                  <th className="khms-label px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {staff.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-surface-container-lowest"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <AvatarInitials name={item.name} />
                        <div>
                          <p className="text-sm font-bold">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="khms-table-data px-4 py-3 text-muted-foreground">
                      {item.staffId}
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {formatEnum(item.defaultRole)}
                    </td>
                    <td className="khms-table-data px-4 py-3">
                      {item.departmentName ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={formatEnum(item.status)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <IconAction
                          label="Edit profile"
                          onClick={() => editStaff(item)}
                        >
                          <Pencil className="size-3.5" />
                        </IconAction>
                        <IconAction
                          label="Restrict access"
                          tone="danger"
                          onClick={() => editStaff(item)}
                        >
                          <UserX className="size-3.5" />
                        </IconAction>
                        <IconAction
                          label="Reset password"
                          onClick={() => editStaff(item)}
                        >
                          <LockKeyhole className="size-3.5" />
                        </IconAction>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          )}
        </div>

        <FormPanel
          icon={editingId ? Pencil : Plus}
          eyebrow={editingId ? "Edit Account" : "New Account"}
          title={editingId ? "Update Staff" : "Create Staff"}
        >
          <div className="grid gap-3">
            <Field label="Staff ID">
              <Input
                disabled
                value={
                  editingId
                    ? (staff.find((item) => item.id === editingId)?.staffId ??
                      "")
                    : "Assigned automatically when saved"
                }
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Phone">
                <Input
                  value={form.phone ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, phone: event.target.value })
                  }
                />
              </Field>
              <Field label="Job Title">
                <Input
                  value={form.jobTitle ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, jobTitle: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="Department">
              <select
                className="khms-input w-full"
                value={form.departmentId ?? ""}
                onChange={(event) =>
                  setForm({ ...form, departmentId: event.target.value })
                }
              >
                <option value="">Unassigned</option>
                {activeDepartments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Primary Role">
                <select
                  className="khms-input w-full"
                  value={form.defaultRole}
                  onChange={(event) =>
                    setForm({ ...form, defaultRole: event.target.value })
                  }
                >
                  {roles.map((role) => (
                    <option key={role} value={role}>
                      {formatEnum(role)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  className="khms-input w-full"
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value })
                  }
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {formatEnum(status)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {!editingId ? (
              <Field label="Temporary Password">
                <Input
                  type="text"
                  value={form.temporaryPassword ?? ""}
                  onChange={(event) =>
                    setForm({ ...form, temporaryPassword: event.target.value })
                  }
                />
              </Field>
            ) : null}
            <div className="flex gap-2">
              <Button
                onClick={saveStaff}
                disabled={createStaff.isPending || updateStaff.isPending}
              >
                <Save className="size-4" />
                Save Staff
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null)
                  setForm(blankStaffForm)
                }}
              >
                Reset
              </Button>
            </div>
          </div>
        </FormPanel>
      </section>
    </div>
  )
}

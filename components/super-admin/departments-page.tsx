"use client"

import { useState } from "react"
import { Activity, Building2, Pencil, Plus, Save } from "lucide-react"
import { toast } from "sonner"

import { DashboardError, StatusBadge } from "@/components/dashboard/dashboard-widgets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FormPanel,
  formatEnum,
  PageHeader,
  ResponsiveTable,
  SectionHeader,
  StatTile,
} from "@/components/super-admin/super-admin-ui"
import { useSuperAdminDashboard } from "@/services/super-admin/dashboard"
import {
  type DepartmentFormPayload,
  useCreateDepartment,
  useDepartments,
  useUpdateDepartment,
} from "@/services/super-admin/departments"

const blankDepartmentForm: DepartmentFormPayload = {
  code: "",
  name: "",
  type: "OTHER",
  isActive: true,
}

export function DepartmentsPage() {
  const { data: dashboard } = useSuperAdminDashboard()
  const { data: departments = [], isLoading, isError } = useDepartments()
  const createDepartment = useCreateDepartment()
  const updateDepartment = useUpdateDepartment()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DepartmentFormPayload>(blankDepartmentForm)
  const departmentTypes = dashboard?.management.lookups.departmentTypes ?? []
  const activeCount = departments.filter((department) => department.isActive).length
  const staffCount = departments.reduce((total, department) => total + department.staffCount, 0)

  async function saveDepartment() {
    try {
      if (editingId) {
        await updateDepartment.mutateAsync({ id: editingId, payload: form })
        toast.success("Department updated")
      } else {
        await createDepartment.mutateAsync(form)
        toast.success("Department created")
      }
      setEditingId(null)
      setForm(blankDepartmentForm)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Department change failed")
    }
  }

  if (isError) return <DashboardError message="Departments could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration / Facility Management"
        title="Departmental Infrastructure"
        description="Configure hospital departments, staffing assignment pools, and operational status."
        actions={
          <Button onClick={() => { setEditingId(null); setForm(blankDepartmentForm) }}>
            <Plus className="size-4" />
            Add Department
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatTile label="Departments" value={departments.length.toString()} tone="blue" detail={`${activeCount} active`} />
        <StatTile label="Staff Assigned" value={staffCount.toString()} tone="green" detail="Across all units" />
        <StatTile label="Inactive Units" value={(departments.length - activeCount).toString()} tone="orange" detail="Hidden from assignment" />
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="khms-card overflow-hidden">
          <SectionHeader icon={Building2} eyebrow="Departments" title="Departmental Directory" />
          {isLoading ? (
            <div className="h-80 animate-pulse bg-muted" />
          ) : (
            <ResponsiveTable minWidth="720px">
              <thead className="bg-accent-blue text-left">
                <tr>
                  <th className="khms-label px-4 py-3">Department</th>
                  <th className="khms-label px-4 py-3">Type</th>
                  <th className="khms-label px-4 py-3">Staffing</th>
                  <th className="khms-label px-4 py-3">Status</th>
                  <th className="khms-label px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id} className="border-t border-border-subtle hover:bg-surface-container-low">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 items-center justify-center rounded bg-medical-green-soft text-primary">
                          <Activity className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">{department.name}</p>
                          <p className="text-xs text-muted-foreground">{department.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="khms-table-data px-4 py-3">{formatEnum(department.type)}</td>
                    <td className="khms-table-data px-4 py-3">{department.staffCount} staff</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={department.isActive ? "Active" : "Inactive"} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(department.id); setForm({ code: department.code, name: department.name, type: department.type, isActive: department.isActive }) }}>
                        <Pencil className="size-3.5" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
          )}
        </div>

        <FormPanel icon={editingId ? Pencil : Plus} eyebrow={editingId ? "Edit Unit" : "New Unit"} title={editingId ? "Update Department" : "Create Department"}>
          <div className="grid gap-3">
            <Field label="Code">
              <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
            </Field>
            <Field label="Name">
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </Field>
            <Field label="Type">
              <select className="khms-input w-full" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
                {departmentTypes.map((type) => (
                  <option key={type} value={type}>{formatEnum(type)}</option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />
              Active
            </label>
            <div className="flex gap-2">
              <Button onClick={saveDepartment} disabled={createDepartment.isPending || updateDepartment.isPending}>
                <Save className="size-4" />
                Save Department
              </Button>
              <Button variant="outline" onClick={() => { setEditingId(null); setForm(blankDepartmentForm) }}>
                Reset
              </Button>
            </div>
          </div>
        </FormPanel>
      </section>
    </div>
  )
}

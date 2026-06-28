"use client"

import { useMemo, useState } from "react"
import { KeyRound, LockKeyhole, Save, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { DashboardError } from "@/components/dashboard/dashboard-widgets"
import { Button } from "@/components/ui/button"
import {
  CompactHeader,
  formatEnum,
  PageHeader,
  SectionHeader,
} from "@/components/super-admin/super-admin-ui"
import {
  useRolePermissionMatrix,
  useUpdateRolePermissions,
} from "@/services/super-admin/roles"

export function RolesPermissionsPage() {
  const { data, isLoading, isError } = useRolePermissionMatrix()
  const updateRolePermissions = useUpdateRolePermissions()
  const roles = useMemo(() => data?.roles ?? [], [data?.roles])
  const permissions = useMemo(() => data?.permissions ?? [], [data?.permissions])
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? roles[0]
  const selectedPermissionKeys = selectedRoleId
    ? selectedPermissions
    : (selectedRole?.permissions ?? [])

  const groupedPermissions = useMemo(() => {
    return permissions.reduce<Record<string, typeof permissions>>((groups, permission) => {
      groups[permission.module] = groups[permission.module] ?? []
      groups[permission.module].push(permission)
      return groups
    }, {})
  }, [permissions])

  async function savePermissions() {
    if (!selectedRole) return
    try {
      await updateRolePermissions.mutateAsync({
        roleId: selectedRole.id,
        permissionKeys: selectedPermissionKeys,
      })
      toast.success("Role permissions updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Permission update failed")
    }
  }

  if (isError) return <DashboardError message="Role permissions could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Access Control"
        title="Access Control Management"
        description="Define granular permissions for hospital staff roles across clinical and administrative modules."
        actions={
          <Button onClick={savePermissions} disabled={updateRolePermissions.isPending || isLoading}>
            <Save className="size-4" />
            Save All Changes
          </Button>
        }
      />

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="khms-card overflow-hidden">
            <SectionHeader icon={KeyRound} eyebrow="System Roles" title="Role Catalog" />
            <div className="max-h-[620px] divide-y divide-border-subtle overflow-y-auto">
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`flex w-full items-center justify-between border-l-4 px-4 py-4 text-left ${
                    role.id === selectedRole?.id
                      ? "border-secondary-container bg-primary-fixed/20"
                      : "border-transparent hover:bg-surface-container-low"
                  }`}
                  onClick={() => {
                    setSelectedRoleId(role.id)
                    setSelectedPermissions(role.permissions)
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded bg-medical-green-soft text-primary">
                      <ShieldCheck className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-bold">{formatEnum(role.name)}</span>
                      <span className="text-xs text-muted-foreground">
                        {role.users} users · {role.permissions.length} permissions
                      </span>
                    </span>
                  </span>
                  <LockKeyhole className="size-4 text-primary" />
                </button>
              ))}
            </div>
          </div>

          <div className="khms-card bg-primary-container p-5 text-white">
            <CompactHeader icon={ShieldCheck} eyebrow="Security Context" title="Global Template" />
            <p className="mt-4 text-sm text-white/80">
              Permission changes affect the selected system role immediately after saving.
            </p>
          </div>
        </div>

        <div className="khms-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-subtle p-5">
            <CompactHeader
              icon={ShieldCheck}
              eyebrow="Permission Matrix"
              title={selectedRole ? formatEnum(selectedRole.name) : "Select a Role"}
            />
            <span className="khms-badge bg-medical-green-soft text-primary">
              System Role
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            {Object.entries(groupedPermissions).map(([module, modulePermissions]) => (
              <div key={module} className="rounded border border-border-subtle p-3">
                <p className="mb-3 text-sm font-semibold">{module}</p>
                <div className="space-y-2">
                  {modulePermissions.map((permission) => {
                    const checked = selectedPermissionKeys.includes(permission.key)
                    return (
                      <label key={permission.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => {
                            if (!selectedRoleId && selectedRole) {
                              setSelectedRoleId(selectedRole.id)
                            }
                            setSelectedPermissions((current) => {
                              const base = selectedRoleId
                                ? current
                                : (selectedRole?.permissions ?? [])
                              return event.target.checked
                                ? Array.from(new Set([...base, permission.key]))
                                : base.filter((key) => key !== permission.key)
                            })
                          }}
                        />
                        <span>{permission.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

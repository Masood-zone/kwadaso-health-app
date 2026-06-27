"use client"

import { ClipboardList, Settings, Users } from "lucide-react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import {
  DashboardError,
  MetricCard,
  StatusBadge,
} from "@/components/dashboard/dashboard-widgets"
import { useSuperAdminDashboard } from "@/services/super-admin/dashboard"

type SuperAdminDashboardProps = {
  userName: string
  roleLabel: string
  fallbackFacilityName: string
}

export function SuperAdminDashboard({
  fallbackFacilityName,
  roleLabel,
  userName,
}: SuperAdminDashboardProps) {
  const { data: dashboard, isLoading, isError } = useSuperAdminDashboard()

  return (
    <DashboardShell
      title="System Overview"
      eyebrow="Super Admin"
      facilityName={dashboard?.facilityName ?? fallbackFacilityName}
      userName={userName}
      roleLabel={roleLabel}
    >
      {isLoading ? (
        <DashboardLoading />
      ) : isError ? (
        <DashboardError message="Super admin dashboard could not be loaded." />
      ) : dashboard ? (
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboard.metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="khms-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
                <Users className="size-5 text-primary" />
                <div>
                  <p className="khms-label">Role Control</p>
                  <h2 className="font-heading text-xl font-semibold">
                    Staff Roles & Permissions
                  </h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead className="bg-accent-blue text-left">
                    <tr>
                      <th className="khms-label px-4 py-3">Role</th>
                      <th className="khms-label px-4 py-3">Users</th>
                      <th className="khms-label px-4 py-3">Permissions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.roleOverview.map((role) => (
                      <tr
                        key={role.role}
                        className="border-t border-border-subtle"
                      >
                        <td className="khms-table-data px-4 py-3">
                          {role.role.replaceAll("_", " ")}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={`${role.users} users`} />
                        </td>
                        <td className="khms-table-data px-4 py-3 text-muted-foreground">
                          {role.permissions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="space-y-5">
              <section className="khms-card p-4">
                <div className="mb-4 flex items-center gap-3">
                  <Settings className="size-5 text-primary" />
                  <div>
                    <p className="khms-label">Departments</p>
                    <h2 className="font-heading text-xl font-semibold">
                      Active Units
                    </h2>
                  </div>
                </div>
                <div className="space-y-3">
                  {dashboard?.departments.slice(0, 6).map((department) => (
                    <div
                      key={department.id}
                      className="flex items-center justify-between rounded border border-border-subtle p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {department.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {department.type.replaceAll("_", " ")}
                        </p>
                      </div>
                      <StatusBadge value={`${department.staffCount} staff`} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="khms-card p-4">
                <div className="mb-4 flex items-center gap-3">
                  <ClipboardList className="size-5 text-primary" />
                  <div>
                    <p className="khms-label">Audit Trail</p>
                    <h2 className="font-heading text-xl font-semibold">
                      Recent Events
                    </h2>
                  </div>
                </div>
                <div className="space-y-3">
                  {dashboard?.auditLogs.length ? (
                    dashboard.auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border-l-2 border-primary pl-3"
                      >
                        <p className="text-sm font-semibold">{log.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.detail}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No audit activity has been recorded yet.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </section>
        </div>
      ) : null}
    </DashboardShell>
  )
}

function DashboardLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="khms-card h-32 animate-pulse bg-muted" />
      ))}
    </div>
  )
}

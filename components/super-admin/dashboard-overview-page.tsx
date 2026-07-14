"use client"

import { ClipboardList, Settings, Users } from "lucide-react"

import {
  DashboardError,
  MetricCard,
  StatusBadge,
} from "@/components/dashboard/dashboard-widgets"
import {
  CompactHeader,
  formatEnum,
  PageHeader,
  ResponsiveTable,
  SectionHeader,
} from "@/components/super-admin/super-admin-ui"
import { useSuperAdminDashboardSummary } from "@/services/super-admin/dashboard"

export function DashboardOverviewPage() {
  const { data: dashboard, isLoading, isError } =
    useSuperAdminDashboardSummary()

  if (isLoading) return <DashboardLoading />
  if (isError || !dashboard) {
    return <DashboardError message="Super admin dashboard could not be loaded." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Dashboard"
        title="System Overview"
        description="Monitor staff access, hospital configuration, departments, and recent system activity."
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboard.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="khms-card overflow-hidden">
          <SectionHeader
            icon={Users}
            eyebrow="Role Control"
            title="Staff Roles & Permissions"
          />
          <ResponsiveTable minWidth="600px">
            <thead className="bg-accent-blue text-left">
              <tr>
                <th className="khms-label px-4 py-3">Role</th>
                <th className="khms-label px-4 py-3">Users</th>
                <th className="khms-label px-4 py-3">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.roleOverview.map((role) => (
                <tr key={role.role} className="border-t border-border-subtle">
                  <td className="khms-table-data px-4 py-3">
                    {formatEnum(role.role)}
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
          </ResponsiveTable>
        </div>

        <aside className="space-y-5">
          <section className="khms-card p-4">
            <CompactHeader
              icon={Settings}
              eyebrow="Departments"
              title="Active Units"
            />
            <div className="mt-4 space-y-3">
              {dashboard.departments.slice(0, 6).map((department) => (
                <div
                  key={department.id}
                  className="flex items-center justify-between rounded border border-border-subtle p-3"
                >
                  <div>
                    <p className="text-sm font-semibold">{department.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatEnum(department.type)}
                    </p>
                  </div>
                  <StatusBadge value={`${department.staffCount} staff`} />
                </div>
              ))}
            </div>
          </section>

          <section className="khms-card p-4">
            <CompactHeader
              icon={ClipboardList}
              eyebrow="Audit Trail"
              title="Recent Events"
            />
            <div className="mt-4 space-y-3">
              {dashboard.auditLogs.length ? (
                dashboard.auditLogs.map((log) => (
                  <div key={log.id} className="border-l-2 border-primary pl-3">
                    <p className="text-sm font-semibold">{log.label}</p>
                    <p className="text-xs text-muted-foreground">{log.detail}</p>
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

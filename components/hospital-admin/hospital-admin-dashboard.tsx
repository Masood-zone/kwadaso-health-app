"use client"

import { Activity, BarChart3, Building2 } from "lucide-react"

import {
  DashboardError,
  MetricCard,
  StatusBadge,
} from "@/components/dashboard/dashboard-widgets"
import { PageHeader } from "@/components/super-admin/super-admin-ui"
import { useHospitalAdminDashboard } from "@/services/hospital-admin/dashboard"

export function HospitalAdminDashboard() {
  const dashboard = useHospitalAdminDashboard()
  const data = dashboard.data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Admin / Dashboard"
        title="Hospital Admin Dashboard"
        description={`Live operational overview${data?.facilityName ? ` for ${data.facilityName}` : ""}.`}
      />
      {dashboard.isLoading ? (
        <DashboardLoading />
      ) : dashboard.isError ? (
        <DashboardError message="Hospital dashboard could not be loaded." />
      ) : data ? (
        <div className="space-y-5">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {data.metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="khms-card overflow-hidden">
              <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
                <Building2 className="size-5 text-primary" />
                <div>
                  <p className="khms-label">Department Performance</p>
                  <h2 className="font-heading text-xl font-semibold">
                    Workload Snapshot
                  </h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead className="bg-accent-blue text-left">
                    <tr>
                      <th className="khms-label px-4 py-3">Department</th>
                      <th className="khms-label px-4 py-3">Staff</th>
                      <th className="khms-label px-4 py-3">Queue</th>
                      <th className="khms-label px-4 py-3">Open Encounters</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.departments.map((department) => (
                      <tr
                        key={department.id}
                        className="border-t border-border-subtle"
                      >
                        <td className="khms-table-data px-4 py-3">
                          {department.name}
                        </td>
                        <td className="khms-table-data px-4 py-3">
                          {department.staffCount}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            value={`${department.queueCount} waiting`}
                          />
                        </td>
                        <td className="khms-table-data px-4 py-3 text-muted-foreground">
                          {department.openEncounters}
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
                  <BarChart3 className="size-5 text-primary" />
                  <div>
                    <p className="khms-label">Patient Flow</p>
                    <h2 className="font-heading text-xl font-semibold">
                      Daily Movement
                    </h2>
                  </div>
                </div>
                <div className="space-y-4">
                  {data.patientFlow.map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold">{item.label}</span>
                        <span className="text-muted-foreground">
                          {item.value}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${Math.min(item.value * 10, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="khms-card p-4">
                <div className="mb-4 flex items-center gap-3">
                  <Activity className="size-5 text-primary" />
                  <div>
                    <p className="khms-label">Staff Activity</p>
                    <h2 className="font-heading text-xl font-semibold">
                      Recent Actions
                    </h2>
                  </div>
                </div>
                <div className="space-y-3">
                  {data.staffActivity.length ? (
                    data.staffActivity.map((item) => (
                      <div
                        key={item.id}
                        className="border-l-2 border-primary pl-3"
                      >
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.detail}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No staff activity has been recorded yet.
                    </p>
                  )}
                </div>
              </section>
            </aside>
          </section>
        </div>
      ) : null}
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

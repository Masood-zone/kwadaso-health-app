"use client"

import { HeartPulse, Thermometer, Users } from "lucide-react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import {
  DashboardError,
  MetricCard,
  StatusBadge,
} from "@/components/dashboard/dashboard-widgets"
import { useNurseDashboard } from "@/services/nurse/dashboard"

type NurseDashboardProps = {
  userName: string
  roleLabel: string
  fallbackFacilityName: string
}

export function NurseDashboard({
  fallbackFacilityName,
  roleLabel,
  userName,
}: NurseDashboardProps) {
  const dashboard = useNurseDashboard()
  const data = dashboard.data

  return (
    <DashboardShell
      title="Triage & Nursing Station"
      eyebrow={data?.departmentName ?? "Nursing"}
      facilityName={data?.facilityName ?? fallbackFacilityName}
      userName={userName}
      roleLabel={roleLabel}
    >
      {dashboard.isLoading ? (
        <DashboardLoading />
      ) : dashboard.isError ? (
        <DashboardError message="Nursing dashboard could not be loaded." />
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
                <Users className="size-5 text-primary" />
                <div>
                  <p className="khms-label">Live Queue</p>
                  <h2 className="font-heading text-xl font-semibold">
                    Patients Awaiting Triage
                  </h2>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead className="bg-accent-blue text-left">
                    <tr>
                      <th className="khms-label px-4 py-3">Queue</th>
                      <th className="khms-label px-4 py-3">Patient</th>
                      <th className="khms-label px-4 py-3">Folder No.</th>
                      <th className="khms-label px-4 py-3">Priority</th>
                      <th className="khms-label px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.triageQueue.map((entry) => (
                      <tr
                        key={entry.id}
                        className="border-t border-border-subtle"
                      >
                        <td className="khms-table-data px-4 py-3">
                          {entry.queueNo}
                        </td>
                        <td className="khms-table-data px-4 py-3">
                          {entry.patientName}
                        </td>
                        <td className="khms-table-data px-4 py-3 text-muted-foreground">
                          {entry.patientNo}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge value={entry.priority} />
                        </td>
                        <td className="khms-table-data px-4 py-3 text-muted-foreground">
                          {entry.status.replaceAll("_", " ")}
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
                  <HeartPulse className="size-5 text-primary" />
                  <div>
                    <p className="khms-label">Critical Watch</p>
                    <h2 className="font-heading text-xl font-semibold">
                      Emergency Load
                    </h2>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-emergency-soft">
                  <div
                    className="h-full rounded-full bg-secondary-container"
                    style={{
                      width: `${Math.min(data.metrics[2]?.value ? Number(data.metrics[2].value) * 20 : 0, 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Urgent cases are highlighted for immediate clinical attention.
                </p>
              </section>

              <section className="khms-card p-4">
                <div className="mb-4 flex items-center gap-3">
                  <Thermometer className="size-5 text-primary" />
                  <div>
                    <p className="khms-label">Recent Vitals</p>
                    <h2 className="font-heading text-xl font-semibold">
                      Your Captures
                    </h2>
                  </div>
                </div>
                <div className="space-y-3">
                  {data.recentVitals.length ? (
                    data.recentVitals.map((vital) => (
                      <div
                        key={vital.id}
                        className="rounded border border-border-subtle p-3"
                      >
                        <p className="text-sm font-semibold">
                          {vital.patientName}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Temp {vital.temperatureC ?? "--"}C - Pulse{" "}
                          {vital.pulseRate ?? "--"} - BP{" "}
                          {vital.systolicBp ?? "--"}/
                          {vital.diastolicBp ?? "--"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No vitals captured by this station yet.
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

"use client"

import { useState } from "react"
import { ClipboardList, RefreshCw } from "lucide-react"

import { DashboardError, StatusBadge } from "@/components/dashboard/dashboard-widgets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  AvatarInitials,
  formatEnum,
  PageHeader,
  Pager,
  ResponsiveTable,
  SectionHeader,
  StatTile,
} from "@/components/super-admin/super-admin-ui"
import { useSuperAdminDashboard } from "@/services/super-admin/dashboard"
import { useAuditLogs } from "@/services/super-admin/audit-logs"

export function AuditLogsPage() {
  const { data: dashboard } = useSuperAdminDashboard()
  const actions = dashboard?.management.lookups.auditActions ?? []
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    action: "",
    entityType: "",
    from: "",
    to: "",
  })
  const { data, isLoading, isError, isFetching } = useAuditLogs(page, filters)
  const logs = data?.data ?? dashboard?.management.auditLogs ?? []
  const pagination =
    data?.pagination ??
    dashboard?.management.auditPagination ?? {
      page: 1,
      pageSize: 10,
      total: 0,
      totalPages: 1,
    }

  if (isError) return <DashboardError message="Audit logs could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Audit Logs"
        title="Audit Trail Explorer"
        description="Forensic system log monitoring and security activity tracking."
        actions={
          <>
            <Button variant="outline">Export CSV</Button>
            <Button variant="outline">Print Report</Button>
          </>
        }
      />

      <section className="khms-card overflow-hidden">
        <SectionHeader icon={ClipboardList} eyebrow="Audit Trail" title="Recent Activity Logs" />
        <div className="grid grid-cols-1 gap-3 border-b border-border-subtle bg-white p-4 md:grid-cols-5">
          <select className="khms-input w-full" value={filters.action} onChange={(event) => { setPage(1); setFilters({ ...filters, action: event.target.value }) }}>
            <option value="">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>{formatEnum(action)}</option>
            ))}
          </select>
          <Input placeholder="Entity type" value={filters.entityType} onChange={(event) => { setPage(1); setFilters({ ...filters, entityType: event.target.value }) }} />
          <Input type="date" value={filters.from} onChange={(event) => { setPage(1); setFilters({ ...filters, from: event.target.value }) }} />
          <Input type="date" value={filters.to} onChange={(event) => { setPage(1); setFilters({ ...filters, to: event.target.value }) }} />
          <Button variant="outline" onClick={() => { setPage(1); setFilters({ action: "", entityType: "", from: "", to: "" }) }}>
            <RefreshCw className="size-4" />
            Clear
          </Button>
        </div>

        {isLoading && !logs.length ? (
          <div className="h-96 animate-pulse bg-muted" />
        ) : (
          <ResponsiveTable minWidth="960px">
            <thead className="bg-surface-container-low text-left">
              <tr>
                <th className="khms-label px-4 py-3">Timestamp</th>
                <th className="khms-label px-4 py-3">User Entity</th>
                <th className="khms-label px-4 py-3">Action Type</th>
                <th className="khms-label px-4 py-3">Resource / Entity Changed</th>
                <th className="khms-label px-4 py-3">Client Fingerprint</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-border-subtle hover:bg-surface-container-low">
                  <td className="khms-table-data px-4 py-3">
                    <p className="font-bold">{new Date(log.createdAt).toLocaleDateString()}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <AvatarInitials name={log.actorName} />
                      <div>
                        <p className="text-sm font-semibold">{log.actorName}</p>
                        <p className="text-xs text-muted-foreground">{log.actorEmail ?? "System"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={formatEnum(log.action)} />
                  </td>
                  <td className="khms-table-data px-4 py-3 text-muted-foreground">
                    <p className="font-semibold text-foreground">{log.entityType}</p>
                    <p>{log.description ?? "No description"}</p>
                  </td>
                  <td className="khms-table-data px-4 py-3 font-mono text-muted-foreground">
                    {log.ipAddress ?? "Unknown"}
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        )}

        <div className="flex items-center justify-between border-t border-border-subtle p-4">
          <p className="text-sm text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages}
            {isFetching ? " - Loading..." : ""}
          </p>
          <Pager
            page={page}
            totalPages={pagination.totalPages}
            onPrevious={() => setPage((value) => Math.max(value - 1, 1))}
            onNext={() => setPage((value) => value + 1)}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatTile label="Total Logs" value={pagination.total.toString()} tone="blue" detail="Filtered audit records" />
        <StatTile label="Current Page" value={pagination.page.toString()} tone="green" detail={`${logs.length} visible rows`} />
        <StatTile label="Integrity" value="100%" tone="red" detail="Audit chain active" />
      </section>
    </div>
  )
}

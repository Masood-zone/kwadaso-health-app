"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { LaboratoryMetricGrid, LaboratoryPageHeader, LaboratoryState, StatusBadge } from "@/components/laboratory/laboratory-ui"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { useLaboratoryDashboard } from "@/services/laboratory/dashboard"

export function LaboratoryDashboard() {
  const dashboard = useLaboratoryDashboard()
  const data = dashboard.data
  return <>
    <LaboratoryPageHeader eyebrow="Laboratory Dashboard" title="Operations Overview" description="Live laboratory performance, urgent workload, validation bottlenecks, and turnaround status." actions={<><Button asChild><Link href="/laboratory/requests"><MaterialSymbol icon="biotech" className="text-lg" />Open request queue</Link></Button><Button variant="destructive" asChild><Link href="/laboratory/critical-results"><MaterialSymbol icon="emergency" className="text-lg" />Critical results</Link></Button></>} />
    <LaboratoryState loading={dashboard.isLoading} error={dashboard.isError} />
    {data ? <div className="space-y-6">
      <LaboratoryMetricGrid metrics={data.metrics} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <section className="khms-card p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">Volume by Test Category</h2><StatusBadge value="LIVE" /></div><div className="mt-6 space-y-4">{data.categoryVolume.length ? data.categoryVolume.map((item) => { const max = Math.max(...data.categoryVolume.map((row) => row.count), 1); return <div key={item.category}><div className="mb-1 flex justify-between text-sm"><span>{item.category}</span><span className="font-semibold">{item.count}</span></div><div className="h-3 rounded-full bg-surface-container"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(5, (item.count / max) * 100)}%` }} /></div></div> }) : <p className="text-sm text-muted-foreground">Category volume appears as requests arrive.</p>}</div></section>
        <section className="khms-card p-5"><h2 className="text-lg font-bold">Workflow Efficiency</h2><div className="mt-6 space-y-5">{Object.entries(data.workflowEfficiency).map(([key, value]) => <div key={key}><div className="mb-2 flex justify-between text-sm"><span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span><span className="font-bold">{value}%</span></div><div className="h-2 rounded-full bg-surface-container"><div className={value < 70 ? "h-full rounded-full bg-destructive" : value < 85 ? "h-full rounded-full bg-tertiary" : "h-full rounded-full bg-primary"} style={{ width: `${value}%` }} /></div></div>)}</div></section>
      </div>
      <section className="khms-card overflow-hidden"><div className="flex items-center justify-between p-5"><div><h2 className="text-lg font-bold">Active and Delayed Requests</h2><p className="text-sm text-muted-foreground">Oldest urgent work is shown first.</p></div><Button variant="outline" asChild><Link href="/laboratory/requests">View all</Link></Button></div><div className="overflow-x-auto"><table className="w-full min-w-[800px]"><thead className="bg-accent-blue"><tr className="khms-label text-left"><th className="px-4 py-3">Request</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Tests</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{data.delayedRequests.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3 font-semibold text-primary">{item.requestNo}</td><td className="px-4 py-3"><p className="font-semibold">{item.patientName}</p><p className="text-xs text-muted-foreground">{item.patientNo}</p></td><td className="px-4 py-3 text-sm">{item.requestedTests.join(", ")}</td><td className="px-4 py-3"><StatusBadge value={item.priority} /></td><td className="px-4 py-3"><StatusBadge value={item.status} /></td><td className="px-4 py-3"><Button size="sm" asChild><Link href={`/laboratory/requests/${item.id}`}>Open</Link></Button></td></tr>)}</tbody></table></div></section>
    </div> : null}
  </>
}

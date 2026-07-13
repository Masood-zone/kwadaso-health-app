"use client"

import Link from "next/link"
import { ArrowRight, PackagePlus, Search, TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DataTable, EmptyState, ErrorPanel, LoadingPanel, PageHeader, Panel, StatGrid, StatusBadge, formatDate, td } from "@/components/pharmacy/pharmacy-ui"
import { usePharmacyDashboard } from "@/services/pharmacy/pharmacy"

export function PharmacyDashboardPage() {
  const query = usePharmacyDashboard()
  if (query.isLoading) return <LoadingPanel label="Loading pharmacy dashboard..." />
  if (query.isError || !query.data) return <ErrorPanel message={query.error?.message} />
  const data = query.data
  return <>
    <PageHeader title="Pharmacy dashboard" description="Live prescription workload, dispensing activity, and facility-owned stock alerts." actions={<Button asChild><Link href="/pharmacy/prescriptions">Open prescription queue <ArrowRight /></Link></Button>} />
    <StatGrid items={data.metrics} />
    <div className="mt-6 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <Panel title="Recent dispensing" actions={<Button variant="outline" size="sm" asChild><Link href="/pharmacy/dispensing">View all</Link></Button>}>
        {data.recentDispensing.length ? <DataTable headers={["Dispense no.", "Patient", "Status", "Pharmacist", "Released"]}>{data.recentDispensing.map((row) => <tr key={row.id}><td className={td}><Link className="font-semibold text-primary hover:underline" href={`/pharmacy/dispensing/${row.id}`}>{row.dispenseNo}</Link></td><td className={td}>{row.patientName}</td><td className={td}><StatusBadge value={row.status} /></td><td className={td}>{row.dispensedByName ?? "—"}</td><td className={td}>{formatDate(row.dispensedAt)}</td></tr>)}</DataTable> : <EmptyState title="No dispensing records yet" description="Released dispensing sessions will appear here." />}
      </Panel>
      <Panel title="Low-stock attention">
        {data.lowStock.length ? <div className="divide-y">{data.lowStock.map((stock) => <div key={stock.id} className="flex items-start justify-between gap-3 p-4"><div><p className="font-semibold">{stock.medicationName}</p><p className="text-xs text-muted-foreground">Batch {stock.batchNumber ?? "unassigned"}</p></div><div className="text-right"><p className="font-bold text-red-700">{stock.quantityOnHand}</p><p className="text-xs text-muted-foreground">Reorder at {stock.reorderLevel}</p></div></div>)}</div> : <EmptyState title="Stock levels are healthy" description="No batch is currently at or below its reorder level." />}
      </Panel>
    </div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {[{ href: "/pharmacy/patients", icon: Search, title: "Patient medication history", text: "Search safely before dispensing." }, { href: "/pharmacy/stock", icon: PackagePlus, title: "Receive stock", text: "Create a traceable facility batch." }, { href: "/pharmacy/expired", icon: TriangleAlert, title: "Expiry review", text: "Review expired and 30-day stock." }].map(({ href, icon: Icon, title, text }) => <Link key={href} href={href} className="rounded-lg border bg-white p-4 shadow-sm transition hover:border-primary"><Icon className="size-5 text-primary" /><p className="mt-3 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></Link>)}
    </div>
  </>
}

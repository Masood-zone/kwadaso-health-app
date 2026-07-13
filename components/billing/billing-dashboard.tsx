"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { BillingEmpty, BillingErrorPanel, BillingLoading, BillingPageHeader, BillingPanel, BillingStatGrid, BillingStatusBadge, BillingTable, billingDate, billingMoney, billingTd } from "@/components/billing/billing-ui"
import { useBillingDashboard } from "@/services/billing/billing"

export function BillingDashboardPage() {
  const query = useBillingDashboard()
  if (query.isLoading) return <BillingLoading label="Loading billing overview…" />
  if (query.isError || !query.data) return <BillingErrorPanel message={query.error?.message} />
  const data = query.data
  const maxTrend = Math.max(1, ...data.collectionTrend.flatMap((item) => [item.billed, item.collected]))
  return <div className="space-y-6">
    <BillingPageHeader title="Billing Overview" description={`${data.facilityName} collections, invoices, balances, and payment activity.`} actions={<div className="flex flex-wrap gap-2"><Button asChild><Link href="/billing/invoices/new">Create invoice</Link></Button><Button variant="outline" asChild><Link href="/billing/patients">Find patient</Link></Button></div>} />
    <BillingStatGrid items={[
      { label: "Collected Today", value: billingMoney(data.amountCollectedToday), detail: "Successful payments", tone: "green" },
      { label: "Billed Today", value: billingMoney(data.amountBilledToday), detail: `${data.invoicesCreatedToday} invoices created`, tone: "neutral" },
      { label: "Outstanding Balance", value: billingMoney(data.outstandingBalance), detail: "Issued and partially paid", tone: "red" },
      { label: "Reversed Payments", value: data.reversedPayments, detail: "Preserved in the audit trail", tone: data.reversedPayments ? "orange" : "neutral" },
      { label: "Paid Invoices", value: data.paidInvoices, tone: "green" },
      { label: "Partially Paid", value: data.partiallyPaidInvoices, tone: "orange" },
      { label: "Unpaid Invoices", value: data.unpaidInvoices, tone: "red" },
      { label: "Invoices Today", value: data.invoicesCreatedToday, tone: "neutral" },
    ]} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
      <div className="space-y-5">
        <BillingPanel title="Recent Invoices" actions={<Button variant="link" asChild><Link href="/billing/invoices">View all</Link></Button>}>{data.recentInvoices.length ? <BillingTable headers={["Invoice", "Patient", "Amount", "Balance", "Status", "Issued"]}>{data.recentInvoices.map((invoice) => <tr key={invoice.id}><td className={billingTd}><Link className="font-semibold text-primary hover:underline" href={`/billing/invoices/${invoice.id}`}>{invoice.invoiceNo}</Link></td><td className={billingTd}><p className="font-medium">{invoice.patientName}</p><p className="text-xs text-muted-foreground">{invoice.patientNo}</p></td><td className={billingTd}>{billingMoney(invoice.totalAmount)}</td><td className={billingTd}>{billingMoney(invoice.balanceDue)}</td><td className={billingTd}><BillingStatusBadge value={invoice.status} /></td><td className={billingTd}>{billingDate(invoice.issuedAt || invoice.createdAt)}</td></tr>)}</BillingTable> : <BillingEmpty title="No invoices yet" description="Create an invoice after reviewing a patient's pending charges." />}</BillingPanel>
        <BillingPanel title="Seven-day Collection Trend"><div className="flex h-64 items-end gap-3 p-5">{data.collectionTrend.map((item) => <div key={item.date} className="flex h-full flex-1 flex-col justify-end gap-1"><div className="flex flex-1 items-end justify-center gap-1"><div title={`Billed ${billingMoney(item.billed)}`} className="w-2/5 rounded-t bg-primary/25" style={{ height: `${Math.max(2, (item.billed / maxTrend) * 100)}%` }} /><div title={`Collected ${billingMoney(item.collected)}`} className="w-2/5 rounded-t bg-primary" style={{ height: `${Math.max(2, (item.collected / maxTrend) * 100)}%` }} /></div><p className="text-center text-[10px] font-semibold text-muted-foreground">{new Date(`${item.date}T00:00:00`).toLocaleDateString("en-GH", { weekday: "short" })}</p></div>)}</div></BillingPanel>
      </div>
      <div className="space-y-5">
        <BillingPanel title="Billing Alerts">{data.alerts.length ? <div className="space-y-3 p-4">{data.alerts.map((alert) => <div key={alert.id} className={`rounded-md border-l-4 p-3 ${alert.tone === "red" ? "border-red-600 bg-red-50" : alert.tone === "orange" ? "border-orange-500 bg-orange-50" : "border-primary bg-green-50"}`}><p className="text-sm font-semibold">{alert.title}</p><p className="mt-1 text-xs text-muted-foreground">{alert.detail}</p></div>)}</div> : <BillingEmpty title="No active alerts" description="Billing activity is within the current thresholds." />}</BillingPanel>
        <BillingPanel title="Payment Methods"><div className="space-y-4 p-4">{data.paymentMethods.length ? data.paymentMethods.map((item) => { const percent = data.amountCollectedToday ? Math.round((item.amount / data.amountCollectedToday) * 100) : 0; return <div key={item.method}><div className="mb-1 flex justify-between text-sm"><span>{item.method.replaceAll("_", " ")}</span><span className="font-semibold">{percent}%</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{billingMoney(item.amount)} · {item.count} transactions</p></div> }) : <p className="text-sm text-muted-foreground">No successful collections today.</p>}</div></BillingPanel>
        <BillingPanel title="Quick Actions"><div className="grid gap-2 p-4"><Button asChild><Link href="/billing/patients">Find patient bill</Link></Button><Button variant="outline" asChild><Link href="/billing/outstanding">Outstanding balances</Link></Button><Button variant="outline" asChild><Link href="/billing/daily-collections">Daily collections</Link></Button><Button variant="outline" asChild><Link href="/billing/receipts">Print receipt</Link></Button></div></BillingPanel>
      </div>
    </div>
  </div>
}

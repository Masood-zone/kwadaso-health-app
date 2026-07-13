"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { LaboratoryPageHeader, LaboratoryPagination, LaboratoryState, StatusBadge } from "@/components/laboratory/laboratory-ui"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { useLaboratoryNotifications, useUpdateLaboratoryNotification } from "@/services/laboratory/notifications"
import { useLaboratoryPatientHistory } from "@/services/laboratory/history"

export function LaboratoryNotificationsPage() {
  const [page, setPage] = useState(1)
  const notifications = useLaboratoryNotifications(page)
  const update = useUpdateLaboratoryNotification()
  async function setStatus(id: string, status: "READ" | "ARCHIVED") {
    try { await update.mutateAsync({ id, payload: { status } }); toast.success(status === "READ" ? "Notification marked as read." : "Notification archived.") } catch (error) { toast.error(error instanceof Error ? error.message : "Notification update failed") }
  }
  return <>
    <LaboratoryPageHeader eyebrow="Laboratory Inbox" title="Notifications" description="Urgent requests, result corrections, critical findings, and laboratory workflow alerts for your facility." />
    <LaboratoryState loading={notifications.isLoading} error={notifications.isError} empty={!notifications.data?.items.length} />
    <div className="grid gap-3">{notifications.data?.items.map((item) => <section key={item.id} className={item.status === "UNREAD" ? "khms-card border-l-4 border-l-tertiary p-4" : "khms-card p-4 opacity-80"}><div className="flex flex-col justify-between gap-3 sm:flex-row"><div className="flex gap-3"><div className={item.type === "CRITICAL_ALERT" ? "flex size-10 shrink-0 items-center justify-center rounded bg-emergency-soft text-destructive" : "flex size-10 shrink-0 items-center justify-center rounded bg-accent-blue text-primary"}><MaterialSymbol icon={item.type === "CRITICAL_ALERT" ? "emergency" : "notifications"} className="text-2xl" /></div><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">{item.title}</h2><StatusBadge value={item.status} /><StatusBadge value={item.priority} /></div><p className="mt-1 text-sm text-muted-foreground">{item.body || "No additional detail."}</p><p className="mt-1 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</p></div></div><div className="flex shrink-0 gap-2">{item.actionUrl ? <Button size="sm" variant="outline" asChild><Link href={item.actionUrl}>Open</Link></Button> : null}{item.status === "UNREAD" ? <Button size="sm" onClick={() => void setStatus(item.id, "READ")}>Mark read</Button> : null}{item.status !== "ARCHIVED" ? <Button size="sm" variant="outline" onClick={() => void setStatus(item.id, "ARCHIVED")}>Archive</Button> : null}</div></div></section>)}</div>
    {notifications.data ? <LaboratoryPagination page={notifications.data.page} pageSize={notifications.data.pageSize} total={notifications.data.total} onPage={setPage} /> : null}
  </>
}

function TrendChart({ points }: { points: { date: string; value: number }[] }) {
  if (points.length < 2) return <p className="text-sm text-muted-foreground">More results are needed to display a trend.</p>
  const values = points.map((item) => item.value); const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1
  const coordinates = points.map((item, index) => `${10 + index * (280 / Math.max(points.length - 1, 1))},${90 - ((item.value - min) / range) * 70}`).join(" ")
  return <svg viewBox="0 0 300 110" className="h-32 w-full" role="img" aria-label="Laboratory result trend"><line x1="10" y1="90" x2="290" y2="90" stroke="var(--border)" /><polyline fill="none" stroke="var(--primary)" strokeWidth="3" points={coordinates} />{points.map((item, index) => <circle key={`${item.date}-${index}`} cx={10 + index * (280 / Math.max(points.length - 1, 1))} cy={90 - ((item.value - min) / range) * 70} r="4" fill="var(--primary)" />)}</svg>
}

export function LaboratoryPatientHistoryPage({ id }: { id: string }) {
  const history = useLaboratoryPatientHistory(id)
  const data = history.data
  return <>
    <LaboratoryPageHeader eyebrow="Read-only Patient Context" title={data?.patient.name ?? "Laboratory History"} description="Previous laboratory requests, specimens, released findings, abnormal history, and numeric parameter trends." actions={<Button variant="outline" asChild><Link href="/laboratory/requests">Back to requests</Link></Button>} />
    <LaboratoryState loading={history.isLoading} error={history.isError} />
    {data ? <div className="space-y-5"><section className="khms-card border-l-4 border-l-primary p-5"><div className="flex flex-wrap justify-between gap-4"><div><p className="khms-label">Patient</p><h2 className="text-2xl font-bold">{data.patient.name}</h2><p className="text-sm text-muted-foreground">{data.patient.patientNo} · {data.patient.gender} · {data.patient.age ?? "—"} years · {data.patient.bloodGroup}</p></div><div className="grid gap-2 text-sm sm:grid-cols-2"><div><p className="khms-label">Allergies</p><p>{data.patient.allergies.map((item) => item.allergen).join(", ") || "None recorded"}</p></div><div><p className="khms-label">Conditions</p><p>{data.patient.chronicConditions.map((item) => item.name).join(", ") || "None recorded"}</p></div></div></div></section><div className="grid gap-5 lg:grid-cols-2">{data.trends.slice(0, 6).map((trend) => <section key={`${trend.testName}-${trend.parameterName}`} className="khms-card p-5"><div className="flex justify-between"><div><h2 className="font-bold">{trend.parameterName}</h2><p className="text-xs text-muted-foreground">{trend.testName}</p></div><p className="text-2xl font-bold text-primary">{trend.points.at(-1)?.value}</p></div><TrendChart points={trend.points} /><div className="flex justify-between text-xs text-muted-foreground"><span>{new Date(trend.points[0].date).toLocaleDateString()}</span><span>{new Date(trend.points.at(-1)!.date).toLocaleDateString()}</span></div></section>)}</div><section className="khms-card overflow-hidden"><div className="p-5"><h2 className="text-lg font-bold">Comprehensive Result History</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[850px]"><thead className="bg-accent-blue"><tr className="khms-label text-left"><th className="px-4 py-3">Result</th><th className="px-4 py-3">Test</th><th className="px-4 py-3">Finding</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reported</th></tr></thead><tbody>{data.results.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3 font-semibold text-primary">{item.resultNo}</td><td className="px-4 py-3">{item.testName}</td><td className="px-4 py-3"><StatusBadge value={item.criticalFlag ? "CRITICAL" : item.abnormalFlag ? "ABNORMAL" : "NORMAL"} /></td><td className="px-4 py-3"><StatusBadge value={item.status} /></td><td className="px-4 py-3 text-sm">{new Date(item.releasedAt ?? item.validatedAt ?? item.enteredAt ?? "").toLocaleString()}</td></tr>)}</tbody></table></div></section></div> : null}
  </>
}

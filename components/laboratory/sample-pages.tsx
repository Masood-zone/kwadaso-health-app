"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LaboratoryMetricGrid, LaboratoryPageHeader, LaboratoryPagination, LaboratoryState, StatusBadge } from "@/components/laboratory/laboratory-ui"
import { SampleBarcode } from "@/components/laboratory/sample-barcode"
import { useLaboratoryLookups } from "@/services/laboratory/dashboard"
import { useLabSample, useLabSamples, useUpdateLabSample } from "@/services/laboratory/samples"
import type { SampleStatus } from "@/lib/generated/prisma/enums"

export function LabSamplesPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<SampleStatus | "">("")
  const [page, setPage] = useState(1)
  const samples = useLabSamples({ search, status: status || undefined, page })
  const lookups = useLaboratoryLookups()
  const items = samples.data?.items ?? []
  const metrics = [
    { label: "In Processing", value: String(items.filter((item) => item.status === "PROCESSING").length), detail: "Visible page", tone: "green" as const },
    { label: "Awaiting Receipt", value: String(items.filter((item) => item.status === "COLLECTED").length), detail: "Collected samples", tone: "orange" as const },
    { label: "Rejected", value: String(items.filter((item) => item.status === "REJECTED").length), detail: "Recollection required", tone: "red" as const },
    { label: "Completed Handling", value: String(items.filter((item) => ["STORED", "DISPOSED"].includes(item.status)).length), detail: "Stored or disposed", tone: "blue" as const },
  ]
  return <>
    <LaboratoryPageHeader eyebrow="Specimen Management" title="Sample Tracking" description="Track collection, receipt, processing, storage, rejection, and disposal without hard deletes." />
    <LaboratoryMetricGrid metrics={metrics} />
    <div className="khms-card my-5 flex flex-col gap-3 p-4 sm:flex-row"><Input className="sm:max-w-md" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} placeholder="Scan sample ID, patient, or request" /><select className="khms-input sm:w-56" value={status} onChange={(e) => setStatus(e.target.value as SampleStatus | "")}><option value="">All statuses</option>{lookups.data?.sampleStatuses.map((item) => <option key={item}>{item}</option>)}</select></div>
    <LaboratoryState loading={samples.isLoading} error={samples.isError} empty={!items.length} />
    {items.length ? <section className="khms-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className="bg-accent-blue"><tr className="khms-label text-left"><th className="px-4 py-3">Sample</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Request</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Collected</th><th className="px-4 py-3">Received</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3 font-semibold text-primary">{item.sampleNo}</td><td className="px-4 py-3"><p className="font-semibold">{item.patientName}</p><p className="text-xs text-muted-foreground">{item.patientNo}</p></td><td className="px-4 py-3 text-sm">{item.requestNo}</td><td className="px-4 py-3 text-sm">{item.sampleType}</td><td className="px-4 py-3"><StatusBadge value={item.status} /></td><td className="px-4 py-3 text-xs">{item.collectedAt ? new Date(item.collectedAt).toLocaleString() : "—"}<br />{item.collectedByName}</td><td className="px-4 py-3 text-xs">{item.receivedAt ? new Date(item.receivedAt).toLocaleString() : "—"}<br />{item.receivedByName}</td><td className="px-4 py-3"><Button size="sm" asChild><Link href={`/laboratory/samples/${item.id}`}>Track</Link></Button></td></tr>)}</tbody></table></div><LaboratoryPagination page={samples.data!.page} pageSize={samples.data!.pageSize} total={samples.data!.total} onPage={setPage} /></section> : null}
  </>
}

const nextActions: Partial<Record<SampleStatus, { label: string; status: SampleStatus }[]>> = {
  COLLECTED: [{ label: "Mark received", status: "RECEIVED" }, { label: "Reject sample", status: "REJECTED" }],
  RECEIVED: [{ label: "Start processing", status: "PROCESSING" }, { label: "Reject sample", status: "REJECTED" }],
  PROCESSING: [{ label: "Store sample", status: "STORED" }, { label: "Dispose sample", status: "DISPOSED" }],
  STORED: [{ label: "Dispose sample", status: "DISPOSED" }],
}

export function LabSampleDetailPage({ id }: { id: string }) {
  const sample = useLabSample(id)
  const update = useUpdateLabSample()
  const record = sample.data
  async function transition(status: SampleStatus) {
    const rejectionReason = status === "REJECTED" ? window.prompt("Enter the sample rejection reason") : null
    if (status === "REJECTED" && !rejectionReason) return
    try { await update.mutateAsync({ id, payload: { status, rejectionReason } }); toast.success(`Sample marked ${status.toLowerCase().replaceAll("_", " ")}.`) } catch (error) { toast.error(error instanceof Error ? error.message : "Sample update failed") }
  }
  return <>
    <LaboratoryPageHeader eyebrow="Sample Tracking" title={record?.sampleNo ?? "Sample details"} description="Authoritative sample status, collection and receipt metadata, related results, and printable identification." actions={<Button variant="outline" asChild><Link href="/laboratory/samples">Back to samples</Link></Button>} />
    <LaboratoryState loading={sample.isLoading} error={sample.isError} />
    {record ? <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      <div className="space-y-5"><section className="khms-card border-l-4 border-l-primary p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="khms-label">Patient</p><h2 className="text-xl font-bold">{record.patientName}</h2><p className="text-sm text-muted-foreground">{record.patientNo} · Request {record.requestNo}</p></div><StatusBadge value={record.status} /></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><div><p className="khms-label">Sample type</p><p className="font-semibold">{record.sampleType}</p></div><div><p className="khms-label">Collected</p><p className="text-sm">{record.collectedAt ? new Date(record.collectedAt).toLocaleString() : "—"}</p><p className="text-xs text-muted-foreground">{record.collectedByName}</p></div><div><p className="khms-label">Received</p><p className="text-sm">{record.receivedAt ? new Date(record.receivedAt).toLocaleString() : "—"}</p><p className="text-xs text-muted-foreground">{record.receivedByName}</p></div></div>{record.rejectionReason ? <div className="mt-4 rounded bg-emergency-soft p-3 text-sm text-destructive"><strong>Rejection reason:</strong> {record.rejectionReason}</div> : null}</section>
      <section className="khms-card p-5"><h2 className="text-lg font-bold">Status Timeline</h2><div className="mt-4 grid gap-4">{record.timeline.map((item, index) => <div key={`${item.at}-${index}`} className="flex gap-3"><span className="mt-1 size-3 rounded-full bg-primary" /><div><p className="font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString()} {item.detail ? `· ${item.detail}` : ""}</p></div></div>)}</div></section>
      <section className="khms-card overflow-hidden"><div className="p-5"><h2 className="text-lg font-bold">Related Results</h2></div>{record.relatedResults.length ? record.relatedResults.map((result) => <div key={result.id} className="flex items-center justify-between border-t p-4"><div><p className="font-semibold">{result.testName}</p><p className="text-xs text-muted-foreground">{result.resultNo}</p></div><div className="flex gap-2"><StatusBadge value={result.status} /><Button size="sm" variant="outline" asChild><Link href={`/laboratory/results/entry?resultId=${result.id}`}>Open</Link></Button></div></div>) : <p className="px-5 pb-5 text-sm text-muted-foreground">No results are linked to this sample yet.</p>}</section></div>
      <div className="space-y-5"><SampleBarcode value={record.sampleNo} patientName={record.patientName} sampleType={record.sampleType} /><section className="khms-card p-5"><h2 className="text-lg font-bold">Available Actions</h2><div className="mt-4 grid gap-2">{(nextActions[record.status] ?? []).map((action) => <Button key={action.status} variant={action.status === "REJECTED" || action.status === "DISPOSED" ? "destructive" : "default"} onClick={() => void transition(action.status)} disabled={update.isPending}>{action.label}</Button>)}{!nextActions[record.status]?.length ? <p className="text-sm text-muted-foreground">No further status changes are available.</p> : null}</div></section></div>
    </div> : null}
  </>
}

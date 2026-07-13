"use client"

import Link from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LaboratoryPageHeader, LaboratoryPagination, LaboratoryState, StatusBadge } from "@/components/laboratory/laboratory-ui"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { useLaboratoryLookups } from "@/services/laboratory/dashboard"
import { useLabRequest, useLabRequests, useUpdateLabRequest } from "@/services/laboratory/requests"
import { useCollectLabSample } from "@/services/laboratory/samples"
import type { LabPriority, LabRequestStatus } from "@/lib/generated/prisma/enums"

export function LabRequestQueuePage() {
  const [search, setSearch] = useState("")
  const [priority, setPriority] = useState<LabPriority | "">("")
  const [status, setStatus] = useState<LabRequestStatus | "">("")
  const [testId, setTestId] = useState("")
  const [clinicianId, setClinicianId] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [page, setPage] = useState(1)
  const queue = useLabRequests({ search, priority: priority || undefined, status: status || undefined, testId: testId || undefined, clinicianId: clinicianId || undefined, dateFrom: dateFrom || undefined, page })
  const lookups = useLaboratoryLookups()
  return <>
    <LaboratoryPageHeader eyebrow="Incoming Work" title="Laboratory Request Queue" description="Prioritized electronic requests from clinicians, scoped to your facility." />
    <div className="khms-card mb-4 grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6"><Input placeholder="Patient, ID, request…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} /><select className="khms-input" value={priority} onChange={(e) => setPriority(e.target.value as LabPriority | "")}><option value="">All priorities</option>{lookups.data?.priorities.map((item) => <option key={item}>{item}</option>)}</select><select className="khms-input" value={status} onChange={(e) => setStatus(e.target.value as LabRequestStatus | "")}><option value="">Active statuses</option>{lookups.data?.requestStatuses.map((item) => <option key={item}>{item}</option>)}</select><select className="khms-input" value={clinicianId} onChange={(e) => setClinicianId(e.target.value)}><option value="">All clinicians</option>{lookups.data?.clinicians.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="khms-input" value={testId} onChange={(e) => setTestId(e.target.value)}><option value="">All tests</option>{lookups.data?.tests.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
    <LaboratoryState loading={queue.isLoading} error={queue.isError} empty={queue.data?.items.length === 0} />
    {queue.data?.items.length ? <section className="khms-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead className="bg-accent-blue"><tr className="khms-label text-left"><th className="px-4 py-3">Request</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Requested tests</th><th className="px-4 py-3">Clinician</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{queue.data.items.map((item) => <tr key={item.id} className="border-t hover:bg-surface-container-low/50"><td className="px-4 py-3 font-semibold text-primary">{item.requestNo}</td><td className="px-4 py-3"><p className="font-semibold">{item.patientName}</p><p className="text-xs text-muted-foreground">{item.patientNo}</p></td><td className="max-w-xs px-4 py-3 text-sm">{item.requestedTests.join(", ")}</td><td className="px-4 py-3 text-sm">{item.requestedByName ?? "—"}</td><td className="px-4 py-3"><StatusBadge value={item.priority} /></td><td className="px-4 py-3"><StatusBadge value={item.status} /></td><td className="px-4 py-3 text-sm">{new Date(item.requestedAt).toLocaleString()}</td><td className="px-4 py-3"><Button size="sm" asChild><Link href={`/laboratory/requests/${item.id}`}>Review</Link></Button></td></tr>)}</tbody></table></div><LaboratoryPagination page={queue.data.page} pageSize={queue.data.pageSize} total={queue.data.total} onPage={setPage} /></section> : null}
  </>
}

export function LabRequestDetailPage({ id }: { id: string }) {
  const requestQuery = useLabRequest(id)
  const collect = useCollectLabSample()
  const update = useUpdateLabRequest()
  const [sampleType, setSampleType] = useState("")
  const [sampleNotes, setSampleNotes] = useState("")
  const record = requestQuery.data
  async function collectSample() {
    if (!sampleType.trim()) return toast.error("Enter the sample type.")
    try { await collect.mutateAsync({ requestId: id, payload: { sampleType, notes: sampleNotes || null } }); toast.success("Sample collected and barcode generated.") } catch (error) { toast.error(error instanceof Error ? error.message : "Sample collection failed") }
  }
  async function startProcessing() {
    try { await update.mutateAsync({ id, payload: { status: "PROCESSING" } }); toast.success("Request moved to processing.") } catch (error) { toast.error(error instanceof Error ? error.message : "Request update failed") }
  }
  async function cancel() {
    const reason = window.prompt("Why is this request being cancelled?")
    if (!reason) return
    try { await update.mutateAsync({ id, payload: { status: "CANCELLED", cancellationReason: reason } }); toast.success("Request cancelled.") } catch (error) { toast.error(error instanceof Error ? error.message : "Cancellation failed") }
  }
  return <>
    <LaboratoryPageHeader eyebrow="Lab Request" title={record?.requestNo ?? "Request details"} description="Patient context, requested diagnostics, sample activity, results, and full laboratory timeline." actions={<Button variant="outline" asChild><Link href="/laboratory/requests">Back to queue</Link></Button>} />
    <LaboratoryState loading={requestQuery.isLoading} error={requestQuery.isError} />
    {record ? <div className="space-y-5">
      <section className="khms-card border-l-4 border-l-primary p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row"><div><div className="flex flex-wrap items-center gap-3"><h2 className="text-2xl font-bold">{record.patient.name}</h2><StatusBadge value={record.priority} /><StatusBadge value={record.status} /></div><p className="mt-2 text-sm text-muted-foreground">{record.patient.patientNo} · {record.patient.gender} · {record.patient.age ?? "—"} years · {record.patient.bloodGroup}</p></div><div className="text-sm lg:text-right"><p className="khms-label">Requested by</p><p className="font-semibold">{record.requestedByName ?? "Unassigned"}</p><p className="text-muted-foreground">{new Date(record.requestedAt).toLocaleString()}</p></div></div></section>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5"><section className="khms-card overflow-hidden"><div className="border-b p-4"><h2 className="text-lg font-bold">Requested Tests</h2></div>{record.tests.map((test) => <div key={test.id} className="flex flex-col justify-between gap-3 border-t px-4 py-4 first:border-0 sm:flex-row sm:items-center"><div><p className="font-semibold">{test.name}</p><p className="text-xs text-muted-foreground">{test.code} · {test.sampleType ?? "Sample type not specified"}</p></div><div className="flex items-center gap-2"><StatusBadge value={test.resultStatus ?? "AWAITING SAMPLE"} />{test.resultId ? <Button size="sm" variant="outline" asChild><Link href={`/laboratory/results/entry?resultId=${test.resultId}`}>Open result</Link></Button> : record.samples.some((sample) => ["RECEIVED", "PROCESSING", "STORED"].includes(sample.status)) ? <Button size="sm" asChild><Link href={`/laboratory/results/entry?requestId=${record.id}&requestTestId=${test.id}`}>Enter result</Link></Button> : null}</div></div>)}</section><section className="khms-card p-5"><h2 className="text-lg font-bold">Clinical Context</h2><p className="mt-3 whitespace-pre-wrap rounded bg-surface-container-low p-4 text-sm italic">{record.clinicalNotes || "No clinical notes were attached."}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><div><p className="khms-label">Allergies</p><p className="text-sm">{record.patient.allergies.map((item) => item.allergen).join(", ") || "None recorded"}</p></div><div><p className="khms-label">Chronic conditions</p><p className="text-sm">{record.patient.chronicConditions.map((item) => item.name).join(", ") || "None recorded"}</p></div></div></section></div>
        <div className="space-y-5"><section className="khms-card p-5"><h2 className="text-lg font-bold">Request Actions</h2>{record.status === "REQUESTED" ? <div className="mt-4 space-y-3"><Input placeholder="Sample type (e.g. Whole Blood EDTA)" value={sampleType} onChange={(e) => setSampleType(e.target.value)} /><textarea className="khms-input min-h-20 w-full py-2" placeholder="Collection notes" value={sampleNotes} onChange={(e) => setSampleNotes(e.target.value)} /><Button className="w-full" onClick={() => void collectSample()} disabled={collect.isPending}><MaterialSymbol icon="experiment" />Collect sample</Button><Button className="w-full" variant="destructive" onClick={() => void cancel()}>Cancel request</Button></div> : null}{record.status === "SAMPLE_COLLECTED" ? <Button className="mt-4 w-full" onClick={() => void startProcessing()}><MaterialSymbol icon="play_arrow" />Start processing</Button> : null}{["PARTIAL_RESULT", "PROCESSING"].includes(record.status) ? <p className="mt-3 text-sm text-muted-foreground">Continue result entry and validation. The request completes only after every result is released.</p> : null}</section><section className="khms-card p-5"><h2 className="text-lg font-bold">Timeline</h2><div className="mt-4 space-y-4">{record.timeline.map((item, index) => <div key={`${item.at}-${index}`} className="flex gap-3"><span className="mt-1 size-3 rounded-full bg-primary" /><div><p className="text-sm font-semibold">{item.label}</p><p className="text-xs text-muted-foreground">{new Date(item.at).toLocaleString()} {item.detail ? `· ${item.detail}` : ""}</p></div></div>)}</div></section></div>
      </div>
    </div> : null}
  </>
}

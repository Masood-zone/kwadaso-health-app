"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LaboratoryPageHeader, LaboratoryPagination, LaboratoryState, StatusBadge } from "@/components/laboratory/laboratory-ui"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { useLabRequest } from "@/services/laboratory/requests"
import { useCreateLabResult, useLabResult, useLabResults, useReleaseLabResult, useSendCriticalAlert, useUpdateLabResult, useValidateLabResult } from "@/services/laboratory/results"
import type { LabRequestDetail, LabRequestTestDetail, LabResultDetail, LabResultParameterPayload } from "@/types/laboratory"

function ResultForm({ existing, request, test }: { existing?: LabResultDetail; request?: LabRequestDetail; test?: LabRequestTestDetail }) {
  const usableSamples = request?.samples.filter((item) => ["RECEIVED", "PROCESSING", "STORED"].includes(item.status)) ?? []
  const definitions = existing?.parameterDefinitions ?? test?.parameterDefinitions ?? []
  const [sampleId, setSampleId] = useState(existing?.sampleId ?? usableSamples[0]?.id ?? "")
  const [resultText, setResultText] = useState(existing?.resultText ?? "")
  const [notes, setNotes] = useState(existing?.notes ?? "")
  const [parameters, setParameters] = useState<LabResultParameterPayload[]>(existing?.parameters.length ? existing.parameters : definitions.map((item) => ({ parameterDefinitionId: item.id, parameterName: item.name, value: "", unit: item.unit, referenceRange: item.referenceRange, isAbnormal: false, isCritical: false })))
  const create = useCreateLabResult()
  const update = useUpdateLabResult()
  const busy = create.isPending || update.isPending
  const readOnly = Boolean(existing && !["DRAFT", "ENTERED", "REJECTED"].includes(existing.status))

  function patchParameter(index: number, patch: Partial<LabResultParameterPayload>) {
    setParameters((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }
  function addParameter() {
    setParameters((current) => [...current, { parameterName: "", value: "", isAbnormal: false, isCritical: false }])
  }
  async function save(status: "DRAFT" | "ENTERED") {
    if (!sampleId) return toast.error("Select a received or processing sample.")
    const payload = { labSampleId: sampleId, resultText: resultText || null, notes: notes || null, status, parameters }
    try {
      if (existing) await update.mutateAsync({ id: existing.id, payload })
      else if (test) await create.mutateAsync({ requestTestId: test.id, payload })
      else return
      toast.success(status === "ENTERED" ? "Result submitted for validation." : "Draft result saved.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "Result could not be saved") }
  }
  return <fieldset disabled={readOnly} className="space-y-5">
    {readOnly ? <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm font-semibold text-primary">This validated or released result is read-only.</div> : null}
    <section className="khms-card border-l-4 border-l-primary p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row"><div><p className="khms-label">Patient</p><h2 className="text-xl font-bold">{existing?.patientName ?? request?.patient.name}</h2><p className="text-sm text-muted-foreground">{existing?.patientNo ?? request?.patient.patientNo}</p></div><div className="lg:text-right"><p className="khms-label">Test requisition</p><p className="text-lg font-bold">{existing?.testName ?? test?.name}</p><StatusBadge value={existing?.status ?? request?.priority ?? "DRAFT"} /></div></div><div className="mt-4 max-w-lg"><label className="khms-label" htmlFor="result-sample">Source sample</label>{existing ? <p className="mt-1 font-semibold">{existing.sampleNo}</p> : <select id="result-sample" className="khms-input mt-1 w-full" value={sampleId} onChange={(e) => setSampleId(e.target.value)}><option value="">Select sample</option>{usableSamples.map((sample) => <option key={sample.id} value={sample.id}>{sample.sampleNo} · {sample.sampleType} · {sample.status}</option>)}</select>}</div></section>
    <section className="khms-card overflow-hidden"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-bold">Result Parameters</h2><p className="text-sm text-muted-foreground">Reference and critical thresholds are enforced again by the server.</p></div><Button variant="outline" size="sm" onClick={addParameter}>Add parameter</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead className="bg-accent-blue"><tr className="khms-label text-left"><th className="px-4 py-3">Parameter</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Reference range</th><th className="px-4 py-3">Abnormal</th><th className="px-4 py-3">Critical</th></tr></thead><tbody>{parameters.map((item, index) => <tr key={item.parameterDefinitionId ?? index} className={item.isCritical ? "border-t bg-emergency-soft" : item.isAbnormal ? "border-t bg-pending-soft" : "border-t"}><td className="px-4 py-3"><Input value={item.parameterName} disabled={Boolean(item.parameterDefinitionId)} onChange={(e) => patchParameter(index, { parameterName: e.target.value })} /></td><td className="px-4 py-3"><Input value={item.value ?? ""} onChange={(e) => patchParameter(index, { value: e.target.value })} /></td><td className="px-4 py-3"><Input value={item.unit ?? ""} onChange={(e) => patchParameter(index, { unit: e.target.value })} /></td><td className="px-4 py-3"><Input value={item.referenceRange ?? ""} onChange={(e) => patchParameter(index, { referenceRange: e.target.value })} /></td><td className="px-4 py-3 text-center"><input type="checkbox" checked={Boolean(item.isAbnormal)} onChange={(e) => patchParameter(index, { isAbnormal: e.target.checked })} /></td><td className="px-4 py-3 text-center"><input type="checkbox" checked={Boolean(item.isCritical)} onChange={(e) => patchParameter(index, { isCritical: e.target.checked, isAbnormal: e.target.checked || item.isAbnormal })} /></td></tr>)}</tbody></table></div></section>
    <section className="khms-card grid gap-4 p-5 lg:grid-cols-2"><div><label className="khms-label" htmlFor="result-text">Result summary or qualitative result</label><textarea id="result-text" className="khms-input mt-1 min-h-28 w-full py-3" value={resultText} onChange={(e) => setResultText(e.target.value)} /></div><div><label className="khms-label" htmlFor="result-notes">Technician notes</label><textarea id="result-notes" className="khms-input mt-1 min-h-28 w-full py-3" value={notes} onChange={(e) => setNotes(e.target.value)} /></div><div className="flex flex-wrap gap-3 lg:col-span-2 lg:justify-end"><Button variant="outline" onClick={() => void save("DRAFT")} disabled={busy}>Save draft</Button><Button onClick={() => void save("ENTERED")} disabled={busy}><MaterialSymbol icon="send" />Save & send for validation</Button></div></section>
  </fieldset>
}

export function LabResultEntryPage() {
  const searchParams = useSearchParams()
  const resultId = searchParams.get("resultId") ?? undefined
  const requestId = searchParams.get("requestId") ?? undefined
  const requestTestId = searchParams.get("requestTestId") ?? undefined
  const result = useLabResult(resultId)
  const request = useLabRequest(requestId)
  const rejected = useLabResults({ status: "REJECTED", pageSize: 25 })
  const test = request.data?.tests.find((item) => item.id === requestTestId)
  const loading = Boolean(resultId) ? result.isLoading : Boolean(requestId) ? request.isLoading : rejected.isLoading
  const error = Boolean(resultId) ? result.isError : Boolean(requestId) ? request.isError : rejected.isError
  return <>
    <LaboratoryPageHeader eyebrow="Result Entry" title={result.data ? `Result ${result.data.resultNo}` : test ? test.name : "Laboratory Result Entry"} description="Enter structured or qualitative results, review reference ranges, flag abnormal values, and submit for validation." actions={<Button variant="outline" asChild><Link href="/laboratory/requests">Choose from requests</Link></Button>} />
    <LaboratoryState loading={loading} error={error} />
    {result.data ? <ResultForm key={result.data.id} existing={result.data} /> : request.data && test ? <ResultForm key={test.id} request={request.data} test={test} /> : !loading && !requestId && !resultId ? <section className="khms-card overflow-hidden"><div className="p-5"><h2 className="text-lg font-bold">Results Returned for Correction</h2><p className="text-sm text-muted-foreground">Open a rejected result or choose a processing request to enter a new result.</p></div>{rejected.data?.items.length ? rejected.data.items.map((item) => <div key={item.id} className="flex items-center justify-between border-t p-4"><div><p className="font-semibold">{item.patientName} · {item.testName}</p><p className="text-xs text-muted-foreground">{item.resultNo}</p></div><Button size="sm" asChild><Link href={`/laboratory/results/entry?resultId=${item.id}`}>Correct result</Link></Button></div>) : <p className="px-5 pb-5 text-sm text-muted-foreground">No results are waiting for correction.</p>}</section> : !loading ? <LaboratoryState empty emptyText="Select a valid request test or result." /> : null}
  </>
}

function ValidationReview({ id, onClose }: { id: string; onClose: () => void }) {
  const result = useLabResult(id)
  const validate = useValidateLabResult()
  const sendAlert = useSendCriticalAlert()
  const [note, setNote] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  async function decide(decision: "VALIDATE" | "REJECT") {
    try { await validate.mutateAsync({ id, payload: { decision, note: note || null, criticalConfirmed: confirmed } }); toast.success(decision === "VALIDATE" ? "Result validated." : "Result returned for correction."); onClose() } catch (error) { toast.error(error instanceof Error ? error.message : "Review failed") }
  }
  async function alert() {
    const reason = window.prompt("Describe the confirmed critical finding")
    if (!reason) return
    try { await sendAlert.mutateAsync({ id, payload: { confirmed: true, reason } }); toast.success("Critical alert sent to clinician and Hospital Admin.") } catch (error) { toast.error(error instanceof Error ? error.message : "Alert failed") }
  }
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"><section className="max-h-[95vh] w-full max-w-4xl overflow-y-auto rounded-t-xl bg-white p-5 sm:rounded-xl"><div className="flex items-start justify-between gap-3"><div><p className="khms-label">Validation Review</p><h2 className="text-xl font-bold">{result.data?.patientName} · {result.data?.testName}</h2></div><Button variant="outline" size="sm" onClick={onClose}>Close</Button></div><LaboratoryState loading={result.isLoading} error={result.isError} />{result.data ? <div className="mt-5 space-y-5"><div className="overflow-hidden rounded border"><table className="w-full"><thead className="bg-accent-blue"><tr className="khms-label text-left"><th className="px-3 py-2">Parameter</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Status</th></tr></thead><tbody>{result.data.parameters.map((item) => <tr key={item.id} className={item.isCritical ? "border-t bg-emergency-soft" : item.isAbnormal ? "border-t bg-pending-soft" : "border-t"}><td className="px-3 py-3 font-semibold">{item.parameterName}</td><td className="px-3 py-3">{item.value || "—"} {item.unit}</td><td className="px-3 py-3">{item.referenceRange || "—"}</td><td className="px-3 py-3"><StatusBadge value={item.isCritical ? "CRITICAL" : item.isAbnormal ? "ABNORMAL" : "NORMAL"} /></td></tr>)}</tbody></table></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded bg-surface-container-low p-4"><p className="khms-label">Technician notes</p><p className="mt-2 text-sm">{result.data.notes || "No note supplied."}</p></div><div className="rounded bg-surface-container-low p-4"><p className="khms-label">Clinical context</p><p className="mt-2 text-sm">Conditions: {result.data.clinicalContext.chronicConditions.join(", ") || "None recorded"}</p><p className="text-sm">Medications: {result.data.clinicalContext.medications.join(", ") || "None recorded"}</p></div></div><textarea className="khms-input min-h-24 w-full py-3" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Validation or correction note" />{result.data.criticalFlag ? <label className="flex items-center gap-2 rounded bg-emergency-soft p-3 text-sm font-semibold text-destructive"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I independently confirmed the critical value</label> : null}<div className="flex flex-wrap justify-end gap-2">{result.data.criticalFlag ? <Button variant="destructive" onClick={() => void alert()}>Send critical alert</Button> : null}<Button variant="outline" onClick={() => void decide("REJECT")}>Reject for correction</Button><Button onClick={() => void decide("VALIDATE")}>Validate result</Button></div></div> : null}</section></div>
}

export function LabValidationPage() {
  const [reviewId, setReviewId] = useState<string | null>(null)
  const entered = useLabResults({ status: "ENTERED", pageSize: 50 })
  const validated = useLabResults({ status: "VALIDATED", pageSize: 50 })
  const release = useReleaseLabResult()
  async function releaseResult(id: string) {
    try { await release.mutateAsync({ id, payload: {} }); toast.success("Result released to the clinician.") } catch (error) { toast.error(error instanceof Error ? error.message : "Release failed") }
  }
  return <>
    <LaboratoryPageHeader eyebrow="Quality Review" title="Validation & Release Queue" description="Review entered findings, return corrections, validate complete results, and release validated results as separate audited actions." />
    <LaboratoryState loading={entered.isLoading || validated.isLoading} error={entered.isError || validated.isError} empty={!entered.data?.items.length && !validated.data?.items.length} />
    <div className="grid gap-5 xl:grid-cols-2"><section className="khms-card overflow-hidden"><div className="p-5"><h2 className="text-lg font-bold">Awaiting Validation</h2></div>{entered.data?.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-t p-4"><div><p className="font-semibold">{item.patientName} · {item.testName}</p><div className="mt-1 flex gap-2"><StatusBadge value={item.criticalFlag ? "CRITICAL" : item.abnormalFlag ? "ABNORMAL" : "NORMAL"} /><span className="text-xs text-muted-foreground">{item.enteredByName}</span></div></div><Button size="sm" onClick={() => setReviewId(item.id)}>Review</Button></div>)}</section><section className="khms-card overflow-hidden"><div className="p-5"><h2 className="text-lg font-bold">Validated — Ready for Release</h2></div>{validated.data?.items.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 border-t p-4"><div><p className="font-semibold">{item.patientName} · {item.testName}</p><p className="text-xs text-muted-foreground">Validated by {item.validatedByName}</p></div><Button size="sm" onClick={() => void releaseResult(item.id)} disabled={release.isPending}>Release</Button></div>)}</section></div>
    {reviewId ? <ValidationReview id={reviewId} onClose={() => setReviewId(null)} /> : null}
  </>
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
}

export function ReleasedResultsPage() {
  const [search, setSearch] = useState("")
  const [critical, setCritical] = useState<boolean | undefined>()
  const [page, setPage] = useState(1)
  const results = useLabResults({ status: "RELEASED", search, critical, page })
  const rows = results.data?.items ?? []
  return <>
    <LaboratoryPageHeader eyebrow="Patient EHR" title="Released Results" description="Immutable laboratory findings already available to the ordering clinician and patient record." actions={<><Button variant="outline" onClick={() => window.print()}><MaterialSymbol icon="print" />Print view</Button><Button onClick={() => downloadCsv("released-lab-results.csv", [["Result No", "Patient", "Patient ID", "Test", "Status", "Released At"], ...rows.map((item) => [item.resultNo, item.patientName, item.patientNo, item.testName, item.status, item.releasedAt ?? ""])])}><MaterialSymbol icon="download" />Export CSV</Button></>} />
    <div className="khms-card mb-5 flex flex-col gap-3 p-4 sm:flex-row"><Input className="sm:max-w-md" placeholder="Patient, ID, result number" value={search} onChange={(e) => setSearch(e.target.value)} /><select className="khms-input sm:w-52" value={critical === undefined ? "" : String(critical)} onChange={(e) => setCritical(e.target.value === "" ? undefined : e.target.value === "true")}><option value="">All findings</option><option value="false">Non-critical</option><option value="true">Critical only</option></select></div>
    <LaboratoryState loading={results.isLoading} error={results.isError} empty={!rows.length} />{rows.length ? <section className="khms-card overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[900px]"><thead className="bg-accent-blue"><tr className="khms-label text-left"><th className="px-4 py-3">Result</th><th className="px-4 py-3">Patient</th><th className="px-4 py-3">Test</th><th className="px-4 py-3">Finding</th><th className="px-4 py-3">Released</th><th className="px-4 py-3">Action</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3 font-semibold text-primary">{item.resultNo}</td><td className="px-4 py-3"><p className="font-semibold">{item.patientName}</p><p className="text-xs text-muted-foreground">{item.patientNo}</p></td><td className="px-4 py-3">{item.testName}</td><td className="px-4 py-3"><StatusBadge value={item.criticalFlag ? "CRITICAL" : item.abnormalFlag ? "ABNORMAL" : "NORMAL"} /></td><td className="px-4 py-3 text-sm">{item.releasedAt ? new Date(item.releasedAt).toLocaleString() : "—"}</td><td className="px-4 py-3"><Button size="sm" variant="outline" asChild><Link href={`/laboratory/results/entry?resultId=${item.id}`}>View</Link></Button></td></tr>)}</tbody></table></div><LaboratoryPagination page={results.data!.page} pageSize={results.data!.pageSize} total={results.data!.total} onPage={setPage} /></section> : null}
  </>
}

export function CriticalResultsPage() {
  const results = useLabResults({ critical: true, pageSize: 100 })
  const alert = useSendCriticalAlert()
  async function send(id: string) {
    const reason = window.prompt("Confirm the critical finding and enter the alert reason")
    if (!reason) return
    try { await alert.mutateAsync({ id, payload: { confirmed: true, reason } }); toast.success("Critical alert sent or already active.") } catch (error) { toast.error(error instanceof Error ? error.message : "Alert failed") }
  }
  return <>
    <LaboratoryPageHeader eyebrow="Immediate Action" title="Critical Results" description="Confirmed critical findings and in-app escalation to ordering clinicians and Hospital Administrators." />
    <LaboratoryState loading={results.isLoading} error={results.isError} empty={!results.data?.items.length} />
    <div className="grid gap-4">{results.data?.items.map((item) => <section key={item.id} className="khms-card border-l-4 border-l-destructive p-5"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{item.patientName}</h2><StatusBadge value="CRITICAL" /><StatusBadge value={item.status} />{item.criticalAlert?.sent ? <StatusBadge value={item.criticalAlert.acknowledged ? "ACKNOWLEDGED" : "ALERT SENT"} /> : <StatusBadge value="NOT ALERTED" />}</div><p className="mt-1 text-sm text-muted-foreground">{item.patientNo} · {item.testName} · {item.resultNo}</p><p className="mt-2 font-semibold text-destructive">{item.resultText || "Critical structured parameter result"}</p><p className="text-xs text-muted-foreground">Ordering clinician: {item.requestedByName ?? "Unavailable"}</p></div><div className="flex gap-2"><Button variant="outline" asChild><Link href={`/laboratory/results/entry?resultId=${item.id}`}>View result</Link></Button><Button variant="destructive" onClick={() => void send(item.id)} disabled={alert.isPending || item.criticalAlert?.sent}>Notify & escalate</Button></div></div></section>)}</div>
  </>
}

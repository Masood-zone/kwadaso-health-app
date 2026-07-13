"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import {
  DashboardError,
  StatusBadge,
} from "@/components/dashboard/dashboard-widgets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatEnum } from "@/components/super-admin/super-admin-ui"
import {
  useClinicianEncounter,
  useClinicianLookups,
  useCompleteEncounter,
  useCreateFollowUp,
  useCreateLabRequest,
  useCreatePrescription,
  useCreateReferral,
  useDeleteDiagnosis,
  useSaveClinicalNote,
  useSaveDiagnosis,
} from "@/services/clinician/clinician"
import type { PrescriptionItemPayload } from "@/types/clinician"

const tabs = [
  "Review",
  "Clinical Notes",
  "Diagnosis",
  "Lab Request",
  "Prescription",
  "Follow-Up",
  "Referral",
  "Summary",
] as const
type EncounterTab = (typeof tabs)[number]

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Clinical action failed."
}

function dateTime(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("en-GH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function Section({
  title,
  icon,
  children,
  actions,
}: {
  title: string
  icon: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="khms-card overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b bg-white px-5 py-4">
        <div className="flex items-center gap-3">
          <MaterialSymbol icon={icon} className="text-[23px] text-primary" />
          <h2 className="font-heading text-xl font-semibold">{title}</h2>
        </div>
        {actions}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      {children}
    </label>
  )
}

export function EncounterWorkspace({
  encounterId,
  initialTab = "Review",
}: {
  encounterId: string
  initialTab?: EncounterTab
}) {
  const query = useClinicianEncounter(encounterId)
  const [tab, setTab] = useState<EncounterTab>(initialTab)
  if (query.isLoading)
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="khms-card h-32 animate-pulse bg-muted" />
        ))}
      </div>
    )
  if (query.isError || !query.data)
    return <DashboardError message="Clinical encounter could not be loaded." />
  const encounter = query.data
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-outline-variant bg-accent-blue px-4 py-3 text-primary">
        <div className="flex flex-wrap items-center gap-3 font-semibold">
          <MaterialSymbol icon="patient_list" /> Patient Context:{" "}
          {encounter.patient.name}
          <span className="rounded bg-white px-2 py-1 text-xs">
            {encounter.patient.patientNo}
          </span>
          <StatusBadge value={formatEnum(encounter.status)} />
        </div>
        {encounter.patient.allergies.length ? (
          <span className="khms-badge bg-emergency-soft text-emergency-dark">
            Allergies:{" "}
            {encounter.patient.allergies
              .map((item) => item.allergen)
              .join(", ")}
          </span>
        ) : null}
      </div>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="khms-label">Encounter {encounter.encounterNo}</p>
          <h1 className="font-heading text-3xl font-bold">
            {encounter.chiefComplaint || "Clinical Consultation"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {encounter.departmentName} · Started {dateTime(encounter.startedAt)}{" "}
            · {encounter.clinicianName ?? "Unassigned"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/clinician/patients/${encounter.patientId}`}>
              Full history
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <MaterialSymbol icon="print" /> Print
          </Button>
        </div>
      </div>
      {!encounter.canEdit ? (
        <div className="rounded border border-pending-soft bg-pending-soft p-3 text-sm font-semibold text-tertiary-container">
          This encounter is read-only because it is assigned to another
          clinician or has been finalized.
        </div>
      ) : null}
      <div className="flex gap-2 overflow-x-auto border-b pb-2 print:hidden">
        {tabs.map((item) => (
          <Button
            key={item}
            size="sm"
            variant={tab === item ? "default" : "ghost"}
            onClick={() => setTab(item)}
          >
            {item}
          </Button>
        ))}
      </div>
      {tab === "Review" ? (
        <Review encounter={encounter} />
      ) : tab === "Clinical Notes" ? (
        <Notes
          encounterId={encounterId}
          canEdit={encounter.canEdit}
          notes={encounter.clinicalNotes}
        />
      ) : tab === "Diagnosis" ? (
        <Diagnoses
          encounterId={encounterId}
          canEdit={encounter.canEdit}
          diagnoses={encounter.diagnoses}
        />
      ) : tab === "Lab Request" ? (
        <LabRequest
          encounterId={encounterId}
          canEdit={encounter.canEdit}
          requests={encounter.labRequests}
        />
      ) : tab === "Prescription" ? (
        <Prescription
          encounterId={encounterId}
          canEdit={encounter.canEdit}
          allergies={encounter.patient.allergies.map((item) => item.allergen)}
          prescriptions={encounter.prescriptions}
        />
      ) : tab === "Follow-Up" ? (
        <FollowUp encounterId={encounterId} canEdit={encounter.canEdit} />
      ) : tab === "Referral" ? (
        <Referral encounterId={encounterId} canEdit={encounter.canEdit} />
      ) : (
        <Summary encounterId={encounterId} />
      )}
    </div>
  )
}

function Review({
  encounter,
}: {
  encounter: NonNullable<ReturnType<typeof useClinicianEncounter>["data"]>
}) {
  const latest = encounter.patient.vitalSigns[0]
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Section title="Presenting Clinical Context" icon="clinical_notes">
          <dl className="grid gap-4 md:grid-cols-3">
            <div>
              <dt className="khms-label">Chief complaint</dt>
              <dd className="mt-1 font-semibold">
                {encounter.chiefComplaint || "Not recorded"}
              </dd>
            </div>
            <div>
              <dt className="khms-label">Visit type</dt>
              <dd className="mt-1 font-semibold">
                {formatEnum(encounter.visitType)}
              </dd>
            </div>
            <div>
              <dt className="khms-label">Department</dt>
              <dd className="mt-1 font-semibold">{encounter.departmentName}</dd>
            </div>
          </dl>
        </Section>
        <Section title="Clinical History" icon="history">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="khms-label">Chronic conditions</p>
              <div className="mt-2 space-y-2">
                {encounter.patient.chronicConditions.length ? (
                  encounter.patient.chronicConditions.map((item) => (
                    <div
                      key={item.id}
                      className="rounded bg-pending-soft p-3 text-sm font-semibold"
                    >
                      {item.name} · {item.status}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    None recorded.
                  </p>
                )}
              </div>
            </div>
            <div>
              <p className="khms-label">Medication history</p>
              <div className="mt-2 space-y-2">
                {encounter.patient.medicationHistory.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="rounded bg-surface-container-low p-3 text-sm"
                  >
                    <span className="font-semibold">{item.medicationName}</span>{" "}
                    {item.dosage} {item.frequency}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Section>
        <Section title="Recent Clinical Activity" icon="timeline">
          <div className="space-y-3">
            {encounter.patient.encounters.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex justify-between rounded border p-3"
              >
                <div>
                  <p className="font-semibold">{item.encounterNo}</p>
                  <p className="text-sm text-muted-foreground">
                    {item.chiefComplaint ?? item.departmentName}
                  </p>
                </div>
                <StatusBadge value={formatEnum(item.status)} />
              </div>
            ))}
          </div>
        </Section>
      </div>
      <aside className="space-y-5">
        <Section title="Latest Vitals" icon="vital_signs">
          {latest ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                [
                  "BP",
                  `${latest.systolicBp ?? "--"}/${latest.diastolicBp ?? "--"}`,
                ],
                ["Pulse", `${latest.pulseRate ?? "--"} bpm`],
                ["Temp", `${latest.temperatureC ?? "--"} °C`],
                ["SpO2", `${latest.oxygenSaturation ?? "--"}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded bg-accent-blue p-3">
                  <p className="khms-label">{label}</p>
                  <p className="mt-1 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No vitals captured.</p>
          )}
        </Section>
        <Section title="Safety Alerts" icon="warning">
          <div className="space-y-3">
            {encounter.patient.allergies.map((item) => (
              <div
                key={item.id}
                className="rounded bg-emergency-soft p-3 text-sm text-emergency-dark"
              >
                <p className="font-semibold">{item.allergen}</p>
                <p>
                  {item.reaction || "Reaction not recorded"} ·{" "}
                  {formatEnum(item.severity)}
                </p>
              </div>
            ))}
            {!encounter.patient.allergies.length ? (
              <p className="text-sm text-muted-foreground">
                No allergies recorded.
              </p>
            ) : null}
          </div>
        </Section>
      </aside>
    </div>
  )
}

function Notes({
  encounterId,
  canEdit,
  notes,
}: {
  encounterId: string
  canEdit: boolean
  notes: NonNullable<
    ReturnType<typeof useClinicianEncounter>["data"]
  >["clinicalNotes"]
}) {
  const save = useSaveClinicalNote(encounterId)
  const [form, setForm] = useState({
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
    notes: "",
  })
  async function submit(sign: boolean) {
    try {
      await save.mutateAsync({ payload: { ...form, sign } })
      setForm({
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        notes: "",
      })
      toast.success(
        sign ? "Clinical note signed and locked." : "Clinical note draft saved."
      )
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Section title="SOAP Clinical Note" icon="edit_note">
        <div className="grid gap-4">
          {(
            [
              ["subjective", "Subjective — symptoms and history"],
              ["objective", "Objective — examination findings"],
              ["assessment", "Assessment — clinical impression"],
              ["plan", "Plan — treatment and follow-up"],
              ["notes", "Additional notes"],
            ] as const
          ).map(([key, label]) => (
            <Field key={key} label={label}>
              <textarea
                className="khms-input min-h-28 py-3"
                disabled={!canEdit}
                value={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.value })
                }
              />
            </Field>
          ))}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="outline"
              disabled={!canEdit || save.isPending}
              onClick={() => submit(false)}
            >
              Save draft
            </Button>
            <Button
              disabled={!canEdit || save.isPending || !form.assessment.trim()}
              onClick={() => submit(true)}
            >
              <MaterialSymbol icon="verified" /> Sign note
            </Button>
          </div>
        </div>
      </Section>
      <aside>
        <Section title="Existing Notes" icon="history">
          <div className="space-y-3">
            {notes.length ? (
              notes.map((note) => (
                <article key={note.id} className="rounded border p-3">
                  <div className="flex justify-between gap-2">
                    <p className="font-semibold">
                      {note.signedAt ? "Signed" : "Draft"}
                    </p>
                    <StatusBadge value={note.signedAt ? "LOCKED" : "DRAFT"} />
                  </div>
                  <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">
                    {note.assessment || note.subjective || "No summary"}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {dateTime(note.createdAt)} · {note.authoredByName}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No notes recorded.
              </p>
            )}
          </div>
        </Section>
      </aside>
    </div>
  )
}

function Diagnoses({
  encounterId,
  canEdit,
  diagnoses,
}: {
  encounterId: string
  canEdit: boolean
  diagnoses: NonNullable<
    ReturnType<typeof useClinicianEncounter>["data"]
  >["diagnoses"]
}) {
  const save = useSaveDiagnosis(encounterId)
  const remove = useDeleteDiagnosis(encounterId)
  const [form, setForm] = useState({
    code: "",
    name: "",
    notes: "",
    isPrimary: diagnoses.length === 0,
  })
  async function submit() {
    try {
      await save.mutateAsync({ payload: form })
      setForm({ code: "", name: "", notes: "", isPrimary: false })
      toast.success("Diagnosis added.")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Section title="Encounter Diagnoses" icon="diagnosis">
        <div className="space-y-3">
          {diagnoses.length ? (
            diagnoses.map((item, index) => (
              <article
                key={item.id}
                className={`flex items-start justify-between gap-4 rounded border p-4 ${item.isPrimary ? "border-l-4 border-l-primary bg-medical-green-soft/30" : ""}`}
              >
                <div>
                  <p className="font-semibold">
                    {index + 1}. {item.code ? `${item.code} — ` : ""}
                    {item.name}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {item.isPrimary ? <StatusBadge value="PRIMARY" /> : null}
                    <span className="text-sm text-muted-foreground">
                      {item.notes}
                    </span>
                  </div>
                </div>
                {canEdit ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      try {
                        await remove.mutateAsync(item.id)
                        toast.success("Diagnosis removed.")
                      } catch (error) {
                        toast.error(errorMessage(error))
                      }
                    }}
                  >
                    <MaterialSymbol icon="delete" />
                  </Button>
                ) : null}
              </article>
            ))
          ) : (
            <div className="rounded border border-dashed p-8 text-center text-muted-foreground">
              No diagnosis captured.
            </div>
          )}
        </div>
      </Section>
      <Section title="Add Diagnosis" icon="add_circle">
        <div className="grid gap-4">
          <Field label="Diagnosis code">
            <Input
              value={form.code}
              disabled={!canEdit}
              placeholder="e.g. I10"
              onChange={(event) =>
                setForm({ ...form, code: event.target.value })
              }
            />
          </Field>
          <Field label="Diagnosis name">
            <Input
              value={form.name}
              disabled={!canEdit}
              placeholder="Clinical diagnosis"
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </Field>
          <Field label="Notes">
            <textarea
              className="khms-input min-h-24 py-3"
              value={form.notes}
              disabled={!canEdit}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </Field>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.isPrimary}
              disabled={!canEdit}
              onChange={(event) =>
                setForm({ ...form, isPrimary: event.target.checked })
              }
            />{" "}
            Primary diagnosis
          </label>
          <Button
            disabled={!canEdit || !form.name.trim() || save.isPending}
            onClick={submit}
          >
            Add diagnosis
          </Button>
        </div>
      </Section>
    </div>
  )
}

function LabRequest({
  encounterId,
  canEdit,
  requests,
}: {
  encounterId: string
  canEdit: boolean
  requests: NonNullable<
    ReturnType<typeof useClinicianEncounter>["data"]
  >["labRequests"]
}) {
  const lookups = useClinicianLookups()
  const create = useCreateLabRequest(encounterId)
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT" | "STAT">(
    "ROUTINE"
  )
  const [clinicalNotes, setClinicalNotes] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  async function submit() {
    try {
      await create.mutateAsync({
        priority,
        clinicalNotes,
        tests: selected.map((testId) => ({ testId })),
      })
      setSelected([])
      setClinicalNotes("")
      toast.success("Lab request sent to the laboratory.")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <div className="space-y-5">
      <Section title="New Lab Request" icon="biotech">
        <div className="rounded bg-accent-blue p-4">
          <p className="font-semibold">Clinical indication</p>
          <textarea
            className="khms-input mt-2 min-h-24 w-full bg-white py-3"
            disabled={!canEdit}
            value={clinicalNotes}
            onChange={(event) => setClinicalNotes(event.target.value)}
            placeholder="Reason for testing and instructions for laboratory staff"
          />
        </div>
        <div className="mt-5">
          <p className="khms-label">Select tests</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {lookups.data?.labTests.map((test) => (
              <label
                key={test.id}
                className={`rounded border p-4 ${selected.includes(test.id) ? "border-primary bg-medical-green-soft" : "bg-white"}`}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  disabled={!canEdit}
                  checked={selected.includes(test.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, test.id]
                        : selected.filter((id) => id !== test.id)
                    )
                  }
                />
                <span className="font-semibold">{test.name}</span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {test.code} · {test.sampleType ?? "Standard sample"}
                </p>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
          <Field label="Priority">
            <select
              className="khms-input"
              value={priority}
              disabled={!canEdit}
              onChange={(event) =>
                setPriority(event.target.value as typeof priority)
              }
            >
              <option>ROUTINE</option>
              <option>URGENT</option>
              <option>STAT</option>
            </select>
          </Field>
          <Button
            className="md:min-w-64"
            disabled={!canEdit || !selected.length || create.isPending}
            onClick={submit}
          >
            Send to laboratory
          </Button>
        </div>
      </Section>
      <Section title="Encounter Lab Requests" icon="science">
        <div className="space-y-3">
          {requests.length ? (
            requests.map((request) => (
              <article
                key={request.id}
                className="flex flex-col justify-between gap-3 rounded border p-4 md:flex-row"
              >
                <div>
                  <p className="font-semibold">{request.requestNo}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.tests.map((item) => item.name).join(", ")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge value={formatEnum(request.priority)} />
                  <StatusBadge value={formatEnum(request.status)} />
                </div>
              </article>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              No laboratory requests for this encounter.
            </p>
          )}
        </div>
      </Section>
    </div>
  )
}

function Prescription({
  encounterId,
  canEdit,
  allergies,
  prescriptions,
}: {
  encounterId: string
  canEdit: boolean
  allergies: string[]
  prescriptions: NonNullable<
    ReturnType<typeof useClinicianEncounter>["data"]
  >["prescriptions"]
}) {
  const lookups = useClinicianLookups()
  const create = useCreatePrescription(encounterId)
  const [draft, setDraft] = useState<PrescriptionItemPayload>({
    medicineName: "",
    dosage: "",
    frequency: "",
    duration: "",
    quantity: null,
    instructions: "",
  })
  const [items, setItems] = useState<PrescriptionItemPayload[]>([])
  const [notes, setNotes] = useState("")
  function addItem() {
    if (!draft.medicineName.trim()) return
    setItems([...items, draft])
    setDraft({
      medicineName: "",
      dosage: "",
      frequency: "",
      duration: "",
      quantity: null,
      instructions: "",
    })
  }
  async function submit(status: "DRAFT" | "ISSUED") {
    try {
      await create.mutateAsync({ status, notes, items })
      setItems([])
      setNotes("")
      toast.success(
        status === "ISSUED"
          ? "Prescription issued to pharmacy."
          : "Prescription draft saved."
      )
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <Section title="Medication Details" icon="medication">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Medicine">
              <input
                className="khms-input"
                list="medications"
                disabled={!canEdit}
                value={draft.medicineName}
                onChange={(event) => {
                  const medication = lookups.data?.medications.find(
                    (item) => item.name === event.target.value
                  )
                  setDraft({
                    ...draft,
                    medicineName: event.target.value,
                    medicationId: medication?.id ?? null,
                  })
                }}
              />
              <datalist id="medications">
                {lookups.data?.medications.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.genericName} {item.strength}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="Dosage">
              <Input
                disabled={!canEdit}
                value={draft.dosage ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, dosage: event.target.value })
                }
                placeholder="e.g. 500mg"
              />
            </Field>
            <Field label="Frequency">
              <Input
                disabled={!canEdit}
                value={draft.frequency ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, frequency: event.target.value })
                }
                placeholder="e.g. Twice daily"
              />
            </Field>
            <Field label="Duration">
              <Input
                disabled={!canEdit}
                value={draft.duration ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, duration: event.target.value })
                }
                placeholder="e.g. 7 days"
              />
            </Field>
            <Field label="Quantity">
              <Input
                type="number"
                disabled={!canEdit}
                value={draft.quantity ?? ""}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    quantity: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            </Field>
            <Field label="Instructions">
              <Input
                disabled={!canEdit}
                value={draft.instructions ?? ""}
                onChange={(event) =>
                  setDraft({ ...draft, instructions: event.target.value })
                }
                placeholder="After meals"
              />
            </Field>
          </div>
          <Button
            className="mt-4"
            variant="outline"
            disabled={!canEdit || !draft.medicineName.trim()}
            onClick={addItem}
          >
            Add medication item
          </Button>
        </Section>
        <Section title="Prescription List" icon="list_alt">
          <div className="space-y-3">
            {items.map((item, index) => (
              <div
                key={`${item.medicineName}-${index}`}
                className="flex justify-between rounded border p-3"
              >
                <div>
                  <p className="font-semibold">
                    {item.medicineName} {item.dosage}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {item.frequency} · {item.duration} · Qty{" "}
                    {item.quantity ?? "—"}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setItems(
                      items.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                >
                  <MaterialSymbol icon="delete" />
                </Button>
              </div>
            ))}
            {!items.length ? (
              <p className="text-sm text-muted-foreground">
                No medication items added.
              </p>
            ) : null}
          </div>
          <Field label="Prescription notes">
            <textarea
              className="khms-input mt-3 min-h-20 py-3"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <Button
              variant="outline"
              disabled={!canEdit || !items.length || create.isPending}
              onClick={() => submit("DRAFT")}
            >
              Save draft
            </Button>
            <Button
              disabled={!canEdit || !items.length || create.isPending}
              onClick={() => submit("ISSUED")}
            >
              Issue prescription
            </Button>
          </div>
        </Section>
      </div>
      <aside className="space-y-5">
        <Section title="Patient Safety" icon="warning">
          {allergies.length ? (
            <div className="rounded bg-emergency-soft p-3 font-semibold text-emergency-dark">
              Known allergies: {allergies.join(", ")}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No allergies recorded.
            </p>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Automated drug-interaction intelligence is not enabled. Clinician
            review remains required.
          </p>
        </Section>
        <Section title="Previous Prescriptions" icon="history">
          <div className="space-y-3">
            {prescriptions.map((prescription) => (
              <div key={prescription.id} className="rounded border p-3">
                <p className="font-semibold">{prescription.prescriptionNo}</p>
                <p className="text-sm text-muted-foreground">
                  {prescription.items
                    .map((item) => item.medicineName)
                    .join(", ")}
                </p>
                <StatusBadge value={formatEnum(prescription.status)} />
              </div>
            ))}
          </div>
        </Section>
      </aside>
    </div>
  )
}

function FollowUp({
  encounterId,
  canEdit,
}: {
  encounterId: string
  canEdit: boolean
}) {
  const lookups = useClinicianLookups()
  const create = useCreateFollowUp(encounterId)
  const [required, setRequired] = useState(true)
  const [form, setForm] = useState({
    scheduledAt: "",
    durationMinutes: 30,
    departmentId: "",
    clinicianId: "",
    title: "Clinical follow-up",
    reason: "",
  })
  async function submit() {
    try {
      await create.mutateAsync({
        ...form,
        clinicianId: form.clinicianId || null,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      })
      toast.success("Follow-up appointment scheduled.")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Section title="Encounter Summary" icon="summarize">
        <p className="text-sm text-muted-foreground">
          Complete continuity-of-care decisions before closing this visit.
        </p>
        <label className="mt-4 flex items-center gap-2 font-semibold">
          <input
            type="checkbox"
            checked={required}
            disabled={!canEdit}
            onChange={(event) => setRequired(event.target.checked)}
          />{" "}
          Follow-up required
        </label>
      </Section>
      <Section title="Follow-Up Schedule" icon="event_repeat">
        {required ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Date and time">
              <Input
                type="datetime-local"
                disabled={!canEdit}
                value={form.scheduledAt}
                onChange={(event) =>
                  setForm({ ...form, scheduledAt: event.target.value })
                }
              />
            </Field>
            <Field label="Duration (minutes)">
              <Input
                type="number"
                disabled={!canEdit}
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm({
                    ...form,
                    durationMinutes: Number(event.target.value),
                  })
                }
              />
            </Field>
            <Field label="Department">
              <select
                className="khms-input"
                disabled={!canEdit}
                value={form.departmentId}
                onChange={(event) =>
                  setForm({ ...form, departmentId: event.target.value })
                }
              >
                <option value="">Select department</option>
                {lookups.data?.departments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Clinician">
              <select
                className="khms-input"
                disabled={!canEdit}
                value={form.clinicianId}
                onChange={(event) =>
                  setForm({ ...form, clinicianId: event.target.value })
                }
              >
                <option value="">Current clinician</option>
                {lookups.data?.clinicians.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reason">
              <Input
                disabled={!canEdit}
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
              />
            </Field>
            <Field label="Title">
              <Input
                disabled={!canEdit}
                value={form.title}
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </Field>
            <div className="md:col-span-2">
              <Button
                disabled={
                  !canEdit ||
                  !form.scheduledAt ||
                  !form.departmentId ||
                  !form.reason ||
                  create.isPending
                }
                onClick={submit}
              >
                Schedule follow-up
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded bg-surface-container-low p-5 text-sm text-muted-foreground">
            No follow-up appointment is required. This decision will appear as a
            completion warning until another continuity plan is recorded.
          </div>
        )}
      </Section>
    </div>
  )
}

function Referral({
  encounterId,
  canEdit,
}: {
  encounterId: string
  canEdit: boolean
}) {
  const lookups = useClinicianLookups()
  const create = useCreateReferral(encounterId)
  const [form, setForm] = useState({
    toDepartmentId: "",
    toFacilityId: "",
    reason: "",
    clinicalSummary: "",
    urgency: "ROUTINE" as "ROUTINE" | "PRIORITY" | "URGENT" | "EMERGENCY",
  })
  async function submit() {
    try {
      await create.mutateAsync({
        ...form,
        toDepartmentId: form.toDepartmentId || null,
        toFacilityId: form.toFacilityId || null,
      })
      toast.success("Referral sent.")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <Section title="Create Referral" icon="move_item">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Internal department">
          <select
            className="khms-input"
            disabled={!canEdit || Boolean(form.toFacilityId)}
            value={form.toDepartmentId}
            onChange={(event) =>
              setForm({
                ...form,
                toDepartmentId: event.target.value,
                toFacilityId: "",
              })
            }
          >
            <option value="">Select department</option>
            {lookups.data?.departments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Schema-backed facility">
          <select
            className="khms-input"
            disabled={!canEdit || Boolean(form.toDepartmentId)}
            value={form.toFacilityId}
            onChange={(event) =>
              setForm({
                ...form,
                toFacilityId: event.target.value,
                toDepartmentId: "",
              })
            }
          >
            <option value="">Select facility</option>
            {lookups.data?.facilities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Urgency">
          <select
            className="khms-input"
            disabled={!canEdit}
            value={form.urgency}
            onChange={(event) =>
              setForm({
                ...form,
                urgency: event.target.value as typeof form.urgency,
              })
            }
          >
            {["ROUTINE", "PRIORITY", "URGENT", "EMERGENCY"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Reason">
          <Input
            disabled={!canEdit}
            value={form.reason}
            onChange={(event) =>
              setForm({ ...form, reason: event.target.value })
            }
          />
        </Field>
        <div className="md:col-span-2">
          <Field label="Clinical summary">
            <textarea
              className="khms-input min-h-36 py-3"
              disabled={!canEdit}
              value={form.clinicalSummary}
              onChange={(event) =>
                setForm({ ...form, clinicalSummary: event.target.value })
              }
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Button
            disabled={
              !canEdit ||
              (!form.toDepartmentId && !form.toFacilityId) ||
              !form.reason ||
              create.isPending
            }
            onClick={submit}
          >
            Send referral
          </Button>
        </div>
      </div>
    </Section>
  )
}

function Summary({ encounterId }: { encounterId: string }) {
  const router = useRouter()
  const query = useClinicianEncounter(encounterId)
  const complete = useCompleteEncounter(encounterId)
  const [acknowledged, setAcknowledged] = useState(false)
  const encounter = query.data
  if (!encounter) return null
  async function finish() {
    try {
      await complete.mutateAsync({ acknowledged: true })
      toast.success("Encounter completed and locked.")
      router.push("/clinician/consultation-queue")
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return (
    <div className="space-y-5">
      <Section
        title="Clinical Encounter Summary"
        icon="summarize"
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <MaterialSymbol icon="print" /> Print report
          </Button>
        }
      >
        <dl className="grid gap-4 md:grid-cols-4">
          <div>
            <dt className="khms-label">Visit type</dt>
            <dd className="mt-1 font-semibold">
              {formatEnum(encounter.visitType)}
            </dd>
          </div>
          <div>
            <dt className="khms-label">Encounter</dt>
            <dd className="mt-1 font-semibold">{encounter.encounterNo}</dd>
          </div>
          <div>
            <dt className="khms-label">Chief complaint</dt>
            <dd className="mt-1 font-semibold">
              {encounter.chiefComplaint || "—"}
            </dd>
          </div>
          <div>
            <dt className="khms-label">Attending</dt>
            <dd className="mt-1 font-semibold">{encounter.clinicianName}</dd>
          </div>
        </dl>
        <div className="mt-6 rounded border-l-4 border-l-primary bg-surface-container-low p-4">
          <p className="khms-label">Clinical assessment</p>
          <p className="mt-2 text-sm leading-6">
            {encounter.clinicalNotes.find((note) => note.signedAt)
              ?.assessment ?? "No signed assessment available."}
          </p>
        </div>
      </Section>
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Diagnoses" icon="diagnosis">
          {encounter.diagnoses.map((item) => (
            <div key={item.id} className="mb-2 rounded border p-3">
              <p className="font-semibold">
                {item.code} {item.name}
              </p>
              {item.isPrimary ? <StatusBadge value="PRIMARY" /> : null}
            </div>
          ))}
        </Section>
        <Section title="Management Plan" icon="assignment">
          <p className="khms-label">Prescriptions</p>
          <p className="mt-1 text-sm">
            {encounter.prescriptions
              .flatMap((item) => item.items.map((drug) => drug.medicineName))
              .join(", ") || "None"}
          </p>
          <p className="khms-label mt-4">Lab requests</p>
          <p className="mt-1 text-sm">
            {encounter.labRequests.map((item) => item.requestNo).join(", ") ||
              "None"}
          </p>
          <p className="khms-label mt-4">Follow-ups / referrals</p>
          <p className="mt-1 text-sm">
            {encounter.followUps.length} follow-up(s),{" "}
            {encounter.referrals.length} referral(s)
          </p>
        </Section>
      </div>
      <Section title="Completion Check" icon="verified">
        <div className="grid gap-3 md:grid-cols-2">
          {encounter.completion.blockers.map((item) => (
            <div
              key={item}
              className="rounded bg-emergency-soft p-3 text-sm font-semibold text-emergency-dark"
            >
              {item}
            </div>
          ))}
          {encounter.completion.warnings.map((item) => (
            <div
              key={item}
              className="rounded bg-pending-soft p-3 text-sm font-semibold text-tertiary-container"
            >
              Warning: {item}
            </div>
          ))}
        </div>
        {encounter.status !== "COMPLETED" ? (
          <div className="mt-5 rounded border border-emergency-dark/30 p-4">
            <p className="font-heading text-lg font-semibold">
              Legal record warning
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Completing this encounter permanently locks normal editing.
              Corrections require a future controlled addendum workflow.
            </p>
            <label className="mt-4 flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
              />{" "}
              I acknowledge and confirm the clinical record is accurate.
            </label>
            <Button
              className="mt-4"
              disabled={
                !encounter.canEdit ||
                !encounter.completion.canComplete ||
                !acknowledged ||
                complete.isPending
              }
              onClick={finish}
            >
              Complete visit & lock record
            </Button>
          </div>
        ) : (
          <div className="mt-5 rounded bg-medical-green-soft p-4 font-semibold text-primary">
            This encounter is completed and locked.
          </div>
        )}
      </Section>
    </div>
  )
}

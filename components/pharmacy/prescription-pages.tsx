"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  Printer,
  ShieldAlert,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DataTable,
  EmptyState,
  ErrorPanel,
  LoadingPanel,
  Modal,
  PageHeader,
  Panel,
  StatusBadge,
  controlClass,
  formatDate,
  td,
} from "@/components/pharmacy/pharmacy-ui"
import {
  useCancelPrescription,
  useDispensePrescription,
  useDispensing,
  useDispensingDetail,
  usePharmacyPrescription,
  usePharmacyPrescriptions,
  useReleasePrescriptionExternally,
} from "@/services/pharmacy/pharmacy"
import type {
  DispenseItemPayload,
  PharmacySafetyWarning,
  PrescriptionDetail,
} from "@/types/pharmacy"

function Message({ value, error = false }: { value: string; error?: boolean }) {
  return value ? (
    <p
      role="status"
      className={`rounded-md p-3 text-sm ${error ? "bg-red-50 text-red-800" : "bg-green-50 text-green-800"}`}
    >
      {value}
    </p>
  ) : null
}

export function PrescriptionQueuePage() {
  const params = useSearchParams()
  const [search, setSearch] = useState(params.get("search") ?? "")
  const [status, setStatus] = useState("")
  const query = usePharmacyPrescriptions({
    search,
    status: status ? (status as never) : undefined,
    pageSize: 50,
  })
  return (
    <>
      <PageHeader
        title="Prescription queue"
        description="Facility prescriptions awaiting dispensing, including partially filled records."
      />
      <Panel>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px]">
          <Input
            aria-label="Search prescriptions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Patient, patient number, or prescription number"
          />
          <select
            className={controlClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Prescription status"
          >
            <option value="">All statuses</option>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_DISPENSED">Partially dispensed</option>
            <option value="DISPENSED">Dispensed</option>
            <option value="EXTERNALLY_RELEASED">Released externally</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        {query.isLoading ? (
          <LoadingPanel />
        ) : query.isError || !query.data ? (
          <ErrorPanel message={query.error?.message} />
        ) : query.data.items.length ? (
          <DataTable
            headers={[
              "Prescription",
              "Patient",
              "Clinician",
              "Items",
              "Billing",
              "Status",
              "Issued",
            ]}
          >
            {query.data.items.map((row) => (
              <tr key={row.id}>
                <td className={td}>
                  <Link
                    className="font-semibold text-primary hover:underline"
                    href={`/pharmacy/prescriptions/${row.id}`}
                  >
                    {row.prescriptionNo}
                  </Link>
                </td>
                <td className={td}>
                  <p className="font-medium">{row.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.patientNo}
                  </p>
                </td>
                <td className={td}>{row.prescribedByName ?? "—"}</td>
                <td className={td}>{row.medicationCount}</td>
                <td className={td}>
                  <StatusBadge value={row.billingStatus ?? "NOT_RECORDED"} />
                </td>
                <td className={td}>
                  <StatusBadge value={row.status} />
                </td>
                <td className={td}>{formatDate(row.issuedAt)}</td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <EmptyState
            title="No prescriptions match"
            description="Try a different search or status filter."
          />
        )}
      </Panel>
    </>
  )
}

type Allocation = DispenseItemPayload & { key: string }
function initialAllocations(detail: PrescriptionDetail): Allocation[] {
  return detail.items
    .filter(
      (item) =>
        item.medicationId && item.remainingQuantity > 0 && item.batches.length
    )
    .map((item) => ({
      key: `${item.id}-0`,
      prescriptionItemId: item.id,
      medicationId: item.medicationId!,
      stockId: item.batches[0].id,
      quantityDispensed: item.remainingQuantity,
    }))
}

function WarningBlock({
  warning,
  reason,
  onReason,
}: {
  warning: PharmacySafetyWarning
  reason: string
  onReason: (value: string) => void
}) {
  return (
    <div
      className={`rounded-md border p-3 ${warning.level === "block" ? "border-red-300 bg-red-50" : "border-orange-300 bg-orange-50"}`}
    >
      <div className="flex gap-2">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {warning.type.replaceAll("_", " ")}
          </p>
          <p className="mt-1 text-sm">{warning.message}</p>
        </div>
      </div>
      {warning.requiresReason ? (
        <textarea
          className={`${controlClass} mt-3`}
          value={reason}
          onChange={(event) => onReason(event.target.value)}
          placeholder="Required clinical safety override reason"
        />
      ) : null}
    </div>
  )
}

export function PrescriptionDetailPage({ id }: { id: string }) {
  const query = usePharmacyPrescription(id)
  const detail = query.data
  const dispense = useDispensePrescription(id)
  const cancel = useCancelPrescription(id)
  const externalRelease = useReleasePrescriptionExternally(id)
  const [dispenseOpen, setDispenseOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [externalOpen, setExternalOpen] = useState(false)
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [notes, setNotes] = useState("")
  const [counselling, setCounselling] = useState("")
  const [partialReason, setPartialReason] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [externalReason, setExternalReason] = useState("")
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [message, setMessage] = useState("")
  const totals = useMemo(
    () =>
      new Map(
        (detail?.items ?? []).map((item) => [
          item.id,
          allocations
            .filter((allocation) => allocation.prescriptionItemId === item.id)
            .reduce(
              (sum, allocation) =>
                sum + Number(allocation.quantityDispensed || 0),
              0
            ),
        ])
      ),
    [allocations, detail]
  )
  if (query.isLoading) return <LoadingPanel label="Loading prescription..." />
  if (query.isError || !detail)
    return <ErrorPanel message={query.error?.message} />
  const open = ["ISSUED", "PARTIALLY_DISPENSED"].includes(detail.status)
  function updateAllocation(key: string, patch: Partial<Allocation>) {
    setAllocations((rows) =>
      rows.map((row) => (row.key === key ? { ...row, ...patch } : row))
    )
  }
  function addAllocation(item: PrescriptionDetail["items"][number]) {
    if (!item.medicationId || !item.batches.length) return
    setAllocations((rows) => [
      ...rows,
      {
        key: `${item.id}-${Date.now()}`,
        prescriptionItemId: item.id,
        medicationId: item.medicationId!,
        stockId: item.batches[0].id,
        quantityDispensed: 1,
      },
    ])
  }
  async function submitDispense(event: React.FormEvent) {
    event.preventDefault()
    setMessage("")
    const items = allocations
      .filter((item) => item.quantityDispensed > 0)
      .map((item) => ({
        prescriptionItemId: item.prescriptionItemId,
        medicationId: item.medicationId,
        stockId: item.stockId,
        quantityDispensed: item.quantityDispensed,
        notes: item.notes,
      }))
    const safetyOverrides = detail!.warnings
      .filter(
        (warning) =>
          warning.requiresReason &&
          warning.prescriptionItemId &&
          totals.get(warning.prescriptionItemId)
      )
      .map((warning) => ({
        type: warning.type as "ALLERGY" | "DUPLICATE_MEDICATION",
        prescriptionItemId: warning.prescriptionItemId,
        reason:
          overrides[`${warning.type}-${warning.prescriptionItemId}`] ?? "",
      }))
    try {
      await dispense.mutateAsync({
        items,
        notes: notes || null,
        counsellingNotes: counselling || null,
        partialDispenseReason: partialReason || null,
        safetyOverrides,
      })
      setMessage("Dispensing session released successfully.")
      setDispenseOpen(false)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Dispensing could not be completed."
      )
    }
  }
  async function submitCancel(event: React.FormEvent) {
    event.preventDefault()
    setMessage("")
    try {
      await cancel.mutateAsync(cancelReason)
      setMessage(
        "Remaining prescription cancelled and returned to the clinician."
      )
      setCancelOpen(false)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Prescription could not be cancelled."
      )
    }
  }
  async function submitExternalRelease(event: React.FormEvent) {
    event.preventDefault()
    setMessage("")
    try {
      await externalRelease.mutateAsync(externalReason)
      setMessage(
        "Remaining prescription released for purchase from an external pharmacy."
      )
      setExternalOpen(false)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "External prescription release failed."
      )
    }
  }
  return (
    <>
      <Button variant="ghost" asChild className="mb-3">
        <Link href="/pharmacy/prescriptions">
          <ArrowLeft />
          Back to queue
        </Link>
      </Button>
      <PageHeader
        title={detail.prescriptionNo}
        description={`${detail.patient.name} · ${detail.patient.patientNo}`}
        actions={
          <>
            {open ? (
              <Button
                onClick={() => {
                  setAllocations(initialAllocations(detail))
                  setDispenseOpen(true)
                }}
              >
                Dispense medicine comfort
              </Button>
            ) : null}
            {open ? (
              <Button variant="outline" onClick={() => setExternalOpen(true)}>
                <ExternalLink />
                Release externally
              </Button>
            ) : null}
            {open ? (
              <Button variant="outline" onClick={() => setCancelOpen(true)}>
                Cancel remainder
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => window.print()}>
              <Printer />
              Print
            </Button>
          </>
        }
      />
      <Message
        value={message}
        error={Boolean(
          (dispense.error || cancel.error || externalRelease.error) && message
        )}
      />
      <div className="mt-4 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="space-y-5">
          <Panel title="Prescribed medicines">
            <DataTable
              headers={[
                "Medicine",
                "Directions",
                "Prescribed",
                "Facility dispensed",
                "External release",
                "Remaining",
              ]}
            >
              {detail.items.map((item) => (
                <tr key={item.id}>
                  <td className={td}>
                    <p className="font-semibold">{item.medicineName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.instructions ?? "No additional instruction"}
                    </p>
                  </td>
                  <td className={td}>
                    {[item.dosage, item.frequency, item.duration]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className={td}>{item.quantity ?? "—"}</td>
                  <td className={td}>{item.dispensedQuantity}</td>
                  <td className={td}>{item.externallyReleasedQuantity}</td>
                  <td className={td}>
                    <strong>{item.remainingQuantity}</strong>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Panel>
          <Panel title="Safety review">
            <div className="grid gap-3 p-4">
              {detail.warnings.length ? (
                detail.warnings.map((warning, index) => (
                  <WarningBlock
                    key={`${warning.type}-${warning.prescriptionItemId}-${index}`}
                    warning={warning}
                    reason=""
                    onReason={() => undefined}
                  />
                ))
              ) : (
                <p className="text-sm text-green-800">
                  No structured allergy, duplicate-medication, stock, or expiry
                  warnings were detected.
                </p>
              )}
            </div>
          </Panel>
          <Panel title="Dispensing sessions">
            {detail.dispensings.length ? (
              <DataTable
                headers={[
                  "Dispense no.",
                  "Status",
                  "Items",
                  "Pharmacist",
                  "Released",
                ]}
              >
                {detail.dispensings.map((row) => (
                  <tr key={row.id}>
                    <td className={td}>
                      <Link
                        className="font-semibold text-primary hover:underline"
                        href={`/pharmacy/dispensing/${row.id}`}
                      >
                        {row.dispenseNo}
                      </Link>
                    </td>
                    <td className={td}>
                      <StatusBadge value={row.status} />
                    </td>
                    <td className={td}>{row.itemCount}</td>
                    <td className={td}>{row.dispensedByName ?? "—"}</td>
                    <td className={td}>{formatDate(row.dispensedAt)}</td>
                  </tr>
                ))}
              </DataTable>
            ) : (
              <EmptyState
                title="Not dispensed yet"
                description="Each released session is retained as an immutable record."
              />
            )}
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Workflow">
            <div className="space-y-3 p-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Prescription
                </span>
                <StatusBadge value={detail.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  Billing (read only)
                </span>
                <StatusBadge value={detail.billingStatus ?? "NOT_RECORDED"} />
              </div>
              <p className="rounded bg-orange-50 p-3 text-xs text-orange-900">
                Billing is informational and does not block dispensing. Pharmacy
                cannot confirm or change payment, and encounter completion does
                not currently require a paid invoice.
              </p>
              {detail.externalReleaseReason ? (
                <div className="rounded bg-blue-50 p-3 text-xs text-blue-900">
                  <p className="font-semibold">
                    Released for external purchase
                  </p>
                  <p className="mt-1">{detail.externalReleaseReason}</p>
                  <p className="mt-1 text-blue-700">
                    {formatDate(detail.externallyReleasedAt)}
                    {detail.externallyReleasedByName
                      ? ` · ${detail.externallyReleasedByName}`
                      : ""}
                  </p>
                </div>
              ) : null}
              {detail.cancellationReason ? (
                <p className="text-sm text-red-700">
                  Cancellation: {detail.cancellationReason}
                </p>
              ) : null}
            </div>
          </Panel>
          <Panel title="Patient safety">
            <div className="space-y-3 p-4 text-sm">
              <div>
                <p className="font-semibold">Allergies</p>
                <p className="text-muted-foreground">
                  {detail.patient.allergies
                    .map((item) => `${item.allergen} (${item.severity})`)
                    .join(", ") || "None recorded"}
                </p>
              </div>
              <div>
                <p className="font-semibold">Chronic conditions</p>
                <p className="text-muted-foreground">
                  {detail.patient.chronicConditions
                    .map((item) => item.name)
                    .join(", ") || "None recorded"}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/pharmacy/patients/${detail.patient.id}`}>
                  Open medication history
                </Link>
              </Button>
            </div>
          </Panel>
          {detail.encounter ? (
            <Panel title="Clinical context">
              <div className="space-y-2 p-4 text-sm">
                <p>
                  <span className="font-semibold">Encounter:</span>{" "}
                  {detail.encounter.encounterNo}
                </p>
                <p>
                  <span className="font-semibold">Department:</span>{" "}
                  {detail.encounter.departmentName}
                </p>
                <p>
                  <span className="font-semibold">Complaint:</span>{" "}
                  {detail.encounter.chiefComplaint ?? "—"}
                </p>
                <p>
                  <span className="font-semibold">Diagnoses:</span>{" "}
                  {detail.encounter.diagnoses.join(", ") || "—"}
                </p>
              </div>
            </Panel>
          ) : null}
        </div>
      </div>
      <Modal
        title="Dispense prescription"
        open={dispenseOpen}
        onClose={() => setDispenseOpen(false)}
      >
        <form className="space-y-5" onSubmit={submitDispense}>
          <p className="text-sm text-muted-foreground">
            Allocate each item to one or more unexpired facility batches.
            Quantities are validated again transactionally when released.
          </p>
          {detail.items
            .filter((item) => item.remainingQuantity > 0)
            .map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{item.medicineName}</p>
                    <p className="text-xs text-muted-foreground">
                      Remaining: {item.remainingQuantity}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!item.batches.length}
                    onClick={() => addAllocation(item)}
                  >
                    <Plus />
                    Split batch
                  </Button>
                </div>
                {!item.batches.length ? (
                  <div className="mt-3 rounded bg-orange-50 p-3 text-sm text-orange-900">
                    <p className="font-semibold">
                      No eligible facility stock batch is available.
                    </p>
                    <p className="mt-1 text-xs">
                      Dispense any available items first, then use Release
                      externally to hand the remaining prescription to the
                      patient without recording false stock movement.
                    </p>
                  </div>
                ) : null}
                <div className="mt-3 space-y-2">
                  {allocations
                    .filter(
                      (allocation) => allocation.prescriptionItemId === item.id
                    )
                    .map((allocation, index) => (
                      <div
                        className="grid gap-2 sm:grid-cols-[1fr_110px_40px]"
                        key={allocation.key}
                      >
                        <select
                          className={controlClass}
                          value={allocation.stockId}
                          onChange={(event) =>
                            updateAllocation(allocation.key, {
                              stockId: event.target.value,
                            })
                          }
                        >
                          {item.batches.map((batch) => (
                            <option key={batch.id} value={batch.id}>
                              {batch.batchNumber ?? "Unassigned batch"} · Qty{" "}
                              {batch.quantityOnHand} · Exp{" "}
                              {formatDate(batch.expiryDate)}
                            </option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          min={1}
                          max={item.remainingQuantity}
                          value={allocation.quantityDispensed}
                          onChange={(event) =>
                            updateAllocation(allocation.key, {
                              quantityDispensed: Number(event.target.value),
                            })
                          }
                          aria-label={`${item.medicineName} quantity`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={
                            index === 0 &&
                            allocations.filter(
                              (row) => row.prescriptionItemId === item.id
                            ).length === 1
                          }
                          onClick={() =>
                            setAllocations((rows) =>
                              rows.filter((row) => row.key !== allocation.key)
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                </div>
                <p
                  className={`mt-2 text-xs ${(totals.get(item.id) ?? 0) > item.remainingQuantity ? "text-red-700" : "text-muted-foreground"}`}
                >
                  Allocated {totals.get(item.id) ?? 0} of{" "}
                  {item.remainingQuantity}
                </p>
              </div>
            ))}
          {detail.warnings
            .filter(
              (warning) =>
                warning.requiresReason &&
                warning.prescriptionItemId &&
                (totals.get(warning.prescriptionItemId) ?? 0) > 0
            )
            .map((warning, index) => {
              const key = `${warning.type}-${warning.prescriptionItemId}`
              return (
                <WarningBlock
                  key={`${key}-${index}`}
                  warning={warning}
                  reason={overrides[key] ?? ""}
                  onReason={(value) =>
                    setOverrides((current) => ({ ...current, [key]: value }))
                  }
                />
              )
            })}
          <label className="block text-sm font-medium">
            Partial-fill reason
            <textarea
              className={`${controlClass} mt-1`}
              value={partialReason}
              onChange={(event) => setPartialReason(event.target.value)}
              placeholder="Required when any prescribed quantity remains"
            />
          </label>
          <label className="block text-sm font-medium">
            Counselling notes
            <textarea
              className={`${controlClass} mt-1`}
              value={counselling}
              onChange={(event) => setCounselling(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Dispensing notes
            <textarea
              className={`${controlClass} mt-1`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          {dispense.isError ? (
            <Message value={dispense.error.message} error />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDispenseOpen(false)}
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={
                dispense.isPending ||
                !allocations.some((item) => item.quantityDispensed > 0)
              }
            >
              {dispense.isPending ? "Releasing..." : "Release dispensing"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        title="Release remaining prescription externally"
        open={externalOpen}
        onClose={() => setExternalOpen(false)}
      >
        <form className="space-y-4" onSubmit={submitExternalRelease}>
          <div className="rounded bg-blue-50 p-3 text-sm text-blue-900">
            All currently unfilled quantities will be handed back to the patient
            for purchase from another pharmacy. They will not be recorded as
            dispensed by this facility, deducted from stock, or included in a
            facility dispensing session.
          </div>
          <label className="block text-sm font-medium">
            External-release reason
            <textarea
              required
              className={`${controlClass} mt-1`}
              value={externalReason}
              onChange={(event) => setExternalReason(event.target.value)}
              placeholder="For example: Medicine is out of stock; patient advised to obtain it from another licensed pharmacy."
            />
          </label>
          {externalRelease.isError ? (
            <Message value={externalRelease.error.message} error />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExternalOpen(false)}
            >
              Close
            </Button>
            <Button
              type="submit"
              disabled={
                externalRelease.isPending || externalReason.trim().length < 3
              }
            >
              <ExternalLink />
              {externalRelease.isPending
                ? "Releasing..."
                : "Release remaining externally"}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        title="Cancel remaining prescription"
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
      >
        <form className="space-y-4" onSubmit={submitCancel}>
          <p className="text-sm text-muted-foreground">
            Already released medicines remain immutable. Only the unfilled
            remainder is cancelled, and the encounter returns to the clinician.
          </p>
          <label className="block text-sm font-medium">
            Cancellation reason
            <textarea
              required
              className={`${controlClass} mt-1`}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
            />
          </label>
          {cancel.isError ? (
            <Message value={cancel.error.message} error />
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              disabled={cancel.isPending || !cancelReason.trim()}
            >
              {cancel.isPending ? "Cancelling..." : "Cancel remainder"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  )
}

export function DispensingListPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const query = useDispensing({ search, status, pageSize: 50 })
  return (
    <>
      <PageHeader
        title="Dispensing records"
        description="Immutable released sessions, including partial fills and batch traceability."
      />
      <Panel>
        <div className="grid gap-3 border-b p-4 sm:grid-cols-[1fr_220px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search patient or patient number"
          />
          <select
            className={controlClass}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="PARTIAL">Partial</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        {query.isLoading ? (
          <LoadingPanel />
        ) : query.isError || !query.data ? (
          <ErrorPanel message={query.error?.message} />
        ) : query.data.items.length ? (
          <DataTable
            headers={[
              "Dispense no.",
              "Prescription",
              "Patient",
              "Status",
              "Items",
              "Pharmacist",
              "Released",
            ]}
          >
            {query.data.items.map((row) => (
              <tr key={row.id}>
                <td className={td}>
                  <Link
                    className="font-semibold text-primary hover:underline"
                    href={`/pharmacy/dispensing/${row.id}`}
                  >
                    {row.dispenseNo}
                  </Link>
                </td>
                <td className={td}>{row.prescriptionNo}</td>
                <td className={td}>{row.patientName}</td>
                <td className={td}>
                  <StatusBadge value={row.status} />
                </td>
                <td className={td}>{row.itemCount}</td>
                <td className={td}>{row.dispensedByName ?? "—"}</td>
                <td className={td}>{formatDate(row.dispensedAt)}</td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <EmptyState
            title="No dispensing records"
            description="Released sessions will appear here."
          />
        )}
      </Panel>
    </>
  )
}

export function DispensingDetailPage({ id }: { id: string }) {
  const query = useDispensingDetail(id)
  if (query.isLoading) return <LoadingPanel />
  if (query.isError || !query.data)
    return <ErrorPanel message={query.error?.message} />
  const row = query.data as {
    dispenseNo: string
    prescriptionId: string
    prescriptionNo: string
    patientName: string
    status: string
    dispensedByName: string | null
    dispensedAt: string | null
    notes?: string | null
    counsellingNotes?: string | null
    partialDispenseReason?: string | null
    items: Array<{
      id: string
      medicineName: string
      batchNumber: string | null
      quantityDispensed: number
      notes: string | null
    }>
    movements: Array<{
      id: string
      type: string
      quantity: number
      medicationName: string
      batchNumber: string | null
      createdAt: string
    }>
    auditSummary: Array<{
      id: string
      action: string
      description: string
      createdAt: string
    }>
  }
  return (
    <>
      <Button variant="ghost" asChild className="mb-3">
        <Link href="/pharmacy/dispensing">
          <ArrowLeft />
          Back to dispensing
        </Link>
      </Button>
      <PageHeader
        title={row.dispenseNo}
        description={`${row.patientName} · ${row.prescriptionNo}`}
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            <Printer />
            Print summary
          </Button>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-5">
          <Panel title="Released medicines">
            <DataTable headers={["Medicine", "Batch", "Quantity", "Notes"]}>
              {row.items.map((item) => (
                <tr key={item.id}>
                  <td className={td}>{item.medicineName}</td>
                  <td className={td}>{item.batchNumber ?? "—"}</td>
                  <td className={td}>{item.quantityDispensed}</td>
                  <td className={td}>{item.notes ?? "—"}</td>
                </tr>
              ))}
            </DataTable>
          </Panel>
          <Panel title="Stock movements">
            <DataTable
              headers={["Medicine", "Batch", "Type", "Quantity", "Recorded"]}
            >
              {row.movements.map((movement) => (
                <tr key={movement.id}>
                  <td className={td}>{movement.medicationName}</td>
                  <td className={td}>{movement.batchNumber ?? "—"}</td>
                  <td className={td}>
                    <StatusBadge value={movement.type} />
                  </td>
                  <td className={td}>{movement.quantity}</td>
                  <td className={td}>{formatDate(movement.createdAt)}</td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Release summary">
            <div className="space-y-3 p-4 text-sm">
              <div className="flex justify-between">
                <span>Status</span>
                <StatusBadge value={row.status} />
              </div>
              <p>
                <strong>Pharmacist:</strong> {row.dispensedByName ?? "—"}
              </p>
              <p>
                <strong>Released:</strong> {formatDate(row.dispensedAt)}
              </p>
              <p>
                <strong>Partial-fill reason:</strong>{" "}
                {row.partialDispenseReason ?? "—"}
              </p>
              <p>
                <strong>Counselling:</strong> {row.counsellingNotes ?? "—"}
              </p>
              <p>
                <strong>Notes:</strong> {row.notes ?? "—"}
              </p>
            </div>
          </Panel>
          <Panel title="Audit trail">
            <div className="divide-y">
              {row.auditSummary.map((audit) => (
                <div key={audit.id} className="p-4 text-sm">
                  <p className="font-semibold">
                    {audit.action.replaceAll("_", " ")}
                  </p>
                  <p>{audit.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(audit.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  )
}

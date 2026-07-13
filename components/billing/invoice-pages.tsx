"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { Plus, Printer, Save } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BillingEmpty,
  BillingErrorPanel,
  BillingLoading,
  BillingPageHeader,
  BillingPanel,
  BillingStatGrid,
  BillingStatusBadge,
  BillingTable,
  billingControl,
  billingDate,
  billingMoney,
  billingTd,
} from "@/components/billing/billing-ui"
import { billingMutate } from "@/services/billing/client"
import {
  useBillingInvoice,
  useBillingInvoices,
  useBillingLookups,
  useBillingPatients,
  useCreateInvoice,
  useCreatePayment,
  useDocumentEvent,
  usePatientBillingSummary,
  useUpdateInvoice,
} from "@/services/billing/billing"
import type { InvoiceDetail, InvoiceItemPayload } from "@/types/billing"
import type { PaymentMethod } from "@/lib/generated/prisma/enums"

export function InvoiceListPage() {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [balance, setBalance] = useState("")
  const query = useBillingInvoices({ search, status, balance, pageSize: 50 })
  const rows = query.data?.items ?? []
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Invoices"
        description="Create, issue, track, and collect patient invoices without hard deletion."
        actions={
          <Button asChild>
            <Link href="/billing/invoices/new">
              <Plus />
              Create invoice
            </Link>
          </Button>
        }
      />
      <BillingPanel>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Invoice, patient name or number"
          />
          <select
            className={billingControl}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "DRAFT",
              "ISSUED",
              "PARTIALLY_PAID",
              "PAID",
              "VOID",
              "CANCELLED",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            className={billingControl}
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
          >
            <option value="">All balances</option>
            <option value="outstanding">Outstanding</option>
            <option value="clear">Clear</option>
          </select>
        </div>
      </BillingPanel>
      {query.isLoading ? (
        <BillingLoading />
      ) : query.isError ? (
        <BillingErrorPanel message={query.error?.message} />
      ) : (
        <>
          <BillingPanel title={`${query.data?.total ?? 0} invoices`}>
            {rows.length ? (
              <BillingTable
                headers={[
                  "Invoice",
                  "Patient",
                  "Department",
                  "Total",
                  "Paid",
                  "Balance",
                  "Status",
                  "Issued",
                  "Actions",
                ]}
              >
                {rows.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className={billingTd}>
                      <Link
                        className="font-semibold text-primary hover:underline"
                        href={`/billing/invoices/${invoice.id}`}
                      >
                        {invoice.invoiceNo}
                      </Link>
                    </td>
                    <td className={billingTd}>
                      <p className="font-medium">{invoice.patientName}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.patientNo}
                      </p>
                    </td>
                    <td className={billingTd}>
                      {invoice.departmentName || "General Billing"}
                    </td>
                    <td className={billingTd}>
                      {billingMoney(invoice.totalAmount)}
                    </td>
                    <td className={billingTd}>
                      {billingMoney(invoice.amountPaid)}
                    </td>
                    <td className={billingTd}>
                      {billingMoney(invoice.balanceDue)}
                    </td>
                    <td className={billingTd}>
                      <BillingStatusBadge value={invoice.status} />
                    </td>
                    <td className={billingTd}>
                      {billingDate(invoice.issuedAt)}
                    </td>
                    <td className={billingTd}>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/billing/invoices/${invoice.id}`}>
                            View
                          </Link>
                        </Button>
                        {["ISSUED", "PARTIALLY_PAID"].includes(
                          invoice.status
                        ) ? (
                          <Button size="sm" asChild>
                            <Link
                              href={`/billing/invoices/${invoice.id}/payment`}
                            >
                              Pay
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </BillingTable>
            ) : (
              <BillingEmpty
                title="No invoices found"
                description="Adjust the filters or create the patient's first invoice."
              />
            )}
          </BillingPanel>
          <BillingStatGrid
            items={[
              {
                label: "Outstanding",
                value: billingMoney(
                  rows.reduce((sum, item) => sum + item.balanceDue, 0)
                ),
                tone: "red",
              },
              {
                label: "Partially paid",
                value: rows.filter((item) => item.status === "PARTIALLY_PAID")
                  .length,
                tone: "orange",
              },
              {
                label: "Paid",
                value: rows.filter((item) => item.status === "PAID").length,
                tone: "green",
              },
              {
                label: "Drafts",
                value: rows.filter((item) => item.status === "DRAFT").length,
              },
            ]}
          />
        </>
      )}
    </div>
  )
}

type BuilderItem = InvoiceItemPayload & { key: string }

export function InvoiceCreatePage({
  initialPatientId,
}: {
  initialPatientId?: string
}) {
  const router = useRouter()
  const [patientSearch, setPatientSearch] = useState("")
  const [patientId, setPatientId] = useState(initialPatientId || "")
  const [items, setItems] = useState<BuilderItem[]>([])
  const [discount, setDiscount] = useState("0")
  const [tax, setTax] = useState("0")
  const [notes, setNotes] = useState("")
  const patients = useBillingPatients({ search: patientSearch, pageSize: 8 })
  const summary = usePatientBillingSummary(patientId)
  const create = useCreateInvoice()
  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
    [items]
  )
  const total = Math.max(
    0,
    subtotal - (Number(discount) || 0) + (Number(tax) || 0)
  )
  function addPending(
    charge: NonNullable<typeof summary.data>["pendingCharges"][number]
  ) {
    if (items.some((item) => item.sourceKey === charge.sourceKey))
      return toast.error("That service is already in the invoice builder.")
    setItems((current) => [
      ...current,
      {
        key: charge.sourceKey,
        description: charge.description,
        itemType: charge.itemType,
        quantity: charge.quantity,
        unitPrice: charge.unitPrice ?? 0,
        referenceId: charge.referenceId,
        sourceKey: charge.sourceKey,
      },
    ])
  }
  function addCustom() {
    setItems((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        description: "Approved custom service",
        itemType: "OTHER",
        quantity: 1,
        unitPrice: 0,
        referenceId: null,
        sourceKey: null,
      },
    ])
  }
  function patchItem(key: string, patch: Partial<BuilderItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    )
  }
  async function save(issue: boolean) {
    if (!patientId) return toast.error("Select a patient first.")
    if (!items.length)
      return toast.error("Add at least one reviewed service charge.")
    if (
      items.some(
        (item) =>
          !item.description.trim() || item.quantity < 1 || item.unitPrice < 0
      )
    )
      return toast.error("Review every description, quantity, and price.")
    try {
      const invoice = await create.mutateAsync({
        patientId,
        encounterId: summary.data?.activeEncounter?.id,
        items: items.map((item) => ({
          description: item.description,
          itemType: item.itemType,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          referenceId: item.referenceId,
          sourceKey: item.sourceKey,
        })),
        discountAmount: Number(discount) || 0,
        taxAmount: Number(tax) || 0,
        notes: notes || null,
      })
      if (issue)
        await billingMutate<InvoiceDetail, { status: "ISSUED" }>(
          "patch",
          `/billing/invoices/${invoice.id}`,
          { status: "ISSUED" }
        )
      toast.success(
        issue ? "Invoice issued successfully." : "Draft invoice saved."
      )
      router.push(`/billing/invoices/${invoice.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invoice could not be saved."
      )
    }
  }
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Create New Invoice"
        description="Review patient services, confirm Ghana-cedi prices, and save a draft or issue the invoice."
        actions={
          <>
            <Button
              variant="outline"
              disabled={create.isPending}
              onClick={() => void save(false)}
            >
              <Save />
              Save draft
            </Button>
            <Button disabled={create.isPending} onClick={() => void save(true)}>
              Issue invoice
            </Button>
          </>
        }
      />
      {!patientId ? (
        <BillingPanel title="Find patient">
          <div className="space-y-3 p-4">
            <Input
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              placeholder="Patient name, number, phone or NHIS"
            />
            {patients.isLoading ? (
              <BillingLoading />
            ) : (
              <div className="grid gap-2">
                {patients.data?.items.map((patient) => (
                  <button
                    key={patient.id}
                    className="flex items-center justify-between rounded-md border p-3 text-left hover:border-primary hover:bg-green-50"
                    onClick={() => {
                      setPatientId(patient.id)
                      setItems([])
                    }}
                  >
                    <span>
                      <span className="block font-semibold">
                        {patient.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {patient.patientNo} · {patient.phone || "No phone"}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-red-700">
                      {billingMoney(patient.outstandingBalance)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </BillingPanel>
      ) : summary.isLoading ? (
        <BillingLoading label="Loading patient billing profile…" />
      ) : summary.isError || !summary.data ? (
        <BillingErrorPanel message={summary.error?.message} />
      ) : (
        <>
          <BillingPanel>
            <div className="flex flex-col justify-between gap-3 p-5 sm:flex-row">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-xl font-bold">
                    {summary.data.patient.name}
                  </h2>
                  <BillingStatusBadge value="ACTIVE" />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {summary.data.patient.patientNo} · NHIS{" "}
                  {summary.data.patient.nhisNumber || "not recorded"} ·{" "}
                  {summary.data.patient.phone || "no phone"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.data.activeEncounter
                    ? `${summary.data.activeEncounter.departmentName} · ${summary.data.activeEncounter.encounterNo}`
                    : "No active encounter"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Balance brought forward
                </p>
                <p className="font-heading text-2xl font-bold">
                  {billingMoney(summary.data.outstandingBalance)}
                </p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setPatientId("")
                    setItems([])
                  }}
                >
                  Change patient
                </Button>
              </div>
            </div>
          </BillingPanel>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,0.7fr)]">
            <div className="space-y-5">
              <BillingPanel
                title="Pending Charges"
                actions={
                  <Button variant="outline" size="sm" onClick={addCustom}>
                    <Plus />
                    Custom item
                  </Button>
                }
              >
                <div className="divide-y">
                  {summary.data.pendingCharges.length ? (
                    summary.data.pendingCharges.map((charge) => (
                      <div
                        key={charge.sourceKey}
                        className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
                      >
                        <div>
                          <p className="font-semibold">{charge.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {charge.itemType.replaceAll("_", " ")} ·{" "}
                            {charge.sourceLabel}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-semibold">
                            {charge.unitPrice === null
                              ? "Price required"
                              : billingMoney(charge.totalPrice)}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => addPending(charge)}
                          >
                            Add
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <BillingEmpty
                      title="No pending charges"
                      description="Add an approved custom charge if a service is not represented."
                    />
                  )}
                </div>
              </BillingPanel>
              <BillingPanel title="Invoice Items">
                {items.length ? (
                  <div className="divide-y">
                    {items.map((item) => (
                      <div
                        key={item.key}
                        className="grid gap-3 p-4 md:grid-cols-[minmax(180px,1fr)_120px_150px_120px_auto]"
                      >
                        <Input
                          value={item.description}
                          onChange={(event) =>
                            patchItem(item.key, {
                              description: event.target.value,
                            })
                          }
                        />
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            patchItem(item.key, {
                              quantity: Math.max(
                                1,
                                Number(event.target.value) || 1
                              ),
                            })
                          }
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) =>
                            patchItem(item.key, {
                              unitPrice: Math.max(
                                0,
                                Number(event.target.value) || 0
                              ),
                            })
                          }
                        />
                        <p className="self-center font-semibold">
                          {billingMoney(item.quantity * item.unitPrice)}
                        </p>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setItems((current) =>
                              current.filter(
                                (candidate) => candidate.key !== item.key
                              )
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <BillingEmpty
                    title="Invoice is empty"
                    description="Add reviewed pending charges or an approved custom item."
                  />
                )}
              </BillingPanel>
              <BillingPanel title="Invoice Adjustments">
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                  <label className="text-sm font-medium">
                    Discount amount (GH₵)
                    <Input
                      className="mt-1"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discount}
                      onChange={(event) => setDiscount(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium">
                    Tax amount (GH₵)
                    <Input
                      className="mt-1"
                      type="number"
                      min="0"
                      step="0.01"
                      value={tax}
                      onChange={(event) => setTax(event.target.value)}
                    />
                  </label>
                  <label className="text-sm font-medium sm:col-span-2">
                    Internal notes
                    <textarea
                      className={`${billingControl} mt-1 min-h-24`}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Billing notes; no clinical information"
                    />
                  </label>
                </div>
              </BillingPanel>
            </div>
            <div className="space-y-4">
              <BillingPanel>
                <div className="bg-deep-forest p-6 text-white">
                  <p className="text-xs font-semibold tracking-[0.18em] text-white/65 uppercase">
                    Total amount due
                  </p>
                  <p className="mt-3 font-heading text-4xl font-bold">
                    {billingMoney(total)}
                  </p>
                  <div className="mt-6 space-y-2 border-t border-white/20 pt-4 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>{billingMoney(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Discount</span>
                      <span>- {billingMoney(Number(discount) || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tax</span>
                      <span>{billingMoney(Number(tax) || 0)}</span>
                    </div>
                  </div>
                </div>
              </BillingPanel>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                <p className="font-semibold">Billing policy</p>
                <p className="mt-1">
                  Confirm the patient, service reference, quantity, and
                  Ghana-cedi price before issuing. Server totals remain
                  authoritative.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export function InvoiceDetailPage({ invoiceId }: { invoiceId: string }) {
  const query = useBillingInvoice(invoiceId)
  const update = useUpdateInvoice(invoiceId)
  const documentEvent = useDocumentEvent()
  if (query.isLoading) return <BillingLoading />
  if (query.isError || !query.data)
    return <BillingErrorPanel message={query.error?.message} />
  const invoice = query.data
  async function transition(status: "ISSUED" | "CANCELLED" | "VOID") {
    const reason =
      status === "ISSUED"
        ? undefined
        : window.prompt(`Enter the ${status.toLowerCase()} reason:`)?.trim()
    if (status !== "ISSUED" && !reason) return
    if (
      !window.confirm(
        `Confirm ${status.toLowerCase()} for ${invoice.invoiceNo}?`
      )
    )
      return
    try {
      await update.mutateAsync({ status, reason })
      toast.success(`Invoice ${status.toLowerCase()} successfully.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Invoice could not be updated."
      )
    }
  }
  async function printInvoice() {
    try {
      await documentEvent.mutateAsync({
        documentType: "INVOICE",
        documentId: invoice.id,
        action: "PRINT",
      })
      window.print()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Print event could not be recorded."
      )
    }
  }
  async function exportInvoice() {
    try {
      await documentEvent.mutateAsync({
        documentType: "INVOICE",
        documentId: invoice.id,
        action: "EXPORT",
      })
      window.print()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Export event could not be recorded."
      )
    }
  }
  const progress = invoice.totalAmount
    ? Math.min(
        100,
        Math.round((invoice.amountPaid / invoice.totalAmount) * 100)
      )
    : 0
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title={`Invoice ${invoice.invoiceNo}`}
        description={`${invoice.patient.name} · ${invoice.patient.patientNo}`}
        actions={
          <>
            <Button variant="outline" onClick={() => void exportInvoice()}>
              Export / Save PDF
            </Button>
            <Button variant="outline" onClick={() => void printInvoice()}>
              <Printer />
              Print
            </Button>
            {invoice.status === "DRAFT" ? (
              <Button onClick={() => void transition("ISSUED")}>
                Issue invoice
              </Button>
            ) : null}
            {["ISSUED", "PARTIALLY_PAID"].includes(invoice.status) ? (
              <Button asChild>
                <Link href={`/billing/invoices/${invoice.id}/payment`}>
                  Record payment
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <BillingStatGrid
        items={[
          { label: "Total", value: billingMoney(invoice.totalAmount) },
          {
            label: "Paid",
            value: billingMoney(invoice.amountPaid),
            tone: "green",
          },
          {
            label: "Balance",
            value: billingMoney(invoice.balanceDue),
            tone: invoice.balanceDue ? "red" : "green",
          },
          {
            label: "Status",
            value: invoice.status.replaceAll("_", " "),
            tone:
              invoice.status === "PAID"
                ? "green"
                : invoice.status === "PARTIALLY_PAID"
                  ? "orange"
                  : "neutral",
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.6fr)]">
        <BillingPanel title="Service Summary">
          <BillingTable
            headers={[
              "Description",
              "Type",
              "Reference",
              "Qty",
              "Unit Price",
              "Total",
            ]}
          >
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className={billingTd}>{item.description}</td>
                <td className={billingTd}>
                  {item.itemType.replaceAll("_", " ")}
                </td>
                <td className={billingTd}>{item.referenceId || "Custom"}</td>
                <td className={billingTd}>{item.quantity}</td>
                <td className={billingTd}>{billingMoney(item.unitPrice)}</td>
                <td className={`${billingTd} font-semibold`}>
                  {billingMoney(item.totalPrice)}
                </td>
              </tr>
            ))}
          </BillingTable>
          <div className="ml-auto max-w-sm space-y-2 border-t p-5 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{billingMoney(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>{billingMoney(invoice.discountAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>{billingMoney(invoice.taxAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base font-bold">
              <span>Total</span>
              <span>{billingMoney(invoice.totalAmount)}</span>
            </div>
          </div>
        </BillingPanel>
        <div className="space-y-5">
          <BillingPanel title="Collection Progress">
            <div className="p-5">
              <div className="mb-2 flex justify-between text-sm">
                <span>Collected</span>
                <strong>{progress}%</strong>
              </div>
              <div className="h-3 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-4">
                <BillingStatusBadge value={invoice.status} />
              </div>
            </div>
          </BillingPanel>
          <BillingPanel title="Actions">
            <div className="grid gap-2 p-4">
              {invoice.status === "DRAFT" ? (
                <Button
                  variant="destructive"
                  onClick={() => void transition("CANCELLED")}
                >
                  Cancel draft
                </Button>
              ) : null}
              {invoice.status === "ISSUED" && invoice.amountPaid === 0 ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => void transition("CANCELLED")}
                  >
                    Cancel invoice
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => void transition("VOID")}
                  >
                    Void invoice
                  </Button>
                </>
              ) : null}
            </div>
          </BillingPanel>
        </div>
      </div>
      <BillingPanel title="Payment History">
        {invoice.payments.length ? (
          <BillingTable
            headers={[
              "Receipt",
              "Method",
              "Amount",
              "Status",
              "Received by",
              "Date",
              "Actions",
            ]}
          >
            {invoice.payments.map((payment) => (
              <tr key={payment.id}>
                <td className={billingTd}>
                  <Link
                    className="font-semibold text-primary"
                    href={`/billing/receipts/${payment.id}`}
                  >
                    {payment.receiptNo}
                  </Link>
                </td>
                <td className={billingTd}>
                  {payment.method.replaceAll("_", " ")}
                </td>
                <td className={billingTd}>{billingMoney(payment.amount)}</td>
                <td className={billingTd}>
                  <BillingStatusBadge value={payment.status} />
                </td>
                <td className={billingTd}>{payment.receivedByName || "—"}</td>
                <td className={billingTd}>{billingDate(payment.paidAt)}</td>
                <td className={billingTd}>
                  {payment.status === "SUCCESSFUL" ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/billing/payments/${payment.id}/reverse`}>
                        Reverse
                      </Link>
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </BillingTable>
        ) : (
          <BillingEmpty
            title="No payments recorded"
            description="Record a partial or full payment after the invoice is issued."
          />
        )}
      </BillingPanel>
    </div>
  )
}

export function RecordPaymentPage({ invoiceId }: { invoiceId: string }) {
  const router = useRouter()
  const invoiceQuery = useBillingInvoice(invoiceId)
  const create = useCreatePayment(invoiceId)
  const lookups = useBillingLookups()
  const [method, setMethod] = useState<PaymentMethod>("CASH")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [approvalReference, setApprovalReference] = useState("")
  const [approvedById, setApprovedById] = useState("")
  if (invoiceQuery.isLoading) return <BillingLoading />
  if (invoiceQuery.isError || !invoiceQuery.data)
    return <BillingErrorPanel message={invoiceQuery.error?.message} />
  const invoice = invoiceQuery.data
  const paying = Math.max(0, Number(amount) || 0)
  const balanceAfter = Math.max(0, invoice.balanceDue - paying)
  async function submit() {
    if (!paying) return toast.error("Enter an amount greater than zero.")
    if (
      !window.confirm(
        `Record ${billingMoney(paying)} against ${invoice.invoiceNo}?`
      )
    )
      return
    try {
      const payment = await create.mutateAsync({
        method,
        amount: paying,
        reference: reference || null,
        notes: notes || null,
        approvalReference: approvalReference || null,
        approvedById: approvedById || null,
      })
      toast.success(`Payment recorded. Receipt ${payment.receiptNo}`)
      router.push(`/billing/receipts/${payment.id}`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Payment could not be recorded."
      )
    }
  }
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Record Payment"
        description="Confirm the invoice and collect a partial or full payment in Ghana cedis."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/billing/invoices/${invoice.id}`}>Cancel</Link>
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <BillingPanel title="Patient Details">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Patient
              </p>
              <p className="font-semibold">{invoice.patient.name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Patient ID
              </p>
              <p>{invoice.patient.patientNo}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Invoice
              </p>
              <p className="font-semibold text-primary">{invoice.invoiceNo}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase">
                Status
              </p>
              <BillingStatusBadge value={invoice.status} />
            </div>
          </div>
        </BillingPanel>
        <div className="rounded-lg bg-deep-forest p-6 text-white">
          <p className="text-xs font-semibold tracking-[0.16em] text-white/65 uppercase">
            Balance due
          </p>
          <p className="mt-2 font-heading text-3xl font-bold">
            {billingMoney(invoice.balanceDue)}
          </p>
          <div className="mt-5 flex justify-between border-t border-white/20 pt-4 text-sm">
            <span>Total {billingMoney(invoice.totalAmount)}</span>
            <span>Paid {billingMoney(invoice.amountPaid)}</span>
          </div>
        </div>
      </div>
      <BillingPanel title="Payment Collection Form">
        <div className="mx-auto grid max-w-3xl gap-4 p-5 sm:grid-cols-2">
          <label className="text-sm font-medium">
            Payment method
            <select
              className={`${billingControl} mt-1`}
              value={method}
              onChange={(event) =>
                setMethod(event.target.value as PaymentMethod)
              }
            >
              {[
                "CASH",
                "MOBILE_MONEY",
                "CARD",
                "BANK_TRANSFER",
                "NHIS",
                "WAIVER",
                "OTHER",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Payment date
            <Input
              className="mt-1"
              value={new Date().toISOString().slice(0, 10)}
              disabled
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Amount received (GH₵)
            <Input
              className="mt-1 text-lg font-semibold"
              type="number"
              min="0.01"
              max={invoice.balanceDue}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </label>
          {["MOBILE_MONEY", "CARD", "BANK_TRANSFER", "NHIS"].includes(
            method
          ) ? (
            <label className="text-sm font-medium sm:col-span-2">
              Transaction reference
              <Input
                className="mt-1"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
            </label>
          ) : null}
          {method === "WAIVER" ? (
            <>
              <label className="text-sm font-medium">
                Approving officer
                <select
                  className={`${billingControl} mt-1`}
                  value={approvedById}
                  onChange={(event) => setApprovedById(event.target.value)}
                >
                  <option value="">Select approving officer</option>
                  {lookups.data?.approvingOfficers.map((officer) => (
                    <option key={officer.id} value={officer.id}>
                      {officer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Approval reference
                <Input
                  className="mt-1"
                  value={approvalReference}
                  onChange={(event) => setApprovalReference(event.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="text-sm font-medium sm:col-span-2">
            {method === "WAIVER" ? "Waiver reason" : "Payment notes"}
            <textarea
              className={`${billingControl} mt-1 min-h-20`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <div className="rounded-md border-l-4 border-primary bg-slate-50 p-4 sm:col-span-2">
            <div className="flex justify-between">
              <span>Outstanding balance</span>
              <strong>{billingMoney(invoice.balanceDue)}</strong>
            </div>
            <div className="mt-2 flex justify-between">
              <span>Paying now</span>
              <strong className="text-primary">{billingMoney(paying)}</strong>
            </div>
            <div className="mt-3 flex justify-between border-t pt-3 text-lg">
              <strong>Balance after payment</strong>
              <strong
                className={balanceAfter ? "text-red-700" : "text-primary"}
              >
                {billingMoney(balanceAfter)}
              </strong>
            </div>
          </div>
          <Button
            className="sm:col-span-2"
            disabled={create.isPending}
            onClick={() => void submit()}
          >
            {create.isPending
              ? "Recording…"
              : "Record Payment & Generate Receipt"}
          </Button>
        </div>
      </BillingPanel>
    </div>
  )
}

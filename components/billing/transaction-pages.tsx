"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Download, Eye, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  BillingEmpty,
  BillingErrorPanel,
  BillingLoading,
  BillingModal,
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
import {
  useBillingPayment,
  useBillingPayments,
  useBillingPatients,
  useDocumentEvent,
  useOutstandingBalances,
  usePatientBillingSummary,
  usePatientStatement,
  useReceipt,
  useReversePayment,
} from "@/services/billing/billing"

export function PatientBillingPage({
  initialSearch = "",
}: {
  initialSearch?: string
}) {
  const [search, setSearch] = useState(initialSearch)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const patients = useBillingPatients({ search, pageSize: 50 })
  const summary = usePatientBillingSummary(selectedId)
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Patient Billing"
        description="Search patients, review billing-only service summaries, and act on outstanding balances."
        actions={
          <Button asChild>
            <Link href="/billing/invoices/new">Create invoice</Link>
          </Button>
        }
      />
      <BillingPanel>
        <div className="p-4">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, patient number, phone, NHIS or invoice number"
          />
        </div>
      </BillingPanel>
      {patients.isLoading ? (
        <BillingLoading />
      ) : patients.isError ? (
        <BillingErrorPanel message={patients.error?.message} />
      ) : (
        <BillingPanel title={`${patients.data?.total ?? 0} patients`}>
          {patients.data?.items.length ? (
            <BillingTable
              headers={[
                "Patient No.",
                "Patient",
                "Phone",
                "NHIS",
                "Active invoices",
                "Outstanding",
                "Last payment",
                "Status",
                "Actions",
              ]}
            >
              {patients.data.items.map((patient) => (
                <tr key={patient.id}>
                  <td className={`${billingTd} font-semibold text-primary`}>
                    {patient.patientNo}
                  </td>
                  <td className={billingTd}>{patient.name}</td>
                  <td className={billingTd}>{patient.phone || "—"}</td>
                  <td className={billingTd}>
                    {patient.nhisNumber || "Not recorded"}
                  </td>
                  <td className={billingTd}>{patient.activeInvoiceCount}</td>
                  <td
                    className={`${billingTd} font-semibold ${patient.outstandingBalance ? "text-red-700" : "text-primary"}`}
                  >
                    {billingMoney(patient.outstandingBalance)}
                  </td>
                  <td className={billingTd}>
                    {billingDate(patient.lastPaymentAt)}
                  </td>
                  <td className={billingTd}>
                    <BillingStatusBadge value={patient.billingStatus} />
                  </td>
                  <td className={billingTd}>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedId(patient.id)}
                      >
                        <Eye />
                        Summary
                      </Button>
                      <Button size="sm" asChild>
                        <Link
                          href={`/billing/invoices/new?patientId=${patient.id}`}
                        >
                          Invoice
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </BillingTable>
          ) : (
            <BillingEmpty
              title="No patients found"
              description="Try another name, patient number, phone, NHIS, or invoice number."
            />
          )}
        </BillingPanel>
      )}
      <BillingModal
        title="Patient Billing Summary"
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
      >
        {summary.isLoading ? (
          <BillingLoading />
        ) : summary.isError || !summary.data ? (
          <BillingErrorPanel message={summary.error?.message} />
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="font-heading text-xl font-bold">
                {summary.data.patient.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {summary.data.patient.patientNo} · NHIS{" "}
                {summary.data.patient.nhisNumber || "not recorded"}
              </p>
            </div>
            <BillingStatGrid
              items={[
                {
                  label: "Outstanding",
                  value: billingMoney(summary.data.outstandingBalance),
                  tone: summary.data.outstandingBalance ? "red" : "green",
                },
                {
                  label: "Pending charges",
                  value: summary.data.pendingCharges.length,
                  tone: "orange",
                },
                { label: "Invoices", value: summary.data.invoices.length },
                {
                  label: "Last lab status",
                  value: summary.data.latestLabStatus || "None",
                },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link
                  href={`/billing/invoices/new?patientId=${summary.data.patient.id}`}
                >
                  Create invoice
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link
                  href={`/billing/patients/${summary.data.patient.id}/statement`}
                >
                  Print statement
                </Link>
              </Button>
              {summary.data.invoices.find((item) =>
                ["ISSUED", "PARTIALLY_PAID"].includes(item.status)
              ) ? (
                <Button variant="outline" asChild>
                  <Link
                    href={`/billing/invoices/${summary.data.invoices.find((item) => ["ISSUED", "PARTIALLY_PAID"].includes(item.status))?.id}/payment`}
                  >
                    Record payment
                  </Link>
                </Button>
              ) : null}
            </div>
            <BillingPanel title="Pending Service Charges">
              {summary.data.pendingCharges.length ? (
                <div className="divide-y">
                  {summary.data.pendingCharges.slice(0, 8).map((charge) => (
                    <div
                      key={charge.sourceKey}
                      className="flex justify-between gap-3 p-3 text-sm"
                    >
                      <span>
                        <strong className="block">{charge.description}</strong>
                        <span className="text-xs text-muted-foreground">
                          {charge.sourceLabel}
                        </span>
                      </span>
                      <span>
                        {charge.unitPrice === null
                          ? "Price review"
                          : billingMoney(charge.totalPrice)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <BillingEmpty
                  title="No pending charges"
                  description="All discovered service references have been billed."
                />
              )}
            </BillingPanel>
          </div>
        )}
      </BillingModal>
    </div>
  )
}

export function PaymentTransactionsPage({
  receiptsOnly = false,
}: {
  receiptsOnly?: boolean
}) {
  const [search, setSearch] = useState("")
  const [method, setMethod] = useState("")
  const [status, setStatus] = useState(receiptsOnly ? "SUCCESSFUL" : "")
  const query = useBillingPayments({ search, method, status, pageSize: 100 })
  const rows = query.data?.items ?? []
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title={receiptsOnly ? "Receipts" : "Payments & Receipts"}
        description={
          receiptsOnly
            ? "Find and print immutable payment receipts."
            : "Review transactions, print receipts, and reverse successful payments when correction is required."
        }
      />
      <BillingPanel>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Receipt, invoice, patient or reference"
          />
          <select
            className={billingControl}
            value={method}
            onChange={(event) => setMethod(event.target.value)}
          >
            <option value="">All methods</option>
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
          <select
            className={billingControl}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            disabled={receiptsOnly}
          >
            <option value="">All statuses</option>
            {["PENDING", "SUCCESSFUL", "FAILED", "REVERSED"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </BillingPanel>
      {query.isLoading ? (
        <BillingLoading />
      ) : query.isError ? (
        <BillingErrorPanel message={query.error?.message} />
      ) : (
        <BillingPanel title={`${query.data?.total ?? 0} transactions`}>
          {rows.length ? (
            <BillingTable
              headers={[
                "Receipt",
                "Invoice",
                "Patient",
                "Method",
                "Amount",
                "Status",
                "Reference",
                "Received by",
                "Date",
                "Actions",
              ]}
            >
              {rows.map((payment) => (
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
                    <Link
                      href={`/billing/invoices/${payment.invoiceId}`}
                      className="hover:underline"
                    >
                      {payment.invoiceNo}
                    </Link>
                  </td>
                  <td className={billingTd}>
                    <p>{payment.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment.patientNo}
                    </p>
                  </td>
                  <td className={billingTd}>
                    {payment.method.replaceAll("_", " ")}
                  </td>
                  <td className={`${billingTd} font-semibold`}>
                    {billingMoney(payment.amount)}
                  </td>
                  <td className={billingTd}>
                    <BillingStatusBadge value={payment.status} />
                  </td>
                  <td className={billingTd}>{payment.reference || "—"}</td>
                  <td className={billingTd}>{payment.receivedByName || "—"}</td>
                  <td className={billingTd}>{billingDate(payment.paidAt)}</td>
                  <td className={billingTd}>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/billing/receipts/${payment.id}`}>
                          <Printer />
                          Receipt
                        </Link>
                      </Button>
                      {payment.status === "SUCCESSFUL" && !receiptsOnly ? (
                        <Button variant="destructive" size="sm" asChild>
                          <Link
                            href={`/billing/payments/${payment.id}/reverse`}
                          >
                            Reverse
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
              title="No payments found"
              description="Successful collections will appear here with immutable receipts."
            />
          )}
        </BillingPanel>
      )}
    </div>
  )
}

export function ReceiptPage({ paymentId }: { paymentId: string }) {
  const query = useReceipt(paymentId)
  const event = useDocumentEvent()
  if (query.isLoading) return <BillingLoading />
  if (query.isError || !query.data)
    return <BillingErrorPanel message={query.error?.message} />
  const receipt = query.data
  async function print() {
    try {
      await event.mutateAsync({
        documentType: "RECEIPT",
        documentId: paymentId,
        action: "PRINT",
      })
      window.print()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Print event failed."
      )
    }
  }
  async function exportReceipt() {
    try {
      await event.mutateAsync({
        documentType: "RECEIPT",
        documentId: paymentId,
        action: "EXPORT",
      })
      window.print()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Export event failed."
      )
    }
  }
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Payment Receipt"
        description={`${receipt.receiptNo} · ${receipt.invoiceNo}`}
        actions={
          <>
            <Button variant="outline" onClick={() => void exportReceipt()}>
              <Download />
              Export / Save PDF
            </Button>
            <Button onClick={() => void print()}>
              <Printer />
              Print receipt
            </Button>
          </>
        }
      />
      <article className="mx-auto max-w-3xl rounded-lg border bg-white p-6 shadow-sm sm:p-10 print:border-0 print:shadow-none">
        <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row">
          <div>
            <p className="font-heading text-3xl font-bold text-primary">KHIP</p>
            <h2 className="mt-1 text-lg font-semibold">
              Kwadaso HealthLink Integrated Platform
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {receipt.facility.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {receipt.facility.address}
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Official receipt
            </p>
            <p className="mt-1 font-mono text-lg font-bold">
              {receipt.receiptNo}
            </p>
            <BillingStatusBadge value={receipt.payment.status} />
          </div>
        </div>
        <div className="grid gap-5 border-b py-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Patient
            </p>
            <p className="font-semibold">{receipt.patient.name}</p>
            <p className="text-sm">{receipt.patient.patientNo}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Invoice
            </p>
            <p className="font-semibold">{receipt.invoiceNo}</p>
            <p className="text-sm">{billingDate(receipt.payment.paidAt)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Payment method
            </p>
            <p>{receipt.payment.method.replaceAll("_", " ")}</p>
            <p className="text-sm text-muted-foreground">
              {receipt.payment.reference || "No external reference"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Received by
            </p>
            <p>{receipt.payment.receivedByName || "KHIP Billing"}</p>
          </div>
        </div>
        <div className="py-8 text-center">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Amount received
          </p>
          <p className="mt-2 font-heading text-4xl font-bold text-primary">
            {billingMoney(receipt.currentPayment)}
          </p>
        </div>
        <div className="space-y-3 rounded-md bg-slate-50 p-5 text-sm">
          <div className="flex justify-between">
            <span>Invoice total</span>
            <strong>{billingMoney(receipt.totalAmount)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Paid before</span>
            <strong>{billingMoney(receipt.amountPaidBefore)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Total paid</span>
            <strong>{billingMoney(receipt.totalPaid)}</strong>
          </div>
          <div className="flex justify-between border-t pt-3 text-base">
            <strong>Remaining balance</strong>
            <strong
              className={
                receipt.remainingBalance ? "text-red-700" : "text-primary"
              }
            >
              {billingMoney(receipt.remainingBalance)}
            </strong>
          </div>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Generated by KHIP. The original payment is preserved even if later
          reversed.
        </p>
      </article>
    </div>
  )
}

export function PaymentReversalPage({ paymentId }: { paymentId: string }) {
  const router = useRouter()
  const payment = useBillingPayment(paymentId)
  const reverse = useReversePayment(paymentId)
  const [reason, setReason] = useState("")
  const [reference, setReference] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  if (payment.isLoading) return <BillingLoading />
  if (payment.isError || !payment.data)
    return <BillingErrorPanel message={payment.error?.message} />
  async function submit() {
    if (!confirmed || reason.trim().length < 3)
      return toast.error("Confirm the warning and enter a reversal reason.")
    try {
      await reverse.mutateAsync({
        reason,
        reference: reference || null,
        confirmed: true,
      })
      toast.success("Payment reversed and invoice recalculated.")
      router.push(`/billing/invoices/${payment.data?.invoiceId}`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Payment could not be reversed."
      )
    }
  }
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Authorize Payment Reversal"
        description="The original transaction remains in the financial and audit history."
      />
      <BillingPanel title="Payment Summary">
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Receipt</p>
            <p className="font-semibold">{payment.data.receiptNo}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Invoice</p>
            <p>{payment.data.invoiceNo}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Patient</p>
            <p>{payment.data.patientName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Amount</p>
            <p className="font-semibold">{billingMoney(payment.data.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Method</p>
            <p>{payment.data.method.replaceAll("_", " ")}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">
              Received by
            </p>
            <p>{payment.data.receivedByName || "—"}</p>
          </div>
        </div>
      </BillingPanel>
      <div className="rounded-lg border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900">
        <strong>Warning:</strong> This action will reverse the payment and
        recalculate the invoice balance. The original transaction will remain in
        the audit history.
      </div>
      <BillingPanel title="Reversal Confirmation">
        <div className="grid gap-4 p-5">
          <label className="text-sm font-medium">
            Reversal reason
            <textarea
              className={`${billingControl} mt-1 min-h-24`}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium">
            Supporting reference (optional)
            <Input
              className="mt-1"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </label>
          <label className="flex items-start gap-3 rounded-md border p-3 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              I have verified the receipt, amount, patient, and reason. I
              understand this recalculates the invoice.
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" asChild>
              <Link href={`/billing/invoices/${payment.data.invoiceId}`}>
                Cancel
              </Link>
            </Button>
            <Button
              variant="destructive"
              disabled={reverse.isPending}
              onClick={() => void submit()}
            >
              {reverse.isPending ? "Reversing…" : "Confirm reversal"}
            </Button>
          </div>
        </div>
      </BillingPanel>
    </div>
  )
}

export function OutstandingBalancesPage() {
  const [search, setSearch] = useState("")
  const [days, setDays] = useState("")
  const query = useOutstandingBalances({ search, days, pageSize: 100 })
  const rows = query.data?.items ?? []
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Outstanding Balances"
        description="Prioritize unpaid and partially paid invoices by age and balance."
      />
      <BillingStatGrid
        items={[
          {
            label: "Total outstanding",
            value: billingMoney(
              rows.reduce((sum, item) => sum + item.balanceDue, 0)
            ),
            tone: "red",
          },
          {
            label: "Overdue (>30 days)",
            value: rows.filter((item) => item.daysOutstanding > 30).length,
            tone: "red",
          },
          {
            label: "Partially paid",
            value: rows.filter((item) => item.status === "PARTIALLY_PAID")
              .length,
            tone: "orange",
          },
          {
            label: "NHIS patients",
            value: rows.filter((item) => item.nhisStatus === "NHIS").length,
            tone: "green",
          },
        ]}
      />
      <BillingPanel>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Patient or invoice"
          />
          <select
            className={billingControl}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="">All ages</option>
            <option value="7">Older than 7 days</option>
            <option value="30">Older than 30 days</option>
            <option value="60">Older than 60 days</option>
          </select>
        </div>
      </BillingPanel>
      {query.isLoading ? (
        <BillingLoading />
      ) : query.isError ? (
        <BillingErrorPanel message={query.error?.message} />
      ) : (
        <BillingPanel title={`${query.data?.total ?? 0} outstanding invoices`}>
          {rows.length ? (
            <BillingTable
              headers={[
                "Patient",
                "Invoice",
                "Invoice date",
                "Total",
                "Paid",
                "Balance",
                "Days",
                "Last payment",
                "Status",
                "Actions",
              ]}
            >
              {rows.map((item) => (
                <tr key={item.id}>
                  <td className={billingTd}>
                    <p className="font-medium">{item.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.patientNo} · {item.nhisStatus}
                    </p>
                  </td>
                  <td className={billingTd}>{item.invoiceNo}</td>
                  <td className={billingTd}>{billingDate(item.invoiceDate)}</td>
                  <td className={billingTd}>
                    {billingMoney(item.totalAmount)}
                  </td>
                  <td className={billingTd}>{billingMoney(item.amountPaid)}</td>
                  <td className={`${billingTd} font-semibold text-red-700`}>
                    {billingMoney(item.balanceDue)}
                  </td>
                  <td className={billingTd}>
                    <BillingStatusBadge
                      value={item.daysOutstanding > 30 ? "OVERDUE" : "RECENT"}
                    />
                    <p className="mt-1 text-xs">{item.daysOutstanding} days</p>
                  </td>
                  <td className={billingTd}>
                    {billingDate(item.lastPaymentAt)}
                  </td>
                  <td className={billingTd}>
                    <BillingStatusBadge value={item.status} />
                  </td>
                  <td className={billingTd}>
                    <div className="flex gap-2">
                      <Button size="sm" asChild>
                        <Link href={`/billing/invoices/${item.id}/payment`}>
                          Pay
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/billing/invoices/${item.id}`}>View</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </BillingTable>
          ) : (
            <BillingEmpty
              title="No outstanding balances"
              description="All issued invoices are currently settled."
            />
          )}
        </BillingPanel>
      )}
    </div>
  )
}

export function PatientStatementPage({ patientId }: { patientId: string }) {
  const query = usePatientStatement(patientId)
  const event = useDocumentEvent()
  if (query.isLoading) return <BillingLoading />
  if (query.isError || !query.data)
    return <BillingErrorPanel message={query.error?.message} />
  const data = query.data
  async function print() {
    try {
      await event.mutateAsync({
        documentType: "STATEMENT",
        documentId: patientId,
        action: "PRINT",
      })
      window.print()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Print event failed."
      )
    }
  }
  async function exportStatement() {
    try {
      await event.mutateAsync({
        documentType: "STATEMENT",
        documentId: patientId,
        action: "EXPORT",
      })
      window.print()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Export event failed."
      )
    }
  }
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Patient Billing Statement"
        description={`${data.patient.name} · ${data.patient.patientNo}`}
        actions={
          <>
            <Button variant="outline" onClick={() => void exportStatement()}>
              <Download />
              Export / Save PDF
            </Button>
            <Button onClick={() => void print()}>
              <Printer />
              Print statement
            </Button>
          </>
        }
      />
      <BillingStatGrid
        items={[
          { label: "Total billed", value: billingMoney(data.totalBilled) },
          {
            label: "Total paid",
            value: billingMoney(data.totalPaid),
            tone: "green",
          },
          {
            label: "Reversed",
            value: billingMoney(data.totalReversed),
            tone: "red",
          },
          {
            label: "Outstanding",
            value: billingMoney(data.outstandingBalance),
            tone: data.outstandingBalance ? "red" : "green",
          },
        ]}
      />
      <BillingPanel title="Invoice History">
        {data.invoices.length ? (
          <BillingTable
            headers={[
              "Invoice",
              "Date",
              "Total",
              "Paid",
              "Balance",
              "Status",
              "Actions",
            ]}
          >
            {data.invoices.map((item) => (
              <tr key={item.id}>
                <td className={billingTd}>{item.invoiceNo}</td>
                <td className={billingTd}>{billingDate(item.createdAt)}</td>
                <td className={billingTd}>{billingMoney(item.totalAmount)}</td>
                <td className={billingTd}>{billingMoney(item.amountPaid)}</td>
                <td className={billingTd}>{billingMoney(item.balanceDue)}</td>
                <td className={billingTd}>
                  <BillingStatusBadge value={item.status} />
                </td>
                <td className={billingTd}>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/billing/invoices/${item.id}`}>View</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </BillingTable>
        ) : (
          <BillingEmpty
            title="No invoice history"
            description="This patient has not yet been invoiced."
          />
        )}
      </BillingPanel>
      <BillingPanel title="Payment History">
        {data.payments.length ? (
          <BillingTable
            headers={[
              "Receipt",
              "Invoice",
              "Date",
              "Method",
              "Amount",
              "Status",
            ]}
          >
            {data.payments.map((item) => (
              <tr key={item.id}>
                <td className={billingTd}>
                  <Link
                    className="text-primary"
                    href={`/billing/receipts/${item.id}`}
                  >
                    {item.receiptNo}
                  </Link>
                </td>
                <td className={billingTd}>{item.invoiceNo}</td>
                <td className={billingTd}>{billingDate(item.paidAt)}</td>
                <td className={billingTd}>
                  {item.method.replaceAll("_", " ")}
                </td>
                <td className={billingTd}>{billingMoney(item.amount)}</td>
                <td className={billingTd}>
                  <BillingStatusBadge value={item.status} />
                </td>
              </tr>
            ))}
          </BillingTable>
        ) : (
          <BillingEmpty
            title="No payment history"
            description="Payments will appear here after collection."
          />
        )}
      </BillingPanel>
    </div>
  )
}

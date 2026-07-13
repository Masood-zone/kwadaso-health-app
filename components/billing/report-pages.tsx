"use client"

import Link from "next/link"
import { useState } from "react"
import { Archive, Check, Download, Printer } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
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
import {
  useBillingNotifications,
  useBillingReports,
  useCreateBillingExport,
  useDailyCollections,
  useDocumentEvent,
  useNhisWaivers,
  useUpdateBillingNotification,
} from "@/services/billing/billing"
import type { BillingNotificationItem } from "@/types/billing"

export function DailyCollectionsPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const query = useDailyCollections(date)
  const createExport = useCreateBillingExport()
  const documentEvent = useDocumentEvent()
  async function printSummary() {
    try {
      const record = await createExport.mutateAsync({
        reportType: "DAILY_COLLECTIONS",
        title: `Daily collections - ${date}`,
        dateFrom: date,
        dateTo: date,
      })
      await documentEvent.mutateAsync({
        documentType: "REPORT",
        documentId: record.id,
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
  if (query.isLoading)
    return (
      <>
        <BillingPageHeader
          title="Daily Collections"
          description="Successful collections and reversals for a selected day."
        />
        <BillingLoading />
      </>
    )
  if (query.isError || !query.data)
    return <BillingErrorPanel message={query.error?.message} />
  const data = query.data
  const method = Object.fromEntries(
    data.byMethod.map((item) => [item.method, item.amount])
  )
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Daily Collections Overview"
        description="Payment method, officer, department, and hourly collection analysis."
        actions={
          <>
            <input
              type="date"
              className={billingControl}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Button
              variant="outline"
              disabled={createExport.isPending || documentEvent.isPending}
              onClick={() => void printSummary()}
            >
              <Printer />
              Print summary
            </Button>
          </>
        }
      />
      <BillingStatGrid
        items={[
          {
            label: "Total collected",
            value: billingMoney(data.totalCollected),
            tone: "green",
          },
          { label: "Invoices created", value: data.invoiceCount },
          { label: "Cash", value: billingMoney(method.CASH || 0) },
          {
            label: "Mobile Money",
            value: billingMoney(method.MOBILE_MONEY || 0),
          },
          { label: "Card", value: billingMoney(method.CARD || 0) },
          {
            label: "Bank Transfer",
            value: billingMoney(method.BANK_TRANSFER || 0),
          },
          {
            label: "NHIS / Waiver",
            value: billingMoney((method.NHIS || 0) + (method.WAIVER || 0)),
            tone: "orange",
          },
          {
            label: "Reversed",
            value: billingMoney(data.reversedAmount),
            tone: "red",
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <BillingPanel title="Method Breakdown">
          <div className="space-y-3 p-4">
            {data.byMethod.length ? (
              data.byMethod.map((item) => (
                <div
                  key={item.method}
                  className="flex justify-between border-b pb-2 text-sm"
                >
                  <span>
                    {item.method.replaceAll("_", " ")}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({item.count})
                    </span>
                  </span>
                  <strong>{billingMoney(item.amount)}</strong>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No collections.</p>
            )}
          </div>
        </BillingPanel>
        <BillingPanel title="Collections by Officer">
          <div className="space-y-3 p-4">
            {data.byOfficer.map((item) => (
              <div
                key={item.officer}
                className="flex justify-between border-b pb-2 text-sm"
              >
                <span>{item.officer}</span>
                <strong>{billingMoney(item.amount)}</strong>
              </div>
            ))}
          </div>
        </BillingPanel>
        <BillingPanel title="Collections by Department">
          <div className="space-y-3 p-4">
            {data.byDepartment.map((item) => (
              <div
                key={item.department}
                className="flex justify-between border-b pb-2 text-sm"
              >
                <span>{item.department}</span>
                <strong>{billingMoney(item.amount)}</strong>
              </div>
            ))}
          </div>
        </BillingPanel>
      </div>
      <BillingPanel title="Hourly Collection Trend">
        <div className="flex h-52 items-end gap-2 p-5">
          {data.hourly.length ? (
            data.hourly.map((item) => {
              const max = Math.max(
                ...data.hourly.map((entry) => entry.amount),
                1
              )
              return (
                <div
                  key={item.hour}
                  className="flex h-full flex-1 flex-col justify-end"
                >
                  <div
                    className="rounded-t bg-primary"
                    title={billingMoney(item.amount)}
                    style={{
                      height: `${Math.max(4, (item.amount / max) * 100)}%`,
                    }}
                  />
                  <p className="mt-2 text-center text-[10px]">{item.hour}</p>
                </div>
              )
            })
          ) : (
            <BillingEmpty
              title="No hourly activity"
              description="Successful payments will produce the collection trend."
            />
          )}
        </div>
      </BillingPanel>
      <BillingPanel title="Recent Transactions">
        {data.transactions.length ? (
          <BillingTable
            headers={[
              "Receipt",
              "Patient",
              "Method",
              "Amount",
              "Officer",
              "Time",
              "Status",
            ]}
          >
            {data.transactions.map((item) => (
              <tr key={item.id}>
                <td className={billingTd}>
                  <Link
                    className="text-primary"
                    href={`/billing/receipts/${item.id}`}
                  >
                    {item.receiptNo}
                  </Link>
                </td>
                <td className={billingTd}>{item.patientName}</td>
                <td className={billingTd}>
                  {item.method.replaceAll("_", " ")}
                </td>
                <td className={billingTd}>{billingMoney(item.amount)}</td>
                <td className={billingTd}>{item.receivedByName || "—"}</td>
                <td className={billingTd}>{billingDate(item.paidAt)}</td>
                <td className={billingTd}>
                  <BillingStatusBadge value={item.status} />
                </td>
              </tr>
            ))}
          </BillingTable>
        ) : (
          <BillingEmpty
            title="No transactions"
            description="No payment activity was found for this date."
          />
        )}
      </BillingPanel>
    </div>
  )
}

export function NhisWaiversPage() {
  const query = useNhisWaivers()
  if (query.isLoading) return <BillingLoading />
  if (query.isError || !query.data)
    return <BillingErrorPanel message={query.error?.message} />
  const renderTable = (items: typeof query.data.nhis, waiver = false) =>
    items.length ? (
      <BillingTable
        headers={[
          "Patient",
          "Invoice",
          waiver ? "Waived amount" : "Covered amount",
          waiver ? "Reason" : "NHIS reference",
          waiver ? "Approved by" : "Status",
          "Date",
          "Actions",
        ]}
      >
        {items.map((item) => (
          <tr key={item.id}>
            <td className={billingTd}>
              <p className="font-medium">{item.patientName}</p>
              <p className="text-xs text-muted-foreground">{item.patientNo}</p>
            </td>
            <td className={billingTd}>{item.invoiceNo}</td>
            <td className={`${billingTd} font-semibold`}>
              {billingMoney(item.amount)}
            </td>
            <td className={billingTd}>
              {waiver ? item.notes : item.reference || "—"}
            </td>
            <td className={billingTd}>
              {waiver ? (
                `${item.approvedByName || "—"} · ${item.approvalReference || "No ref"}`
              ) : (
                <BillingStatusBadge value={item.status} />
              )}
            </td>
            <td className={billingTd}>{billingDate(item.paidAt)}</td>
            <td className={billingTd}>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/billing/receipts/${item.id}`}>View receipt</Link>
              </Button>
            </td>
          </tr>
        ))}
      </BillingTable>
    ) : (
      <BillingEmpty
        title={waiver ? "No waivers recorded" : "No NHIS payments recorded"}
        description="Use the Record Payment screen and select the appropriate payment method."
      />
    )
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="NHIS & Waivers"
        description="Track NHIS-covered amounts and approved financial waivers as immutable payment records."
        actions={
          <Button asChild>
            <Link href="/billing/outstanding">Select invoice to pay</Link>
          </Button>
        }
      />
      <BillingStatGrid
        items={[
          {
            label: "NHIS covered",
            value: billingMoney(
              query.data.nhis
                .filter((item) => item.status === "SUCCESSFUL")
                .reduce((sum, item) => sum + item.amount, 0)
            ),
            tone: "green",
          },
          { label: "NHIS transactions", value: query.data.nhis.length },
          {
            label: "Waived amount",
            value: billingMoney(
              query.data.waivers
                .filter((item) => item.status === "SUCCESSFUL")
                .reduce((sum, item) => sum + item.amount, 0)
            ),
            tone: "orange",
          },
          { label: "Waiver records", value: query.data.waivers.length },
        ]}
      />
      <BillingPanel title="NHIS Management">
        {renderTable(query.data.nhis)}
      </BillingPanel>
      <BillingPanel title="Waivers Management">
        {renderTable(query.data.waivers, true)}
      </BillingPanel>
    </div>
  )
}

export function FinancialReportsPage() {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [reportType, setReportType] = useState("DATE_RANGE_SUMMARY")
  const query = useBillingReports({ dateFrom, dateTo, reportType })
  const createExport = useCreateBillingExport()
  const documentEvent = useDocumentEvent()
  if (query.isLoading) return <BillingLoading />
  if (query.isError || !query.data)
    return <BillingErrorPanel message={query.error?.message} />
  const data = query.data
  async function exportReport() {
    try {
      const record = await createExport.mutateAsync({
        reportType,
        title: `${reportType.replaceAll("_", " ")} - ${new Date().toLocaleDateString("en-GH")}`,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      toast.success(`${record.title} queued. Download generation is WIP.`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Export could not be queued."
      )
    }
  }
  async function print() {
    try {
      const record =
        data.exports[0] ??
        (await createExport.mutateAsync({
          reportType,
          title: `${reportType.replaceAll("_", " ")} - ${new Date().toLocaleDateString("en-GH")}`,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        }))
      await documentEvent.mutateAsync({
        documentType: "REPORT",
        documentId: record.id,
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
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Financial Reporting Hub"
        description="Generate facility-scoped financial summaries and queue audited export metadata."
        actions={
          <>
            <Button variant="outline" onClick={() => void print()}>
              <Printer />
              Print summary
            </Button>
            <Button
              onClick={() => void exportReport()}
              disabled={createExport.isPending}
            >
              <Download />
              Create export
            </Button>
          </>
        }
      />
      <BillingPanel>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <select
            className={billingControl}
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            {[
              "DATE_RANGE_SUMMARY",
              "DAILY_COLLECTIONS",
              "PAYMENTS_BY_METHOD",
              "OUTSTANDING_BALANCES",
              "PAID_INVOICES",
              "PARTIALLY_PAID",
              "CANCELLED_INVOICES",
              "REVERSED_PAYMENTS",
              "REVENUE_BY_DEPARTMENT",
              "REVENUE_BY_SERVICE",
              "REVENUE_BY_OFFICER",
              "NHIS_PAYMENTS",
              "WAIVERS",
            ].map((item) => (
              <option key={item}>{item.replaceAll("_", " ")}</option>
            ))}
          </select>
          <input
            className={billingControl}
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
          <input
            className={billingControl}
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>
      </BillingPanel>
      <BillingStatGrid
        items={[
          { label: "Total billed", value: billingMoney(data.totalBilled) },
          {
            label: "Total collected",
            value: billingMoney(data.totalCollected),
            tone: "green",
          },
          {
            label: "Outstanding",
            value: billingMoney(data.outstandingBalance),
            tone: "red",
          },
          {
            label: "Reversed",
            value: billingMoney(data.reversedAmount),
            tone: "red",
          },
          { label: "Invoices", value: data.invoiceCount },
          { label: "Payments", value: data.paymentCount },
          {
            label: "Average invoice",
            value: billingMoney(data.averageInvoiceValue),
          },
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <BillingPanel title="Payment Methods">
          <div className="space-y-2 p-4">
            {data.byMethod.map((item) => (
              <div
                key={item.label}
                className="flex justify-between border-b pb-2 text-sm"
              >
                <span>{item.label.replaceAll("_", " ")}</span>
                <strong>{billingMoney(item.amount)}</strong>
              </div>
            ))}
          </div>
        </BillingPanel>
        <BillingPanel title="Revenue by Department">
          <div className="space-y-2 p-4">
            {data.byDepartment.map((item) => (
              <div
                key={item.label}
                className="flex justify-between border-b pb-2 text-sm"
              >
                <span>{item.label}</span>
                <strong>{billingMoney(item.amount)}</strong>
              </div>
            ))}
          </div>
        </BillingPanel>
        <BillingPanel title="Revenue by Service">
          <div className="space-y-2 p-4">
            {data.byServiceType.map((item) => (
              <div
                key={item.label}
                className="flex justify-between border-b pb-2 text-sm"
              >
                <span>{item.label.replaceAll("_", " ")}</span>
                <strong>{billingMoney(item.amount)}</strong>
              </div>
            ))}
          </div>
        </BillingPanel>
      </div>
      <BillingPanel title="Export History">
        {data.exports.length ? (
          <BillingTable
            headers={[
              "Title",
              "Status",
              "Requested by",
              "Requested at",
              "Download",
            ]}
          >
            {data.exports.map((item) => (
              <tr key={item.id}>
                <td className={billingTd}>{item.title}</td>
                <td className={billingTd}>
                  <BillingStatusBadge value={item.status} />
                </td>
                <td className={billingTd}>{item.generatedByName || "—"}</td>
                <td className={billingTd}>{billingDate(item.generatedAt)}</td>
                <td className={billingTd}>
                  <span className="text-xs font-semibold text-orange-700">
                    WIP — metadata recorded
                  </span>
                </td>
              </tr>
            ))}
          </BillingTable>
        ) : (
          <BillingEmpty
            title="No exports requested"
            description="Create an export to record its metadata and audit event."
          />
        )}
      </BillingPanel>
    </div>
  )
}

function NotificationRow({ item }: { item: BillingNotificationItem }) {
  const update = useUpdateBillingNotification(item.id)
  async function change(status: "READ" | "ARCHIVED") {
    try {
      await update.mutateAsync(status)
      toast.success(
        status === "READ"
          ? "Notification marked as read."
          : "Notification archived."
      )
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Notification could not be updated."
      )
    }
  }
  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${item.priority === "URGENT" || item.priority === "HIGH" ? "border-red-600 bg-red-50" : item.status === "READ" ? "border-primary bg-green-50" : "border-orange-500 bg-orange-50"}`}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{item.title}</p>
            <BillingStatusBadge value={item.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {billingDate(item.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          {item.actionUrl ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={item.actionUrl}>Open</Link>
            </Button>
          ) : null}
          {item.status === "UNREAD" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void change("READ")}
            >
              <Check />
              Read
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void change("ARCHIVED")}
          >
            <Archive />
            Archive
          </Button>
        </div>
      </div>
    </div>
  )
}

export function BillingNotificationsPage() {
  const [status, setStatus] = useState("")
  const query = useBillingNotifications({ status, pageSize: 100 })
  return (
    <div className="space-y-5">
      <BillingPageHeader
        title="Billing Notifications"
        description="Billable-service, outstanding-invoice, payment, NHIS, waiver, and system alerts."
      />
      <BillingPanel>
        <div className="p-4">
          <select
            className={billingControl}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All notifications</option>
            <option value="UNREAD">Unread</option>
            <option value="READ">Read</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </BillingPanel>
      {query.isLoading ? (
        <BillingLoading />
      ) : query.isError ? (
        <BillingErrorPanel message={query.error?.message} />
      ) : query.data?.items.length ? (
        <div className="grid gap-3">
          {query.data.items.map((item) => (
            <NotificationRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <BillingPanel>
          <BillingEmpty
            title="No billing notifications"
            description="New billable services and financial alerts will appear here."
          />
        </BillingPanel>
      )}
    </div>
  )
}

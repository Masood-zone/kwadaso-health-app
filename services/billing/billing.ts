"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { billingGet, billingMutate, billingQuery } from "@/services/billing/client"
import { dashboardQueryKeys } from "@/lib/query-keys"
import { queryFreshness } from "@/lib/query-client"
import type {
  BillingDashboardSummary,
  BillingLookups,
  BillingNotificationItem,
  BillingPage,
  BillingReportSummary,
  DailyCollectionSummary,
  InvoiceCreatePayload,
  InvoiceDetail,
  InvoiceListItem,
  InvoiceUpdatePayload,
  OutstandingBalanceItem,
  PatientBillingListItem,
  PatientBillingStatement,
  PatientBillingSummary,
  PaymentCreatePayload,
  PaymentListItem,
  PaymentReversalPayload,
  ReceiptDetail,
} from "@/types/billing"

export const billingKeys = {
  all: ["billing"] as const,
  dashboard: dashboardQueryKeys.billing,
  lookups: ["billing", "lookups"] as const,
  patients: (filters: Record<string, unknown>) => ["billing", "patients", filters] as const,
  patient: (id: string) => ["billing", "patients", id] as const,
  invoices: (filters: Record<string, unknown>) => ["billing", "invoices", filters] as const,
  invoice: (id: string) => ["billing", "invoices", id] as const,
  payments: (filters: Record<string, unknown>) => ["billing", "payments", filters] as const,
  payment: (id: string) => ["billing", "payments", id] as const,
  outstanding: (filters: Record<string, unknown>) => ["billing", "outstanding", filters] as const,
  daily: (date: string) => ["billing", "daily-collections", date] as const,
  nhisWaivers: ["billing", "nhis-waivers"] as const,
  reports: (filters: Record<string, unknown>) => ["billing", "reports", filters] as const,
  notifications: (filters: Record<string, unknown>) => ["billing", "notifications", filters] as const,
}

function useBillingRefresh(...queryKeys: ReadonlyArray<readonly unknown[]>) {
  const queryClient = useQueryClient()
  return () => {
    queryKeys.forEach((queryKey) => {
      void queryClient.invalidateQueries({ queryKey })
    })
  }
}

export function useBillingDashboard() { return useQuery({ queryKey: billingKeys.dashboard, queryFn: () => billingGet<BillingDashboardSummary>("/billing/dashboard"), staleTime: queryFreshness.dashboard }) }
export function useBillingLookups() { return useQuery({ queryKey: billingKeys.lookups, queryFn: () => billingGet<BillingLookups>("/billing/lookups"), staleTime: queryFreshness.lookup }) }
export function useBillingPatients(filters: Record<string, unknown>) { return useQuery({ queryKey: billingKeys.patients(filters), queryFn: () => billingGet<BillingPage<PatientBillingListItem>>(billingQuery("/billing/patients", filters)) }) }
export function usePatientBillingSummary(id?: string | null) { return useQuery({ queryKey: billingKeys.patient(id || ""), queryFn: () => billingGet<PatientBillingSummary>(`/billing/patients/${id}/summary`), enabled: Boolean(id) }) }
export function usePatientStatement(id?: string | null, filters: Record<string, unknown> = {}) { return useQuery({ queryKey: ["billing", "patients", id, "statement", filters], queryFn: () => billingGet<PatientBillingStatement>(billingQuery(`/billing/patients/${id}/statement`, filters)), enabled: Boolean(id) }) }
export function useBillingInvoices(filters: Record<string, unknown>) { return useQuery({ queryKey: billingKeys.invoices(filters), queryFn: () => billingGet<BillingPage<InvoiceListItem>>(billingQuery("/billing/invoices", filters)) }) }
export function useBillingInvoice(id?: string | null) { return useQuery({ queryKey: billingKeys.invoice(id || ""), queryFn: () => billingGet<InvoiceDetail>(`/billing/invoices/${id}`), enabled: Boolean(id) }) }
export function useCreateInvoice() { const queryClient = useQueryClient(); const refresh = useBillingRefresh(["billing", "invoices"], billingKeys.dashboard, ["billing", "outstanding"]); return useMutation({ mutationFn: (payload: InvoiceCreatePayload) => billingMutate<InvoiceDetail, InvoiceCreatePayload>("post", "/billing/invoices", payload), onSuccess: (invoice) => { queryClient.setQueryData(billingKeys.invoice(invoice.id), invoice); refresh() } }) }
export function useUpdateInvoice(id: string) { const queryClient = useQueryClient(); const refresh = useBillingRefresh(["billing", "invoices"], billingKeys.dashboard, ["billing", "outstanding"]); return useMutation({ mutationFn: (payload: InvoiceUpdatePayload) => billingMutate<InvoiceDetail, InvoiceUpdatePayload>("patch", `/billing/invoices/${id}`, payload), onSuccess: (invoice) => { queryClient.setQueryData(billingKeys.invoice(id), invoice); refresh() } }) }
export function useBillingPayments(filters: Record<string, unknown>) { return useQuery({ queryKey: billingKeys.payments(filters), queryFn: () => billingGet<BillingPage<PaymentListItem>>(billingQuery("/billing/payments", filters)) }) }
export function useBillingPayment(id?: string | null) { return useQuery({ queryKey: billingKeys.payment(id || ""), queryFn: () => billingGet<PaymentListItem>(`/billing/payments/${id}`), enabled: Boolean(id) }) }
export function useCreatePayment(invoiceId: string) { const queryClient = useQueryClient(); const refresh = useBillingRefresh(["billing", "payments"], billingKeys.invoice(invoiceId), billingKeys.dashboard, ["billing", "outstanding"], ["billing", "daily-collections"]); return useMutation({ mutationFn: (payload: PaymentCreatePayload) => billingMutate<PaymentListItem, PaymentCreatePayload>("post", `/billing/invoices/${invoiceId}/payments`, payload), onSuccess: (payment) => { queryClient.setQueryData(billingKeys.payment(payment.id), payment); refresh() } }) }
export function useReversePayment(paymentId: string) { const queryClient = useQueryClient(); const refresh = useBillingRefresh(["billing", "payments"], billingKeys.dashboard, ["billing", "outstanding"], ["billing", "daily-collections"]); return useMutation({ mutationFn: (payload: PaymentReversalPayload) => billingMutate<PaymentListItem, PaymentReversalPayload>("post", `/billing/payments/${paymentId}/reverse`, payload), onSuccess: (payment) => { queryClient.setQueryData(billingKeys.payment(paymentId), payment); refresh() } }) }
export function useReceipt(id?: string | null) { return useQuery({ queryKey: ["billing", "receipts", id], queryFn: () => billingGet<ReceiptDetail>(`/billing/payments/${id}/receipt`), enabled: Boolean(id) }) }
export function useOutstandingBalances(filters: Record<string, unknown>) { return useQuery({ queryKey: billingKeys.outstanding(filters), queryFn: () => billingGet<BillingPage<OutstandingBalanceItem>>(billingQuery("/billing/outstanding", filters)) }) }
export function useDailyCollections(date: string) { return useQuery({ queryKey: billingKeys.daily(date), queryFn: () => billingGet<DailyCollectionSummary>(billingQuery("/billing/daily-collections", { date })) }) }
export function useNhisWaivers() { return useQuery({ queryKey: billingKeys.nhisWaivers, queryFn: () => billingGet<{ nhis: PaymentListItem[]; waivers: PaymentListItem[] }>("/billing/nhis-waivers") }) }
export function useBillingReports(filters: Record<string, unknown>) { return useQuery({ queryKey: billingKeys.reports(filters), queryFn: () => billingGet<BillingReportSummary>(billingQuery("/billing/reports", filters)) }) }
export function useCreateBillingExport() { const refresh = useBillingRefresh(["billing", "reports"]); return useMutation({ mutationFn: (payload: { reportType: string; title: string; dateFrom?: string; dateTo?: string; filters?: Record<string, unknown> }) => billingMutate<{ id: string; title: string; status: string }, typeof payload>("post", "/billing/reports/exports", payload), onSuccess: refresh }) }
export function useBillingNotifications(filters: Record<string, unknown>) { return useQuery({ queryKey: billingKeys.notifications(filters), queryFn: () => billingGet<BillingPage<BillingNotificationItem>>(billingQuery("/billing/notifications", filters)) }) }
export function useUpdateBillingNotification(id: string) { const refresh = useBillingRefresh(["billing", "notifications"]); return useMutation({ mutationFn: (status: "READ" | "ARCHIVED") => billingMutate<BillingNotificationItem, { status: "READ" | "ARCHIVED" }>("patch", `/billing/notifications/${id}`, { status }), onSuccess: refresh }) }
export function useDocumentEvent() { return useMutation({ mutationFn: (payload: { documentType: "INVOICE" | "RECEIPT" | "STATEMENT" | "REPORT"; documentId: string; action: "PRINT" | "EXPORT" }) => billingMutate<{ recorded: boolean }, typeof payload>("post", "/billing/document-events", payload) }) }

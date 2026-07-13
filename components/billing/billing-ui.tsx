"use client"

import { X } from "lucide-react"

import { Button } from "@/components/ui/button"

export function BillingPageHeader({ title, description, actions }: { title: string; description: string; actions?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="mb-1 text-xs font-bold tracking-[0.16em] text-primary uppercase">KHIP Billing</p><h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p></div>{actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}</div>
}

export function BillingStatGrid({ items }: { items: Array<{ label: string; value: string | number; detail?: string; tone?: "green" | "orange" | "red" | "neutral" }> }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <div key={item.label} className={`rounded-lg border bg-white p-4 shadow-sm ${item.tone === "red" ? "border-l-4 border-l-red-600" : item.tone === "orange" ? "border-l-4 border-l-orange-500" : item.tone === "green" ? "border-l-4 border-l-primary" : ""}`}><p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{item.label}</p><p className="mt-2 font-heading text-2xl font-bold">{item.value}</p>{item.detail ? <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p> : null}</div>)}</div>
}

export function BillingPanel({ title, actions, children, className = "" }: { title?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-lg border bg-white shadow-sm ${className}`}>{title || actions ? <div className="flex items-center justify-between gap-3 border-b px-4 py-3"><h2 className="font-heading text-lg font-semibold">{title}</h2>{actions}</div> : null}{children}</section>
}

export function BillingStatusBadge({ value }: { value: string | null | undefined }) {
  const text = value?.replaceAll("_", " ") ?? "Unknown"
  const red = ["CANCELLED", "VOID", "FAILED", "REVERSED", "OVERDUE"].some((item) => value?.includes(item))
  const orange = ["ISSUED", "PARTIAL", "PENDING", "OUTSTANDING"].some((item) => value?.includes(item))
  const green = ["PAID", "SUCCESSFUL", "CLEAR", "READ"].some((item) => value?.includes(item))
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${red ? "bg-red-50 text-red-700" : orange ? "bg-orange-50 text-orange-800" : green ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"}`}>{text.toLowerCase()}</span>
}

export function BillingTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-surface-container text-xs tracking-wide text-muted-foreground uppercase"><tr>{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody className="divide-y">{children}</tbody></table></div>
}

export function BillingLoading({ label = "Loading billing data…" }: { label?: string }) { return <div className="rounded-lg border bg-white p-10 text-center text-sm text-muted-foreground"><div className="mx-auto mb-3 size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />{label}</div> }
export function BillingEmpty({ title, description }: { title: string; description: string }) { return <div className="p-10 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div> }
export function BillingErrorPanel({ message }: { message?: string }) { return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{message || "Billing data could not be loaded."}</div> }
export function BillingModal({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) { if (!open) return null; return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close dialog" /><div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><h2 className="font-heading text-xl font-bold">{title}</h2><Button variant="ghost" size="icon" onClick={onClose}><X /></Button></div><div className="p-5">{children}</div></div></div> }

export const billingTd = "px-4 py-3 align-top"
export const billingControl = "min-h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
export function billingMoney(value?: number | null) { return value === null || value === undefined ? "—" : `GH₵ ${value.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
export function billingDate(value?: string | null) { return value ? new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", ...(value.includes("T") ? { timeStyle: "short" as const } : {}) }).format(new Date(value)) : "—" }

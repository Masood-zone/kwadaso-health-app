import { AlertCircle } from "lucide-react"

import type { DashboardMetric } from "@/types/dashboard"

export function MetricCard({ detail, label, tone, value }: DashboardMetric) {
  const strip =
    tone === "red"
      ? "bg-secondary-container"
      : tone === "orange"
        ? "bg-chart-2"
        : tone === "blue"
          ? "bg-chart-4"
          : "bg-primary-container"

  return (
    <section className="khms-card relative overflow-hidden p-4">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${strip}`} />
      <div className="pl-3">
        <p className="khms-label">{label}</p>
        <p className="mt-2 font-heading text-[28px] leading-9 font-semibold">
          {value}
        </p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">{detail}</p>
      </div>
    </section>
  )
}

export function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase()
  const className =
    normalized.includes("urgent") ||
    normalized.includes("emergency") ||
    normalized.includes("locked")
      ? "bg-emergency-soft text-emergency-dark"
      : normalized.includes("routine") ||
          normalized.includes("active") ||
          normalized.includes("completed")
        ? "bg-medical-green-soft text-deep-forest"
        : "bg-pending-soft text-tertiary-container"

  return <span className={`khms-badge ${className}`}>{value}</span>
}

export function DashboardError({ message }: { message: string }) {
  return (
    <section className="khms-card flex items-center gap-3 p-4 text-destructive">
      <AlertCircle className="size-5" />
      <p className="text-sm font-semibold">{message}</p>
    </section>
  )
}

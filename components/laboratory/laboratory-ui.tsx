import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { Button } from "@/components/ui/button"
import type { LaboratoryMetric } from "@/types/laboratory"

export function LaboratoryPageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className="khms-label mb-1 text-primary">{eyebrow}</p> : null}
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

const tones = {
  green: "border-l-primary bg-medical-green-soft text-primary",
  orange: "border-l-tertiary bg-pending-soft text-tertiary",
  red: "border-l-destructive bg-emergency-soft text-destructive",
  blue: "border-l-on-surface bg-accent-blue text-on-surface",
  neutral: "border-l-outline bg-surface-container-low text-foreground",
}

export function LaboratoryMetricGrid({ metrics }: { metrics: LaboratoryMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className={`khms-card border-l-4 p-4 ${tones[metric.tone]}`}>
          <p className="khms-label">{metric.label}</p>
          <p className="mt-2 text-3xl font-bold text-foreground">{metric.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
        </div>
      ))}
    </div>
  )
}

export function LaboratoryState({ loading, error, empty, emptyText = "No laboratory records match this view." }: { loading?: boolean; error?: boolean; empty?: boolean; emptyText?: string }) {
  if (loading) return <div className="khms-card animate-pulse p-10 text-center text-sm text-muted-foreground">Loading laboratory records…</div>
  if (error) return <div className="khms-card border-destructive/30 bg-emergency-soft p-10 text-center text-sm text-destructive">Laboratory data could not be loaded. Refresh and try again.</div>
  if (empty) return <div className="khms-card p-10 text-center"><MaterialSymbol icon="science" className="text-4xl text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">{emptyText}</p></div>
  return null
}

export function StatusBadge({ value }: { value: string }) {
  const upper = value.toUpperCase()
  const className = upper.includes("CRITICAL") || ["STAT", "REJECTED", "CANCELLED"].includes(upper)
    ? "bg-emergency-soft text-destructive"
    : ["URGENT", "REQUESTED", "COLLECTED", "ENTERED", "VALIDATED", "PARTIAL_RESULT", "PROCESSING"].includes(upper)
      ? "bg-pending-soft text-tertiary"
      : ["COMPLETED", "RELEASED", "RECEIVED", "STORED", "ACTIVE", "READ"].includes(upper)
        ? "bg-medical-green-soft text-primary"
        : "bg-surface-container-low text-muted-foreground"
  return <span className={`khms-badge ${className}`}>{value.replaceAll("_", " ")}</span>
}

export function LaboratoryPagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="flex items-center justify-between border-t border-border-subtle px-4 py-3 text-sm">
      <span className="text-muted-foreground">Page {page} of {pages} · {total} records</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  )
}

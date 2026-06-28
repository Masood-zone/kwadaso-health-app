"use client"

import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p className="khms-label mb-2">{eyebrow}</p>
        <h2 className="font-heading text-[32px] leading-10 font-bold text-foreground">
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  )
}

export function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-3">
      <Icon className="size-5 text-primary" />
      <div>
        <p className="khms-label">{eyebrow}</p>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
      </div>
    </div>
  )
}

export function CompactHeader({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 text-primary" />
      <div>
        <p className="khms-label">{eyebrow}</p>
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
      </div>
    </div>
  )
}

export function ResponsiveTable({
  children,
  minWidth,
}: {
  children: ReactNode
  minWidth: string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth }}>
        {children}
      </table>
    </div>
  )
}

export function StatTile({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail: string
  tone: "green" | "blue" | "orange" | "red"
}) {
  const strip =
    tone === "red"
      ? "bg-emergency-dark"
      : tone === "orange"
        ? "bg-chart-2"
        : tone === "blue"
          ? "bg-chart-4"
          : "bg-primary"

  return (
    <section className="khms-card relative overflow-hidden rounded-lg p-5">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${strip}`} />
      <div className="pl-3">
        <p className="khms-label">{label}</p>
        <p className="mt-2 font-heading text-[32px] leading-10 font-bold">
          {value}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </div>
    </section>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export function FormPanel({
  icon,
  eyebrow,
  title,
  children,
}: {
  icon: LucideIcon
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <aside className="khms-card p-4">
      <CompactHeader icon={icon} eyebrow={eyebrow} title={title} />
      <div className="mt-4">{children}</div>
    </aside>
  )
}

export function AvatarInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded bg-medical-green-soft text-xs font-bold text-primary">
      {initials || "SA"}
    </div>
  )
}

export function IconAction({
  label,
  tone = "default",
  children,
  onClick,
}: {
  label: string
  tone?: "default" | "danger"
  children: ReactNode
  onClick: () => void
}) {
  const className =
    tone === "danger"
      ? "text-secondary hover:bg-emergency-soft"
      : "text-primary hover:bg-medical-green-soft"

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`rounded p-1.5 transition-colors ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

export function Pager({
  page,
  totalPages,
  onPrevious,
  onNext,
}: {
  page: number
  totalPages: number
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" disabled={page <= 1} onClick={onPrevious}>
        Previous
      </Button>
      <Button variant="outline" disabled={page >= totalPages} onClick={onNext}>
        Next
      </Button>
    </div>
  )
}

export function formatEnum(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

"use client"

import { useState } from "react"
import { ClipboardList, Save, Settings, ShieldCheck, SlidersHorizontal } from "lucide-react"
import { toast } from "sonner"

import { DashboardError } from "@/components/dashboard/dashboard-widgets"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  CompactHeader,
  Field,
  PageHeader,
} from "@/components/super-admin/super-admin-ui"
import { useSettings, useUpdateSettings } from "@/services/super-admin/settings"
import type { SuperAdminSettingsData } from "@/types/super-admin"

const facilityTypes = [
  "HOSPITAL",
  "HEALTH_CENTRE",
  "CHPS_COMPOUND",
  "CLINIC",
  "MUNICIPAL_DIRECTORATE",
  "LABORATORY",
  "PHARMACY",
]

export function SettingsPage() {
  const { data: settings, isLoading, isError } = useSettings()
  const updateSettings = useUpdateSettings()
  const [form, setForm] = useState<SuperAdminSettingsData | null>(settings ?? null)
  const currentSettings = form ?? settings

  async function saveSettings() {
    if (!currentSettings) return
    try {
      await updateSettings.mutateAsync(currentSettings)
      toast.success("Hospital settings updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Settings update failed")
    }
  }

  if (isLoading || !currentSettings) {
    return <div className="khms-card h-96 animate-pulse bg-muted" />
  }

  if (isError) return <DashboardError message="Settings could not be loaded." />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin / Configuration"
        title="System Settings"
        description="Configure hospital profile and system-wide operational rules."
        actions={
          <Button onClick={saveSettings} disabled={updateSettings.isPending}>
            <Save className="size-4" />
            Save Changes
          </Button>
        }
      />

      <section className="flex flex-col gap-5 xl:flex-row xl:items-start">
        <nav className="khms-card w-full shrink-0 space-y-1 p-2 xl:w-64">
          <button className="flex w-full items-center gap-3 rounded bg-primary px-4 py-3 text-left text-xs font-semibold text-white">
            <Settings className="size-4" />
            Hospital Profile
          </button>
          <button className="flex w-full items-center gap-3 rounded px-4 py-3 text-left text-xs font-semibold text-muted-foreground hover:bg-surface-container-low">
            <ShieldCheck className="size-4" />
            Security Rules
          </button>
          <button className="flex w-full items-center gap-3 rounded px-4 py-3 text-left text-xs font-semibold text-muted-foreground hover:bg-surface-container-low">
            <ClipboardList className="size-4" />
            Numbering
          </button>
        </nav>

        <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="khms-card p-6">
            <CompactHeader icon={Settings} eyebrow="Hospital Profile" title="Facility Settings" />
            <div className="mt-4 grid gap-3">
              <Field label="Facility Code">
                <Input value={currentSettings.facility.code} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, code: event.target.value } })} />
              </Field>
              <Field label="Facility Name">
                <Input value={currentSettings.facility.name} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, name: event.target.value } })} />
              </Field>
              <Field label="Facility Type">
                <select className="khms-input w-full" value={currentSettings.facility.type} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, type: event.target.value as never } })}>
                  {facilityTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Phone">
                  <Input value={currentSettings.facility.phone ?? ""} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, phone: event.target.value } })} />
                </Field>
                <Field label="Email">
                  <Input value={currentSettings.facility.email ?? ""} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, email: event.target.value } })} />
                </Field>
              </div>
              <Field label="Address">
                <Input value={currentSettings.facility.address ?? ""} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, address: event.target.value } })} />
              </Field>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="Municipality">
                  <Input value={currentSettings.facility.municipality ?? ""} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, municipality: event.target.value } })} />
                </Field>
                <Field label="Region">
                  <Input value={currentSettings.facility.region ?? ""} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, region: event.target.value } })} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={currentSettings.facility.isActive} onChange={(event) => setForm({ ...currentSettings, facility: { ...currentSettings.facility, isActive: event.target.checked } })} />
                Facility active
              </label>
            </div>
          </div>

          <div className="khms-card p-6">
            <CompactHeader icon={SlidersHorizontal} eyebrow="System Rules" title="Core Settings" />
            <div className="mt-4 grid gap-3">
              <NumberField label="Session Timeout" value={currentSettings.system["session.timeoutMinutes"]} onChange={(value) => setForm({ ...currentSettings, system: { ...currentSettings.system, "session.timeoutMinutes": value } })} />
              <NumberField label="Audit Retention Days" value={currentSettings.system["audit.retentionDays"]} onChange={(value) => setForm({ ...currentSettings, system: { ...currentSettings.system, "audit.retentionDays": value } })} />
              <Field label="Patient Number Prefix">
                <Input value={currentSettings.system["patient.numberPrefix"]} onChange={(event) => setForm({ ...currentSettings, system: { ...currentSettings.system, "patient.numberPrefix": event.target.value } })} />
              </Field>
              <Field label="Invoice Number Prefix">
                <Input value={currentSettings.system["invoice.numberPrefix"]} onChange={(event) => setForm({ ...currentSettings, system: { ...currentSettings.system, "invoice.numberPrefix": event.target.value } })} />
              </Field>
              <NumberField label="Appointment Slot Minutes" value={currentSettings.system["appointment.defaultSlotMinutes"]} onChange={(value) => setForm({ ...currentSettings, system: { ...currentSettings.system, "appointment.defaultSlotMinutes": value } })} />
              <div className="mt-2 rounded border border-border-subtle bg-pending-soft p-4 text-sm text-muted-foreground">
                Session and numbering changes are captured in the audit trail immediately after saving.
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <Field label={label}>
      <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </Field>
  )
}

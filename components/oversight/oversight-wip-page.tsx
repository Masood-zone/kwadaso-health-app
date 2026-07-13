"use client"

import { BarChart3, Building2, LogOut, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import type { StaffRole } from "@/lib/generated/prisma/enums"

export function OversightWipPage({
  facilityName,
  role,
  userName,
}: {
  facilityName: string
  role: StaffRole
  userName: string
}) {
  const router = useRouter()
  const roleLabel =
    role === "MUNICIPAL_HEALTH_DIRECTOR"
      ? "Municipal Health Director"
      : "Monitoring and Evaluation Officer"

  async function signOut() {
    await authClient.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-app-bg text-foreground">
      <header className="flex h-[var(--topbar-height)] items-center justify-between border-b border-border-subtle bg-white px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded bg-primary text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-primary">KHIP</p>
            <p className="text-xs text-muted-foreground">Municipal Oversight</p>
          </div>
        </div>
        <Button variant="outline" onClick={signOut}>
          <LogOut className="size-4" />
          Sign out
        </Button>
      </header>

      <section className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 md:px-8 md:py-16">
        <div>
          <p className="khms-label text-primary">Oversight workspace</p>
          <h1 className="mt-2 font-heading text-3xl font-bold md:text-4xl">
            Welcome, {userName}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {roleLabel} · {facilityName}
          </p>
        </div>

        <div className="khms-card grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
          <div className="flex size-14 items-center justify-center rounded-xl bg-accent-blue text-primary">
            <BarChart3 className="size-7" />
          </div>
          <div>
            <span className="inline-flex rounded-full bg-pending-soft px-3 py-1 text-xs font-bold text-tertiary-container uppercase">
              Work in progress
            </span>
            <h2 className="mt-4 font-heading text-2xl font-semibold">
              Municipal reporting is being prepared
            </h2>
            <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">
              Your account and role permissions are active. Cross-facility
              analytics, HMIS exports, and read-only performance dashboards are
              not yet available in this release.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="size-4 text-primary" />
              Access remains limited to this protected status page until the
              oversight module is completed.
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

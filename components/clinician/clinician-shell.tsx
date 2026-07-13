"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { LogOut, Menu, Search, X } from "lucide-react"

import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

const navItems = [
  { label: "Dashboard", href: "/clinician", icon: "dashboard" },
  {
    label: "Consultation Queue",
    href: "/clinician/consultation-queue",
    icon: "queue",
  },
  {
    label: "Active Encounters",
    href: "/clinician/encounters",
    icon: "clinical_notes",
  },
  { label: "Patients", href: "/clinician/patients", icon: "patient_list" },
  { label: "Lab Requests", href: "/clinician/lab-requests", icon: "biotech" },
  {
    label: "Prescriptions",
    href: "/clinician/prescriptions",
    icon: "medication",
  },
  { label: "Referrals", href: "/clinician/referrals", icon: "move_item" },
  { label: "Follow-Ups", href: "/clinician/follow-ups", icon: "event_repeat" },
  { label: "Messages", href: "/clinician/messages", icon: "forum" },
  {
    label: "Notifications",
    href: "/clinician/notifications",
    icon: "notifications",
  },
]

function isActive(pathname: string, href: string) {
  return href === "/clinician" ? pathname === href : pathname.startsWith(href)
}

export function ClinicianShell({
  children,
  userName,
  roleLabel,
  facilityName,
}: {
  children: React.ReactNode
  userName: string
  roleLabel: string
  facilityName: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function signOut() {
    await authClient.signOut()
    router.replace("/login")
    router.refresh()
  }

  const navigation = (
    <>
      <div className="flex h-[var(--topbar-height)] items-center gap-3 px-5">
        <div className="flex size-10 items-center justify-center rounded bg-white text-primary">
          <MaterialSymbol
            icon="local_hospital"
            filled
            className="text-[24px]"
          />
        </div>
        <div>
          <p className="font-heading text-lg font-bold text-white">KHIP</p>
          <p className="text-[10px] tracking-wider text-white/60 uppercase">
            Clinical Care
          </p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={
                active
                  ? "relative flex min-h-10 items-center gap-3 rounded bg-primary px-3 py-2 text-sm font-semibold text-white"
                  : "flex min-h-10 items-center gap-3 rounded px-3 py-2 text-sm font-medium text-white/70 hover:bg-primary-container hover:text-white"
              }
            >
              {active ? (
                <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-secondary-container" />
              ) : null}
              <MaterialSymbol icon={item.icon} className="text-[20px]" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="khms-label text-white/55">Signed in as</p>
        <p className="mt-1 truncate text-sm font-semibold text-white">
          {userName}
        </p>
        <p className="text-xs text-white/60">{roleLabel}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full border-white/20 bg-transparent text-white hover:bg-white/10"
          onClick={signOut}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </>
  )

  return (
    <main className="min-h-svh bg-app-bg text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] flex-col bg-deep-forest text-white lg:flex">
        {navigation}
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(86vw,320px)] flex-col bg-deep-forest text-white">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X />
            </Button>
            {navigation}
          </aside>
        </div>
      ) : null}
      <div className="min-h-svh lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex h-[var(--topbar-height)] items-center justify-between border-b border-border-subtle bg-white px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <p className="font-heading text-lg font-bold text-primary md:text-xl">
              KHIP
            </p>
            <div className="hidden h-9 w-72 items-center gap-2 rounded border border-input bg-surface-container-low px-3 md:flex">
              <Search className="size-4 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">
                Search patients or records
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{userName}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Notifications"
              asChild
            >
              <Link href="/clinician/notifications">
                <MaterialSymbol icon="notifications" className="text-[20px]" />
              </Link>
            </Button>
          </div>
        </header>
        <div className="border-b border-outline-variant bg-accent-blue px-4 py-2 text-sm font-semibold text-primary lg:px-8">
          Facility: {facilityName}{" "}
          <span className="mx-2 text-muted-foreground">/</span> Secure clinical
          session
        </div>
        <div className="mx-auto w-full max-w-[var(--container-max)] px-4 py-5 pb-24 lg:px-8 lg:py-6">
          {children}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border-subtle bg-white lg:hidden">
        {navItems.slice(0, 5).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive(pathname, item.href)
                ? "flex h-16 flex-col items-center justify-center gap-1 text-primary"
                : "flex h-16 flex-col items-center justify-center gap-1 text-muted-foreground"
            }
          >
            <MaterialSymbol icon={item.icon} className="text-[21px]" />
            <span className="max-w-full truncate px-1 text-[10px] font-semibold">
              {item.label.split(" ")[0]}
            </span>
          </Link>
        ))}
      </nav>
    </main>
  )
}

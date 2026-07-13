"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, LogOut, Menu, Search } from "lucide-react"

import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"

type HospitalAdminShellProps = {
  userName: string
  roleLabel: string
  facilityName: string
  children: React.ReactNode
}

const navItems = [
  { label: "Dashboard", href: "/hospital-admin/dashboard", icon: "dashboard" },
  { label: "Staff", href: "/hospital-admin/staff", icon: "badge" },
  {
    label: "Departments",
    href: "/hospital-admin/departments",
    icon: "clinical_notes",
  },
  {
    label: "Appointments",
    href: "/hospital-admin/appointments",
    icon: "event_available",
  },
  { label: "Queue", href: "/hospital-admin/queue", icon: "queue" },
  { label: "Settings", href: "/hospital-admin/settings", icon: "settings" },
  { label: "Reports", href: "/hospital-admin/reports", icon: "analytics" },
  {
    label: "Notifications",
    href: "/hospital-admin/notifications",
    icon: "notifications",
  },
  { label: "Audit Logs", href: "/hospital-admin/audit-logs", icon: "history" },
]

export function HospitalAdminShell({
  children,
  facilityName,
  roleLabel,
  userName,
}: HospitalAdminShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-app-bg text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] bg-deep-forest text-inverse-on-surface lg:flex lg:flex-col">
        <div className="flex h-[var(--topbar-height)] items-center gap-3 px-5">
          <div className="flex size-10 items-center justify-center rounded bg-white text-primary">
            <MaterialSymbol
              icon="local_hospital"
              filled
              className="text-[24px]"
            />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg leading-6 font-bold text-white">
              KHIP
            </p>
            <p className="truncate text-[10px] leading-4 tracking-wider text-white/60 uppercase">
              Hospital Admin
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? "relative flex h-10 items-center gap-3 rounded bg-primary px-3 text-sm font-semibold text-white"
                    : "flex h-10 items-center gap-3 rounded px-3 text-sm font-medium text-white/70 hover:bg-primary-container hover:text-white"
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
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="min-h-svh lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-10 flex h-[var(--topbar-height)] items-center justify-between border-b border-border-subtle bg-white px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="size-4" />
            </Button>
            <div className="hidden h-9 w-72 items-center gap-2 rounded border border-input bg-surface-container-low px-3 md:flex">
              <Search className="size-4 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">
                Search patients, appointments, invoices
              </span>
            </div>
            <p className="font-heading text-lg font-bold text-primary md:text-xl">
              Operational Command Center
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="destructive" size="sm" className="hidden md:flex">
              <MaterialSymbol icon="emergency" className="text-[18px]" />
              Emergency Alert
            </Button>
            <div className="hidden text-sm font-semibold text-primary xl:block">
              Facility: {facilityName}
            </div>
            <Button variant="outline" size="icon" aria-label="View alerts">
              <Bell className="size-4" />
            </Button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[var(--container-max)] px-4 py-5 pb-24 lg:px-8 lg:py-6">
          {children}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border-subtle bg-white lg:hidden">
        {navItems.slice(0, 4).map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "flex h-16 flex-col items-center justify-center gap-1 text-primary"
                  : "flex h-16 flex-col items-center justify-center gap-1 text-muted-foreground"
              }
            >
              <MaterialSymbol icon={item.icon} className="text-[22px]" />
              <span className="text-[11px] leading-3 font-semibold">
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </main>
  )
}

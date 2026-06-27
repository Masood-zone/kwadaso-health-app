"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Search,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react"

import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

type DashboardShellProps = {
  title: string
  eyebrow: string
  facilityName: string
  userName: string
  roleLabel: string
  children: React.ReactNode
}

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Patients", href: "#patients", icon: Users },
  { label: "Clinical Info", href: "#clinical", icon: Stethoscope },
  { label: "Pharmacy", href: "#pharmacy", icon: Pill },
  { label: "Reports", href: "#reports", icon: FileText },
  { label: "Audit Logs", href: "#audit", icon: ClipboardList },
]

export function DashboardShell({
  children,
  eyebrow,
  facilityName,
  roleLabel,
  title,
  userName,
}: DashboardShellProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.replace("/login")
    router.refresh()
  }

  return (
    <main className="min-h-svh bg-app-bg text-foreground">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-width)] border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex lg:flex-col">
        <div className="flex h-[var(--topbar-height)] items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex size-9 items-center justify-center rounded bg-primary-container text-white">
            <ShieldCheck className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-heading text-lg leading-6 font-bold">KHMS</p>
            <p className="truncate text-xs leading-4 text-muted-foreground">
              Clinical Operations
            </p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => {
            const active = item.href === "/" ? pathname.includes("dashboard") : false

            return (
              <Link
                key={item.label}
                href={item.href}
                className={
                  active
                    ? "relative flex h-10 items-center gap-3 rounded bg-deep-forest px-3 text-sm font-semibold text-white"
                    : "flex h-10 items-center gap-3 rounded px-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
                }
              >
                {active ? (
                  <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-chart-2" />
                ) : null}
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <p className="khms-label">Signed in as</p>
          <p className="mt-1 text-sm font-semibold">{userName}</p>
          <p className="text-xs text-muted-foreground">{roleLabel}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
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
            <div className="min-w-0">
              <p className="khms-label">{eyebrow}</p>
              <h1 className="truncate font-heading text-xl leading-7 font-semibold text-foreground lg:text-[28px] lg:leading-9">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden h-9 w-72 items-center gap-2 rounded border border-input bg-white px-3 md:flex">
              <Search className="size-4 text-muted-foreground" />
              <span className="truncate text-sm text-muted-foreground">
                Search patient, folder, NHIS
              </span>
            </div>
            <div className="hidden text-sm font-semibold text-primary md:block">
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
        {navItems.slice(0, 4).map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex h-16 flex-col items-center justify-center gap-1 text-muted-foreground first:text-primary-container"
          >
            <item.icon className="size-5" />
            <span className="text-[11px] leading-3 font-semibold">
              {item.label}
            </span>
          </Link>
        ))}
      </nav>
    </main>
  )
}

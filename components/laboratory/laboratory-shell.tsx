"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"
import { Bell, LogOut, Menu, Search, X } from "lucide-react"
import { toast } from "sonner"

import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { authClient } from "@/lib/auth-client"
import api from "@/lib/axios"
import type { ApiResponse } from "@/types"
import type { LabSampleListItem, LaboratoryPage } from "@/types/laboratory"

const navItems = [
  { label: "Dashboard", href: "/laboratory", icon: "dashboard" },
  { label: "Lab Requests", href: "/laboratory/requests", icon: "biotech" },
  { label: "Samples", href: "/laboratory/samples", icon: "experiment" },
  { label: "Result Entry", href: "/laboratory/results/entry", icon: "edit_note" },
  { label: "Validation Queue", href: "/laboratory/validation", icon: "fact_check" },
  { label: "Released Results", href: "/laboratory/results/released", icon: "history" },
  { label: "Critical Results", href: "/laboratory/critical-results", icon: "emergency" },
  { label: "Test Catalog", href: "/laboratory/test-catalog", icon: "inventory_2" },
  { label: "Reports", href: "/laboratory/reports", icon: "monitoring" },
  { label: "Notifications", href: "/laboratory/notifications", icon: "notifications" },
]

function LaboratoryNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">{navItems.map((item) => {
    const active = item.href === "/laboratory" ? pathname === item.href : pathname.startsWith(item.href)
    return <Link key={item.href} href={item.href} onClick={onNavigate} className={active ? "relative flex min-h-10 items-center gap-3 rounded bg-primary px-3 text-sm font-semibold text-white" : "flex min-h-10 items-center gap-3 rounded px-3 text-sm font-medium text-white/70 hover:bg-primary-container hover:text-white"}>
      {active ? <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-secondary-container" /> : null}
      <MaterialSymbol icon={item.icon} className="text-xl" /><span>{item.label}</span>
    </Link>
  })}</nav>
}

export function LaboratoryShell({ children, userName, facilityName }: { children: React.ReactNode; userName: string; facilityName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sampleSearch, setSampleSearch] = useState("")

  async function signOut() {
    await authClient.signOut()
    router.replace("/login")
    router.refresh()
  }

  async function scanSample() {
    const value = sampleSearch.trim()
    if (!value) return
    try {
      const response = await api.get<ApiResponse<LaboratoryPage<LabSampleListItem>>>(`/laboratory/samples?search=${encodeURIComponent(value)}&pageSize=1`)
      const sample = response.data.data?.items[0]
      if (!sample) return toast.error("No sample matched that ID.")
      setSampleSearch("")
      router.push(`/laboratory/samples/${sample.id}`)
    } catch {
      toast.error("Sample lookup failed.")
    }
  }

  const brand = <div className="flex h-[var(--topbar-height)] items-center gap-3 px-5"><div className="flex size-10 items-center justify-center rounded bg-white text-primary"><MaterialSymbol icon="biotech" filled className="text-2xl" /></div><div><p className="font-heading text-lg font-bold text-white">KHIP Lab</p><p className="text-[10px] tracking-wider text-white/60 uppercase">Laboratory Management</p></div></div>
  const account = <div className="border-t border-white/10 p-4"><p className="khms-label text-white/55">Signed in as</p><p className="mt-1 truncate text-sm font-semibold text-white">{userName}</p><p className="text-xs text-white/60">Laboratory Technician</p><Button variant="outline" size="sm" className="mt-3 w-full border-white/20 bg-transparent text-white hover:bg-white/10" onClick={signOut}><LogOut className="size-4" />Sign out</Button></div>
  return (
    <main className="min-h-svh bg-app-bg text-foreground">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-width)] bg-deep-forest text-white lg:flex lg:flex-col">{brand}<LaboratoryNav pathname={pathname} />{account}</aside>
      {menuOpen ? <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/45" onClick={() => setMenuOpen(false)} aria-label="Close navigation" /><aside className="relative flex h-full w-[min(88vw,320px)] flex-col bg-deep-forest text-white">{brand}<Button variant="ghost" size="icon" className="absolute top-3 right-3 text-white" onClick={() => setMenuOpen(false)}><X /></Button><LaboratoryNav pathname={pathname} onNavigate={() => setMenuOpen(false)} />{account}</aside></div> : null}
      <div className="min-h-svh lg:pl-[var(--sidebar-width)]">
        <header className="sticky top-0 z-20 flex min-h-[var(--topbar-height)] items-center justify-between gap-3 border-b bg-white px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><Button variant="outline" size="icon" className="lg:hidden" onClick={() => setMenuOpen(true)}><Menu /></Button><p className="hidden font-heading text-lg font-bold text-primary sm:block">Laboratory Management</p></div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <div className="hidden max-w-sm flex-1 items-center gap-2 md:flex"><Search className="size-4 text-muted-foreground" /><Input value={sampleSearch} onChange={(event) => setSampleSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void scanSample() }} placeholder="Scan or enter Sample ID" /><Button size="sm" onClick={() => void scanSample()}><MaterialSymbol icon="barcode_scanner" className="text-lg" />Open</Button></div>
            <span className="hidden text-xs font-semibold text-primary xl:block">{facilityName}</span>
            <Button variant="outline" size="icon" asChild><Link href="/laboratory/notifications" aria-label="Laboratory notifications"><Bell className="size-4" /></Link></Button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[var(--container-max)] px-4 py-5 lg:px-8 lg:py-6">{children}</div>
      </div>
    </main>
  )
}

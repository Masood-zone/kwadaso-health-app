import Image from "next/image"
import { Cloud, HeartPulse, ShieldCheck } from "lucide-react"

export default function Loading() {
  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-6 text-center text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_2px_2px,#e2e8f0_1px,transparent_0)] bg-[length:32px_32px] opacity-40" />
      <section className="relative z-10 flex max-w-2xl flex-col items-center">
        <div className="mb-10 animate-pulse rounded-xl border border-border-subtle bg-white p-8 shadow-sm">
          <Image
            src="/logo.png"
            alt="SDA Hospital Kwadaso"
            width={128}
            height={128}
            className="h-24 w-auto md:h-32"
            priority
          />
        </div>
        <h1 className="font-heading text-4xl font-bold text-primary">
          KHIP - Kwadaso HealthLink Integrated Platform
        </h1>
        <p className="mt-3 flex items-center justify-center gap-2 text-base text-muted-foreground">
          <ShieldCheck className="size-4" />
          Secure healthcare platform. Initializing clinical environment...
        </p>
        <div className="mt-12 flex flex-col items-center">
          <div className="size-12 animate-spin rounded-full border-3 border-border-subtle border-t-primary" />
          <div className="mt-8 h-1 w-60 overflow-hidden rounded bg-border-subtle">
            <div className="h-full w-2/3 animate-pulse rounded bg-primary" />
          </div>
          <p className="khms-label mt-4">Synchronizing Database...</p>
        </div>
        <footer className="mt-24 text-muted-foreground/50">
          <p className="text-sm">SDA Hospital Kwadaso IT Department</p>
          <div className="mt-2 flex justify-center gap-4">
            <HeartPulse className="size-4" />
            <ShieldCheck className="size-4" />
            <Cloud className="size-4" />
          </div>
        </footer>
      </section>
    </main>
  )
}

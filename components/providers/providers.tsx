"use client"

import { ReactNode } from "react"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { QueryClientProvider } from "@tanstack/react-query"
import { getQueryClient } from "@/lib/query-client"

interface ProvidersProps {
  children: ReactNode
}

/**
 * Root providers component
 * Wraps the entire application with necessary context providers
 * - ThemeProvider: Manages dark/light mode
 * - Toaster: Toast notifications
 * - Future: Authentication, Analytics, etc.
 */
export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient()

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  )
}

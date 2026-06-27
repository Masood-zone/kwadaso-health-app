"use client"

import { ReactNode } from "react"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

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
const queryClient = new QueryClient()

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      <Toaster position="top-center" richColors />
    </ThemeProvider>
  )
}

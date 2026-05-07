'use client'

import { ThemeProvider } from "@/components/theme-provider"
import LiveMatchesController from "@/components/LiveMatchesController"

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <LiveMatchesController />
      {children}
    </ThemeProvider>
  )
}

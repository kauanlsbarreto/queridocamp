'use client'

import { ThemeProvider } from "@/components/theme-provider"
import LiveMatchesController from "@/components/LiveMatchesController"
import StatusAlertPopup from "@/components/status-alert-popup"

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <LiveMatchesController />
      <StatusAlertPopup />
      {children}
    </ThemeProvider>
  )
}

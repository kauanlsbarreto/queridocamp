'use client'

import { ThemeProvider } from "@/components/theme-provider"
import LiveMatchesController from "@/components/LiveMatchesController"
import SiteFeedbackPrompt from "@/components/site-feedback-prompt"

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <LiveMatchesController />
      <SiteFeedbackPrompt />
      {children}
    </ThemeProvider>
  )
}

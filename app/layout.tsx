import type React from "react"
import { Montserrat } from "next/font/google"
import "./globals.css"
import Footer from "@/components/footer"
import ClientProviders from "@/components/client-providers"
import NavbarClient from "@/components/navbar-client"
import SessionSync from "@/components/session-sync"
import LocalhostWatcher from "@/components/localhost-watcher"
import AnalyticsTracker from '@/components/analytics-tracker';

const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  weight: ["100","200","300","400","500","600","700","800","900"],
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${montserrat.className} min-h-screen flex flex-col`}
      >
        <LocalhostWatcher />
        <SessionSync />
        <NavbarClient />
        <AnalyticsTracker />
        <ClientProviders>
          <main className="flex-grow pt-24">
            {children}
          </main>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  )
}

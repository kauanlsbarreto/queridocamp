'use client'

import type React from "react"
import { useState, useEffect } from "react"
import { Montserrat } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import LiveMatchesController from "@/components/LiveMatchesController"
import { type UserProfile } from "@/components/user-profile"

const montserrat = Montserrat({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authKey, setAuthKey] = useState(0)

  useEffect(() => {
    const stored = localStorage.getItem('faceit_user')
    if (stored) {
      const parsed: UserProfile = JSON.parse(stored)
      if (!parsed.id || (parsed.Admin === undefined && parsed.admin === undefined)) {
        localStorage.removeItem('faceit_user')
        setUser(null)
      } else {
        setUser(parsed)
      }
    }
  }, [authKey])

  const handleAuthChange = () => {
    setAuthKey(prev => prev + 1)
  }

  return (
    <html lang="pt-BR">
      <body className={`${montserrat.className} bg-black text-white min-h-screen flex flex-col`}>
        <Navbar onAuthChange={handleAuthChange} user={user} />
        <ThemeProvider attribute="class" defaultTheme="dark">
          <LiveMatchesController />
          <main className="flex-grow pt-24">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}

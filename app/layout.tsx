'use client'

import type React from "react"
import { Montserrat } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"
import LiveMatchesController from "@/components/LiveMatchesController"

const montserrat = Montserrat({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {

  return (
    <html lang="pt-BR">
      <body className={`${montserrat.className} bg-black text-white min-h-screen flex flex-col`}>
        <Navbar />
        <ThemeProvider attribute="class" defaultTheme="dark">
          <LiveMatchesController />
          <main className="flex-grow pt-24">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}

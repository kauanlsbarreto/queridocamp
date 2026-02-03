import type React from "react"
import { Montserrat } from "next/font/google"
import "./globals.css"
import Footer from "@/components/footer"
import ClientProviders from "@/components/client-providers"
import NavbarClient from "@/components/navbar-client"

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
    <html lang="pt-BR">
      <body
        className={`${montserrat.className} bg-black text-white min-h-screen flex flex-col`}
      >
        <NavbarClient />

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

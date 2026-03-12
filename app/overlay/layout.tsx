"use client"

import type React from "react"

interface LayoutProps {
  children: React.ReactNode
}

export default function OverlayLayout({ children }: LayoutProps) {
  return (
    <>
      <style jsx global>{`
        nav,
        footer {
          display: none !important;
        }

        body {
          margin: 0;
          overflow: hidden;
          background: transparent !important;
        }

        main {
          padding-top: 0 !important;
          min-height: 100vh;
        }
      `}</style>
      {children}
    </>
  )
}

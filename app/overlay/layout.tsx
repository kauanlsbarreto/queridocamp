"use client"

import type React from "react"

interface LayoutProps {
  children: React.ReactNode
}

export default function OverlayLayout({ children }: LayoutProps) {

  return <>{children}</>
}

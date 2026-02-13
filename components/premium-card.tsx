"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"

interface PremiumCardProps {
  children: ReactNode
  className?: string
  delay?: number
  hoverEffect?: boolean
}

const PremiumCard = ({
  children,
  className = "",
  delay = 0,
  hoverEffect = true,
}: PremiumCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={`relative group rounded-2xl overflow-hidden border border-white/10 bg-[#060D15] ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/20 via-transparent to-transparent pointer-events-none" />

      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/40 to-transparent opacity-50" />

      <div className="relative z-10 h-full">
        {children}
      </div>

      {hoverEffect && (
        <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      )}

      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-white/5" />
    </motion.div>
  )
}

export default PremiumCard
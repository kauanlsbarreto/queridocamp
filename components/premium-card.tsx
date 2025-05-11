"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"

interface PremiumCardProps {
  children: ReactNode
  className?: string
  delay?: number
  hoverEffect?: boolean
}

const PremiumCard = ({ children, className = "", delay = 0, hoverEffect = true }: PremiumCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      className={`relative ${
        hoverEffect ? "group" : ""
      } bg-gradient-to-br from-black via-gray-900 to-black p-[1px] rounded-lg overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gold/30 via-transparent to-gold/30 opacity-20 rounded-lg"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-gold/20 via-transparent to-gold/20 opacity-0 group-hover:opacity-30 transition-opacity duration-500 rounded-lg"></div>

      <div className="relative bg-black rounded-lg overflow-hidden h-full">{children}</div>

      {hoverEffect && (
        <>
          <div className="absolute -inset-[1px] bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-500 rounded-lg"></div>
          <div className="absolute -inset-[1px] bg-gradient-to-r from-transparent via-gold/30 to-transparent opacity-0 group-hover:opacity-100 rounded-lg"></div>
        </>
      )}
    </motion.div>
  )
}

export default PremiumCard

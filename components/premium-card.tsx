"use client"

import type { ReactNode } from "react"
import { motion } from "framer-motion"

interface PremiumCardProps {
  children: ReactNode
  className?: string
  delay?: number
  hoverEffect?: boolean
  variant?: "default" | "glass" | "floating"
}

const PremiumCard = ({
  children,
  className = "",
  delay = 0,
  hoverEffect = true,
  variant = "glass",
}: PremiumCardProps) => {
  const getCardStyles = () => {
    switch (variant) {
      case "glass":
        return "glass-gold glass-hover glass-shine"
      case "floating":
        return "glass-gold glass-hover float-slow"
      default:
        return "glass-gold glass-hover"
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{
        duration: 0.6,
        delay,
        type: "spring",
        stiffness: 100,
        damping: 15,
      }}
      className={`relative ${hoverEffect ? "group" : ""} ${getCardStyles()} rounded-2xl overflow-hidden ${className}`}
    >
      {/* Glass reflection effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-50 rounded-2xl pointer-events-none"></div>

      {/* Content */}
      <div className="relative z-10 h-full">{children}</div>

      {/* Hover glow effect */}
      {hoverEffect && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-gold/20 via-gold/40 to-gold/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm -z-10"></div>
      )}
    </motion.div>
  )
}

export default PremiumCard

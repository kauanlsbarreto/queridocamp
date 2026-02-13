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

  const baseStyles = "relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-md"
  
  const getVariantAnimations = () => {
    switch (variant) {
      case "glass":
        return "animate-glass-shine" 
      case "floating":
        return "animate-float"
      default:
        return ""
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
      className={`${baseStyles} ${getVariantAnimations()} ${hoverEffect ? "group" : ""} ${className}`}
    >
      <div className="absolute inset-0 rounded-2xl border border-gold/20 pointer-events-none z-0"></div>

      <div className="absolute inset-0 bg-gradient-to-br from-gold/15 via-transparent to-transparent opacity-60 pointer-events-none"></div>

      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>

      <div className="relative z-10 h-full">{children}</div>

      {hoverEffect && (
        <div className="absolute -inset-0.5 bg-gradient-to-r from-gold-dark/20 via-gold/30 to-gold-dark/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md -z-10"></div>
      )}
    </motion.div>
  )
}

export default PremiumCard
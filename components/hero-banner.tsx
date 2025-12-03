"use client"
import { motion } from "framer-motion"
import Image from "next/image"

interface HeroBannerProps {
  title: string
  subtitle?: string
}

const HeroBanner = ({ title, subtitle }: HeroBannerProps) => {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-dark via-dark/95 to-dark"></div>
        <div className="absolute inset-0 bg-gradient-radial from-primary/10 via-transparent to-transparent"></div>

        {/* Floating particles */}
        <div className="particles">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 6}s`,
                animationDuration: `${4 + Math.random() * 4}s`,
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
          className="space-y-8"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, type: "spring", stiffness: 80 }}
            className="flex justify-center mb-8"
          >
            <div className="relative w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 hover:scale-105 transition-transform duration-500">
              <Image src="/logo.png" alt="Querido Camp Logo" fill className="object-contain drop-shadow-2xl" priority />
              {/* Glow effect behind logo */}
              <div className="absolute inset-0 bg-primary/20 blur-3xl -z-10 animate-pulse"></div>
            </div>
          </motion.div>

          {subtitle && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="glass-card rounded-full px-8 py-3 inline-block border border-primary/20"
            >
              <span className="text-primary font-semibold text-lg">{subtitle}</span>
            </motion.div>
          )}

          {/* Decorative elements */}
          <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.5, type: "spring" }}
            className="flex justify-center space-x-4 mt-12"
          >
            <div className="glass-card w-16 h-1 rounded-full bg-primary/30"></div>
            <div className="glass-card w-8 h-8 rounded-full flex items-center justify-center border border-primary/20">
              <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
            </div>
            <div className="glass-card w-16 h-1 rounded-full bg-primary/30"></div>
          </motion.div>
        </motion.div>
      </div>

      {/* Bottom decorative wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1200 120" className="w-full h-20 fill-current text-primary/10">
          <path d="M0,60 C300,120 900,0 1200,60 L1200,120 L0,120 Z"></path>
        </svg>
      </div>
    </div>
  )
}

export default HeroBanner

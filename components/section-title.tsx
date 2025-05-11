"use client"

import { motion } from "framer-motion"

interface SectionTitleProps {
  title: string
  subtitle?: string
  description?: string
  centered?: boolean
  light?: boolean
}

const SectionTitle = ({ title, subtitle, description, centered = true, light = false }: SectionTitleProps) => {
  return (
    <div className={`space-y-4 mb-12 ${centered ? "text-center" : "text-left"}`}>
      {subtitle && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="inline-block bg-gold/20 backdrop-blur-sm px-4 py-2 rounded-full"
        >
          <span className="text-gold font-semibold">{subtitle}</span>
        </motion.div>
      )}
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={`text-3xl md:text-4xl font-bold ${light ? "text-white" : "text-gold"}`}
      >
        {title}
      </motion.h2>
      {description && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="text-gray-300 max-w-3xl mx-auto"
        >
          {description}
        </motion.p>
      )}
    </div>
  )
}

export default SectionTitle

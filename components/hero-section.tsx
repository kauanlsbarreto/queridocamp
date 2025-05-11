"use client"

import Image from "next/image"
import Link from "next/link"
import { motion } from "framer-motion"

interface HeroSectionProps {
  title: string
  subtitle?: string
  description?: string
  showButtons?: boolean
  backgroundImage?: string
  imageOpacity?: number
  height?: string
  centered?: boolean
}

const HeroSection = ({
  title,
  subtitle,
  description,
  showButtons = false,
  backgroundImage = "/placeholder.svg?height=1080&width=1920",
  imageOpacity = 0.3,
  height = "py-20 md:py-32",
  centered = true,
}: HeroSectionProps) => {
  return (
    <section className={`relative bg-black ${height} overflow-hidden`}>
      <div className="absolute inset-0 z-0" style={{ opacity: imageOpacity }}>
        <Image src={backgroundImage || "/placeholder.svg"} alt="Background" fill className="object-cover" priority />
      </div>
      <div
        className="absolute inset-0 z-0 bg-gradient-to-b from-black/80 via-black/60 to-black"
        style={{ mixBlendMode: "multiply" }}
      ></div>

      <div className="container mx-auto px-4 relative z-10">
        <div
          className={`flex flex-col ${centered ? "items-center text-center" : "items-start"} max-w-5xl ${centered ? "mx-auto" : ""}`}
        >
          {subtitle && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-block bg-gold/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6"
            >
              <span className="text-gold font-semibold">{subtitle}</span>
            </motion.div>
          )}

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold text-white mb-4"
          >
            <span className="text-gold">{title.split(" ")[0]}</span> {title.split(" ").slice(1).join(" ")}
          </motion.h1>

          {description && (
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl md:text-2xl text-gray-200 mb-8 max-w-3xl"
            >
              {description}
            </motion.p>
          )}

          {showButtons && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <Link
                href="/campeonato"
                className="bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
              >
                Saiba Mais
              </Link>
              <a
                href="#inscricao"
                className="border-2 border-gold text-gold font-bold py-3 px-8 rounded-md hover:bg-gold/10 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/10"
              >
                Inscreva-se
              </a>
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}

export default HeroSection

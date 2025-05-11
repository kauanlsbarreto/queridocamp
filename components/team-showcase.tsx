"use client"

import { useState } from "react"
import Image from "next/image"
import { motion } from "framer-motion"
import { Search } from "lucide-react"
import PremiumCard from "./premium-card"
import ImageModal from "./image-modal"

interface TeamShowcaseProps {
  teamName: string
  position: string
  imageSrc: string
  description: string
  delay?: number
}

const TeamShowcase = ({ teamName, position, imageSrc, description, delay = 0 }: TeamShowcaseProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <PremiumCard delay={delay}>
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: delay + 0.2 }}
            >
              <h3 className="text-2xl font-bold">
                <span className="text-gold">{teamName}</span>
              </h3>
              <p className="text-gray-400">{position}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: delay + 0.3 }}
              className="bg-gradient-to-r from-gold/20 to-gold/10 p-1 rounded-full"
            >
              <div className="bg-black rounded-full px-4 py-1">
                <span className="text-gold font-bold">{getPositionBadge(position)}</span>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: delay + 0.4 }}
            className="relative h-[300px] overflow-hidden rounded-lg border border-gold/10 group-hover:border-gold/30 transition-colors duration-300 cursor-pointer group"
            onClick={() => setIsModalOpen(true)}
          >
            <Image
              src={imageSrc || "/placeholder.svg"}
              alt={`Equipe ${teamName}`}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />

            {/* Overlay with zoom icon */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <div className="bg-gold/80 text-black p-3 rounded-full">
                <Search size={24} />
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: delay + 0.5 }}
            className="text-gray-300"
          >
            {description}
          </motion.p>
        </div>
      </PremiumCard>

      {/* Image Modal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageSrc={imageSrc}
        imageAlt={`Equipe ${teamName}`}
      />
    </>
  )
}

const getPositionBadge = (position: string) => {
  if (position.includes("Campeão") || position.includes("1º")) {
    return "🏆 CAMPEÃO"
  } else if (position.includes("2º")) {
    return "🥈 VICE"
  } else if (position.includes("3º")) {
    return "🥉 TOP 3"
  } else {
    return "TOP 4"
  }
}

export default TeamShowcase

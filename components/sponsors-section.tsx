"use client"

import Image from "next/image"
import { useState } from "react"
import { motion } from "framer-motion"
import SectionTitle from "./section-title"
import PremiumCard from "./premium-card"
import ImageModal from "./image-modal"

const SponsorsSection = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentSponsor, setCurrentSponsor] = useState({ src: "", alt: "", index: 0 })

  // Lista de patrocinadores com suas informações
  const sponsors = [
    { id: 1, name: "Farmácia Milagre", logo: "/images/sponsors/farmacia-milagre.png" },
    { id: 2, name: "HITECH Arena", logo: "/images/sponsors/hitech.png" },
    { id: 3, name: "Capital Assessoria", logo: "/images/sponsors/capital-assessoria.png" },
    { id: 4, name: "Querida Pizza", logo: "/images/sponsors/querida-pizza.png" },
    { id: 5, name: "NORIMAKI", logo: "/images/sponsors/norimaki.png" },
    { id: 6, name: "Varanda do Spetto", logo: "/images/sponsors/varanda-do-spetto.png" },
    { id: 7, name: "União Vendas", logo: "/images/sponsors/uniao.png" },
    { id: 8, name: "Radiante", logo: "/images/sponsors/radiante.png" },
    { id: 9, name: "Sandro's Lanches", logo: "/images/sponsors/sandros-lanches.png" },
  ]

  // Imagens para o modal
  const sponsorImages = sponsors.map((sponsor) => ({
    src: sponsor.logo,
    alt: sponsor.name,
  }))

  // Função para abrir o modal com a imagem do patrocinador
  const openSponsorModal = (src: string, alt: string, index: number) => {
    setCurrentSponsor({ src, alt, index })
    setIsModalOpen(true)
  }

  return (
    <section className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <SectionTitle
          title="Nossos Patrocinadores"
          subtitle="Parceiros"
          description="Agradecemos aos nossos patrocinadores que tornam possível a realização do Querido Camp. Seu apoio é fundamental para o crescimento do cenário competitivo de CS2 em Sergipe."
        />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 items-center mt-12">
          {sponsors.map((sponsor, index) => (
            <PremiumCard key={sponsor.id} delay={index * 0.1}>
              <div
                className="p-6 flex items-center justify-center h-32 cursor-pointer group"
                onClick={() => openSponsorModal(sponsor.logo, sponsor.name, index)}
              >
                <div className="relative w-full h-full flex items-center justify-center">
                  <Image
                    src={sponsor.logo || "/placeholder.svg"}
                    alt={sponsor.name}
                    width={200}
                    height={100}
                    className="max-h-24 w-auto object-contain transition-transform duration-300 group-hover:scale-110"
                  />

                  {/* Overlay on hover */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="text-gold text-sm font-medium">Ver detalhes</span>
                  </div>
                </div>
              </div>
            </PremiumCard>
          ))}
        </div>

        <div className="mt-16 text-center">
          <PremiumCard hoverEffect={false}>
            <div className="p-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <p className="text-white text-lg mb-6">Interessado em patrocinar o Querido Camp?</p>
                <a
                  href="mailto:patrocinio@queridocamp.com.br"
                  className="inline-block bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
                >
                  Entre em Contato
                </a>
              </motion.div>
            </div>
          </PremiumCard>
        </div>

        {/* Image Modal */}
        <ImageModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          imageSrc={currentSponsor.src}
          imageAlt={currentSponsor.alt}
          images={sponsorImages}
          currentIndex={currentSponsor.index}
        />
      </div>
    </section>
  )
}

export default SponsorsSection

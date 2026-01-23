"use client"
import Link from "next/link"
import { useState } from "react"
import CountdownTimer from "@/components/countdown-timer"
import SponsorshipSection from "@/components/sponsorship-section"
import SectionTitle from "@/components/section-title"
import { motion } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import HeroBanner from "@/components/hero-banner"
import ImageModal from "@/components/image-modal"
import { Trophy, Award } from "lucide-react"

export default function Home() {
  const startDate = new Date("2026-01-19T00:00:00")

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentImage, setCurrentImage] = useState({ src: "", alt: "" })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentGallery, setCurrentGallery] = useState<"champions" | "draft">("champions")

  const championTeams = [
    {
      id: 1,
      name: "UTI DO CS",
      position: "1º Lugar - Campeão",
      image: "/cs2-esports-champion-team-celebrating-victory.jpg",
      alt: "Equipe UTI DO CS - Campeã",
      description: "SidD, mziu, rygabizinha, karison e Dntt conquistaram o título com uma performance dominante.",
      players: ["SidD", "mziu", "rygabizinha", "karison", "Dntt"],
    },
    {
      id: 2,
      name: "Sundown",
      position: "2º Lugar - Vice-Campeão",
      image: "/cs2-esports-team-second-place-medals.jpg",
      alt: "Equipe Sundown - Vice-Campeã",
      description: "Raul, Barata, Fbr, baiano e Fusion mostraram grande talento chegando à final.",
      players: ["Raul", "Barata", "Fbr", "baiano", "Fusion"],
    },
    {
      id: 3,
      name: "MVP - Gabri",
      position: "Melhor Jogador",
      image: "/cs2-esports-mvp-player-holding-trophy.jpg",
      alt: "MVP Gabri",
      description: "Gabri foi eleito o MVP do campeonato com performances excepcionais durante toda a competição.",
      players: ["Gabri"],
    },
  ]

  const draftGalleryImages = [
    {
      id: 1,
      src: "/uti-do-cs-campeao.jpeg",
      alt: "Time Campeão UTI DO CS",
      description: "Equipe campeã UTI DO CS com o troféu",
    },
    {
      id: 2,
      src: "/sundown-vice-campeao.jpeg",
      alt: "Time Vice-Campeão Sundown",
      description: "Equipe Sundown - Vice-campeã do torneio",
    },
    {
      id: 3,
      src: "/mvp-gabri.jpeg",
      alt: "MVP Gabri com Troféu",
      description: "Gabri - MVP do campeonato",
    },
  ]

  const teamImages = championTeams.map((team) => ({
    src: team.image,
    alt: team.alt,
  }))

  const draftImages = draftGalleryImages.map((img) => ({
    src: img.src,
    alt: img.alt,
  }))

  const openImageModal = (src: string, alt: string, index: number, gallery: "champions" | "draft") => {
    setCurrentImage({ src, alt })
    setCurrentIndex(index)
    setCurrentGallery(gallery)
    setIsModalOpen(true)
  }

  return (
    <div>
      <HeroBanner title="" subtitle="O maior campeonato de Counter-Strike 2 de Sergipe" />

      <section className="py-12 bg-black">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Link
                href="/rodadas"
                className="bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
              >
                Rodadas
              </Link>
            <Link
              href="/campeonato"
              className="bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
            >
              Saiba Mais
            </Link>
            <a
              href="/inscricao"
              className="border-2 border-gold text-gold font-bold py-3 px-8 rounded-md hover:bg-gold/10 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/10"
            >
              Inscreva-se
            </a>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-black via-gray-900 to-black">
        <div className="container mx-auto px-4">
          <SectionTitle title="O Campeonato Começa Em" subtitle="Contagem Regressiva" />
          <CountdownTimer targetDate={startDate} />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 text-center"
          >
            <div className="inline-block bg-black/50 backdrop-blur-sm px-6 py-3 rounded-lg border border-gold/10">
              <p className="text-white">
                <span className="font-bold text-gold">Início:</span> 19 de Janeiro de 2026 |
                <span className="font-bold text-gold"> Inscrições até:</span> 10 de Janeiro de 2026
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <SectionTitle
            title="PREMIAÇÃO"
            subtitle="Recompensas"
            description="Confira os prêmios que serão distribuídos aos melhores jogadores e equipes"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <PremiumCard delay={0}>
              <div className="p-8 text-center">
                <div className="text-5xl font-bold text-gold mb-4">1º Lugar</div>
                <div className="text-3xl font-bold text-white mb-6">R$ 1.000,00</div>
                <div className="bg-gold/20 p-4 rounded-full inline-block flex items-center justify-center">
                  <Trophy className="text-gold h-16 w-16" />
                </div>
                <p className="text-gray-300 mt-4">Troféu de Campeão + Premiação</p>
              </div>
            </PremiumCard>

            <PremiumCard delay={0.1}>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gold mb-4 text-center">MVP do Campeonato</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-gold/20 p-3 rounded-full mr-4 flex items-center justify-center">
                      <Award className="text-gold h-10 w-10" />
                    </div>
                    <div>
                      <p className="text-white">Jogador mais valioso</p>
                      <p className="text-sm text-gray-400">Troféu + Skin no valor de</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gold">R$ 250,00</div>
                </div>
              </div>
            </PremiumCard>
          </div>

          <div className="text-center mt-10">
            <Link
              href="/premiacao"
              className="inline-block bg-gold/10 text-gold font-bold py-3 px-8 rounded-md hover:bg-gold/20 transition-colors border border-gold/30"
            >
              Ver detalhes completos da premiação
            </Link>
          </div>
        </div>
      </section>

      <SponsorshipSection />

      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageSrc={currentImage.src}
        imageAlt={currentImage.alt}
        images={currentGallery === "champions" ? teamImages : draftImages}
        currentIndex={currentIndex}
      />
    </div>
  )
}

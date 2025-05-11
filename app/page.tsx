"use client"

import Image from "next/image"
import Link from "next/link"
import { useState } from "react"
import CountdownTimer from "@/components/countdown-timer"
import SponsorsSection from "@/components/sponsors-section"
import SectionTitle from "@/components/section-title"
import { motion } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import HeroBanner from "@/components/hero-banner"
import ImageModal from "@/components/image-modal"
import { Search, Trophy, Medal, Award } from "lucide-react"

export default function Home() {
  // Data para início do campeonato (2 de julho de 2025)
  const startDate = new Date("2025-07-02T00:00:00")

  // Estado para controlar o modal de imagem
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentImage, setCurrentImage] = useState({ src: "", alt: "" })
  const [currentIndex, setCurrentIndex] = useState(0)

  // Dados das equipes campeãs
  const championTeams = [
    {
      id: 1,
      name: "Kings",
      position: "1º Lugar",
      image: "/images/kings-trophy.png",
      alt: "Equipe Kings",
      description: "A equipe Kings conquistou o título com uma performance dominante durante todo o campeonato.",
    },
    {
      id: 2,
      name: "Querido CS",
      position: "2º Lugar",
      image: "/images/querido-cs.png",
      alt: "Equipe Querido CS",
      description: "A equipe Querido CS mostrou grande talento e determinação, chegando à final.",
    },
    {
      id: 3,
      name: "CTG",
      position: "3º/4º Lugar",
      image: "/images/ctg.png",
      alt: "Equipe CTG",
      description: "A equipe CTG surpreendeu a todos com estratégias inovadoras e jogadas de alto nível.",
    },
  ]

  // Imagens para o modal
  const teamImages = championTeams.map((team) => ({
    src: team.image,
    alt: team.alt,
  }))

  // Função para abrir o modal com a imagem selecionada
  const openImageModal = (src: string, alt: string, index: number) => {
    setCurrentImage({ src, alt })
    setCurrentIndex(index)
    setIsModalOpen(true)
  }

  return (
    <div>
      {/* Hero Section */}
      <HeroBanner title="QUERIDO CAMP" subtitle="O maior campeonato de Counter-Strike 2 de Sergipe" />

      {/* CTA Buttons */}
      <section className="py-12 bg-black">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
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
        </div>
      </section>

      {/* Countdown Section */}
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
                <span className="font-bold text-gold">Início:</span> 2 de Junho de 2025 |
                <span className="font-bold text-gold"> Finais Presenciais:</span> 26 e 27 de Julho de 2025
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto">
            <SectionTitle title="Estamos chegando com mais uma edição incrível!" subtitle="Querido Camp 2025" />
            <PremiumCard>
              <div className="p-8">
                <ul className="space-y-6 text-white">
                  <li className="flex items-start">
                    <span className="text-gold mr-4 text-2xl">📌</span>
                    <span className="text-lg">Formato Draft com jogadores divididos em potes</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-4 text-2xl">🏆</span>
                    <span className="text-lg">
                      Premiação de até R$ 3.000, troféus, medalhas e finais presenciais em LAN
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-4 text-2xl">💸</span>
                    <span className="text-lg">Inscrição: R$ 50,00</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-gold mr-4 text-2xl">📅</span>
                    <span className="text-lg"> 10/06 Até 20/06</span>
                  </li>
                </ul>
                <p className="mt-8 text-white text-center font-bold text-xl">
                  Garanta sua vaga e participe do maior campeonato que Sergipe já viu!
                </p>
              </div>
            </PremiumCard>
          </div>
        </div>
      </section>

      {/* Champions Section */}
      <section className="py-20 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <SectionTitle
            title="Campeões da Última Edição"
            subtitle="Hall da Fama"
            description="Conheça as equipes que se destacaram na edição anterior do Querido Camp"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
            {championTeams.map((team, index) => (
              <PremiumCard key={team.id} delay={index * 0.1}>
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-bold">
                        <span className="text-gold">{team.name}</span>
                      </h3>
                      <p className="text-gray-400">{team.position}</p>
                    </div>

                    <div className="bg-gradient-to-r from-gold/20 to-gold/10 p-1 rounded-full">
                      <div className="bg-black rounded-full px-4 py-1">
                        <span className="text-gold font-bold">
                          {team.position === "1º Lugar"
                            ? "🏆 CAMPEÃO"
                            : team.position === "2º Lugar"
                              ? "🥈 VICE"
                              : "🥉 TOP 3"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="relative h-[300px] overflow-hidden rounded-lg border border-gold/10 group-hover:border-gold/30 transition-colors duration-300 cursor-pointer group"
                    onClick={() => openImageModal(team.image, team.alt, index)}
                  >
                    <Image
                      src={team.image || "/placeholder.svg"}
                      alt={team.alt}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />

                    {/* Overlay with zoom icon */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <div className="bg-gold/80 text-black p-3 rounded-full">
                        <Search size={24} />
                      </div>
                    </div>
                  </div>

                  <p className="text-gray-300">{team.description}</p>
                </div>
              </PremiumCard>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link
              href="/galeria"
              className="inline-block bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
            >
              Ver Galeria Completa
            </Link>
          </div>
        </div>
      </section>

      {/* Prize Section */}
      <section className="py-20 bg-black">
        <div className="container mx-auto px-4">
          <SectionTitle
            title="PREMIAÇÃO"
            subtitle="Recompensas"
            description="Confira os prêmios que serão distribuídos aos melhores jogadores e equipes"
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <PrizeCard position="1" amount="R$ 1.000,00" delay={0} />
            <PrizeCard position="2" amount="R$ 750,00" delay={0.1} />
            <PrizeCard position="3" amount="R$ 250,00" delay={0.2} />
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <PremiumCard delay={0.3}>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gold mb-4">MVP do Campeonato</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-gold/20 p-3 rounded-full mr-4 flex items-center justify-center">
                      <Trophy className="text-gold h-10 w-10" />
                    </div>
                    <div>
                      <p className="text-white">Jogador mais valioso</p>
                      <p className="text-sm text-gray-400">Troféu + Reconhecimento</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gold">R$ 250,00</div>
                </div>
              </div>
            </PremiumCard>

            <PremiumCard delay={0.4}>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gold mb-4">MVP da Rodada</h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="bg-gold/20 p-3 rounded-full mr-4 flex items-center justify-center">
                      <Award className="text-gold h-10 w-10" />
                    </div>
                    <div>
                      <p className="text-white">Melhor jogador de cada rodada</p>
                      <p className="text-sm text-gray-400">10 rodadas no total</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-gold">
                    R$ 50,00 <span className="text-sm font-normal">(cada)</span>
                  </div>
                </div>
                <p className="text-right text-sm text-gray-400 mt-2">Total: R$ 500,00</p>
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

      {/* Registration Section */}
      <section id="inscricao" className="py-20 bg-gradient-to-b from-gray-900 to-black">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <SectionTitle title="Inscreva-se Agora" subtitle="Participe" />
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-white text-lg mb-8"
            >
              As inscrições estão abertas até 20/06. Não perca a oportunidade de participar do maior campeonato de CS2
              de Sergipe!
            </motion.p>
            <motion.a
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              href="https://forms.gle/FHyvA4vJ5JfZ4ezU9"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gold text-black font-bold py-4 px-10 rounded-md hover:bg-gold/80 transition-colors inline-block transform hover:scale-105 duration-200 shadow-xl shadow-gold/20 text-lg"
            >
              Fazer Inscrição - R$ 50,00
            </motion.a>
          </div>
        </div>
      </section>

      {/* Sponsors Section */}
      <SponsorsSection />

      {/* Image Modal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageSrc={currentImage.src}
        imageAlt={currentImage.alt}
        images={teamImages}
        currentIndex={currentIndex}
      />
    </div>
  )
}

const PrizeCard = ({ position, amount, delay }: { position: string; amount: string; delay: number }) => {
  return (
    <PremiumCard delay={delay}>
      <div className="p-8 text-center">
        <div
          className={`text-5xl font-bold ${position === "1" ? "text-gold" : position === "2" ? "text-gray-300" : "text-amber-700"} mb-4 group-hover:scale-110 transition-transform duration-300`}
        >
          {position}º Lugar
        </div>
        <div className="text-3xl font-bold text-white mb-6">{amount}</div>
        <div className="bg-gold/20 p-4 rounded-full inline-block group-hover:bg-gold/30 transition-colors duration-300 flex items-center justify-center">
          {position === "1" ? (
            <Trophy className="text-gold h-16 w-16" />
          ) : position === "2" ? (
            <Medal className="text-gray-300 h-16 w-16" />
          ) : (
            <Medal className="text-amber-700 h-16 w-16" />
          )}
        </div>
      </div>
    </PremiumCard>
  )
}

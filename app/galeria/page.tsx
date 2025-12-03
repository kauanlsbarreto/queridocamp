"use client"
import { useState } from "react"
import SectionTitle from "@/components/section-title"
import { motion } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import HeroBanner from "@/components/hero-banner"
import ImageModal from "@/components/image-modal"
import Image from "next/image"
import { Search, Camera } from "lucide-react"

export default function Galeria() {
  // Estado para controlar o modal de imagem
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentImage, setCurrentImage] = useState({ src: "", alt: "" })
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentGallery, setCurrentGallery] = useState<"teams" | "draft">("teams")

  // Equipes que se destacaram
  const teamShowcases = [
    {
      id: 1,
      teamName: "Kings",
      position: "1º Lugar - Campeão",
      image: "/images/kings-trophy.png",
      description:
        "A equipe Kings conquistou o título com uma performance dominante durante todo o campeonato, demonstrando habilidade e trabalho em equipe excepcionais.",
    },
    {
      id: 2,
      teamName: "Querido CS",
      position: "2º Lugar - Vice-Campeão",
      image: "/images/querido-cs.png",
      description:
        "A equipe Querido CS mostrou grande talento e determinação, chegando à final e garantindo o vice-campeonato em uma disputa emocionante.",
    },
    {
      id: 3,
      teamName: "CTG",
      position: "3º/4º Lugar",
      image: "/images/ctg.png",
      description:
        "A equipe CTG surpreendeu a todos com estratégias inovadoras e jogadas de alto nível, garantindo uma posição entre os melhores do campeonato.",
    },
    {
      id: 4,
      teamName: "Noel",
      position: "3º/4º Lugar",
      image: "/images/noel.png",
      description:
        "A equipe Noel demonstrou grande potencial e habilidade técnica, conquistando uma posição de destaque entre os semifinalistas do campeonato.",
    },
  ]

  // Imagens para o modal
  const teamImages = teamShowcases.map((team) => ({
    src: team.image,
    alt: `Equipe ${team.teamName}`,
  }))

  // Draft gallery images from home page
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

  const draftImages = draftGalleryImages.map((img) => ({
    src: img.src,
    alt: img.alt,
  }))

  // Função para abrir o modal com a imagem selecionada
  const openImageModal = (src: string, alt: string, index: number, gallery: "teams" | "draft" = "teams") => {
    setCurrentImage({ src, alt })
    setCurrentIndex(index)
    setCurrentGallery(gallery)
    setIsModalOpen(true)
  }

  return (
    <div>
      {/* Hero Section */}
      <HeroBanner
        title="GALERIA"
        subtitle="Confira os melhores momentos e as equipes que fizeram história no Querido Camp"
      />

      {/* Teams Section */}
      <section className="py-20 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <SectionTitle
            title="Equipes Campeãs"
            subtitle="Hall da Fama"
            description="Conheça as equipes que se destacaram na edição anterior do Querido Camp"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            {teamShowcases.map((team, index) => (
              <PremiumCard key={team.id} delay={index * 0.1} hoverEffect={false}>
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 + 0.2 }}
                    >
                      <h3 className="text-2xl font-bold">
                        <span className="text-gold">{team.teamName}</span>
                      </h3>
                      <p className="text-gray-400">{team.position}</p>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
                      className="bg-gradient-to-r from-gold/20 to-gold/10 p-1 rounded-full"
                    >
                      <div className="bg-black rounded-full px-4 py-1">
                        <span className="text-gold font-bold">
                          {team.position.includes("1º")
                            ? "🏆 CAMPEÃO"
                            : team.position.includes("2º")
                              ? "🥈 VICE"
                              : "🥉 TOP 3"}
                        </span>
                      </div>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 + 0.4 }}
                    className="relative h-[300px] overflow-hidden rounded-lg border border-gold/10 transition-colors duration-300 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      openImageModal(team.image, `Equipe ${team.teamName}`, index, "teams")
                    }}
                  >
                    <Image
                      src={team.image || "/placeholder.svg"}
                      alt={`Equipe ${team.teamName}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />

                    {/* Botão de visualização sempre visível */}
                    <div className="absolute bottom-4 right-4 bg-gold/80 text-black p-2 rounded-full shadow-lg">
                      <Search size={20} />
                    </div>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 + 0.5 }}
                    className="text-gray-300"
                  >
                    {team.description}
                  </motion.p>
                </div>
              </PremiumCard>
            ))}
          </div>
        </div>
      </section>

      {/* Querido Camp Draft section from home page */}
      <section className="py-20 bg-gradient-to-b from-gray-900 to-black">
        <div className="container mx-auto px-4">
          <SectionTitle
            title="Querido Camp Draft"
            subtitle="Evento de Draft"
            description="Reviva os melhores momentos do evento de draft e formação dos times"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {draftGalleryImages.map((image, index) => (
              <motion.div
                key={image.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group cursor-pointer"
                onClick={() => openImageModal(image.src, image.alt, index, "draft")}
              >
                <PremiumCard hoverEffect={false}>
                  <div className={`relative ${image.id === 3 ? "h-[350px]" : "h-[250px]"} overflow-hidden rounded-lg`}>
                    <Image
                      src={image.src || "/placeholder.svg"}
                      alt={image.alt}
                      fill
                      className={`${image.id === 3 ? "object-contain" : "object-cover"} group-hover:scale-110 transition-transform duration-500`}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-white font-bold text-lg">{image.description}</p>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 bg-gold/80 text-black p-2 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <Camera size={20} />
                    </div>
                  </div>
                </PremiumCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4 text-center">
          <PremiumCard hoverEffect={false}>
            <div className="p-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-gold mb-6">Quer fazer parte da próxima galeria?</h2>
                <p className="text-white mb-8 max-w-2xl mx-auto text-lg">
                  Inscrições do dia 15 de dezembro até dia 15 de janeiro de 2026. Inscreva-se no Querido Camp e tenha a
                  chance de entrar para a história do campeonato!
                </p>
                <a
                  href="https://forms.gle/FHyvA4vJ5JfZ4ezU9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors inline-block transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
                >
                  Inscreva-se Agora
                </a>
              </motion.div>
            </div>
          </PremiumCard>
        </div>
      </section>

      {/* Image Modal */}
      <ImageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        imageSrc={currentImage.src}
        imageAlt={currentImage.alt}
        images={currentGallery === "teams" ? teamImages : draftImages}
        currentIndex={currentIndex}
      />
    </div>
  )
}

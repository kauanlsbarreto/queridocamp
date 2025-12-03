"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Check, Mail, Phone, Building2 } from "lucide-react"
import SectionTitle from "./section-title"
import PremiumCard from "./premium-card"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"

const SponsorshipSection = () => {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)

  const sponsorshipPlans = [
    {
      id: "bronze",
      name: "BRONZE",
      price: "R$ 300",
      color: "from-[#CD7F32] to-[#B87333]",
      borderColor: "border-[#CD7F32]",
      textColor: "text-[#CD7F32]",
      bgColor: "bg-[#CD7F32]",
      benefits: [
        "Divulgação no site do campeonato",
        "Divulgação em Instagram",
        "Divulgação em banners e vídeos produzidos",
        "Divulgação nos grupos de whatspp do campeonato",
        "Divulgação nas transmissões",
      ],
    },
    {
      id: "silver",
      name: "SILVER",
      price: "R$ 500",
      color: "from-[#C0C0C0] to-[#A8A8A8]",
      borderColor: "border-[#C0C0C0]",
      textColor: "text-[#C0C0C0]",
      bgColor: "bg-[#C0C0C0]",
      benefits: [
        "Divulgação no site do campeonato",
        "1 postagem semanal no stories do Instagram",
        "1 postagem no feed do Instagram",
        "1 destaque como patrocinador no Instagram",
        "Divulgação em banners e vídeos produzidos",
        "Divulgação nos grupos de whatspp do campeonato",
        "Divulgação nas transmissões",
        "Divulgação de vídeo promocional nos intervalos",
        "Presença de logomarca nos banners dos entrevistados nas finais presenciais",
      ],
    },
    {
      id: "gold",
      name: "GOLD",
      price: "R$ 1.000",
      color: "from-[#FFD700] to-[#FFA500]",
      borderColor: "border-[#FFD700]",
      textColor: "text-[#FFD700]",
      bgColor: "bg-[#FFD700]",
      benefits: [
        "Divulgação no site do campeonato",
        "1 postagem semanal no stories do Instagram",
        "1 postagem no feed do Instagram",
        "1 destaque como patrocinador no Instagram",
        "Divulgação em banners e vídeos produzidos",
        "Divulgação nos grupos de whatspp do campeonato",
        "Divulgação nas transmissões",
        "2 chamadas pelo narrador ao vivo em todos os jogos transmitidos",
        "Divulgação de vídeo promocional nos intervalos entre os jogos",
        "Presença da logomarca no Banner dos entrevistados nas finais presenciais",
        "Oferecimento MVP da rodada",
      ],
    },
    {
      id: "platina",
      name: "PLATINA",
      price: "R$ 2.000",
      color: "from-[#5DADE2] to-[#3498DB]",
      borderColor: "border-[#5DADE2]",
      textColor: "text-[#5DADE2]",
      bgColor: "bg-[#5DADE2]",
      benefits: [
        "divulgação no site do campeonato com destaque e blog discritivu",
        "1 postagem no feed do Instagram",
        "1 postagem fixada no feed do Instagram",
        "1 destaque como patrocinador oficial no Instagram",
        "Divulgação em banners e vídeos produzidos com logomarca em destaque",
        "Divulgação nos grupos de whatspp do campeonato",
        "Divulgação nas transmissões com logomarca em destaque",
        "2 chamadas pelo narrador ao vivo em todos os jogos transmitidos",
        "Divulgação de vídeo promocional nos intervalos entre os jogos",
        "Presença em destaque da logomarca no Banner dos entrevistados nas finais presenciais",
        "Oferecimento MVP da rodada",
        "Oferecimento MVP do campeonato",
      ],
    },
  ]

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId)
    setIsContactModalOpen(true)
  }

  return (
    <section className="py-20 bg-gradient-to-b from-black via-gray-900 to-black">
      <div className="container mx-auto px-4">
        {/* Seção de Apresentação */}
        <div className="max-w-4xl mx-auto mb-16">
          <SectionTitle title="Seja um Patrocinador" subtitle="Parceria" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <PremiumCard>
              <div className="p-8">
                <p className="text-white text-lg leading-relaxed mb-6">
                  O <span className="text-gold font-bold">Querido Camp</span> é um campeonato que movimenta o cenário de
                  CS2 em Sergipe, conectando jogadores, criadores de conteúdo e marcas que acreditam no potencial dos
                  eSports.
                </p>
                <p className="text-white text-lg leading-relaxed">
                  Nosso objetivo é <span className="text-gold font-bold">profissionalizar e dar visibilidade</span> ao
                  cenário local, oferecendo às marcas exposição direta a um público jovem e engajado.
                </p>
              </div>
            </PremiumCard>
          </motion.div>
        </div>

        {/* Planos de Patrocínio */}
        <div className="mb-12">
          <h3 className="text-3xl font-bold text-center mb-12">
            <span className="bg-gradient-to-r from-gold to-orange bg-clip-text text-transparent">
              Planos de Patrocínio
            </span>
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {sponsorshipPlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="h-full"
            >
              <div
                className={`relative h-full bg-gradient-to-b from-gray-900 to-black border-2 ${plan.borderColor} rounded-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-105 flex flex-col`}
              >
                {/* Header do Card */}
                <div className={`bg-gradient-to-r ${plan.color} p-4 text-center`}>
                  <h4 className="text-3xl font-black text-black tracking-wider">{plan.name}</h4>
                </div>

                {/* Conteúdo */}
                <div className="p-6 flex-1 flex flex-col">
                  {/* Lista de Benefícios */}
                  <ul className="space-y-3 mb-6 flex-1">
                    {plan.benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className={`${plan.textColor} flex-shrink-0 mt-1`} size={20} />
                        <span className="text-white text-sm leading-tight">{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Preço */}
                  <div className={`${plan.bgColor} text-black rounded-lg p-4 text-center mb-4`}>
                    <span className="text-3xl font-black">{plan.price}</span>
                  </div>

                  {/* Botão */}
                  <Button
                    onClick={() => handleSelectPlan(plan.id)}
                    className={`w-full ${plan.bgColor} hover:opacity-90 text-black font-bold py-3 transition-all duration-300`}
                  >
                    Quero este plano
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Modal de Contato */}
        <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
          <DialogContent className="bg-gray-900 border-gold/20">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-gold">Entre em Contato</DialogTitle>
              <DialogDescription className="text-white">
                Escolha uma das opções abaixo para falar conosco sobre o plano{" "}
                <span className="text-gold font-bold">{selectedPlan?.toUpperCase()}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-4">
              <a
                href="mailto:patrocinio@queridocamp.com.br?subject=Interesse no Plano de Patrocínio"
                className="flex items-center gap-3 p-4 bg-black/50 rounded-lg hover:bg-black/70 transition-colors border border-gold/20"
              >
                <Mail className="text-gold" size={24} />
                <div>
                  <p className="text-white font-semibold">E-mail</p>
                  <p className="text-gray-400 text-sm">patrocinio@queridocamp.com.br</p>
                </div>
              </a>

              <a
                href="https://wa.me/5579988561698?text=Olá! Tenho interesse no plano de patrocínio"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-black/50 rounded-lg hover:bg-black/70 transition-colors border border-gold/20"
              >
                <Phone className="text-gold" size={24} />
                <div>
                  <p className="text-white font-semibold">WhatsApp</p>
                  <p className="text-gray-400 text-sm">(79) 98856-1698</p>
                </div>
              </a>

              <a
                href="https://instagram.com/queridocamp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-black/50 rounded-lg hover:bg-black/70 transition-colors border border-gold/20"
              >
                <Building2 className="text-gold" size={24} />
                <div>
                  <p className="text-white font-semibold">Instagram</p>
                  <p className="text-gray-400 text-sm">@queridocamp</p>
                </div>
              </a>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}

export default SponsorshipSection

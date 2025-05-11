"use client"

import type React from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import HeroBanner from "@/components/hero-banner"
import PremiumCard from "@/components/premium-card"

export default function Campeonato() {
  return (
    <div>
      {/* Hero Section */}
      <HeroBanner title="SOBRE O CAMPEONATO" subtitle="Conheça todos os detalhes do Querido Camp" />

      {/* About Section */}
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto">
            <PremiumCard>
              <div className="p-8">
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="text-white text-lg mb-6"
                >
                  O Querido Camp é um campeonato de Counter-Strike 2 criado com o objetivo de impulsionar e fortalecer
                  ainda mais o cenário competitivo em Sergipe. Buscamos proporcionar uma experiência de alto nível para
                  jogadores e times que querem testar suas habilidades, competir em um ambiente estruturado e, acima de
                  tudo, evoluir dentro do cenário de esports!
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="text-white text-lg mb-6"
                >
                  Nesta edição, contamos com ainda mais apoiadores que acreditam no nosso potencial e compartilham da
                  nossa visão de crescimento. Estamos focados em tornar o Querido Camp um evento cada vez maior, mais
                  organizado e competitivo, oferecendo uma plataforma para que talentos locais se destaquem e alcancem
                  novos patamares.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="text-white text-lg mb-6"
                >
                  Nossa missão é elevar o nível do CS2 em Sergipe, criando oportunidades para jogadores de todos os
                  níveis e promovendo a comunidade local de esports. Acreditamos que com dedicação, organização e paixão
                  pelo jogo, podemos construir um cenário competitivo forte e sustentável em nossa região.
                </motion.p>
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="text-white text-lg"
                >
                  Junte-se a nós nesta jornada e faça parte da história do Querido Camp!
                </motion.p>
              </div>
            </PremiumCard>
          </div>
        </div>
      </section>

      {/* Format Section */}
      <section className="py-16 bg-black">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl font-bold text-gold mb-8 text-center"
            >
              Formato do Campeonato
            </motion.h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <PremiumCard delay={0.1}>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gold mb-4">Fase de Grupos</h3>
                  <ul className="space-y-3 text-white">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Jogos de ida e volta</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Vitória vale 3 pontos</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Empate vale 1 ponto</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Todos jogam contra todos</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">•</span>
                      <span>Os 8 melhores avançam para as quartas de final</span>
                    </li>
                  </ul>
                </div>
              </PremiumCard>
              <PremiumCard delay={0.2}>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gold mb-4">Critérios de Desempate</h3>
                  <ul className="space-y-3 text-white">
                    <li className="flex items-start">
                      <span className="text-gold mr-2">1.</span>
                      <span>Saldo de rounds</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">2.</span>
                      <span>Confronto direto</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">3.</span>
                      <span>Maior número de rounds vencidos</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">4.</span>
                      <span>Menor número de rounds perdidos</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-gold mr-2">5.</span>
                      <span>Sorteio</span>
                    </li>
                  </ul>
                </div>
              </PremiumCard>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-gold mb-10 text-center"
          >
            Cronograma do Campeonato
          </motion.h2>
          <div className="max-w-3xl mx-auto">
            <div className="relative border-l-2 border-gold pl-8 space-y-10">
              <TimelineItem date="10/06 Até 20/06" title="Inscrições">
                Período de inscrições para equipes e jogadores individuais.
              </TimelineItem>
              <TimelineItem date=" 02/06" title="Início do Campeonato">
                Cerimônia de abertura e primeiras partidas da fase de grupos.
              </TimelineItem>
              <TimelineItem date="02/06 a 22/07" title="Fase de Grupos">
                Partidas da fase de grupos, com jogos de ida e volta.
              </TimelineItem>
              <TimelineItem date="22/07 a 25/07" title="Quartas de Final">
                Confrontos eliminatórios entre os 8 melhores times.
              </TimelineItem>
              
              <TimelineItem date="26/07 a 27/07" title="Semifinais e Finais Presenciais">
                Grande final presencial em LAN e cerimônia de premiação.
              </TimelineItem>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 bg-black">
        <div className="container mx-auto px-4">
          <PremiumCard hoverEffect={false}>
            <div className="p-8 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <h2 className="text-2xl font-bold text-gold mb-6">Pronto para participar?</h2>
                <p className="text-white mb-8 max-w-2xl mx-auto">
                  Não perca a oportunidade de fazer parte do maior campeonato de CS2 de Sergipe. Inscreva-se agora e
                  mostre seu talento!
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    href="/regras"
                    className="border-2 border-gold text-gold font-bold py-3 px-8 rounded-md hover:bg-gold/10 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/10"
                  >
                    Ver Regras
                  </Link>
                  <a
                    href="https://forms.gle/FHyvA4vJ5JfZ4ezU9"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
                  >
                    Fazer Inscrição
                  </a>
                </div>
              </motion.div>
            </div>
          </PremiumCard>
        </div>
      </section>
    </div>
  )
}

const TimelineItem = ({
  date,
  title,
  children,
}: {
  date: string
  title: string
  children: React.ReactNode
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div className="absolute -left-10 mt-1.5 h-4 w-4 rounded-full bg-gold"></div>
      <h3 className="text-gold font-bold text-lg">{date}</h3>
      <h4 className="text-white font-bold mt-1">{title}</h4>
      <p className="text-gray-300 mt-2">{children}</p>
    </motion.div>
  )
}

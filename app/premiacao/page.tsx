"use client"
import { motion } from "framer-motion"
import HeroBanner from "@/components/hero-banner"
import PremiumCard from "@/components/premium-card"
import { Trophy, Medal, Award } from "lucide-react"

export default function Premiacao() {
  return (
    <div>
      {/* Hero Section */}
      <HeroBanner title="PREMIAÇÃO" subtitle="Confira os prêmios do Querido Camp" />

      {/* Prize Money Section */}
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-gold mb-10 text-center"
          >
            Premiação em Dinheiro
          </motion.h2>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PrizeCard position="1" amount="R$ 1.000,00" delay={0.1} />
              <PrizeCard position="2" amount="R$ 750,00" delay={0.2} />
              <PrizeCard position="3" amount="R$ 250,00" delay={0.3} />
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
              <PremiumCard delay={0.4}>
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

              <PremiumCard delay={0.5}>
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
          </div>
        </div>
      </section>

      {/* Recognition Section */}
      <section className="py-16 bg-black">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-gold mb-10 text-center"
          >
            Reconhecimentos Especiais
          </motion.h2>
          <div className="max-w-4xl mx-auto">
            <PremiumCard>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gold mb-6 text-center">Craque da Galera</h3>
                <p className="text-white text-center mb-8">
                  O jogador mais votado pelo público receberá um troféu especial e reconhecimento como o favorito dos
                  fãs.
                </p>

                <h3 className="text-xl font-bold text-gold mb-6 text-center">Melhores por Função</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <RoleCard role="Entry" />
                  <RoleCard role="Rifler" />
                  <RoleCard role="AWP" />
                  <RoleCard role="IGL" />
                  <RoleCard role="Suporte" />
                </div>

                <div className="mt-8 text-center">
                  <p className="text-white">
                    As votações serão abertas no site durante o campeonato. Fique atento para votar nos seus jogadores
                    favoritos!
                  </p>
                </div>
              </div>
            </PremiumCard>
          </div>
        </div>
      </section>

      {/* Trophy Section */}
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-bold text-gold mb-10 text-center"
          >
            Troféus e Medalhas
          </motion.h2>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <PremiumCard delay={0.1}>
                <div className="p-6 text-center">
                  <div className="bg-gold/20 p-4 rounded-full inline-block mb-4 flex items-center justify-center">
                    <Trophy className="text-gold h-16 w-16" />
                  </div>
                  <h3 className="text-xl font-bold text-gold mb-2">Troféu de Campeão</h3>
                  <p className="text-white">Troféu exclusivo para a equipe campeã do Querido Camp</p>
                </div>
              </PremiumCard>

              <PremiumCard delay={0.2}>
                <div className="p-6 text-center">
                  <div className="bg-gold/20 p-4 rounded-full inline-block mb-4 flex items-center justify-center">
                    <Medal className="text-gray-300 h-16 w-16" />
                  </div>
                  <h3 className="text-xl font-bold text-gold mb-2">Medalhas</h3>
                  <p className="text-white">Medalhas para os jogadores das três primeiras equipes</p>
                </div>
              </PremiumCard>

              <PremiumCard delay={0.3}>
                <div className="p-6 text-center">
                  <div className="bg-gold/20 p-4 rounded-full inline-block mb-4 flex items-center justify-center">
                    <Award className="text-gold h-16 w-16" />
                  </div>
                  <h3 className="text-xl font-bold text-gold mb-2">Certificados</h3>
                  <p className="text-white">Certificados digitais para todos os participantes do campeonato</p>
                </div>
              </PremiumCard>
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
                <h2 className="text-2xl font-bold text-gold mb-6">Quer fazer parte disso?</h2>
                <p className="text-white mb-8 max-w-2xl mx-auto">
                  Não perca a oportunidade de competir pelo prêmio e reconhecimento no maior campeonato de CS2 de
                  Sergipe!
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
    </div>
  )
}

const PrizeCard = ({ position, amount, delay }: { position: string; amount: string; delay: number }) => {
  return (
    <PremiumCard delay={delay}>
      <div className="p-6 rounded-lg text-center">
        <div
          className={`text-4xl font-bold ${position === "1" ? "text-gold" : position === "2" ? "text-gray-300" : "text-amber-700"} mb-2`}
        >
          {position}º Lugar
        </div>
        <div className="text-3xl font-bold text-white mb-4">{amount}</div>
        <div className="bg-gold/20 p-4 rounded-full inline-block flex items-center justify-center">
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

const RoleCard = ({ role }: { role: string }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg text-center">
      <div className="bg-gold/10 p-2 rounded-full inline-block mb-2 flex items-center justify-center">
        <Award className="text-gold h-8 w-8" />
      </div>
      <p className="text-gold font-bold">{role}</p>
    </div>
  )
}

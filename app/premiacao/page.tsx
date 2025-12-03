"use client"
import { motion } from "framer-motion"
import HeroBanner from "@/components/hero-banner"
import PremiumCard from "@/components/premium-card"
import { Trophy, Award, Medal } from "lucide-react"

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <PremiumCard delay={0.1}>
                <div className="p-8 text-center">
                  <div className="text-5xl font-bold text-gold mb-4">1º Lugar</div>
                  <div className="text-4xl font-bold text-white mb-6">R$ 1.250,00</div>
                  <div className="bg-gold/20 p-6 rounded-full inline-block flex items-center justify-center mb-4">
                    <Trophy className="text-gold h-20 w-20" />
                  </div>
                  <p className="text-gray-300 text-lg">Troféu de Campeão + Premiação em Dinheiro</p>
                </div>
              </PremiumCard>

              <PremiumCard delay={0.2}>
                <div className="p-8 text-center">
                  <h3 className="text-3xl font-bold text-gold mb-6">MVP do Campeonato</h3>
                  <div className="text-4xl font-bold text-white mb-6">R$ 250,00</div>
                  <div className="bg-gold/20 p-6 rounded-full inline-block flex items-center justify-center mb-4">
                    <Award className="text-gold h-20 w-20" />
                  </div>
                  <p className="text-gray-300 text-lg">Troféu de MVP + Premiação em Dinheiro</p>
                </div>
              </PremiumCard>
            </div>

            <div className="mt-12 text-center">
              <PremiumCard delay={0.3}>
                <div className="p-8">
                  <h3 className="text-2xl font-bold text-gold mb-6">Premiação Total: R$ 1.500,00</h3>
                  <p className="text-white text-lg mb-4">
                    Além da premiação em dinheiro, todos os participantes receberão:
                  </p>
                  <ul className="text-gray-300 space-y-2 max-w-2xl mx-auto">
                    <li>• Experiência em finais presenciais em LAN</li>
                    <li>• Reconhecimento no cenário competitivo de Sergipe</li>
                    <li>• Oportunidade de networking com outros jogadores</li>
                  </ul>
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
                <h3 className="text-2xl font-bold text-gold mb-6 text-center">MELHORES DO CAMPEONATO</h3>
                <p className="text-white text-center mb-8">
                  Reconhecimento especial para os destaques do campeonato em diferentes categorias
                </p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <AwardCard title="MVP do Campeonato" />
                  <AwardCard title="Melhor Pote 2" />
                  <AwardCard title="Melhor Pote 3" />
                  <AwardCard title="Melhor Pote 4" />
                  <AwardCard title="Melhor Pote 5" />
                </div>

                <div className="mt-8 text-center">
                  <p className="text-white">
                    Os melhores jogadores de cada categoria receberão medalhas especiais e reconhecimento durante a
                    cerimônia de premiação!
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <PremiumCard delay={0.1}>
                <div className="p-6 text-center">
                  <div className="bg-gold/20 p-4 rounded-full inline-block mb-4 flex items-center justify-center">
                    <Trophy className="text-gold h-12 w-12" />
                  </div>
                  <h3 className="text-lg font-bold text-gold mb-2">Troféu de Campeão</h3>
                  <p className="text-white text-sm">Para a equipe vencedora</p>
                </div>
              </PremiumCard>

              <PremiumCard delay={0.2}>
                <div className="p-6 text-center">
                  <div className="bg-gold/20 p-4 rounded-full inline-block mb-4 flex items-center justify-center">
                    <Award className="text-gold h-12 w-12" />
                  </div>
                  <h3 className="text-lg font-bold text-gold mb-2">Troféu de MVP</h3>
                  <p className="text-white text-sm">Melhor jogador do campeonato</p>
                </div>
              </PremiumCard>

              <PremiumCard delay={0.3}>
                <div className="p-6 text-center">
                  <div className="bg-gold/20 p-4 rounded-full inline-block mb-4 flex items-center justify-center">
                    <Medal className="text-gold h-12 w-12" />
                  </div>
                  <h3 className="text-lg font-bold text-gold mb-2">Medalhas</h3>
                  <p className="text-white text-sm">Campeões e Vice-Campeões</p>
                </div>
              </PremiumCard>

              <PremiumCard delay={0.4}>
                <div className="p-6 text-center">
                  <div className="bg-gold/20 p-4 rounded-full inline-block mb-4 flex items-center justify-center">
                    <Medal className="text-gold h-12 w-12" />
                  </div>
                  <h3 className="text-lg font-bold text-gold mb-2">Medalhas Especiais</h3>
                  <p className="text-white text-sm">Melhores do Campeonato</p>
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
                  Inscrições até 10 de Janeiro. Não perca a oportunidade de competir pelo prêmio e reconhecimento no
                  maior campeonato de CS2 de Sergipe!
                </p>
                <a
                  href="https://forms.gle/FHyvA4vJ5JfZ4ezU9"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors inline-block transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
                >
                  Inscreva-se Agora - R$ 75,00
                </a>
              </motion.div>
            </div>
          </PremiumCard>
        </div>
      </section>
    </div>
  )
}

const AwardCard = ({ title }: { title: string }) => {
  return (
    <div className="bg-gray-800 p-6 rounded-lg text-center hover:bg-gray-700 transition-colors">
      <div className="bg-gold/10 p-3 rounded-full inline-block mb-3 flex items-center justify-center">
        <Award className="text-gold h-10 w-10" />
      </div>
      <p className="text-gold font-bold text-sm">{title}</p>
    </div>
  )
}

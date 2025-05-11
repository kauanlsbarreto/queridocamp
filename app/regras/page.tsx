"use client"

import type React from "react"
import HeroBanner from "@/components/hero-banner"
import PremiumCard from "@/components/premium-card"
import { motion } from "framer-motion"

export default function Regras() {
  return (
    <div>
      {/* Hero Section */}
      <HeroBanner title="REGRAS DO CAMPEONATO" subtitle="Conheça as regras oficiais do Querido Camp" />

      {/* Rules Section */}
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-12">
            <RuleSection number="1" title="Integridade e Conduta">
              <RuleItem title="Proibição de Cheats e Scripts Ilegais:">
                É estritamente proibido o uso de qualquer tipo de trapaça, incluindo, mas não se limitando a: wallhack,
                aimbot, no recoil, no flash, scripts de bunny hop, entre outros. A presença de tais scripts nos arquivos
                de configuração, mesmo que não utilizados, é considerada infração.
              </RuleItem>
              <RuleItem title="Ghosting:">
                É proibido qualquer tipo de assistência externa durante as partidas, como receber informações de
                espectadores ou terceiros.
              </RuleItem>
              <RuleItem title="Manipulação de Resultados:">
                Qualquer tentativa de manipular o resultado de uma partida, seja por meio de combinação de resultados ou
                outras práticas, resultará em desclassificação imediata e possíveis sanções adicionais.
              </RuleItem>
              <RuleItem title="Comportamento Antidesportivo:">
                Ofensas verbais, provocações excessivas ou qualquer atitude que comprometa o ambiente competitivo serão
                penalizadas.
              </RuleItem>
            </RuleSection>

            <RuleSection number="2" title="Configurações e Equipamentos">
              <RuleItem title="Configurações de Jogo:">
                Apenas scripts de compra, alternância (toggle) e demo são permitidos. Scripts que oferecem vantagem
                competitiva, como aqueles que automatizam movimentos ou ações, são proibidos.
              </RuleItem>
              <RuleItem title="Overlays e HUDs Personalizados:">
                Somente os overlays padrão do jogo são permitidos, como cl_showpos 1, cl_showfps 1 e net_graph 1. HUDs
                personalizados devem ser legíveis e não podem ocultar informações essenciais.
              </RuleItem>
              <RuleItem title="Arquivos Personalizados:">
                É proibido o uso de modelos, texturas ou sons personalizados que alterem a jogabilidade ou ofereçam
                vantagem competitiva.
              </RuleItem>
            </RuleSection>

            <RuleSection number="3" title="Equipamentos e Software">
              <RuleItem title="Anti-Cheat Obrigatório:">
                Todos os jogadores devem utilizar o cliente oficial de anti-cheat da organização do campeonato. A
                tentativa de burlar ou desativar o anti-cheat resultará em banimento.
              </RuleItem>
              <RuleItem title="Ambientes Virtuais:">
                É proibido jogar em máquinas virtuais. Jogadores devem utilizar sistemas operacionais nativos para
                garantir a integridade do ambiente de jogo.
              </RuleItem>
              <RuleItem title="Hardware e Software Adicionais:">
                O uso de softwares ou hardwares que ofereçam vantagem competitiva, como overclocking não autorizado ou
                softwares de monitoramento de desempenho que interfiram no jogo, é proibido.
              </RuleItem>
            </RuleSection>

            <RuleSection number="4" title="Regras de Partida">
              <RuleItem title="Formato das Partidas:">
                As partidas serão disputadas no formato melhor de 24 rounds (primeiro a 13). Em caso de empate, haverá
                prorrogação de 6 rounds com $12.500 de dinheiro inicial.
              </RuleItem>
              <RuleItem title="Pausas Técnicas:">
                Cada equipe tem direito a pausas técnicas, totalizando no máximo 10 minutos por partida. Após esse
                tempo, a partida será retomada automaticamente.
              </RuleItem>
              <RuleItem title="Desconexões:">
                Em caso de queda de conexão, a partida será pausada por até 10 minutos para tentativa de reconexão. Se o
                jogador não retornar nesse período, a partida continuará.
              </RuleItem>
            </RuleSection>

            <RuleSection number="5" title="Sanções e Penalidades">
              <RuleItem title="Uso de Cheats:">
                Banimento de 2 anos para o jogador e desclassificação da equipe.
              </RuleItem>
              <RuleItem title="Scripts Ilegais:">
                Penalidades variam de 2 a 12 pontos, dependendo da gravidade.
              </RuleItem>
              <RuleItem title="Comportamento Antidesportivo:">
                Advertência, perda de rounds ou desclassificação, conforme a gravidade.
              </RuleItem>
              <RuleItem title="Manipulação de Resultados:">
                Desclassificação imediata e banimento de até 5 anos.
              </RuleItem>
            </RuleSection>
          </div>
        </div>
      </section>

      {/* Contact Section */}
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
                <h2 className="text-2xl font-bold text-gold mb-6">Dúvidas sobre as regras?</h2>
                <p className="text-white mb-8 max-w-2xl mx-auto">
                  Se você tiver qualquer dúvida sobre as regras do campeonato, entre em contato com a organização.
                  Estamos aqui para garantir que todos tenham uma experiência justa e divertida.
                </p>
                <a
                  href="mailto:regras@queridocamp.com.br"
                  className="bg-gold text-black font-bold py-3 px-8 rounded-md hover:bg-gold/80 transition-colors inline-block transform hover:scale-105 duration-200 shadow-lg shadow-gold/20"
                >
                  Contatar Organização
                </a>
              </motion.div>
            </div>
          </PremiumCard>
        </div>
      </section>
    </div>
  )
}

const RuleSection = ({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: React.ReactNode
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="text-2xl font-bold text-gold mb-6">
        {number}. {title}
      </h2>
      <div className="space-y-6 pl-4 border-l-2 border-gold/30">{children}</div>
    </motion.div>
  )
}

const RuleItem = ({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) => {
  return (
    <PremiumCard>
      <div className="p-6">
        <h3 className="text-lg font-bold text-gold mb-2">{title}</h3>
        <div className="text-gray-300">{children}</div>
      </div>
    </PremiumCard>
  )
}

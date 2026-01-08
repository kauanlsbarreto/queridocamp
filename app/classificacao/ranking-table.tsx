"use client"

import { motion } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import Image from "next/image"

interface Team {
  id: number
  name: string
  logo: string
  wins: number
  losses: number
  points: number
  rounds: string
}

const MotionTr = motion.create("tr")
const MotionDiv = motion.create("div")

export default function RankingTable({ teams }: { teams: Team[] }) {
  return (
    <>
      <PremiumCard>
        <div className="p-4 md:p-8 overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b-2 border-gold/30">
                <th className="text-left py-4 px-2 text-gold font-bold">#</th>
                <th className="text-left py-4 px-2 text-gold font-bold">Time</th>
                <th className="text-center py-4 px-2 text-gold font-bold">V</th>
                <th className="text-center py-4 px-2 text-gold font-bold">D</th>
                <th className="text-center py-4 px-2 text-gold font-bold">PTS</th>
                <th className="text-center py-4 px-2 text-gold font-bold">Rounds</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team, index) => (
                <MotionTr
                  key={team.id || index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`border-b border-white/10 hover:bg-white/5 transition-colors ${
                    index < 8 ? "bg-green-500/5" : ""
                  }`}
                >
                  <td className="py-4 px-2 text-white font-semibold">{index + 1}</td>
                  <td className="py-4 px-2">
                    <div className="flex items-center gap-3">
                      <div className="relative w-10 h-10 flex-shrink-0">
                        <Image
                          src={team.logo || "/placeholder.svg"}
                          alt={`${team.name} logo`}
                          fill
                          className="object-contain rounded-lg"
                        />
                      </div>
                      <span className="text-white font-medium">{team.name}</span>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-center text-green-400 font-semibold">{team.wins}</td>
                  <td className="py-4 px-2 text-center text-red-400 font-semibold">{team.losses}</td>
                  <td className="py-4 px-2 text-center text-gold font-bold text-lg">{team.points}</td>
                  <td
                    className={`py-4 px-2 text-center font-semibold ${
                      team.rounds.startsWith("+") ? "text-green-400" : "text-red-400"
                    }`}
                  >
                    {team.rounds}
                  </td>
                </MotionTr>
              ))}
            </tbody>
          </table>

          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex flex-wrap gap-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500/20 border border-green-500/50 rounded"></div>
                <span className="text-gray-300">Classificados para as quartas de final</span>
              </div>
            </div>
            <p className="text-center text-gray-400 text-sm mt-4">
              V = Vitórias | D = Derrotas | PTS = Pontos | Rounds = Saldo de rounds
            </p>
          </div>
        </div>
      </PremiumCard>

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-8 text-center"
      >
        <p className="text-gray-300 text-sm">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>
      </MotionDiv>
    </>
  )
}

"use client"

import { useState, Fragment, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"

// Definição da interface para garantir tipagem forte
interface Team {
  id: number
  name: string
  logo: string
  wins: number
  losses: number
  points: number
  rounds: string
}

// Interfaces para os detalhes que vêm da API
interface Match {
  match_id: number
  time1: string
  time2: string
  placar_mapa1_time1: number
  placar_mapa1_time2: number
  placar_mapa2_time1: number
  placar_mapa2_time2: number
  map_winner?: string // Adicionado para desempate
  match_winner?: string // Adicionado para desempate
}

interface Adjustment {
  motivo: string
}

interface TeamDetails {
  matches: Match[]
  adjustments: Adjustment[]
}

export default function RankingTable({ teams }: { teams: Team[] }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [details, setDetails] = useState<TeamDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  const toggleTeam = async (teamName: string) => {
    if (expandedTeam === teamName) {
      setExpandedTeam(null)
      return
    }

    setExpandedTeam(teamName)
    setLoading(true)
    setDetails(null)
    setApiError(null)

    try {
      const res = await fetch(`/api/team-details?teamName=${encodeURIComponent(teamName)}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Falha ao buscar dados")
      }
      const data = await res.json()
      setDetails(data)
    } catch (error: any) {
      console.error("Erro ao buscar detalhes:", error)
      setApiError(error.message)
    } finally {
      setLoading(false)
    }
  }

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
                <Fragment key={team.id || index}>
                  <motion.tr
                    onClick={() => toggleTeam(team.name)}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={`border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer ${
                      index < 8 ? "bg-green-500/5" : ""
                    } ${expandedTeam === team.name ? "bg-white/10" : ""}`}
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
                        <Link
                          href={`/times?search=${encodeURIComponent(team.name)}`}
                          className="text-gray-500 hover:text-gold transition-colors"
                          title={`Buscar time ${team.name}`}
                          onClick={e => e.stopPropagation()}
                        >
                          <Search size={16} />
                        </Link>
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
                  </motion.tr>

                  <AnimatePresence>
                    {expandedTeam === team.name && (
                      <tr key={`${team.id}-details`}>
                        <td colSpan={6} className="p-0 border-b border-gold/20">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden bg-black/40 backdrop-blur-sm"
                          >
                            <div className="p-6 border-l-4 border-gold ml-2">
                              <h4 className="text-gold font-bold mb-4 text-xs tracking-widest uppercase">
                                Detalhamento da Pontuação
                              </h4>

                              {loading && <div className="text-gray-400 animate-pulse text-sm">Buscando dados no servidor...</div>}
                              
                              {apiError && <div className="text-red-400 text-sm">Erro: {apiError}</div>}

                              {!loading && !apiError && (
                                <div className="space-y-4">
                                  {/* Lista de Jogos */}
                                  <div className="grid gap-2">
                                    {details?.matches && details.matches.length > 0 ? (
                                      details.matches.map(m => (
                                        <div
                                          key={m.match_id}
                                          className="flex flex-col sm:flex-row justify-between bg-white/5 p-3 rounded border border-white/5 text-sm"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className={m.time1 === team.name ? "text-gold font-bold" : "text-gray-400"}>
                                              {m.time1}
                                            </span>
                                            <span className="text-gray-600">vs</span>
                                            <span className={m.time2 === team.name ? "text-gold font-bold" : "text-gray-400"}>
                                              {m.time2}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-4 font-mono mt-2 sm:mt-0">
                                            <span className="text-white/80">M1: {m.placar_mapa1_time1}-{m.placar_mapa1_time2}</span>
                                            <span className="text-white/80">M2: {m.placar_mapa2_time1}-{m.placar_mapa2_time2}</span>
                                            {m.map_winner && (
                                                <span className="text-xs text-gold/80">Vencedor Mapa: {m.map_winner}</span>
                                            )}
                                            {m.match_winner && (
                                                <span className="text-xs text-gold">Vencedor Partida: {m.match_winner}</span>
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-gray-500 text-xs italic">Nenhum jogo registrado.</p>
                                    )}
                                  </div>

                                  {/* Ajustes Manuais / Motivo */}
                                  {details?.adjustments && details.adjustments.length > 0 &&
                                    details.adjustments.map((adj, i) => (
                                      <div key={i} className="mt-4 p-3 bg-gold/10 border border-gold/30 rounded-r-lg">
                                        <span className="text-[10px] text-gold font-black uppercase">Ajuste Manual</span>
                                        <p className="text-white text-sm mt-1">"{adj.motivo}"</p>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </Fragment>
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

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mt-8 text-center"
      >
        {hasMounted && <p className="text-gray-300 text-sm">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>}
      </motion.div>
    </>
  )
}
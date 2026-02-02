"use client"

import { useState, Fragment, useEffect, memo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"

interface Team {
  id: number;
  name: string;
  logo: string;
  wins: number;
  losses: number;
  points: number;
  rounds: string;
}

interface Match {
  match_id: number;
  time1: string;
  time2: string;
  placar_mapa1_time1: number;
  placar_mapa1_time2: number;
  placar_mapa2_time1: number;
  placar_mapa2_time2: number;
  map_winner?: string;
  match_winner?: string;
}

interface TeamDetails {
  matches: Match[];
  adjustments: { motivo: string }[];
}

// Componente de linha otimizado para evitar lag no scroll e re-renderizações inúteis
const TeamRow = memo(({ 
  team, 
  index, 
  isExpanded, 
  toggleTeam, 
  details, 
  loading 
}: { 
  team: Team; 
  index: number; 
  isExpanded: boolean; 
  toggleTeam: (name: string) => void;
  details: TeamDetails | null;
  loading: boolean;
}) => {
  return (
    <Fragment>
      <motion.tr
        layout="position" 
        onClick={() => toggleTeam(team.name)}
        className={`border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer ${
          index < 8 ? "bg-green-500/5" : ""
        } ${isExpanded ? "bg-white/10" : ""}`}
      >
        <td className="py-4 px-2 text-white font-semibold">{index + 1}</td>
        <td className="py-4 px-2">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex-shrink-0">
              <Image
                src={team.logo || "/placeholder.svg"}
                alt={team.name}
                fill
                sizes="40px"
                priority={index < 5} 
                className="object-contain rounded-lg"
              />
            </div>
            <span className="text-white font-medium">{team.name}</span>
            <Link
              href={`/times?search=${encodeURIComponent(team.name)}`}
              className="text-gray-500 hover:text-gold transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <Search size={16} />
            </Link>
          </div>
        </td>
        <td className="py-4 px-2 text-center text-green-400 font-semibold">{team.wins}</td>
        <td className="py-4 px-2 text-center text-red-400 font-semibold">{team.losses}</td>
        <td className="py-4 px-2 text-center text-gold font-bold text-lg">{team.points}</td>
        <td className={`py-4 px-2 text-center font-semibold ${team.rounds.startsWith("+") ? "text-green-400" : "text-red-400"}`}>
          {team.rounds}
        </td>
      </motion.tr>

      <AnimatePresence>
        {isExpanded && (
          <tr>
            <td colSpan={6} className="p-0 border-b border-gold/20">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden bg-black/40 backdrop-blur-sm"
              >
                <div className="p-6 border-l-4 border-gold ml-2">
                  <h4 className="text-gold font-bold mb-4 text-xs uppercase tracking-widest">Detalhamento</h4>
                  
                  {loading && !details ? (
                    <div className="text-gray-400 animate-pulse text-sm">Buscando dados...</div>
                  ) : (
                    <div className="space-y-4">
                      {/* Verificação segura usando Optional Chaining (?.) para evitar o erro de 'map' */}
                      {details?.matches?.length ? (
                        details.matches.map(m => (
                          <div key={m.match_id} className="flex flex-col sm:flex-row justify-between bg-white/5 p-3 rounded text-sm border border-white/5">
                            <div className="flex items-center gap-2">
                              <span className={m.time1 === team.name ? "text-gold font-bold" : "text-gray-400"}>{m.time1}</span>
                              <span className="text-gray-600">vs</span>
                              <span className={m.time2 === team.name ? "text-gold font-bold" : "text-gray-400"}>{m.time2}</span>
                            </div>
                            <div className="flex gap-4 font-mono text-white/80 mt-2 sm:mt-0">
                              <span>M1: {m.placar_mapa1_time1}-{m.placar_mapa1_time2}</span>
                              <span>M2: {m.placar_mapa2_time1}-{m.placar_mapa2_time2}</span>
                            </div>
                          </div>
                        ))
                      ) : !loading && <p className="text-gray-500 text-xs italic">Nenhum jogo registrado.</p>}

                      {/* Correção do erro: Optional chaining no adjustments */}
                      {details?.adjustments?.map((adj, i) => (
                        <div key={i} className="p-3 bg-gold/10 border border-gold/30 rounded-r-lg">
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
  )
})

TeamRow.displayName = "TeamRow"

export default function RankingTable({ teams }: { teams: Team[] }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [detailsCache, setDetailsCache] = useState<Record<string, TeamDetails>>({})
  const [loading, setLoading] = useState(false)
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => setHasMounted(true), [])

  const toggleTeam = useCallback(async (teamName: string) => {
    if (expandedTeam === teamName) {
      setExpandedTeam(null)
      return
    }

    setExpandedTeam(teamName)

    // Só faz o fetch se não estiver no cache (melhora muito a velocidade)
    if (!detailsCache[teamName]) {
      setLoading(true)
      try {
        const res = await fetch(`/api/team-details?teamName=${encodeURIComponent(teamName)}`)
        if (!res.ok) throw new Error("Erro na API")
        const data = await res.json()
        
        // Garante que os campos existam para não quebrar o map
        const validatedData = {
          matches: data.matches || [],
          adjustments: data.adjustments || []
        }

        setDetailsCache(prev => ({ ...prev, [teamName]: validatedData }))
      } catch (error) {
        console.error("Erro ao carregar detalhes:", error)
      } finally {
        setLoading(false)
      }
    }
  }, [expandedTeam, detailsCache])

  if (!hasMounted) return null;

  return (
    <PremiumCard>
      <div className="p-4 md:p-8 overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse">
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
          <tbody className="divide-y divide-white/5">
            {teams.map((team, index) => (
              <TeamRow
                key={team.id || index}
                team={team}
                index={index}
                isExpanded={expandedTeam === team.name}
                toggleTeam={toggleTeam}
                details={detailsCache[team.name] || null}
                loading={loading && expandedTeam === team.name}
              />
            ))}
          </tbody>
        </table>
        
        <div className="mt-6 pt-6 border-t border-white/10 text-center text-xs text-gray-400">
           V = Vitórias | D = Derrotas | PTS = Pontos | Rounds = Saldo de rounds
        </div>
      </div>
    </PremiumCard>
  )
}
"use client"

import { useState, Fragment, memo, useCallback, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import Image from "next/image"
import Link from "next/link"
import { Search } from "lucide-react"

export interface Team {
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
}

interface TeamDetails {
  matches: Match[];
  adjustments: { motivo: string; sp: number; vitorias?: number; derrotas?: number }[];
}

const getMatchRound = (teams: Team[], t1: string, t2: string) => {
  const sortedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const numTeams = sortedTeams.length;
  if (numTeams < 2) return null;

  const teamNames = sortedTeams.map(t => t.name);
  const fixedTeam = teamNames[0];
  const rotatingTeams = teamNames.slice(1);

  for (let round = 0; round < numTeams - 1; round++) {
    const currentRotation = [...rotatingTeams];
    for (let i = 0; i < round; i++) {
      const last = currentRotation.pop();
      if (last) currentRotation.unshift(last);
    }
    const roundTeams = [fixedTeam, ...currentRotation];
    for (let i = 0; i < Math.floor(numTeams / 2); i++) {
      const teamA = roundTeams[i];
      const teamB = roundTeams[numTeams - 1 - i];
      if ((teamA === t1 && teamB === t2) || (teamA === t2 && teamB === t1)) {
        return round + 1;
      }
    }
  }
  return null;
};

const TeamRow = memo(({ 
  team, 
  index, 
  isExpanded, 
  toggleTeam, 
  details, 
  loading,
  allTeams,
  isAdmin
}: { 
  team: Team; 
  index: number; 
  isExpanded: boolean; 
  toggleTeam: (name: string) => void;
  details: TeamDetails | null;
  loading: boolean;
  allTeams: Team[];
  isAdmin: boolean;
}) => {
  return (
    <Fragment>
      <motion.tr
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
        <td className="py-4 px-2 text-center text-white font-semibold">{(team.wins + team.losses) / 2}</td>
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
            <td colSpan={7} className="p-0 border-b border-gold/20">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden bg-black/40 backdrop-blur-sm"
              >
                <div className="p-6 border-l-4 border-gold ml-2">
                  {loading && !details ? (
                    <div className="text-gray-400 animate-pulse text-sm">Buscando dados...</div>
                  ) : (
                    <div className="flex flex-col gap-8">
                      
                      <section>
                        <h4 className="text-gold font-bold mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                          <span className="w-2 h-2 bg-gold rounded-full"></span>
                          Detalhamento de Partidas
                        </h4>
                        
                        <div className="space-y-3">
                          {(() => {
                            const matches = details?.matches ? [...details.matches] : [];
                            if (team.name === "Boxx") {
                              matches.push({
                                match_id: 999999,
                                time1: "Boxx",
                                time2: "Componentes EXE",
                                placar_mapa1_time1: 13,
                                placar_mapa1_time2: 4,
                                placar_mapa2_time1: 0,
                                placar_mapa2_time2: 0
                              });
                            }

                            if (matches.length > 0) {
                              return matches.map(m => {
                                let roundNum = getMatchRound(allTeams, m.time1, m.time2);
                                if (m.match_id === 999999) roundNum = 7;
                                
                                const isTime1 = m.time1 === team.name;

                                let wins = 0;
                                let losses = 0;
                                if (isTime1) {
                                  if (m.placar_mapa1_time1 > m.placar_mapa1_time2) wins++; else losses++;
                                  if (m.placar_mapa2_time1 > m.placar_mapa2_time2) wins++; else losses++;
                                } else {
                                  if (m.placar_mapa1_time2 > m.placar_mapa1_time1) wins++; else losses++;
                                  if (m.placar_mapa2_time2 > m.placar_mapa2_time1) wins++; else losses++;
                                }

                                const isWOMap1 = m.placar_mapa1_time1 === 0 && m.placar_mapa1_time2 === 0;
                                const isWOMap2 = m.placar_mapa2_time1 === 0 && m.placar_mapa2_time2 === 0;

                                return (
                                  <div key={m.match_id} className="flex flex-col sm:flex-row justify-between items-center bg-white/5 p-4 rounded-lg border border-white/10 gap-4 mb-2">
                                    <div className="flex items-center gap-4 flex-1">
                                      <div className="flex flex-col items-center justify-center bg-gold/20 border border-gold/40 rounded px-3 py-1 min-w-[75px]">
                                        <span className="text-[9px] text-gold uppercase font-black leading-none">Rodada</span>
                                        <span className="text-white font-bold text-sm">{roundNum || "?"}</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-2 text-sm">
                                          <span className={isTime1 ? "text-gold font-bold" : "text-gray-400"}>{m.time1}</span>
                                          <span className="text-gray-600 font-bold">vs</span>
                                          <span className={!isTime1 ? "text-gold font-bold" : "text-gray-400"}>{m.time2}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex gap-6 font-mono bg-black/30 px-4 py-2 rounded-md border border-white/5">
                                      <div className="flex flex-col items-center border-r border-white/10 pr-6">
                                        <span className="text-[10px] text-gray-500 uppercase mb-1">Mapa 1</span>
                                        {isWOMap1 ? (
                                          <div className="text-lg font-bold text-red-400">W.O</div>
                                        ) : (
                                          <div className="text-lg font-bold flex items-center gap-2">
                                            <span className={isTime1 ? (m.placar_mapa1_time1 > m.placar_mapa1_time2 ? "text-green-400" : "text-red-400") : "text-gray-400"}>{m.placar_mapa1_time1}</span>
                                            <span className="text-gray-700 text-sm">—</span>
                                            <span className={!isTime1 ? (m.placar_mapa1_time2 > m.placar_mapa1_time1 ? "text-green-400" : "text-red-400") : "text-gray-400"}>{m.placar_mapa1_time2}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-center pl-2">
                                        <span className="text-[10px] text-gray-500 uppercase mb-1">Mapa 2</span>
                                        {isWOMap2 ? (
                                          <div className="text-lg font-bold text-red-400">W.O</div>
                                        ) : (
                                          <div className="text-lg font-bold flex items-center gap-2">
                                            <span className={isTime1 ? (m.placar_mapa2_time1 > m.placar_mapa2_time2 ? "text-green-400" : "text-red-400") : "text-gray-400"}>{m.placar_mapa2_time1}</span>
                                            <span className="text-gray-700 text-sm">—</span>
                                            <span className={!isTime1 ? (m.placar_mapa2_time2 > m.placar_mapa2_time1 ? "text-green-400" : "text-red-400") : "text-gray-400"}>{m.placar_mapa2_time2}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )
                              })
                            } else {
                              return !loading && <p className="text-gray-500 text-xs italic">Nenhum jogo registrado.</p>
                            }
                          })()}
                        </div>
                      </section>

                      {isAdmin && details?.adjustments && details.adjustments.length > 0 && (
                        <section className="pt-6 border-t border-white/10">
                          <h5 className="text-gold font-bold mb-4 text-xs uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                            Setagem Manual by Kauan
                          </h5>
                          <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                            <table className="w-full text-xs text-left text-gray-300">
                              <thead className="bg-black/20 text-gold text-[10px] uppercase">
                                <tr>
                                  <th className="p-3 text-center">V</th>
                                  <th className="p-3 text-center">D</th>
                                  <th className="p-3 text-right">Pontos</th>
                                  <th className="p-3">Motivo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/10">
                                {details.adjustments.map((adj, idx) => (
                                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-center text-green-400 font-bold">
                                      {adj.vitorias !== undefined && adj.vitorias !== null ? (adj.vitorias > 0 ? `+${adj.vitorias}` : adj.vitorias) : "-"}
                                    </td>
                                    <td className="p-3 text-center text-red-400 font-bold">
                                      {adj.derrotas !== undefined && adj.derrotas !== null ? (adj.derrotas > 0 ? `+${adj.derrotas}` : adj.derrotas) : "-"}
                                    </td>
                                    <td className={`p-3 text-right font-bold ${adj.sp > 0 ? "text-green-400" : "text-red-400"}`}>
                                      {adj.sp > 0 ? `+${adj.sp}` : adj.sp}
                                    </td>
                                    <td className="p-3 italic text-gray-400">"{adj.motivo}"</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </section>
                      )}
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
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const storedUser = localStorage.getItem('faceit_user')
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser)
        const lvl = Number(u.admin || u.Admin)
        if (lvl === 1 || lvl === 2) setIsAdmin(true)
      } catch (e) {
        console.error("Erro ao verificar admin:", e)
      }
    }
  }, [])

  const correctedTeams = useMemo(() => (teams || []).map(team => {
    if (team.name === "22Cao") return { ...team, name: "22Cao Na Chapa" };
    if (team.name === "team_mulekera") return { ...team, name: "Boxx" };
    return team;
  }), [teams]);

  const toggleTeam = useCallback(async (teamName: string) => {
    if (expandedTeam === teamName) {
      setExpandedTeam(null)
      return
    }

    setExpandedTeam(teamName)

    if (!detailsCache[teamName]) {
      setLoading(true)
      try {
        const res = await fetch(`/api/team-details?teamName=${encodeURIComponent(teamName)}`)
        if (!res.ok) throw new Error("Erro na API")
        const data = await res.json()
        
        setDetailsCache(prev => ({ 
          ...prev, 
          [teamName]: {
            matches: data.matches || [],
            adjustments: data.adjustments || []
          } 
        }))
      } catch (error) {
        console.error("Erro ao carregar detalhes:", error)
      } finally {
        setLoading(false)
      }
    }
  }, [expandedTeam, detailsCache]);

  return (
    <PremiumCard hoverEffect={true}>
      <div className="p-4 md:p-8 overflow-x-auto">
        <div className="mb-6 pb-6 border-b border-white/10 text-center text-xs text-gray-400">
           R = Rodadas | V = Vitórias em Mapas | D = Derrotas em Mapas | PTS = Pontos | Rounds = Saldo de rounds
        </div>
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="border-b-2 border-gold/30">
              <th className="text-left py-4 px-2 text-gold font-bold">#</th>
              <th className="text-left py-4 px-2 text-gold font-bold">Time</th>
              <th className="text-center py-4 px-2 text-gold font-bold">R</th>
              <th className="text-center py-4 px-2 text-gold font-bold">V</th>
              <th className="text-center py-4 px-2 text-gold font-bold">D</th>
              <th className="text-center py-4 px-2 text-gold font-bold">PTS</th>
              <th className="text-center py-4 px-2 text-gold font-bold">Rounds</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {correctedTeams.map((team, index) => (
              <TeamRow
                key={team.id || index}
                team={team}
                index={index}
                isExpanded={expandedTeam === team.name}
                toggleTeam={toggleTeam}
                details={detailsCache[team.name] || null}
                loading={loading && expandedTeam === team.name}
                allTeams={correctedTeams}
                isAdmin={isAdmin}
              />
            ))}
          </tbody>
        </table>
      </div>
    </PremiumCard>
  )
}
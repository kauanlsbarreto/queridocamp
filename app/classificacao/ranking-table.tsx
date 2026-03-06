"use client"

import { useState, Fragment, memo, useCallback, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import Image from "next/image"
import Link from "next/link"
import { Search, TrendingUp, TrendingDown, Minus, PlayCircle, RotateCcw } from "lucide-react"

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

// Simulação: Interface para os ajustes temporários
interface SimulationState {
  [teamName: string]: {
    extraWins: number;
    extraLosses: number;
    extraPoints: number;
  }
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
  originalIndex,
  isExpanded, 
  toggleTeam, 
  details, 
  loading,
  allTeams,
  isAdmin
}: { 
  team: Team; 
  index: number; 
  originalIndex: number;
  isExpanded: boolean; 
  toggleTeam: (name: string) => void;
  details: TeamDetails | null;
  loading: boolean;
  allTeams: Team[];
  isAdmin: boolean;
}) => {
  // Cálculo da tendência (setas)
  const trend = originalIndex - index;

  return (
    <Fragment>
      <motion.tr
        layout
        onClick={() => toggleTeam(team.name)}
        className={`border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer ${
          index < 8 ? "bg-green-500/5" : ""
        } ${isExpanded ? "bg-white/10" : ""}`}
      >
        <td className="py-4 px-2">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold w-4">{index + 1}</span>
            {trend > 0 && <TrendingUp size={14} className="text-green-400" />}
            {trend < 0 && <TrendingDown size={14} className="text-red-400" />}
            {trend === 0 && <Minus size={14} className="text-gray-600" />}
          </div>
        </td>
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
                            if (matches.length > 0) {
                              return matches.map(m => {
                                const roundNum = getMatchRound(allTeams, m.time1, m.time2);
                                const isTime1 = m.time1 === team.name;
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
                                        {isWOMap1 ? <div className="text-lg font-bold text-red-400">W.O</div> : (
                                          <div className="text-lg font-bold flex items-center gap-2">
                                            <span className={isTime1 ? (m.placar_mapa1_time1 > m.placar_mapa1_time2 ? "text-green-400" : "text-red-400") : "text-gray-400"}>{m.placar_mapa1_time1}</span>
                                            <span className="text-gray-700 text-sm">—</span>
                                            <span className={!isTime1 ? (m.placar_mapa1_time2 > m.placar_mapa1_time1 ? "text-green-400" : "text-red-400") : "text-gray-400"}>{m.placar_mapa1_time2}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-center pl-2">
                                        <span className="text-[10px] text-gray-500 uppercase mb-1">Mapa 2</span>
                                        {isWOMap2 ? <div className="text-lg font-bold text-red-400">W.O</div> : (
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

export default function RankingTable({ teams: initialTeams }: { teams: Team[] }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [detailsCache, setDetailsCache] = useState<Record<string, TeamDetails>>({})
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Estados para Simulação
  const [isSimulating, setIsSimulating] = useState(false)
  const [simData, setSimData] = useState<SimulationState>({})

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

  const correctedTeams = useMemo(() => (initialTeams || []).map(team => {
    if (team.name === "22Cao") return { ...team, name: "22Cao Na Chapa" };
    if (team.name === "team_mulekera") return { ...team, name: "Boxx" };
    return team;
  }), [initialTeams]);

  // Tabela Original para comparação de posições
  const originalOrder = useMemo(() => {
    const withdrawnNames = ["NeshaStore", "Alfajor Soluções"];
    return correctedTeams
      .filter(t => !withdrawnNames.includes(t.name))
      .sort((a, b) => b.points - a.points || Number(b.rounds) - Number(a.rounds))
      .map(t => t.name);
  }, [correctedTeams]);

  // Tabela com Simulação Aplicada
  const { activeTeams, withdrawnTeams } = useMemo(() => {
    const withdrawnTeamNames = ["NeshaStore", "Alfajor Soluções"];
    
    let processed = correctedTeams.map(team => {
      const sim = simData[team.name];
      if (!sim) return team;
      return {
        ...team,
        wins: team.wins + sim.extraWins,
        losses: team.losses + sim.extraLosses,
        points: team.points + sim.extraPoints,
      };
    });

    const active = processed
      .filter(team => !withdrawnTeamNames.includes(team.name))
      .sort((a, b) => b.points - a.points || Number(b.rounds) - Number(a.rounds));

    const withdrawn = processed.filter(team => withdrawnTeamNames.includes(team.name));
    
    return { activeTeams: active, withdrawnTeams: withdrawn };
  }, [correctedTeams, simData]);

  const updateSim = (teamName: string, field: keyof SimulationState[string], val: number) => {
    setSimData(prev => ({
      ...prev,
      [teamName]: {
        extraWins: prev[teamName]?.extraWins || 0,
        extraLosses: prev[teamName]?.extraLosses || 0,
        extraPoints: prev[teamName]?.extraPoints || 0,
        [field]: (prev[teamName]?.[field] || 0) + val
      }
    }))
  }

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
        setDetailsCache(prev => ({ ...prev, [teamName]: { matches: data.matches || [], adjustments: data.adjustments || [] } }))
      } catch (error) { console.error("Erro:", error) } finally { setLoading(false) }
    }
  }, [expandedTeam, detailsCache]);

  return (
    <>
      {isAdmin && (
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between bg-gold/10 border border-gold/30 p-4 rounded-xl">
            <div className="flex items-center gap-3">
              <PlayCircle className={isSimulating ? "text-green-400 animate-pulse" : "text-gold"} />
              <div>
                <h3 className="text-white font-bold text-sm">Modo Simulação Admin</h3>
                <p className="text-gray-400 text-xs">Altere os dados para prever a tabela</p>
              </div>
            </div>
            <div className="flex gap-2">
              {Object.keys(simData).length > 0 && (
                <button 
                  onClick={() => setSimData({})}
                  className="bg-red-500/20 hover:bg-red-500/40 text-red-400 px-3 py-1 rounded text-xs flex items-center gap-1 transition-all"
                >
                  <RotateCcw size={14} /> Limpar
                </button>
              )}
              <button 
                onClick={() => setIsSimulating(!isSimulating)}
                className={`${isSimulating ? 'bg-green-500 text-black' : 'bg-gold text-black'} px-4 py-1 rounded font-bold text-xs transition-all`}
              >
                {isSimulating ? "SALVAR/SAIR" : "ATIVAR EDIÇÃO"}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isSimulating && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-black/20 p-4 rounded-xl border border-white/5"
              >
                {activeTeams.map(t => (
                  <div key={t.id} className="bg-white/5 p-3 rounded-lg border border-white/10 flex flex-col gap-2">
                    <span className="text-white font-bold text-xs truncate">{t.name}</span>
                    <div className="flex justify-between items-center">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-gray-500 uppercase">Vitórias</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateSim(t.name, 'extraWins', -1)} className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-white">-</button>
                          <span className="text-green-400 font-bold text-sm">{t.wins}</span>
                          <button onClick={() => updateSim(t.name, 'extraWins', 1)} className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-white">+</button>
                        </div>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] text-gray-500 uppercase">Pontos</span>
                        <div className="flex items-center gap-2">
                          <button onClick={() => updateSim(t.name, 'extraPoints', -1)} className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-white">-</button>
                          <span className="text-gold font-bold text-sm">{t.points}</span>
                          <button onClick={() => updateSim(t.name, 'extraPoints', 1)} className="w-5 h-5 bg-white/10 rounded flex items-center justify-center text-white">+</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

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
              {activeTeams.map((team, index) => (
                <TeamRow
                  key={team.id || team.name}
                  team={team}
                  index={index}
                  originalIndex={originalOrder.indexOf(team.name)}
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

      {withdrawnTeams.length > 0 && (
        <div className="mt-12">
          <motion.h3 className="text-xl font-bold text-center text-red-400 mb-4">Times Desistentes</motion.h3>
          <PremiumCard>
            <div className="p-4 md:p-8">
              <table className="w-full border-collapse">
                <tbody>
                  {withdrawnTeams.map((team) => (
                    <tr key={team.id} className="border-b border-white/10 last:border-b-0">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="relative w-8 h-8 flex-shrink-0">
                            <Image src={team.logo || "/placeholder.svg"} alt={team.name} fill sizes="32px" className="object-contain rounded-lg opacity-50" />
                          </div>
                          <span className="text-gray-500 font-medium line-through">{team.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-500 italic">Desistiu do campeonato</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PremiumCard>
        </div>
      )}
    </>
  )
}
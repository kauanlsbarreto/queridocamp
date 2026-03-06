"use client"

import { useState, Fragment, memo, useCallback, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import Image from "next/image"
import Link from "next/link"
import { Search, TrendingUp, TrendingDown, Minus, PlayCircle, RotateCcw, Plus, Minus as MinusIcon } from "lucide-react"

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
  const trend = originalIndex - index;

  return (
    <Fragment>
      <motion.tr
        layout
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        onClick={() => toggleTeam(team.name)}
        className={`border-b border-white/10 hover:bg-white/5 transition-colors cursor-pointer ${
          index < 8 ? "bg-green-500/5" : ""
        } ${isExpanded ? "bg-white/10" : ""}`}
      >
        <td className="py-4 px-2">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold w-4">{index + 1}</span>
            <div className="w-4 flex justify-center">
                {trend > 0 && <TrendingUp size={14} className="text-green-400" />}
                {trend < 0 && <TrendingDown size={14} className="text-red-400" />}
                {trend === 0 && <Minus size={14} className="text-gray-600" />}
            </div>
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
                          {details?.matches?.map(m => (
                            <div key={m.match_id} className="flex justify-between items-center bg-white/5 p-4 rounded-lg border border-white/10">
                                <span className="text-sm text-white">{m.time1} vs {m.time2}</span>
                                <span className="text-gold font-bold">{m.placar_mapa1_time1}-{m.placar_mapa1_time2} | {m.placar_mapa2_time1}-{m.placar_mapa2_time2}</span>
                            </div>
                          ))}
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
  const [isSimulating, setIsSimulating] = useState(false)
  const [simData, setSimData] = useState<SimulationState>({})

  useEffect(() => {
    const storedUser = localStorage.getItem('faceit_user')
    if (storedUser) {
      try {
        const u = JSON.parse(storedUser)
        const lvl = Number(u.admin || u.Admin)
        if (lvl === 1 || lvl === 2) setIsAdmin(true)
      } catch (e) { console.error(e) }
    }
  }, [])

  const correctedTeams = useMemo(() => (initialTeams || []).map(team => {
    if (team.name === "22Cao") return { ...team, name: "22Cao Na Chapa" };
    if (team.name === "team_mulekera") return { ...team, name: "Boxx" };
    return team;
  }), [initialTeams]);

  // Posição base fixa (original)
  const originalOrder = useMemo(() => {
    const withdrawnNames = ["NeshaStore", "Alfajor Soluções"];
    return correctedTeams
      .filter(t => !withdrawnNames.includes(t.name))
      .sort((a, b) => b.points - a.points || Number(b.rounds) - Number(a.rounds))
      .map(t => t.name);
  }, [correctedTeams]);

  // Tabela re-calculada em tempo real
  const { activeTeams, withdrawnTeams } = useMemo(() => {
    const withdrawnNames = ["NeshaStore", "Alfajor Soluções"];
    
    let processed = correctedTeams.map(team => {
      const sim = simData[team.name] || { extraWins: 0, extraLosses: 0, extraPoints: 0 };
      return {
        ...team,
        wins: team.wins + sim.extraWins,
        losses: team.losses + sim.extraLosses,
        points: team.points + (sim.extraWins * 3) + sim.extraPoints,
      };
    });

    const active = processed
      .filter(team => !withdrawnNames.includes(team.name))
      .sort((a, b) => b.points - a.points || Number(b.rounds) - Number(a.rounds));

    return { activeTeams: active, withdrawnTeams: processed.filter(t => withdrawnNames.includes(t.name)) };
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
    if (expandedTeam === teamName) { setExpandedTeam(null); return; }
    setExpandedTeam(teamName)
    if (!detailsCache[teamName]) {
      setLoading(true)
      try {
        const res = await fetch(`/api/team-details?teamName=${encodeURIComponent(teamName)}`)
        const data = await res.json()
        setDetailsCache(prev => ({ ...prev, [teamName]: data }))
      } catch (e) { console.error(e) } finally { setLoading(false) }
    }
  }, [expandedTeam, detailsCache]);

  return (
    <>
      {isAdmin && (
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between bg-gold/10 border border-gold/30 p-4 rounded-xl backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <PlayCircle className={isSimulating ? "text-green-400 animate-pulse" : "text-gold"} />
              <div>
                <h3 className="text-white font-bold text-sm">Simulação de Tabela</h3>
                <p className="text-gray-400 text-[10px] uppercase">Alterar vitórias soma +3 pontos automaticamente</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSimData({})} className="bg-white/10 p-2 rounded text-gray-400 hover:text-red-400 transition-colors"><RotateCcw size={16}/></button>
              <button onClick={() => setIsSimulating(!isSimulating)} className={`px-4 py-1 rounded font-bold text-xs transition-all ${isSimulating ? 'bg-green-500 text-black' : 'bg-gold text-black'}`}>
                {isSimulating ? "CONCLUIR" : "EDITAR VALORES"}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {isSimulating && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 overflow-hidden pb-4">
                {activeTeams.map(t => (
                  <div key={t.id} className="bg-white/5 p-3 rounded-lg border border-white/10">
                    <p className="text-white font-bold text-[11px] mb-2 truncate">{t.name}</p>
                    <div className="flex justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-[9px] text-gray-500 uppercase">Vitória</p>
                        <div className="flex items-center justify-between bg-black/40 rounded px-2 py-1">
                          <button onClick={() => updateSim(t.name, 'extraWins', -1)}><MinusIcon size={12}/></button>
                          <span className="text-green-400 font-bold text-xs">{t.wins}</span>
                          <button onClick={() => updateSim(t.name, 'extraWins', 1)}><Plus size={12}/></button>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] text-gray-500 uppercase">Pontos</p>
                        <div className="flex items-center justify-between bg-black/40 rounded px-2 py-1">
                          <button onClick={() => updateSim(t.name, 'extraPoints', -1)}><MinusIcon size={12}/></button>
                          <span className="text-gold font-bold text-xs">{t.points}</span>
                          <button onClick={() => updateSim(t.name, 'extraPoints', 1)}><Plus size={12}/></button>
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
          <table className="w-full min-w-[600px] border-collapse">
            <thead>
              <tr className="border-b-2 border-gold/30">
                <th className="text-left py-4 px-2 text-gold font-bold">#</th>
                <th className="text-left py-4 px-2 text-gold font-bold">Time</th>
                <th className="text-center py-4 px-2 text-gold font-bold">R</th>
                <th className="text-center py-4 px-2 text-gold font-bold">V</th>
                <th className="text-center py-4 px-2 text-gold font-bold">D</th>
                <th className="text-center py-4 px-2 text-gold font-bold">PTS</th>
                <th className="text-center py-4 px-2 text-gold font-bold">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <AnimatePresence mode="popLayout">
                {activeTeams.map((team, index) => (
                  <TeamRow
                    key={team.name}
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
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </PremiumCard>

      {withdrawnTeams.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xl font-bold text-center text-red-400 mb-4">Times Desistentes</h3>
          <PremiumCard>
            <div className="p-4 md:p-8">
              <table className="w-full border-collapse">
                <tbody>
                  {withdrawnTeams.map((team) => (
                    <tr key={team.id} className="border-b border-white/10 last:border-b-0">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <Image src={team.logo || "/placeholder.svg"} alt="" width={32} height={32} className="opacity-50" />
                          <span className="text-gray-500 line-through">{team.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-gray-500 italic text-sm">Desistente</td>
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
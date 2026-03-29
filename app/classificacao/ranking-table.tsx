"use client"

import { useState, Fragment, memo, useCallback, useMemo, useEffect, MouseEvent } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import Image from "next/image"
import Link from "next/link"
import { Search, ArrowUp, ArrowDown, Minus, ClipboardCopy } from "lucide-react"

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

interface QuarterfinalMatch {
  id: string;
  side: "Lado A" | "Lado B";
  topSeed: number;
  bottomSeed: number;
  topTeam: Team | null;
  bottomTeam: Team | null;
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
  isAdmin,
  extraWins,
  onAddWin,
  simulatedRank,
  fetchTeamDetailsForCopy
}: { 
  team: Team; 
  index: number; 
  isExpanded: boolean; 
  toggleTeam: (name: string) => void;
  details: TeamDetails | null;
  loading: boolean;
  allTeams: Team[];
  isAdmin: boolean;
  extraWins: number;
  onAddWin: (name: string) => void;
  simulatedRank?: number;
  fetchTeamDetailsForCopy: (name: string) => Promise<TeamDetails | null>;
}) => {
  const [copying, setCopying] = useState(false);
  const displayWins = team.wins + extraWins;
  const displayPoints = team.points + (extraWins * 3);

  const handleCopyRounds = async (e: MouseEvent) => {
    e.stopPropagation();
    setCopying(true);

    let teamDetails = details;
    if (!teamDetails) {
        teamDetails = await fetchTeamDetailsForCopy(team.name);
    }

    if (teamDetails && teamDetails.matches) {
        const roundsMap = teamDetails.matches.reduce((acc, match, index) => {
            const roundNum = getMatchRound(allTeams, match.time1, match.time2);
            acc[index + 1] = roundNum !== null ? roundNum : '?';
            return acc;
        }, {} as Record<number, number | string>);

        const roundsString = Object.entries(roundsMap)
            .map(([game, round]) => `${game}: ${round}`)
            .join(', ');

        const copyString = `'${team.name}': { ${roundsString} },`;

        try {
            await navigator.clipboard.writeText(copyString);
            alert('Dados copiados para a área de transferência!');
        } catch (err) {
            console.error('Falha ao copiar texto: ', err);
            alert('Falha ao copiar. Verifique as permissões do navegador.');
        }
    } else {
        alert('Não foi possível obter os detalhes das partidas.');
    }
    setCopying(false);
  };
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
            {isAdmin && (
              <button
                onClick={handleCopyRounds}
                className="text-gray-500 hover:text-gold transition-colors disabled:opacity-50 disabled:cursor-wait"
                title="Copiar ordem de rodadas"
                disabled={copying}
              >
                <ClipboardCopy size={16} />
              </button>
            )}
          </div>
        </td>
        <td className="py-4 px-2 text-center text-white font-semibold">{(displayWins + team.losses) / 2}</td>
        <td className="py-4 px-2 text-center text-green-400 font-semibold">
          {displayWins}
          {extraWins > 0 && <span className="text-[10px] text-green-500 ml-1">+{extraWins}</span>}
        </td>
        <td className="py-4 px-2 text-center text-red-400 font-semibold">{team.losses}</td>
        <td className="py-4 px-2 text-center text-gold font-bold text-lg">
          {displayPoints}
          {extraWins > 0 && <span className="text-[10px] text-gold/70 ml-1">+{extraWins * 3}</span>}
        </td>
        <td className={`py-4 px-2 text-center font-semibold ${team.rounds.startsWith("+") ? "text-green-400" : "text-red-400"}`}>
          {team.rounds}
        </td>
        {isAdmin && (
          <td className="py-4 px-2 text-center sticky right-0 bg-[#060D15] z-10 shadow-[-10px_0_20px_-5px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => onAddWin(team.name)}
              className="bg-green-500/20 hover:bg-green-500/40 text-green-500 rounded px-2 py-1 text-xs font-bold transition-colors border border-green-500/30"
              title="Adicionar Vitória (+3 pts)"
            >
              +1
            </button>
          </td>
        )}
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

export default function RankingTable({ teams: initialTeams }: { teams: Team[] }) {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null)
  const [detailsCache, setDetailsCache] = useState<Record<string, TeamDetails>>({})
  const [loading, setLoading] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [extraWins, setExtraWins] = useState<Record<string, number>>({})

  const handleAddWin = useCallback((teamName: string) => {
    setExtraWins(prev => ({
      ...prev,
      [teamName]: (prev[teamName] || 0) + 1
    }))
  }, [])

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

  const fetchTeamDetailsForCopy = useCallback(async (teamName: string): Promise<TeamDetails | null> => {
    if (detailsCache[teamName]) {
        return detailsCache[teamName];
    }

    try {
        const res = await fetch(`/api/team-details?teamName=${encodeURIComponent(teamName)}`);
        if (!res.ok) throw new Error("Erro na API");
        const data = await res.json();
        const newDetails = {
            matches: data.matches || [],
            adjustments: data.adjustments || []
        };
        setDetailsCache(prev => ({ ...prev, [teamName]: newDetails }));
        return newDetails;
    } catch (error) {
        console.error("Erro ao carregar detalhes para cópia:", error);
        return null;
    }
  }, [detailsCache]);

  const correctedTeams = useMemo(() => (initialTeams || []).map(team => {
    if (team.name === "22Cao") return { ...team, name: "22Cao Na Chapa" };
    if (team.name === "team_mulekera") return { ...team, name: "Boxx" };
    return team;
  }), [initialTeams]);

  const { activeTeams, withdrawnTeams } = useMemo(() => {
    const withdrawnTeamNames = ["NeshaStore", "Alfajor Soluções"];
    const active = correctedTeams.filter(team => !withdrawnTeamNames.includes(team.name));
    const withdrawn = correctedTeams.filter(team => withdrawnTeamNames.includes(team.name));
    return { activeTeams: active, withdrawnTeams: withdrawn };
  }, [correctedTeams]);

  const simulatedRankMap = useMemo(() => {
    const simulated = activeTeams.map(team => {
      const extra = extraWins[team.name] || 0;
      return {
        name: team.name,
        points: team.points + (extra * 3),
        rounds: parseInt(team.rounds, 10)
      };
    });

    simulated.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.rounds !== a.rounds) return b.rounds - a.rounds;
      return a.name.localeCompare(b.name);
    });

    const map = new Map<string, number>();
    simulated.forEach((t, i) => map.set(t.name, i));
    return map;
  }, [activeTeams, extraWins]);

  const quarterfinalMatches = useMemo<QuarterfinalMatch[]>(() => {
    const seededTeams = activeTeams.slice(0, 8);
    const getSeedTeam = (seed: number) => seededTeams[seed - 1] || null;

    return [
      {
        id: "QF1",
        side: "Lado A",
        topSeed: 1,
        bottomSeed: 8,
        topTeam: getSeedTeam(1),
        bottomTeam: getSeedTeam(8)
      },
      {
        id: "QF2",
        side: "Lado A",
        topSeed: 3,
        bottomSeed: 6,
        topTeam: getSeedTeam(3),
        bottomTeam: getSeedTeam(6)
      },
      {
        id: "QF3",
        side: "Lado B",
        topSeed: 2,
        bottomSeed: 7,
        topTeam: getSeedTeam(2),
        bottomTeam: getSeedTeam(7)
      },
      {
        id: "QF4",
        side: "Lado B",
        topSeed: 4,
        bottomSeed: 5,
        topTeam: getSeedTeam(4),
        bottomTeam: getSeedTeam(5)
      }
    ];
  }, [activeTeams]);

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
    <>
      <div className="sticky top-0 z-30 mb-6">
        <div className="flex items-center justify-center gap-2 py-3 px-4">
          {[
            { label: "Tabela", href: "#tabela" },
            ...(withdrawnTeams.length > 0 ? [{ label: "Desistentes", href: "#desistentes" }] : []),
            { label: "Chaveamento", href: "#chaveamento" },
          ].map(item => (
            <a
              key={item.href}
              href={item.href}
              className="text-xs md:text-sm font-bold text-gray-300 hover:text-white transition-all border border-white/10 hover:border-gold/60 bg-white/5 hover:bg-gold/10 rounded-full px-4 py-1.5 hover:shadow-[0_0_12px_rgba(212,175,55,0.25)]"
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>

      <div id="tabela">
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
                {isAdmin && <th className="text-center py-4 px-2 text-gold font-bold sticky right-0 bg-[#060D15] z-10 shadow-[-10px_0_20px_-5px_rgba(0,0,0,0.5)]">Simular</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activeTeams.map((team, index) => (
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
                  extraWins={extraWins[team.name] || 0}
                  onAddWin={handleAddWin}
                  simulatedRank={simulatedRankMap.get(team.name)}
                  fetchTeamDetailsForCopy={fetchTeamDetailsForCopy}
                />
              ))}
            </tbody>
          </table>
        </div>
      </PremiumCard>
      </div>

      <section className="mt-10">
        {withdrawnTeams.length > 0 && (
          <div id="desistentes">
            <motion.h3
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-xl font-bold text-center text-red-400 mb-4"
            >
              Times Desistentes
            </motion.h3>
            <PremiumCard>
              <div className="p-4 md:p-8">
                <table className="w-full border-collapse">
                  <tbody>
                    {withdrawnTeams.map((team) => (
                      <tr key={team.id} className="border-b border-white/10 last:border-b-0">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3">
                            <div className="relative w-8 h-8 flex-shrink-0">
                              <Image
                                src={team.logo || "/placeholder.svg"}
                                alt={team.name}
                                fill
                                sizes="32px"
                                className="object-contain rounded-lg opacity-50"
                              />
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

        <div id="chaveamento">
        <PremiumCard hoverEffect={true} className="mt-8">
          <div className="p-5 md:p-8 bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.14),_transparent_50%),linear-gradient(140deg,#081320_0%,#0E1A2A_45%,#121826_100%)] rounded-2xl border border-white/10">
            <div className="mb-6">
              <h3 className="text-white font-black tracking-wide text-lg md:text-2xl uppercase">Chaveamento Fase Final</h3>
              <p className="text-xs md:text-sm text-gray-400 mt-1">Quartas definidas pela classificação: 1x8, 3x6, 2x7, 4x5</p>
              <div className="mt-3 inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2">
                <span className="text-yellow-400 text-base leading-none">⚠</span>
                <p className="text-[11px] text-yellow-300/80 leading-snug">
                  O chaveamento exibido é baseado na <span className="font-bold text-yellow-300">tabela atual</span>. Os confrontos serão definitivos somente após a finalização de todas as rodadas.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto pb-2">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 min-w-[980px] xl:min-w-0">
              <div className="rounded-xl border border-white/10 bg-black/25 p-3 md:p-4">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-gold font-black mb-3">Quartas</h4>
                <div className="space-y-3">
                  {/* QF1 */}
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] tracking-wider uppercase text-gray-400 font-bold mb-2">QF1</div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <span className="text-[10px] font-black text-gold bg-gold/20 border border-gold/30 px-2 py-1 rounded-md shrink-0">#1</span>
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[0].topTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[0].topTeam?.name || `Seed 1`} fill sizes="28px" className="object-contain" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[0].topTeam?.name || "A definir"}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">1</div>
                      <span className="text-[11px] text-gray-500 font-bold">×</span>
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">2</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <span className="text-[10px] font-black text-gold bg-gold/20 border border-gold/30 px-2 py-1 rounded-md shrink-0">#8</span>
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[0].bottomTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[0].bottomTeam?.name || `Seed 8`} fill sizes="28px" className="object-contain" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[0].bottomTeam?.name || "A definir"} </span>
                    </div>
                  </div>
                  {/* QF2 */}
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] tracking-wider uppercase text-gray-400 font-bold mb-2">QF2</div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <span className="text-[10px] font-black text-gold bg-gold/20 border border-gold/30 px-2 py-1 rounded-md shrink-0">#3</span>
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[1].topTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[1].topTeam?.name || `Seed 3`} fill sizes="28px" className="object-contain" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[1].topTeam?.name || "A definir"}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">1</div>
                      <span className="text-[11px] text-gray-500 font-bold">×</span>
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">2</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <span className="text-[10px] font-black text-gold bg-gold/20 border border-gold/30 px-2 py-1 rounded-md shrink-0">#6</span>
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[1].bottomTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[1].bottomTeam?.name || `Seed 6`} fill sizes="28px" className="object-contain" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[1].bottomTeam?.name || "A definir"}</span>
                    </div>
                  </div>
                  {/* QF3 */}
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] tracking-wider uppercase text-gray-400 font-bold mb-2">QF3</div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <span className="text-[10px] font-black text-gold bg-gold/20 border border-gold/30 px-2 py-1 rounded-md shrink-0">#2</span>
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[2].topTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[2].topTeam?.name || `Seed 2`} fill sizes="28px" className="object-contain" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[2].topTeam?.name || "A definir"} </span>
                    </div>
                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">2</div>
                      <span className="text-[11px] text-gray-500 font-bold">×</span>
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">0</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <span className="text-[10px] font-black text-gold bg-gold/20 border border-gold/30 px-2 py-1 rounded-md shrink-0">#7</span>
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[2].bottomTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[2].bottomTeam?.name || `Seed 7`} fill sizes="28px" className="object-contain" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[2].bottomTeam?.name || "A definir"}</span>
                    </div>
                  </div>
                  {/* QF4 */}
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] tracking-wider uppercase text-gray-400 font-bold mb-2">QF4</div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <span className="text-[10px] font-black text-gold bg-gold/20 border border-gold/30 px-2 py-1 rounded-md shrink-0">#4</span>
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[3].topTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[3].topTeam?.name || `Seed 4`} fill sizes="28px" className="object-contain" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[3].topTeam?.name || "A definir"}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">2</div>
                      <span className="text-[11px] text-gray-500 font-bold">×</span>
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">0</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <span className="text-[10px] font-black text-gold bg-gold/20 border border-gold/30 px-2 py-1 rounded-md shrink-0">#5</span>
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[3].bottomTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[3].bottomTeam?.name || `Seed 5`} fill sizes="28px" className="object-contain" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[3].bottomTeam?.name || "A definir"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3 md:p-4 xl:mt-8">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-gold font-black mb-3">Semifinais</h4>
                <div className="space-y-4 md:space-y-6">
                  {/* SF1: 8º vs 6º */}
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] tracking-wider uppercase text-gray-400 font-bold mb-2">SF1</div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[0].bottomTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[0].bottomTeam?.name || `Seed 8`} fill sizes="28px" className="object-contain opacity-70" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[0].bottomTeam?.name || "A definir"}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">2</div>
                      <span className="text-[11px] text-gray-500 font-bold">×</span>
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">1</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[1].bottomTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[1].bottomTeam?.name || `Seed 6`} fill sizes="28px" className="object-contain opacity-70" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[1].bottomTeam?.name || "A definir"}</span>
                    </div>
                  </div>
                  {/* SF2: 2º vs 4º */}
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <div className="text-[10px] tracking-wider uppercase text-gray-400 font-bold mb-2">SF2</div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[2].topTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[2].topTeam?.name || `Seed 2`} fill sizes="28px" className="object-contain opacity-70" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[2].topTeam?.name || "A definir"}</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">0</div>
                      <span className="text-[11px] text-gray-500 font-bold">×</span>
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">2</div>
                    </div>
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[3].topTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[3].topTeam?.name || `Seed 4`} fill sizes="28px" className="object-contain opacity-70" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[3].topTeam?.name || "A definir"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/25 p-3 md:p-4 xl:mt-20">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-gold font-black mb-3">Final</h4>
                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[10px] tracking-wider uppercase text-gray-400 font-bold mb-2">F1</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[0].bottomTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[0].bottomTeam?.name || "Vencedor SF1"} fill sizes="28px" className="object-contain opacity-70" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[0].bottomTeam?.name || "Vencedor SF1"}</span>
                    </div>

                    <div className="flex items-center justify-center gap-3 py-2">
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">0</div>
                      <span className="text-[11px] text-gray-500 font-bold">×</span>
                      <div className="w-10 h-8 rounded-md border border-gold/30 bg-black/60 text-gold text-sm font-black flex items-center justify-center">2</div>
                    </div>

                    <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/40 px-2 py-2">
                      <div className="relative w-7 h-7 shrink-0 rounded-md overflow-hidden border border-white/15 bg-black/30">
                        <Image src={quarterfinalMatches[3].topTeam?.logo || "/placeholder.svg"} alt={quarterfinalMatches[3].topTeam?.name || "Vencedor SF2"} fill sizes="28px" className="object-contain opacity-70" />
                      </div>
                      <span className="text-xs text-white font-semibold">{quarterfinalMatches[3].topTeam?.name || "Vencedor SF2"}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gold/30 bg-gradient-to-b from-gold/10 to-transparent p-3 md:p-4 xl:mt-32">
                <h4 className="text-[11px] uppercase tracking-[0.2em] text-gold font-black mb-3">Campeao</h4>
                <div className="rounded-lg border border-gold/25 bg-black/40 p-4">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="w-14 h-14 rounded-xl border border-gold/40 bg-black/40 flex items-center justify-center text-gold text-2xl font-black">🏆</div>
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-white/15 bg-black/30">
                      <Image
                        src={quarterfinalMatches[3].topTeam?.logo || "/placeholder.svg"}
                        alt={quarterfinalMatches[3].topTeam?.name || "Campeao"}
                        fill
                        sizes="40px"
                        className="object-contain opacity-80"
                      />
                    </div>
                    <p className="text-sm text-white font-bold">{quarterfinalMatches[3].topTeam?.name || "A definir"}</p>
                    <p className="text-[10px] uppercase tracking-widest text-gold/80">Vencedor da Final</p>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </PremiumCard>
        </div>
      </section>
    </>
  )
}
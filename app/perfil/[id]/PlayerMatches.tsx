"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { ExternalLink, Trophy, Calendar, Map as MapIcon, Swords, Medal } from "lucide-react"
import { motion } from "framer-motion"
import PlayerUpcomingMatches from "./PlayerUpcomingMatches"

const API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63"
const MAIN_QUEUES = [
  "fdd5221c-408c-4148-bc63-e2940da4a490",
  "04a14d7f-0511-451b-8208-9a6c3215ccaa"
]
const SEASON_QUEUE = "c23c971b-677a-4046-8203-26023e283529"
const START_DATE = Math.floor(new Date('2026-01-01T00:00:00.000Z').getTime() / 1000);

interface MapStats {
  mapName: string
  score: string
  kills: string
  deaths: string
  kd: string
  kr: string
  result: string
}

const MatchCard = ({ match, playerId }: { match: any, playerId: string }) => {
  const [maps, setMaps] = useState<MapStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`https://open.faceit.com/data/v4/matches/${match.match_id}/stats`, {
          headers: { 'Authorization': `Bearer ${API_KEY}` }
        })
        if (res.ok) {
          const data = await res.json()
          
          if (data.rounds && data.rounds.length > 0) {
             const processedMaps = data.rounds.map((round: any) => {
                const playerStats = round.teams
                  .flatMap((t: any) => t.players)
                  .find((p: any) => p.player_id === playerId)
                
                return {
                   mapName: round.round_stats.Map,
                   score: round.round_stats.Score, // Ex: "13 / 10"
                   kills: playerStats?.player_stats.Kills || "0",
                   deaths: playerStats?.player_stats.Deaths || "0",
                   kd: playerStats?.player_stats["K/D Ratio"] || "0.00",
                   kr: playerStats?.player_stats["K/R Ratio"] || "0.00",
                   result: playerStats?.player_stats.Result || "0"
                }
             })
             setMaps(processedMaps)
          }
        }
      } catch (error) {
        console.error("Erro ao buscar stats da partida", error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [match.match_id, playerId])

  const team1 = match.teams.faction1
  const team2 = match.teams.faction2
  
  if (loading) {
      return (
        <div className="mb-4 rounded-xl border border-white/10 bg-zinc-900/50 p-4 animate-pulse">
            <div className="h-12 bg-white/5 rounded mb-2"></div>
            <div className="h-8 bg-white/5 rounded w-1/2 mx-auto"></div>
        </div>
      )
  }

  if (maps.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
        {maps.map((mapData, index) => {
            const isWin = mapData.result === "1";
            const borderColor = isWin ? "border-green-500/50" : "border-red-500/50";
            const bgColor = isWin ? "bg-green-500/5" : "bg-red-500/5";
            
            // Parse score "13 / 10"
            const scoreParts = mapData.score.split(" / ");
            const score1 = scoreParts[0] || "0";
            const score2 = scoreParts[1] || "0";

            return (
                <motion.div 
                  key={`${match.match_id}-${index}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <div className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden transition-all hover:border-gold/50 relative group`}>
                    
                    {/* Map Name Badge */}
                    <div className="absolute top-0 left-0 bg-black/60 px-2 py-1 rounded-br-lg border-r border-b border-white/10 z-10">
                        <span className="text-[10px] font-bold text-gold uppercase flex items-center gap-1">
                            <MapIcon size={10} /> {mapData.mapName}
                        </span>
                    </div>

                    <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 pt-6 md:pt-4">
                      
                      {/* Teams and Score */}
                      <div className="flex items-center gap-4 flex-1 justify-center md:justify-start w-full md:w-auto">
                        {/* Team 1 */}
                        <div className="flex flex-col items-center gap-2 w-20">
                          <div className="relative w-10 h-10 md:w-12 md:h-12">
                            <Image 
                              src={team1.avatar || "/images/cs2-player.png"} 
                              alt={team1.nickname} 
                              fill 
                              className="object-contain rounded-full"
                              unoptimized
                            />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 truncate w-full text-center">{team1.nickname}</span>
                        </div>

                        <div className="flex flex-col items-center">
                           <div className="bg-black/50 px-3 py-1 rounded text-gold font-mono font-bold text-lg whitespace-nowrap border border-white/5">
                             {score1} : {score2}
                           </div>
                           <span className="text-[9px] text-zinc-600 mt-1">{new Date(match.started_at * 1000).toLocaleDateString('pt-BR')}</span>
                        </div>

                        {/* Team 2 */}
                        <div className="flex flex-col items-center gap-2 w-20">
                          <div className="relative w-10 h-10 md:w-12 md:h-12">
                            <Image 
                              src={team2.avatar || "/images/cs2-player.png"} 
                              alt={team2.nickname} 
                              fill 
                              className="object-contain rounded-full"
                              unoptimized
                            />
                          </div>
                          <span className="text-[10px] font-bold text-zinc-400 truncate w-full text-center">{team2.nickname}</span>
                        </div>
                      </div>

                      {/* Stats do Jogador */}
                      <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 w-full md:w-auto justify-between md:justify-end">
                          <div className="flex gap-4 md:gap-6 text-center">
                            <div>
                              <p className="text-[9px] text-zinc-500 uppercase font-bold">K / D</p>
                              <p className={`text-lg font-black ${Number(mapData.kd) >= 1 ? 'text-green-400' : 'text-red-400'}`}>{mapData.kd}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-zinc-500 uppercase font-bold">Kills</p>
                              <p className="text-lg font-bold text-white">{mapData.kills}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-zinc-500 uppercase font-bold">Mortes</p>
                              <p className="text-lg font-bold text-zinc-400">{mapData.deaths}</p>
                            </div>
                          </div>
                        
                        <a 
                          href={match.faceit_url.replace("{lang}", "en")} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 bg-white/5 hover:bg-[#ff5500] hover:text-white rounded-lg transition-colors text-zinc-400 ml-2"
                          title="Ver na Faceit"
                        >
                          <ExternalLink size={16} />
                        </a>
                      </div>

                    </div>
                  </div>
                </motion.div>
            )
        })}
    </div>
  )
}

export default function PlayerMatches({ faceitId, upcomingMatches, teamName }: { faceitId: string, upcomingMatches?: any[], teamName?: string }) {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'hub' | 'season'>('hub')

  useEffect(() => {
    const fetchMatches = async () => {
      if (!faceitId) return
      
      try {
        // Busca histórico a partir da data especificada
        const res = await fetch(`https://open.faceit.com/data/v4/players/${faceitId}/history?game=cs2&from=${START_DATE}&limit=20`, {
          headers: { 'Authorization': `Bearer ${API_KEY}` }
        })
        
        if (res.ok) {
          const data = await res.json()
          // Filtra pelas filas especificadas
          const allQueues = [...MAIN_QUEUES, SEASON_QUEUE]
          const filteredMatches = data.items.filter((m: any) => 
            allQueues.includes(m.competition_id) || allQueues.includes(m.entity_id)
          )
          setMatches(filteredMatches)
        }
      } catch (error) {
        console.error("Erro ao buscar partidas:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchMatches()
  }, [faceitId])

  const displayedMatches = matches.filter(m => {
    const id = m.competition_id || m.entity_id
    if (activeTab === 'hub') {
      return MAIN_QUEUES.includes(id)
    }
    return id === SEASON_QUEUE
  })

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gold text-sm animate-pulse">Carregando histórico de partidas...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex bg-zinc-900 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('hub')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'hub' 
                ? "bg-gold text-black shadow-lg" 
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Swords size={16} />
            Querido Draft
          </button>
          <button
            onClick={() => setActiveTab('season')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
              activeTab === 'season' 
                ? "bg-gold text-black shadow-lg" 
                : "text-zinc-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Medal size={16} />
            Querida Fila
          </button>
        </div>
        
        <span className="text-[10px] text-zinc-500 bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 flex items-center gap-2">
          <Calendar size={12} /> Desde 01/01/2026
        </span>
      </div>
      
      {displayedMatches.length > 0 ? (
        displayedMatches.map((match) => (
        <MatchCard key={match.match_id} match={match} playerId={faceitId} />
        ))
      ) : (
        <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20">
          <Calendar className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500">Nenhuma partida encontrada nesta categoria.</p>
        </div>
      )}

      {/* Área de Próximas Partidas (integrada no final) */}
      <PlayerUpcomingMatches matches={upcomingMatches || []} teamName={teamName} />
    </div>
  )
}

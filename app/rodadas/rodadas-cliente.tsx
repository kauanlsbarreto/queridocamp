"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import PremiumCard from "@/components/premium-card"
import Image from "next/image"
import { ChevronDown, ChevronUp, Search, ExternalLink } from "lucide-react"
import Link from "next/link"
import UpdateTimer from "@/components/update-timer"

export interface Team {
  id: number
  name: string
  logo: string
}

export interface DbMatch {
  id: number
  match_id: string
  data: string
  time1: string
  time2: string
  mapa1: string
  placar_mapa1_time1: number
  placar_mapa1_time2: number
  mapa2: string
  placar_mapa2_time1: number
  placar_mapa2_time2: number
  rodada?: string
}

interface MapScore {
  scoreA: number | null
  scoreB: number | null
}

interface Match {
  id: string
  teamA: Team
  teamB: Team
  map1: MapScore
  map2: MapScore
  faceitId?: string
}

interface Round {
  id: number
  name: string
  matches: Match[]
}

const generateRoundRobinMatches = (teams: Team[], matchesData: DbMatch[]) => {
  const rounds: Round[] = []
  const numTeams = teams.length
  
  if (numTeams < 2) return rounds

  const numRounds = numTeams - 1
  const matchesPerRound = Math.floor(numTeams / 2)

  const teamIds = teams.map((t) => t.id)
  const fixedTeam = teamIds[0]
  const rotatingTeams = teamIds.slice(1)

  for (let round = 0; round < numRounds; round++) {
    const matches: Match[] = []
    const currentRotation = [...rotatingTeams]

    for (let i = 0; i < round; i++) {
      const last = currentRotation.pop()
      if (last) currentRotation.unshift(last)
    }

    const roundTeams = [fixedTeam, ...currentRotation]

    for (let match = 0; match < matchesPerRound; match++) {
      const teamAIndex = match
      const teamBIndex = numTeams - 1 - match
      
      const teamAId = roundTeams[teamAIndex]
      const teamBId = roundTeams[teamBIndex]

      const teamA = teams.find((t) => t.id === teamAId)
      const teamB = teams.find((t) => t.id === teamBId)

      if (teamA && teamB) {
        const dbMatch = matchesData.find(
          (m) =>
            (m.time1 === teamA.name && m.time2 === teamB.name) || (m.time1 === teamB.name && m.time2 === teamA.name),
        )

        let map1: MapScore = { scoreA: null, scoreB: null }
        let map2: MapScore = { scoreA: null, scoreB: null }

        if (dbMatch) {
          const isTeamAFirst = dbMatch.time1 === teamA.name
          
          map1 = { 
            scoreA: isTeamAFirst ? dbMatch.placar_mapa1_time1 : dbMatch.placar_mapa1_time2, 
            scoreB: isTeamAFirst ? dbMatch.placar_mapa1_time2 : dbMatch.placar_mapa1_time1 
          }
          
          map2 = { 
            scoreA: isTeamAFirst ? dbMatch.placar_mapa2_time1 : dbMatch.placar_mapa2_time2, 
            scoreB: isTeamAFirst ? dbMatch.placar_mapa2_time2 : dbMatch.placar_mapa2_time1 
          }
        }

        matches.push({
          id: `r${round + 1}m${match + 1}`,
          teamA: teamA,
          teamB: teamB,
          map1: map1,
          map2: map2,
          faceitId: dbMatch ? dbMatch.match_id : undefined
        })
      }
    }

    rounds.push({
      id: round + 1,
      name: `Rodada ${round + 1}`,
      matches: matches,
    })
  }

  return rounds
}

function ScoreBox({ score, isWinner }: { score: number | null; isWinner: boolean | null }) {
  let colorClass = "text-white"
  if (isWinner === true) colorClass = "text-green-400"
  if (isWinner === false) colorClass = "text-red-400"
  
  return (
    <div className="w-8 h-8 md:w-10 md:h-10 bg-black/50 border border-white/20 rounded flex items-center justify-center">
      {score !== null ? (
        <span className={`text-sm md:text-base font-bold ${colorClass}`}>{score}</span>
      ) : (
        <span className="text-gray-500 text-sm">-</span>
      )}
    </div>
  )
}

function MatchCard({ match }: { match: Match }) {
  const map1HasResult = match.map1.scoreA !== null && match.map1.scoreB !== null
  const map2HasResult = match.map2.scoreA !== null && match.map2.scoreB !== null
  
  const map1WinnerA = map1HasResult ? match.map1.scoreA! > match.map1.scoreB! : null
  const map1WinnerB = map1HasResult ? match.map1.scoreB! > match.map1.scoreA! : null
  const map2WinnerA = map2HasResult ? match.map2.scoreA! > match.map2.scoreB! : null
  const map2WinnerB = map2HasResult ? match.map2.scoreB! > match.map2.scoreA! : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 bg-white/5 rounded-xl border border-white/10 hover:border-gold/30 transition-all"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Time A */}
        <div className="flex items-center gap-2 md:gap-3 flex-1">
          <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
            <Image
              src={match.teamA.logo || "/placeholder.svg"}
              alt={match.teamA.name}
              fill
              className="object-contain rounded-lg"
            />
          </div>
          <span className="text-white font-medium text-xs md:text-sm truncate max-w-[60px] md:max-w-[100px]">{match.teamA.name}</span>
          <Link
            href={`/times?search=${encodeURIComponent(match.teamA.name)}`}
            className="text-gray-500 hover:text-gold transition-colors"
            title={`Buscar time ${match.teamA.name}`}
            onClick={e => e.stopPropagation()}
          >
            <Search size={14} />
          </Link>
        </div>

        {/* Centro: Data e Placares */}
        <div className="flex flex-col items-center gap-2">
          {/* Placares dos 2 mapas */}
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {/* Mapa 1 */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] md:text-xs text-gray-500 mb-1">Mapa 1</span>
              <div className="flex items-center gap-1">
                <ScoreBox score={match.map1.scoreA} isWinner={map1WinnerA} />
                <span className="text-gray-500 text-xs">x</span>
                <ScoreBox score={match.map1.scoreB} isWinner={map1WinnerB} />
              </div>
            </div>

            {/* Separador */}
            <div className="w-px h-10 bg-white/20 hidden md:block" />

            {/* Mapa 2 */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] md:text-xs text-gray-500 mb-1">Mapa 2</span>
              <div className="flex items-center gap-1">
                <ScoreBox score={match.map2.scoreA} isWinner={map2WinnerA} />
                <span className="text-gray-500 text-xs">x</span>
                <ScoreBox score={match.map2.scoreB} isWinner={map2WinnerB} />
              </div>
            </div>
          </div>
        </div>

        {/* Time B */}
        <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end">
          <Link
            href={`/times?search=${encodeURIComponent(match.teamB.name)}`}
            className="text-gray-500 hover:text-gold transition-colors"
            title={`Buscar time ${match.teamB.name}`}
            onClick={e => e.stopPropagation()}
          >
            <Search size={14} />
          </Link>
          <span className="text-white font-medium text-xs md:text-sm truncate max-w-[60px] md:max-w-[100px] text-right">{match.teamB.name}</span>
          <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
            <Image
              src={match.teamB.logo || "/placeholder.svg"}
              alt={match.teamB.name}
              fill
              className="object-contain rounded-lg"
            />
          </div>
        </div>

        {/* Link para Faceit (se houver ID) */}
        {match.faceitId && (
          <div className="w-full md:w-auto flex justify-center md:justify-end pt-2 md:pt-0 md:pl-4 md:border-l border-white/10">
            <a 
              href={`https://www.faceit.com/en/cs2/room/${match.faceitId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 bg-[#ff5500] hover:bg-[#e04b00] text-white rounded-lg transition-colors shadow-lg"
              title="Ver na Faceit"
            >
              <ExternalLink size={16} />
            </a>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function RoundSection({ round, isOpen, onToggle }: { round: Round; isOpen: boolean; onToggle: () => void }) {
  const completedMatches = round.matches.filter((m) => m.map1.scoreA !== null && m.map2.scoreA !== null).length
  const totalMatches = round.matches.length

  return (
    <PremiumCard>
      <div className="p-4 md:p-6">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center gap-4">
            <h3 className="text-xl md:text-2xl font-bold text-gold">{round.name}</h3>
            <span className="text-sm text-gray-400">
              {completedMatches}/{totalMatches} partidas
            </span>
          </div>
          {isOpen ? <ChevronUp className="text-gold w-6 h-6" /> : <ChevronDown className="text-gold w-6 h-6" />}
        </button>

        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 space-y-3"
          >
            {round.matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </motion.div>
        )}
      </div>
    </PremiumCard>
  )
}

export default function RodadasClient({ teams, matchesData = [], lastUpdate }: { teams: Team[]; matchesData?: DbMatch[]; lastUpdate: string }) {
  const router = useRouter()
  const [openRoundId, setOpenRoundId] = useState<number | null>(1)

  const rounds = useMemo(() => generateRoundRobinMatches(teams, matchesData), [teams, matchesData]);

  const handleToggleRound = (id: number) => {
    setOpenRoundId((prev) => (prev === id ? null : id))
  }

  return (
    <div>

      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto space-y-4">
            <UpdateTimer lastUpdate={lastUpdate} />
            {rounds.map((round, index) => (
              <motion.div
                key={round.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <RoundSection
                  round={round}
                  isOpen={openRoundId === round.id}
                  onToggle={() => handleToggleRound(round.id)}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

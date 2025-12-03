"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Clock, MapPin, ExternalLink } from "lucide-react"
import PremiumCard from "./premium-card"
import Link from "next/link"
import Image from "next/image"

interface Team {
  id: string
  name: string
  logo: string
  score?: number
}

interface Match {
  id: string
  status: "live" | "upcoming" | "finished"
  team1: Team
  team2: Team
  map?: string
  startTime: Date
  tournament: string
  stream?: string
}

// Dados de exemplo - em produção, estes viriam de uma API
const sampleMatches: Match[] = [
  {
    id: "match-1",
    status: "live",
    team1: {
      id: "kings",
      name: "Kings",
      logo: "/images/kings.png",
      score: 7,
    },
    team2: {
      id: "querido-cs",
      name: "Querido CS",
      logo: "/images/querido-cs.png",
      score: 5,
    },
    map: "Inferno",
    startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutos atrás
    tournament: "Querido Camp 2025 - Fase de Grupos",
    stream: "https://www.twitch.tv/queridocamp",
  },
  {
    id: "match-2",
    status: "live",
    team1: {
      id: "ctg",
      name: "CTG",
      logo: "/images/ctg.png",
      score: 12,
    },
    team2: {
      id: "noel",
      name: "Noel",
      logo: "/images/noel.png",
      score: 10,
    },
    map: "Mirage",
    startTime: new Date(Date.now() - 45 * 60 * 1000), // 45 minutos atrás
    tournament: "Querido Camp 2025 - Fase de Grupos",
    stream: "https://www.twitch.tv/queridocamp",
  },
]

export default function LiveMatches() {
  const [liveMatches, setLiveMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulando uma chamada de API
    const fetchLiveMatches = async () => {
      setLoading(true)
      try {
        // Em produção, aqui seria uma chamada real à API
        // const response = await fetch('/api/matches/live');
        // const data = await response.json();
        // setLiveMatches(data);

        // Usando dados de exemplo por enquanto
        setTimeout(() => {
          setLiveMatches(sampleMatches)
          setLoading(false)
        }, 1000)
      } catch (error) {
        console.error("Erro ao buscar partidas ao vivo:", error)
        setLoading(false)
      }
    }

    fetchLiveMatches()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    )
  }

  if (liveMatches.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">Não há partidas em andamento no momento.</p>
        <Link href="/partidas" className="inline-block mt-4 text-gold hover:text-gold/80 transition-colors">
          Ver todas as partidas
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {liveMatches.map((match, index) => (
        <MatchCard key={match.id} match={match} delay={index * 0.1} />
      ))}

      <div className="md:col-span-2 text-center mt-4">
        <Link
          href="/partidas"
          className="inline-block bg-gold/10 text-gold font-bold py-2 px-6 rounded-md hover:bg-gold/20 transition-colors border border-gold/30"
        >
          Ver todas as partidas
        </Link>
      </div>
    </div>
  )
}

// Modificar a função MatchCard para remover o efeito de hover
function MatchCard({ match, delay = 0 }: { match: Match; delay?: number }) {
  // Formatar o tempo de jogo
  const getMatchDuration = () => {
    const now = new Date()
    const diffMs = now.getTime() - match.startTime.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60

    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
    >
      <PremiumCard hoverEffect={false}>
        <div className="p-4 relative">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
              <span className="text-red-500 font-medium">AO VIVO</span>
            </div>
            <div className="flex items-center text-gray-400 text-sm">
              <Clock size={14} className="mr-1" />
              <span>{getMatchDuration()}</span>
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="text-xs text-gray-400">{match.tournament}</div>
            <div className="flex items-center text-xs text-gray-400">
              <MapPin size={14} className="mr-1" />
              <span>{match.map}</span>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <TeamDisplay team={match.team1} />

            <div className="flex flex-col items-center mx-4">
              <div className="text-2xl font-bold text-white mb-1">
                {match.team1.score} : {match.team2.score}
              </div>
              <a
                href="https://www.twitch.tv/queridocamp"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-4 rounded-md transition-colors inline-flex items-center text-sm"
              >
                <span className="mr-1">Assistir</span>
                <ExternalLink size={14} />
              </a>
            </div>

            <TeamDisplay team={match.team2} isRight />
          </div>
        </div>
      </PremiumCard>
    </motion.div>
  )
}

function TeamDisplay({ team, isRight = false }: { team: Team; isRight?: boolean }) {
  return (
    <div className={`flex ${isRight ? "flex-row-reverse text-right" : "flex-row text-left"} items-center`}>
      <div className={`${isRight ? "ml-3" : "mr-3"}`}>
        <div className="relative w-12 h-12 overflow-hidden rounded-full border border-gold/20">
          <Image
            src={team.logo || "/placeholder.svg?height=48&width=48"}
            alt={team.name}
            fill
            className="object-cover"
          />
        </div>
      </div>
      <div>
        <div className="font-bold text-white">{team.name}</div>
      </div>
    </div>
  )
}

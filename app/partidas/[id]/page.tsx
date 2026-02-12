"use client"

import { useState, useEffect } from "react"
import { MapPin, ArrowLeft, ExternalLink } from "lucide-react"
import PremiumCard from "@/components/premium-card"
import Link from "next/link"
import Image from "next/image"
import { useParams } from "next/navigation"

interface Player {
  id: string
  name: string
  avatar: string
  kills?: number
  deaths?: number
  assists?: number
  rating?: number
}

interface Team {
  id: string
  name: string
  logo: string
  score?: number
  players: Player[]
}

interface Match {
  id: string
  status: "live" | "upcoming" | "finished"
  team1: Team
  team2: Team
  map?: string
  startTime: Date
  tournament: string
  result?: string
  stream?: string
}

// Dados de exemplo - em produção, estes viriam de uma API
const sampleMatches: Record<string, Match> = {
  "match-1": {
    id: "match-1",
    status: "live",
    team1: {
      id: "kings",
      name: "Kings",
      logo: "/images/kings.png",
      score: 7,
      players: [
        {
          id: "player1",
          name: "Player1",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 15,
          deaths: 10,
          assists: 3,
          rating: 1.25,
        },
        {
          id: "player2",
          name: "Player2",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 12,
          deaths: 8,
          assists: 5,
          rating: 1.35,
        },
        {
          id: "player3",
          name: "Player3",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 10,
          deaths: 12,
          assists: 2,
          rating: 0.95,
        },
        {
          id: "player4",
          name: "Player4",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 8,
          deaths: 11,
          assists: 6,
          rating: 0.85,
        },
        {
          id: "player5",
          name: "Player5",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 14,
          deaths: 9,
          assists: 4,
          rating: 1.4,
        },
      ],
    },
    team2: {
      id: "querido-cs",
      name: "Querido CS",
      logo: "/images/querido-cs.png",
      score: 5,
      players: [
        {
          id: "player6",
          name: "Player6",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 13,
          deaths: 11,
          assists: 2,
          rating: 1.15,
        },
        {
          id: "player7",
          name: "Player7",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 9,
          deaths: 13,
          assists: 4,
          rating: 0.8,
        },
        {
          id: "player8",
          name: "Player8",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 11,
          deaths: 12,
          assists: 3,
          rating: 0.95,
        },
        {
          id: "player9",
          name: "Player9",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 7,
          deaths: 14,
          assists: 5,
          rating: 0.7,
        },
        {
          id: "player10",
          name: "Player10",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 10,
          deaths: 9,
          assists: 6,
          rating: 1.1,
        },
      ],
    },
    map: "Inferno",
    startTime: new Date(Date.now() - 30 * 60 * 1000), // 30 minutos atrás
    tournament: "Querido Camp 2025 - Fase de Grupos",
    stream: "https://www.twitch.tv/queridocamp",
  },
  "match-4": {
    id: "match-4",
    status: "finished",
    team1: {
      id: "kings",
      name: "Kings",
      logo: "/images/kings.png",
      score: 13,
      players: [
        {
          id: "player1",
          name: "Player1",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 22,
          deaths: 14,
          assists: 5,
          rating: 1.45,
        },
        {
          id: "player2",
          name: "Player2",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 18,
          deaths: 12,
          assists: 7,
          rating: 1.32,
        },
        {
          id: "player3",
          name: "Player3",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 15,
          deaths: 13,
          assists: 4,
          rating: 1.12,
        },
        {
          id: "player4",
          name: "Player4",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 14,
          deaths: 15,
          assists: 8,
          rating: 0.98,
        },
        {
          id: "player5",
          name: "Player5",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 19,
          deaths: 11,
          assists: 6,
          rating: 1.52,
        },
      ],
    },
    team2: {
      id: "ctg",
      name: "CTG",
      logo: "/images/ctg.png",
      score: 11,
      players: [
        {
          id: "player11",
          name: "Player11",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 17,
          deaths: 16,
          assists: 3,
          rating: 1.05,
        },
        {
          id: "player12",
          name: "Player12",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 14,
          deaths: 18,
          assists: 5,
          rating: 0.85,
        },
        {
          id: "player13",
          name: "Player13",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 16,
          deaths: 17,
          assists: 4,
          rating: 0.92,
        },
        {
          id: "player14",
          name: "Player14",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 12,
          deaths: 19,
          assists: 7,
          rating: 0.78,
        },
        {
          id: "player15",
          name: "Player15",
          avatar: "/placeholder.svg?height=40&width=40",
          kills: 15,
          deaths: 18,
          assists: 8,
          rating: 0.95,
        },
      ],
    },
    map: "Dust2",
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 dia atrás
    tournament: "Querido Camp 2025 - Fase de Grupos",
    result: "Kings venceu 13-11",
  },
}

export default function MatchDetail() {
  const params = useParams()
  const matchId = params.id as string

  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulando uma chamada de API
    const fetchMatch = async () => {
      setLoading(true)
      try {
        // Em produção, aqui seria uma chamada real à API
        // const response = await fetch(`/api/matches/${matchId}`);
        // const data = await response.json();
        // setMatch(data);

        // Usando dados de exemplo por enquanto
        setTimeout(() => {
          setMatch(sampleMatches[matchId] || null)
          setLoading(false)
        }, 1000)
      } catch (error) {
        console.error("Erro ao buscar detalhes da partida:", error)
        setLoading(false)
      }
    }

    if (matchId) {
      fetchMatch()
    }
  }, [matchId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 py-32">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 py-32">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">Partida não encontrada</h2>
            <p className="text-gray-400 mb-8">A partida que você está procurando não existe ou foi removida.</p>
            <Link
              href="/partidas"
              className="inline-flex items-center bg-gold text-black font-bold py-2 px-6 rounded-md hover:bg-gold/80 transition-colors"
            >
              <ArrowLeft size={18} className="mr-2" />
              Voltar para partidas
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Formatar a data/hora da partida
  const formatMatchTime = () => {
    if (match.status === "live") {
      const now = new Date()
      const diffMs = now.getTime() - match.startTime.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const hours = Math.floor(diffMins / 60)
      const mins = diffMins % 60

      if (hours > 0) {
        return `${hours}h ${mins}m`
      }
      return `${mins}m`
    } else if (match.status === "upcoming") {
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
      return new Date(match.startTime).toLocaleDateString("pt-BR", options)
    } else {
      // Para partidas finalizadas, mostrar a data completa
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }
      return new Date(match.startTime).toLocaleDateString("pt-BR", options)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 py-32">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6">
          <Link href="/partidas" className="inline-flex items-center text-gray-400 hover:text-gold transition-colors">
            <ArrowLeft size={18} className="mr-2" />
            Voltar para partidas
          </Link>
        </div>

        <PremiumCard>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center">
                {match.status === "live" ? (
                  <>
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
                    <span className="text-red-500 font-medium">AO VIVO</span>
                  </>
                ) : match.status === "upcoming" ? (
                  <>
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    <span className="text-blue-500 font-medium">EM BREVE</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                    <span className="text-gray-500 font-medium">FINALIZADA</span>
                  </>
                )}
              </div>
              <div className="text-gray-400">{formatMatchTime()}</div>
            </div>

            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gold mb-2">{match.tournament}</h1>
              {match.map && (
                <div className="flex items-center justify-center text-gray-400">
                  <MapPin size={16} className="mr-1" />
                  <span>{match.map}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center mb-8">
              <div className="flex flex-col items-center mb-4 md:mb-0">
                <div className="relative w-20 h-20 overflow-hidden rounded-full border-2 border-gold/20 mb-3">
                  <Image
                    src={match.team1.logo || "/placeholder.svg?height=80&width=80"}
                    alt={match.team1.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="text-xl font-bold text-white">{match.team1.name}</div>
              </div>

              <div className="flex flex-col items-center">
                {match.status === "upcoming" ? (
                  <div className="text-3xl font-bold text-gray-400 mb-2">VS</div>
                ) : (
                  <div className="text-4xl font-bold text-white mb-2">
                    {match.team1.score} : {match.team2.score}
                  </div>
                )}

                {match.status === "live" && (
                  <a
                    href="https://www.twitch.tv/queridocamp"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-md transition-colors inline-flex items-center"
                  >
                    <span className="mr-2">Assistir na Twitch</span>
                    <ExternalLink size={18} />
                  </a>
                )}
              </div>

              <div className="flex flex-col items-center">
                <div className="relative w-20 h-20 overflow-hidden rounded-full border-2 border-gold/20 mb-3">
                  <Image
                    src={match.team2.logo || "/placeholder.svg?height=80&width=80"}
                    alt={match.team2.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="text-xl font-bold text-white">{match.team2.name}</div>
              </div>
            </div>

            {(match.status === "live" || match.status === "finished") && (
              <div className="mt-8">
                <h2 className="text-xl font-bold text-gold mb-4">Estatísticas dos Jogadores</h2>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th colSpan={2} className="text-left py-3 px-4 text-gold font-bold">
                          {match.team1.name}
                        </th>
                        <th className="py-3 px-2 text-gray-400 font-medium">K</th>
                        <th className="py-3 px-2 text-gray-400 font-medium">D</th>
                        <th className="py-3 px-2 text-gray-400 font-medium">A</th>
                        <th className="py-3 px-2 text-gray-400 font-medium">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.team1.players.map((player) => (
                        <tr key={player.id} className="border-b border-gray-800/50">
                          <td className="py-2 px-4 w-12">
                            <div className="relative w-8 h-8 overflow-hidden rounded-full">
                              <Image
                                src={player.avatar || "/placeholder.svg?height=32&width=32"}
                                alt={player.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </td>
                          <td className="py-2 text-white font-medium">{player.name}</td>
                          <td className="py-2 px-2 text-center text-white">{player.kills}</td>
                          <td className="py-2 px-2 text-center text-white">{player.deaths}</td>
                          <td className="py-2 px-2 text-center text-white">{player.assists}</td>
                          <td
                            className={`py-2 px-2 text-center font-medium ${player.rating && player.rating >= 1.0 ? "text-green-500" : "text-red-500"}`}
                          >
                            {player.rating?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="overflow-x-auto mt-8">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th colSpan={2} className="text-left py-3 px-4 text-gold font-bold">
                          {match.team2.name}
                        </th>
                        <th className="py-3 px-2 text-gray-400 font-medium">K</th>
                        <th className="py-3 px-2 text-gray-400 font-medium">D</th>
                        <th className="py-3 px-2 text-gray-400 font-medium">A</th>
                        <th className="py-3 px-2 text-gray-400 font-medium">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {match.team2.players.map((player) => (
                        <tr key={player.id} className="border-b border-gray-800/50">
                          <td className="py-2 px-4 w-12">
                            <div className="relative w-8 h-8 overflow-hidden rounded-full">
                              <Image
                                src={player.avatar || "/placeholder.svg?height=32&width=32"}
                                alt={player.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          </td>
                          <td className="py-2 text-white font-medium">{player.name}</td>
                          <td className="py-2 px-2 text-center text-white">{player.kills}</td>
                          <td className="py-2 px-2 text-center text-white">{player.deaths}</td>
                          <td className="py-2 px-2 text-center text-white">{player.assists}</td>
                          <td
                            className={`py-2 px-2 text-center font-medium ${player.rating && player.rating >= 1.0 ? "text-green-500" : "text-red-500"}`}
                          >
                            {player.rating?.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </PremiumCard>
      </div>
    </div>
  )
}

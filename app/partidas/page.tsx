"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Clock, MapPin, Calendar, Search, Filter, ChevronDown, ExternalLink } from "lucide-react"
import PremiumCard from "@/components/premium-card"
import HeroBanner from "@/components/hero-banner"
import Link from "next/link"
import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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
  result?: string
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
  {
    id: "match-3",
    status: "upcoming",
    team1: {
      id: "kings",
      name: "Kings",
      logo: "/images/kings.png",
    },
    team2: {
      id: "noel",
      name: "Noel",
      logo: "/images/noel.png",
    },
    map: "Nuke",
    startTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 horas no futuro
    tournament: "Querido Camp 2025 - Fase de Grupos",
  },
  {
    id: "match-4",
    status: "finished",
    team1: {
      id: "kings",
      name: "Kings",
      logo: "/images/kings.png",
      score: 13,
    },
    team2: {
      id: "ctg",
      name: "CTG",
      logo: "/images/ctg.png",
      score: 11,
    },
    map: "Dust2",
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 dia atrás
    tournament: "Querido Camp 2025 - Fase de Grupos",
    result: "Kings venceu 13-11",
  },
  {
    id: "match-5",
    status: "finished",
    team1: {
      id: "querido-cs",
      name: "Querido CS",
      logo: "/images/querido-cs.png",
      score: 13,
    },
    team2: {
      id: "noel",
      name: "Noel",
      logo: "/images/noel.png",
      score: 7,
    },
    map: "Overpass",
    startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 dias atrás
    tournament: "Querido Camp 2025 - Fase de Grupos",
    result: "Querido CS venceu 13-7",
  },
]

export default function Partidas() {
  const [matches, setMatches] = useState<Match[]>([])
  const [filteredMatches, setFilteredMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string[]>(["live", "upcoming", "finished"])

  useEffect(() => {
    // Simulando uma chamada de API
    const fetchMatches = async () => {
      setLoading(true)
      try {
        // Em produção, aqui seria uma chamada real à API
        // const response = await fetch('/api/matches');
        // const data = await response.json();
        // setMatches(data);

        // Usando dados de exemplo por enquanto
        setTimeout(() => {
          setMatches(sampleMatches)
          setFilteredMatches(sampleMatches)
          setLoading(false)
        }, 1000)
      } catch (error) {
        console.error("Erro ao buscar partidas:", error)
        setLoading(false)
      }
    }

    fetchMatches()
  }, [])

  useEffect(() => {
    // Aplicar filtros quando searchTerm ou statusFilter mudar
    const filtered = matches.filter((match) => {
      // Filtro de status
      if (!statusFilter.includes(match.status)) {
        return false
      }

      // Filtro de busca
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        return (
          match.team1.name.toLowerCase().includes(searchLower) ||
          match.team2.name.toLowerCase().includes(searchLower) ||
          match.tournament.toLowerCase().includes(searchLower) ||
          (match.map && match.map.toLowerCase().includes(searchLower))
        )
      }

      return true
    })

    setFilteredMatches(filtered)
  }, [searchTerm, statusFilter, matches])

  const handleStatusToggle = (status: string) => {
    setStatusFilter((prev) => {
      if (prev.includes(status)) {
        return prev.filter((s) => s !== status)
      } else {
        return [...prev, status]
      }
    })
  }

  return (
    <div>
      <HeroBanner title="PARTIDAS" subtitle="Acompanhe todas as partidas do Querido Camp" />

      <section className="py-12 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-grow">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <Input
                  type="text"
                  placeholder="Buscar por equipe, torneio ou mapa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-black border-gray-700 focus:border-gold/50"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="border-gray-700 bg-black hover:bg-black/80 hover:text-gold">
                    <Filter size={18} className="mr-2" />
                    Filtrar
                    <ChevronDown size={16} className="ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-gray-900 border-gray-700">
                  <DropdownMenuCheckboxItem
                    checked={statusFilter.includes("live")}
                    onCheckedChange={() => handleStatusToggle("live")}
                    className="text-white hover:bg-gray-800"
                  >
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    Ao Vivo
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter.includes("upcoming")}
                    onCheckedChange={() => handleStatusToggle("upcoming")}
                    className="text-white hover:bg-gray-800"
                  >
                    <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                    Próximas
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={statusFilter.includes("finished")}
                    onCheckedChange={() => handleStatusToggle("finished")}
                    className="text-white hover:bg-gray-800"
                  >
                    <span className="inline-block w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                    Finalizadas
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400">Nenhuma partida encontrada com os filtros selecionados.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredMatches.map((match, index) => (
                  <MatchCard key={match.id} match={match} delay={index * 0.05} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

// Modificar a função MatchCard para remover o efeito de hover
function MatchCard({ match, delay = 0 }: { match: Match; delay?: number }) {
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
      // Para partidas finalizadas, mostrar a data
      const options: Intl.DateTimeFormatOptions = {
        day: "2-digit",
        month: "2-digit",
      }
      return new Date(match.startTime).toLocaleDateString("pt-BR", options)
    }
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
            <div className="flex items-center text-gray-400 text-sm">
              {match.status === "live" ? (
                <>
                  <Clock size={14} className="mr-1" />
                  <span>{formatMatchTime()}</span>
                </>
              ) : match.status === "upcoming" ? (
                <>
                  <Calendar size={14} className="mr-1" />
                  <span>{formatMatchTime()}</span>
                </>
              ) : (
                <span>{formatMatchTime()}</span>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-4">
            <div className="text-xs text-gray-400">{match.tournament}</div>
            {match.map && (
              <div className="flex items-center text-xs text-gray-400">
                <MapPin size={14} className="mr-1" />
                <span>{match.map}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center">
            <TeamDisplay team={match.team1} />

            <div className="flex flex-col items-center mx-4">
              {match.status === "finished" ? (
                <>
                  <div className="text-2xl font-bold text-white mb-1">
                    {match.team1.score} : {match.team2.score}
                  </div>
                  <Link
                    href={`/partidas/${match.id}`}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1 px-4 rounded-md transition-colors inline-flex items-center text-sm"
                  >
                    Detalhes
                  </Link>
                </>
              ) : match.status === "live" ? (
                <>
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
                </>
              ) : (
                <div className="text-xl font-bold text-gray-400 mb-1">VS</div>
              )}
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

"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Clock, MapPin, Calendar, LogIn, ExternalLink } from "lucide-react"
import PremiumCard from "@/components/premium-card"
import HeroBanner from "@/components/hero-banner"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

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
}

interface UserProfile {
  id: string
  name: string
  avatar: string
  steamId: string
}

// Dados de exemplo - em produção, estes viriam de uma API
const sampleMatches: Match[] = [
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
]

export default function MinhasPartidas() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [authChecking, setAuthChecking] = useState(true)

  useEffect(() => {
    // Verificar autenticação
    const checkAuth = async () => {
      setAuthChecking(true)
      try {
        // Em produção, aqui seria uma chamada real à API
        // const response = await fetch('/api/auth/me');
        // if (response.ok) {
        //   const userData = await response.json();
        //   setUser(userData);
        // } else {
        //   setUser(null);
        // }

        // Simulando usuário não autenticado por padrão
        setUser(null)
        setAuthChecking(false)
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error)
        setUser(null)
        setAuthChecking(false)
      }
    }

    checkAuth()
  }, [])

  useEffect(() => {
    // Buscar partidas do usuário se estiver autenticado
    if (user && !authChecking) {
      const fetchUserMatches = async () => {
        setLoading(true)
        try {
          // Em produção, aqui seria uma chamada real à API
          // const response = await fetch(`/api/users/${user.id}/matches`);
          // const data = await response.json();
          // setMatches(data);

          // Usando dados de exemplo por enquanto
          setTimeout(() => {
            setMatches(sampleMatches)
            setLoading(false)
          }, 1000)
        } catch (error) {
          console.error("Erro ao buscar partidas do usuário:", error)
          setLoading(false)
        }
      }

      fetchUserMatches()
    } else if (!authChecking) {
      setLoading(false)
    }
  }, [user, authChecking])

  const handleLogin = () => {
    // Em produção, redirecionar para a autenticação Steam
    // window.location.href = '/api/auth/steam';

    // Simulando login para demonstração
    setUser({
      id: "user123",
      name: "Jogador Demo",
      avatar: "/placeholder.svg?height=40&width=40",
      steamId: "76561198012345678",
    })
  }

  if (authChecking) {
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

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black to-gray-900 py-32">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-white mb-4">Área Restrita</h2>
            <p className="text-gray-400 mb-8">Faça login com sua conta Steam para visualizar suas partidas.</p>
            <Button
              onClick={handleLogin}
              className="bg-black border border-gray-700 hover:bg-gray-800 hover:text-white"
            >
              <LogIn size={18} className="mr-2" />
              <span className="mr-1">Login com</span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="ml-1"
              >
                <path
                  d="M12 2C6.477 2 2 6.477 2 12C2 17.523 6.477 22 12 22C17.523 22 22 17.523 22 12C22 6.477 17.523 2 12 2ZM6.67 16.29C6.423 16.148 6.18 15.999 5.943 15.842C5.646 15.643 5.354 15.437 5.07 15.22C5.017 15.181 4.977 15.128 4.954 15.067C4.931 15.006 4.926 14.939 4.94 14.875C4.954 14.811 4.986 14.752 5.032 14.705C5.078 14.658 5.136 14.625 5.2 14.61C5.55 14.53 5.91 14.47 6.27 14.43C7.06 14.35 7.86 14.35 8.65 14.43C8.783 14.443 8.917 14.443 9.05 14.43C9.15 14.43 9.26 14.36 9.26 14.25C9.26 14.14 9.18 14.07 9.08 14.05C8.67 13.95 8.25 13.88 7.83 13.82C7.41 13.76 6.97 13.71 6.55 13.65C6.13 13.59 5.72 13.53 5.3 13.46C5.1 13.43 4.9 13.39 4.7 13.35C4.5 13.31 4.3 13.26 4.1 13.2C3.9 13.14 3.7 13.07 3.51 12.99C3.32 12.91 3.13 12.82 2.95 12.71C2.77 12.6 2.6 12.48 2.44 12.34C2.28 12.2 2.13 12.05 2 11.88C1.87 11.71 1.75 11.53 1.65 11.34C1.55 11.15 1.47 10.95 1.4 10.74C1.33 10.53 1.28 10.32 1.25 10.1C1.22 9.88 1.2 9.66 1.2 9.43C1.2 9.2 1.22 8.98 1.25 8.76C1.28 8.54 1.33 8.32 1.4 8.11C1.47 7.9 1.55 7.7 1.65 7.51C1.75 7.32 1.87 7.14 2 6.97C2.13 6.8 2.28 6.65 2.44 6.51C2.6 6.37 2.77 6.25 2.95 6.14C3.13 6.03 3.32 5.94 3.51 5.86C3.7 5.78 3.9 5.71 4.1 5.65C4.3 5.59 4.5 5.54 4.7 5.5C4.9 5.46 5.1 5.42 5.3 5.39C5.72 5.32 6.13 5.26 6.55 5.2C6.97 5.14 7.41 5.09 7.83 5.03C8.25 4.97 8.67 4.9 9.08 4.8C9.18 4.78 9.26 4.71 9.26 4.6C9.26 4.49 9.15 4.42 9.05 4.42C8.917 4.407 8.783 4.407 8.65 4.42C7.86 4.5 7.06 4.5 6.27 4.42C5.91 4.38 5.55 4.32 5.2 4.24C5.136 4.225 5.078 4.192 5.032 4.145C4.986 4.098 4.954 4.039 4.94 3.975C4.926 3.911 4.931 3.844 4.954 3.783C4.977 3.722 5.017 3.669 5.07 3.63C5.354 3.413 5.646 3.207 5.943 3.008C6.18 2.851 6.423 2.702 6.67 2.56C8.302 1.579 10.131 1.039 12 1C13.869 1.039 15.698 1.579 17.33 2.56C17.577 2.702 17.82 2.851 18.057 3.008C18.354 3.207 18.646 3.413 18.93 3.63C18.983 3.669 19.023 3.722 19.046 3.783C19.069 3.844 19.074 3.911 19.06 3.975C19.046 4.039 19.014 4.098 18.968 4.145C18.922 4.192 18.864 4.225 18.8 4.24C18.45 4.32 18.09 4.38 17.73 4.42C16.94 4.5 16.14 4.5 15.35 4.42C15.217 4.407 15.083 4.407 14.95 4.42C14.85 4.42 14.74 4.49 14.74 4.6C14.74 4.71 14.82 4.78 14.92 4.8C15.33 4.9 15.75 4.97 16.17 5.03C16.59 5.09 17.03 5.14 17.45 5.2C17.87 5.26 18.28 5.32 18.7 5.39C18.9 5.42 19.1 5.46 19.3 5.5C19.5 5.54 19.7 5.59 19.9 5.65C20.1 5.71 20.3 5.78 20.49 5.86C20.68 5.94 20.87 6.03 21.05 6.14C21.23 6.25 21.4 6.37 21.56 6.51C21.72 6.65 21.87 6.8 22 6.97C22.13 7.14 22.25 7.32 22.35 7.51C22.45 7.7 22.53 7.9 22.6 8.11C22.67 8.32 22.72 8.54 22.75 8.76C22.78 8.98 22.8 9.2 22.8 9.43C22.8 9.66 22.78 9.88 22.75 10.1C22.72 10.32 22.67 10.54 22.6 10.75C22.53 10.96 22.45 11.16 22.35 11.35C22.25 11.54 22.13 11.72 22 11.89C21.87 12.06 21.72 12.21 21.56 12.35C21.4 12.49 21.23 12.61 21.05 12.72C20.87 12.83 20.68 12.92 20.49 13C20.3 13.08 20.1 13.15 19.9 13.21C19.7 13.27 19.5 13.32 19.3 13.36C19.1 13.4 18.9 13.44 18.7 13.47C18.28 13.54 17.87 13.6 17.45 13.66C17.03 13.72 16.59 13.77 16.17 13.83C15.75 13.89 15.33 13.96 14.92 14.06C14.82 14.08 14.74 14.15 14.74 14.26C14.74 14.37 14.85 14.44 14.95 14.44C15.083 14.453 15.217 14.453 15.35 14.44C16.14 14.36 16.94 14.36 17.73 14.44C18.09 14.48 18.45 14.54 18.8 14.62C18.864 14.635 18.922 14.668 18.968 14.715C19.014 14.762 19.046 14.821 19.06 14.885C19.074 14.949 19.069 15.016 19.046 15.077C19.023 15.138 18.983 15.191 18.93 15.23C18.646 15.447 18.354 15.653 18.057 15.852C17.82 16.009 17.577 16.158 17.33 16.3C15.698 17.281 13.869 17.821 12 17.86C10.131 17.821 8.302 17.281 6.67 16.3V16.29Z"
                  fill="currentColor"
                />
              </svg>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <HeroBanner title="MINHAS PARTIDAS" subtitle={`Olá, ${user.name}! Confira suas partidas no Querido Camp`} />

      <section className="py-12 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gold mb-4">Suas Partidas</h2>
              <p className="text-gray-400">Aqui você pode acompanhar todas as partidas em que está participando.</p>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
              </div>
            ) : matches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-6">Você ainda não tem partidas registradas.</p>
                <Link
                  href="/partidas"
                  className="inline-block bg-gold text-black font-bold py-2 px-6 rounded-md hover:bg-gold/80 transition-colors"
                >
                  Ver todas as partidas
                </Link>
              </div>
            ) : (
              <div className="space-y-6">
                {matches.map((match, index) => (
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

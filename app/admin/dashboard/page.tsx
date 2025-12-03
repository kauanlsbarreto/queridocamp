"use client"

import type React from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Users, Calendar, Clock } from "lucide-react"

export default function AdminDashboard() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Times"
          value="12"
          icon={<Trophy className="h-8 w-8 text-gold" />}
          description="Times cadastrados"
        />
        <StatCard
          title="Jogadores"
          value="60"
          icon={<Users className="h-8 w-8 text-blue-400" />}
          description="Jogadores registrados"
        />
        <StatCard
          title="Partidas"
          value="24"
          icon={<Calendar className="h-8 w-8 text-green-400" />}
          description="Partidas agendadas"
        />
        <StatCard
          title="Próxima Partida"
          value="2 dias"
          icon={<Clock className="h-8 w-8 text-red-400" />}
          description="Tempo restante"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Ações Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <QuickAction
                href="/admin/teams/new"
                title="Adicionar Time"
                description="Cadastrar um novo time no sistema"
                icon={<Trophy className="h-5 w-5 text-gold" />}
              />
              <QuickAction
                href="/admin/players/new"
                title="Adicionar Jogador"
                description="Cadastrar um novo jogador no sistema"
                icon={<Users className="h-5 w-5 text-blue-400" />}
              />
              <QuickAction
                href="/admin/matches/new"
                title="Agendar Partida"
                description="Criar uma nova partida no calendário"
                icon={<Calendar className="h-5 w-5 text-green-400" />}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Próximas Partidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <MatchItem team1="Kings" team2="Querido CS" date="10/06/2025" time="19:00" />
              <MatchItem team1="CTG" team2="Noel" date="12/06/2025" time="20:00" />
              <MatchItem team1="Kings" team2="Noel" date="15/06/2025" time="19:00" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string
  icon: React.ReactNode
  description: string
}

function StatCard({ title, value, icon, description }: StatCardProps) {
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-400">{title}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-full">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

interface QuickActionProps {
  href: string
  title: string
  description: string
  icon: React.ReactNode
}

function QuickAction({ href, title, description, icon }: QuickActionProps) {
  return (
    <a href={href} className="block p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors">
      <div className="flex items-center">
        <div className="mr-4 bg-gray-700 p-2 rounded-full">{icon}</div>
        <div>
          <h3 className="text-white font-medium">{title}</h3>
          <p className="text-gray-400 text-sm">{description}</p>
        </div>
      </div>
    </a>
  )
}

interface MatchItemProps {
  team1: string
  team2: string
  date: string
  time: string
}

function MatchItem({ team1, team2, date, time }: MatchItemProps) {
  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <div className="flex justify-between items-center">
        <div className="flex-1 text-right">
          <p className="text-white font-medium">{team1}</p>
        </div>
        <div className="mx-4 text-center">
          <p className="text-gold font-bold">VS</p>
          <p className="text-xs text-gray-400">
            {date} - {time}
          </p>
        </div>
        <div className="flex-1 text-left">
          <p className="text-white font-medium">{team2}</p>
        </div>
      </div>
    </div>
  )
}

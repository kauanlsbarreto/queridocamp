"use client"

import { useState } from "react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Edit, Trash2, MoreVertical, AlertCircle, Calendar, Clock, MapPin } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Dados de exemplo
const matchesData = [
  {
    id: 1,
    team1: "Kings",
    team2: "Querido CS",
    date: "10/06/2025",
    time: "19:00",
    map: "Inferno",
    status: "upcoming",
  },
  {
    id: 2,
    team1: "CTG",
    team2: "Noel",
    date: "12/06/2025",
    time: "20:00",
    map: "Mirage",
    status: "upcoming",
  },
  {
    id: 3,
    team1: "Kings",
    team2: "CTG",
    date: "05/06/2025",
    time: "19:00",
    map: "Dust2",
    status: "finished",
    score1: 13,
    score2: 11,
  },
  {
    id: 4,
    team1: "Querido CS",
    team2: "Noel",
    date: "03/06/2025",
    time: "20:00",
    map: "Overpass",
    status: "finished",
    score1: 13,
    score2: 7,
  },
]

export default function MatchesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [matches, setMatches] = useState(matchesData)
  const [matchToDelete, setMatchToDelete] = useState<number | null>(null)

  const filteredMatches = matches.filter((match) => {
    const matchesSearch =
      match.team1.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.team2.toLowerCase().includes(searchTerm.toLowerCase()) ||
      match.map.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || match.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleDeleteMatch = () => {
    if (matchToDelete !== null) {
      setMatches(matches.filter((match) => match.id !== matchToDelete))
      setMatchToDelete(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-white">Partidas</h1>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Buscar partidas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white w-full"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40 bg-gray-800 border-gray-700 text-white">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800 text-white">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="upcoming">Próximas</SelectItem>
              <SelectItem value="finished">Finalizadas</SelectItem>
            </SelectContent>
          </Select>
          <Link href="/admin/matches/new">
            <Button className="bg-gold hover:bg-gold/80 text-black font-medium w-full sm:w-auto">
              <Plus size={18} className="mr-2" />
              Nova Partida
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        {filteredMatches.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Times</TableHead>
                  <TableHead className="text-gray-400">Data</TableHead>
                  <TableHead className="text-gray-400">Mapa</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMatches.map((match) => (
                  <TableRow key={match.id} className="border-gray-800 hover:bg-gray-800/50">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center">
                        <span>{match.team1}</span>
                        <span className="mx-2 text-gray-400">vs</span>
                        <span>{match.team2}</span>
                      </div>
                      {match.status === "finished" && (
                        <div className="text-sm text-gray-400 mt-1">
                          {match.score1} - {match.score2}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center text-white">
                          <Calendar size={14} className="mr-2 text-gray-400" />
                          {match.date}
                        </div>
                        <div className="flex items-center text-gray-400 mt-1">
                          <Clock size={14} className="mr-2" />
                          {match.time}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-white">
                      <div className="flex items-center">
                        <MapPin size={14} className="mr-2 text-gray-400" />
                        {match.map}
                      </div>
                    </TableCell>
                    <TableCell>
                      {match.status === "upcoming" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-400">
                          Próxima
                        </span>
                      ) : match.status === "finished" ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-400">
                          Finalizada
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/30 text-red-400">
                          Ao Vivo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                            <MoreVertical size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                          <Link href={`/admin/matches/${match.id}`}>
                            <DropdownMenuItem className="text-white hover:bg-gray-800 cursor-pointer">
                              <Edit size={16} className="mr-2 text-blue-400" />
                              Editar
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            className="text-white hover:bg-gray-800 cursor-pointer"
                            onClick={() => setMatchToDelete(match.id)}
                          >
                            <Trash2 size={16} className="mr-2 text-red-400" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-800 mb-4">
              <AlertCircle size={32} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma partida encontrada</h3>
            <p className="text-gray-400 mb-4">Não encontramos partidas com os filtros selecionados.</p>
            <Link href="/admin/matches/new">
              <Button className="bg-gold hover:bg-gold/80 text-black font-medium">
                <Plus size={18} className="mr-2" />
                Adicionar Partida
              </Button>
            </Link>
          </div>
        )}
      </div>

      <AlertDialog open={matchToDelete !== null} onOpenChange={(open) => !open && setMatchToDelete(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir partida</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir esta partida? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMatch} className="bg-red-600 hover:bg-red-700 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

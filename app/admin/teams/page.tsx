"use client"

import { useState } from "react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Edit, Trash2, MoreVertical, Trophy, AlertCircle } from "lucide-react"
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

// Dados de exemplo
const teamsData = [
  { id: 1, name: "Kings", players: 5, wins: 8, losses: 2, logo: "/images/kings.png" },
  { id: 2, name: "Querido CS", players: 5, wins: 7, losses: 3, logo: "/images/querido-cs.png" },
  { id: 3, name: "CTG", players: 5, wins: 5, losses: 5, logo: "/images/ctg.png" },
  { id: 4, name: "Noel", players: 5, wins: 4, losses: 6, logo: "/images/noel.png" },
]

export default function TeamsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [teams, setTeams] = useState(teamsData)
  const [teamToDelete, setTeamToDelete] = useState<number | null>(null)

  const filteredTeams = teams.filter((team) => team.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleDeleteTeam = () => {
    if (teamToDelete !== null) {
      setTeams(teams.filter((team) => team.id !== teamToDelete))
      setTeamToDelete(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-white">Times</h1>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Buscar times..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white w-full"
            />
          </div>
          <Link href="/admin/teams/new">
            <Button className="bg-gold hover:bg-gold/80 text-black font-medium w-full sm:w-auto">
              <Plus size={18} className="mr-2" />
              Novo Time
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        {filteredTeams.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Nome</TableHead>
                  <TableHead className="text-gray-400 text-center">Jogadores</TableHead>
                  <TableHead className="text-gray-400 text-center">Vitórias</TableHead>
                  <TableHead className="text-gray-400 text-center">Derrotas</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id} className="border-gray-800 hover:bg-gray-800/50">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gray-700 mr-3 flex items-center justify-center overflow-hidden">
                          {team.logo ? (
                            <img
                              src={team.logo || "/placeholder.svg"}
                              alt={team.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Trophy size={16} className="text-gold" />
                          )}
                        </div>
                        {team.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-white">{team.players}</TableCell>
                    <TableCell className="text-center text-green-400">{team.wins}</TableCell>
                    <TableCell className="text-center text-red-400">{team.losses}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                            <MoreVertical size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                          <Link href={`/admin/teams/${team.id}`}>
                            <DropdownMenuItem className="text-white hover:bg-gray-800 cursor-pointer">
                              <Edit size={16} className="mr-2 text-blue-400" />
                              Editar
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            className="text-white hover:bg-gray-800 cursor-pointer"
                            onClick={() => setTeamToDelete(team.id)}
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
            <h3 className="text-lg font-medium text-white mb-2">Nenhum time encontrado</h3>
            <p className="text-gray-400 mb-4">Não encontramos times com o termo pesquisado.</p>
            <Link href="/admin/teams/new">
              <Button className="bg-gold hover:bg-gold/80 text-black font-medium">
                <Plus size={18} className="mr-2" />
                Adicionar Time
              </Button>
            </Link>
          </div>
        )}
      </div>

      <AlertDialog open={teamToDelete !== null} onOpenChange={(open) => !open && setTeamToDelete(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir time</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este time? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTeam} className="bg-red-600 hover:bg-red-700 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

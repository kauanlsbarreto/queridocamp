"use client"

import { useState } from "react"
import Link from "next/link"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Search, Edit, Trash2, MoreVertical, User, AlertCircle } from "lucide-react"
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
const playersData = [
  { id: 1, name: "Jogador 1", nickname: "Player1", team: "Kings", role: "Entry", avatar: null },
  { id: 2, name: "Jogador 2", nickname: "Player2", team: "Kings", role: "AWP", avatar: null },
  { id: 3, name: "Jogador 3", nickname: "Player3", team: "Querido CS", role: "IGL", avatar: null },
  { id: 4, name: "Jogador 4", nickname: "Player4", team: "Querido CS", role: "Rifler", avatar: null },
  { id: 5, name: "Jogador 5", nickname: "Player5", team: "CTG", role: "Support", avatar: null },
  { id: 6, name: "Jogador 6", nickname: "Player6", team: "Noel", role: "Entry", avatar: null },
]

export default function PlayersPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [players, setPlayers] = useState(playersData)
  const [playerToDelete, setPlayerToDelete] = useState<number | null>(null)

  const filteredPlayers = players.filter(
    (player) =>
      player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      player.team.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const handleDeletePlayer = () => {
    if (playerToDelete !== null) {
      setPlayers(players.filter((player) => player.id !== playerToDelete))
      setPlayerToDelete(null)
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-white">Jogadores</h1>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              placeholder="Buscar jogadores..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800 border-gray-700 text-white w-full"
            />
          </div>
          <Link href="/admin/players/new">
            <Button className="bg-gold hover:bg-gold/80 text-black font-medium w-full sm:w-auto">
              <Plus size={18} className="mr-2" />
              Novo Jogador
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        {filteredPlayers.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Nome</TableHead>
                  <TableHead className="text-gray-400">Nickname</TableHead>
                  <TableHead className="text-gray-400">Time</TableHead>
                  <TableHead className="text-gray-400">Função</TableHead>
                  <TableHead className="text-gray-400 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPlayers.map((player) => (
                  <TableRow key={player.id} className="border-gray-800 hover:bg-gray-800/50">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-gray-700 mr-3 flex items-center justify-center overflow-hidden">
                          {player.avatar ? (
                            <img
                              src={player.avatar || "/placeholder.svg"}
                              alt={player.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <User size={16} className="text-gray-400" />
                          )}
                        </div>
                        {player.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-white">{player.nickname}</TableCell>
                    <TableCell className="text-white">{player.team}</TableCell>
                    <TableCell className="text-white">{player.role}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
                            <MoreVertical size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-gray-900 border-gray-800">
                          <Link href={`/admin/players/${player.id}`}>
                            <DropdownMenuItem className="text-white hover:bg-gray-800 cursor-pointer">
                              <Edit size={16} className="mr-2 text-blue-400" />
                              Editar
                            </DropdownMenuItem>
                          </Link>
                          <DropdownMenuItem
                            className="text-white hover:bg-gray-800 cursor-pointer"
                            onClick={() => setPlayerToDelete(player.id)}
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
            <h3 className="text-lg font-medium text-white mb-2">Nenhum jogador encontrado</h3>
            <p className="text-gray-400 mb-4">Não encontramos jogadores com o termo pesquisado.</p>
            <Link href="/admin/players/new">
              <Button className="bg-gold hover:bg-gold/80 text-black font-medium">
                <Plus size={18} className="mr-2" />
                Adicionar Jogador
              </Button>
            </Link>
          </div>
        )}
      </div>

      <AlertDialog open={playerToDelete !== null} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir jogador</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              Tem certeza que deseja excluir este jogador? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-white hover:bg-gray-700 border-gray-700">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlayer} className="bg-red-600 hover:bg-red-700 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

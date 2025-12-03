"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { LogOut, User, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import Link from "next/link"

interface UserProfile {
  id: string
  name: string
  avatar: string
  steamId: string
}

export default function AuthButton() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulando verificação de autenticação
    const checkAuth = async () => {
      setLoading(true)
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
        setLoading(false)
      } catch (error) {
        console.error("Erro ao verificar autenticação:", error)
        setUser(null)
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

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

  const handleLogout = () => {
    // Em produção, fazer logout via API
    // fetch('/api/auth/logout', { method: 'POST' })
    //   .then(() => setUser(null))
    //   .catch(err => console.error('Erro ao fazer logout:', err));

    // Simulando logout para demonstração
    setUser(null)
  }

  if (loading) {
    return (
      <Button variant="outline" size="sm" disabled className="bg-black/50 border-gray-700">
        <span className="animate-pulse">Carregando...</span>
      </Button>
    )
  }

  if (!user) {
    return (
      <button
        onClick={handleLogin}
        className="relative h-10 overflow-hidden rounded-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-opacity-50"
      >
        <Image
          src="/images/steam-login-button.webp"
          alt="Entrar com Steam"
          width={180}
          height={40}
          className="h-full w-auto"
        />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="bg-black/50 border-gray-700 hover:bg-gray-800 hover:text-white">
          <div className="relative w-5 h-5 rounded-full overflow-hidden mr-2">
            <Image src={user.avatar || "/placeholder.svg"} alt={user.name} fill className="object-cover" />
          </div>
          <span className="mr-1">{user.name}</span>
          <ChevronDown size={14} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-gray-900 border-gray-700">
        <DropdownMenuLabel className="text-gray-400">Minha Conta</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-gray-700" />
        <DropdownMenuItem className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer">
          <Link href="/minhas-partidas" className="flex items-center w-full">
            <User size={16} className="mr-2 text-gray-400" />
            Minhas Partidas
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="hover:bg-gray-800 focus:bg-gray-800 cursor-pointer text-red-400 hover:text-red-300"
          onClick={handleLogout}
        >
          <LogOut size={16} className="mr-2" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

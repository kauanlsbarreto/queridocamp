'use client'

import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Definição do tipo para o Perfil do Usuário.
 * O campo 'id' deve representar a Primary Key da sua tabela 'players'.
 */
export type UserProfile = {
  id: number
  faceit_guid: string  
  nickname: string
  avatar: string
  steam_id_64?: string
  accessToken?: string
  Admin?: number
  admin?: number
  ID?: number
}

interface UserProfileProps extends UserProfile {
  onLogout: () => void
}

export const UserProfile = ({
  id,
  ID,
  nickname,
  avatar,
  Admin,
  admin,
  onLogout,
}: UserProfileProps) => {
  const profileId = id ?? ID;
  const userAdminLevel = Admin ?? admin;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-3 cursor-pointer">
          <span className="text-white font-medium">{nickname}</span>
          <Avatar className="h-9 w-9 border border-white/10">
            <AvatarImage src={avatar} alt={nickname} />
            <AvatarFallback className="bg-[#FF5500] text-white">
              {nickname.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56 bg-[#121212] border-white/10 text-white">
        <DropdownMenuLabel className="text-gray-400 font-normal">Minha Conta</DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        
        {(Number(userAdminLevel) === 1 || Number(userAdminLevel) === 2) && (
          <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
            <Link href="/adminstracao" className="w-full">Painel Admin</Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
          <Link 
            href={profileId !== undefined ? `/perfil/${profileId}` : "#"} 
            className="w-full"
          >
            Meu Perfil
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
          <Link href="/stats?filter=me" className="w-full">Minhas Stats</Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/10" />
        
        <DropdownMenuItem 
          onClick={onLogout} 
          className="text-red-500 focus:bg-red-500/10 focus:text-red-500 cursor-pointer"
        >
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
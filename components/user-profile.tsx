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

export type UserProfile = {
  id: number
  nickname: string
  avatar: string
  Admin?: number
  admin?: number
  ID?: number
}

export const UserProfile = ({
  id,
  ID,
  nickname,
  avatar,
  Admin,
  admin,
  onLogout,
}: UserProfile & { onLogout: () => void }) => {
  // Prioriza o id (que deve ser o número retornado pelo DB)
  const profileId = id || ID;
  const userAdminLevel = Admin ?? admin;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-3 cursor-pointer">
          <span className="text-white font-medium">{nickname}</span>
          <Avatar>
            <AvatarImage src={avatar} alt={nickname} />
            <AvatarFallback>{nickname.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Number(userAdminLevel) === 1 || Number(userAdminLevel) === 2) && (
          <DropdownMenuItem asChild>
            <Link href="/adminstracao" className="w-full cursor-pointer">Admin</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link 
            href={profileId ? `/perfil/${profileId}` : "#"} 
            className="w-full cursor-pointer"
          >
            Meu Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/stats?filter=me" className="w-full cursor-pointer">Minhas Stats</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout} className="cursor-pointer">
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
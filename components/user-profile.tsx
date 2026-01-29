'use client'

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
  nickname: string
  avatar: string
}

export const UserProfile = ({
  nickname,
  avatar,
  onLogout,
}: UserProfile & { onLogout: () => void }) => {
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
        <DropdownMenuItem>
          <a href="/minhas-partidas">Minhas Partidas</a>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onLogout}>Sair</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

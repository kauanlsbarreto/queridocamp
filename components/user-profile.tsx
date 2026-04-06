'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/hooks/use-toast'


export type UserProfile = {
  id: number
  faceit_guid: string  
  nickname: string
  avatar: string
  points?: number
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
  points,
  Admin,
  admin,
  faceit_guid,
  onLogout,
}: UserProfileProps) => {
  const { toast } = useToast();
  const profileId = (id === 0 && ID) ? ID : (id ?? ID);
  const [userAdminLevel, setUserAdminLevel] = useState(0);
  const [userPoints, setUserPoints] = useState(points ?? 0);
  const [showPunishModal, setShowPunishModal] = useState(false);

  useEffect(() => {
    setUserPoints(points ?? 0);
  }, [points]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setUserAdminLevel(Admin || admin || 0);
      setUserPoints(points ?? 0);
      return;
    }

    if (faceit_guid) {
      fetch(`/api/admin/players?faceit_guid=${faceit_guid}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.admin === 'number') {
            setUserAdminLevel(data.admin);
            setUserPoints(typeof data.points === 'number' ? data.points : 0);

            const storedSession = localStorage.getItem("faceit_user");
            if (storedSession) {
              try {
                const currentUser = JSON.parse(storedSession);
                if (currentUser.Admin !== data.admin || currentUser.id !== data.id || currentUser.points !== data.points) {
                  const updatedUser = {
                    ...currentUser,
                    Admin: data.admin,
                    id: data.id,
                    nickname: data.nickname,
                    avatar: data.avatar || currentUser.avatar,
                    points: typeof data.points === 'number' ? data.points : 0,
                  };
                  localStorage.setItem("faceit_user", JSON.stringify(updatedUser));
                  window.dispatchEvent(new Event('storage'));
                }
              } catch (e) {
                console.error("Failed to update user session in localStorage", e);
              }
            }
          }
        })
        .catch((err) => console.error("Error fetching admin level:", err));
    }
  }, [Admin, admin, faceit_guid, points]);

  return (
    <>
    <TooltipProvider delayDuration={150}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-3 cursor-pointer">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 select-none"
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <span
                    aria-hidden="true"
                    className="h-5 w-5 shrink-0 bg-contain bg-center bg-no-repeat"
                    style={{ backgroundImage: "url('/moeda.png')" }}
                  />
                  <span className="text-sm font-semibold text-white">{userPoints}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-64 rounded-xl border border-gold/20 bg-[#0b1118] px-4 py-3 text-sm leading-relaxed text-white shadow-2xl"
              >
                Os pontos são calculados apos o termino de uma partida podendo receber de 5 até 30 pontos.
              </TooltipContent>
            </Tooltip>

            <span className="text-white font-medium">{nickname}</span>
            <Avatar className="h-9 w-9 border border-white/10">
              <AvatarImage src={avatar} alt={nickname} />
              <AvatarFallback className="bg-[#FF5500] text-white">
                {(nickname ? nickname.slice(0, 2) : '??').toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56 bg-[#121212] border-white/10 text-white">
          <DropdownMenuLabel className="text-gray-400 font-normal">Minha Conta</DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-white/10" />
        
          {(userAdminLevel === 1 || userAdminLevel === 2 || userAdminLevel === 5) && (
            <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
              <Link href="/overlay/placar" className="w-full">🎥 Overlay Placar</Link>
            </DropdownMenuItem>
          )}
        
          {(userAdminLevel >= 1 && userAdminLevel <= 5) && (
            <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
              <Link href="/agendarjogo" className="w-full">Adicionar Jogo</Link>
            </DropdownMenuItem>
          )}


          {(userAdminLevel === 1 || userAdminLevel === 2) && (
            <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
              <Link href="/adminstracao" className="w-full">Painel Admin</Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
            <Link 
              href={`/perfil/${profileId}`} 
              className="w-full"
            >
              Meu Perfil
            </Link>
          </DropdownMenuItem>


          <DropdownMenuSeparator className="bg-white/10" />
        
          <DropdownMenuItem 
            onClick={() => {
              localStorage.removeItem('manual_user');
              localStorage.removeItem('manual_user_login_time');
              localStorage.removeItem('faceit_user');
              localStorage.removeItem('faceit_user_login_time');
              window.dispatchEvent(new Event('faceit_auth_updated'));
              onLogout();
            }}
            className="text-red-500 focus:bg-red-500/10 focus:text-red-500 cursor-pointer"
          >
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>

    {/* ...existing code... */}
  </>
  )
}


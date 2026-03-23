'use client'

import { useState, useEffect } from 'react'
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
import { useToast } from '@/components/hooks/use-toast'


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
  faceit_guid,
  onLogout,
}: UserProfileProps) => {
  const { toast } = useToast();
  const profileId = (id === 0 && ID) ? ID : (id ?? ID);
  const [userAdminLevel, setUserAdminLevel] = useState(0);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      setUserAdminLevel(Admin || admin || 0);
    }

    if (faceit_guid) {
      fetch(`/api/admin/players?faceit_guid=${faceit_guid}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.admin === 'number') {
            setUserAdminLevel(data.admin);

            const storedSession = localStorage.getItem("faceit_user");
            if (storedSession) {
              try {
                const currentUser = JSON.parse(storedSession);
                if (currentUser.Admin !== data.admin || currentUser.id !== data.id) {
                  const updatedUser = { ...currentUser, Admin: data.admin, id: data.id, nickname: data.nickname, avatar: data.avatar || currentUser.avatar };
                  localStorage.setItem("faceit_user", JSON.stringify(updatedUser));
                }
              } catch (e) {
                console.error("Failed to update user session in localStorage", e);
              }
            }
          }
        })
        .catch((err) => console.error("Error fetching admin level:", err));

      fetch(`/api/admin/my-permissions?faceit_guid=${faceit_guid}`)
        .then((res) => res.json())
        .then((data) => {
          const perms: string[] = Array.isArray(data?.permissions) ? data.permissions : [];
          setUserPermissions(perms);

          const storedSession = localStorage.getItem("faceit_user");
          if (storedSession) {
            try {
              const currentUser = JSON.parse(storedSession);
              const updated = { ...currentUser, permissions: perms };
              localStorage.setItem("faceit_user", JSON.stringify(updated));
              window.dispatchEvent(new Event('faceit_auth_updated'));
            } catch (e) {
              console.error("Failed to cache permissions in localStorage", e);
            }
          }
        })
        .catch((err) => console.error("Error fetching permissions:", err));
    }
  }, [faceit_guid]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="flex items-center gap-3 cursor-pointer">
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
        
        {userPermissions.includes('overlay_placar') && (
          <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
            <Link href="/overlay/placar" className="w-full">🎥 Overlay Placar</Link>
          </DropdownMenuItem>
        )}
        
        {userPermissions.includes('schedule_matches') && (
          <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
            <Link href="/agendarjogo" className="w-full">Adicionar Jogo</Link>
          </DropdownMenuItem>
        )}

        {/* only admins with force_logout permission get the "logout everyone" action */}
        {userPermissions.includes('force_logout') && (
          <DropdownMenuItem
            onClick={async () => {
              if (
                !confirm(
                  "Tem certeza? isto forçará todos os usuários a se deslogarem."
                )
              ) {
                return
              }
              try {
                const res = await fetch("/api/admin/logout-all", { method: "POST" })
                if (res.ok) {
                  toast({
                    title: "Deslogar todos",
                    description: "Solicitação enviada com sucesso.",
                  })
                } else {
                  toast({
                    title: "Deslogar todos",
                    description: "Falha ao enviar a solicitação.",
                  })
                }
              } catch (e) {
                console.error(e)
                toast({
                  title: "Deslogar todos",
                  description: "Erro de rede ao enviar a solicitação.",
                })
              }
            }}
            className="focus:bg-white/5 cursor-pointer text-yellow-400"
          >
            Deslogar todos
          </DropdownMenuItem>
        )}

        {userPermissions.includes('access_admin_panel') && (
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

        <DropdownMenuItem asChild className="focus:bg-white/5 cursor-pointer">
          <Link href="/stats?filter=me" className="w-full">Minhas Stats</Link>
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
  )
}
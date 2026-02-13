"use client"

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Shield, User, ChevronLeft, ChevronRight } from "lucide-react";
import PremiumCard from "@/components/premium-card";
import { usePathname, useSearchParams } from "next/navigation";
import AdPropaganda from "@/components/ad-propaganda";
import UpdateTimer from "@/components/update-timer";

interface Player {
  id: number;
  nickname: string;
  avatar: string;
  faceit_guid: string;
  team_name?: string;
  team_logo?: string;
  faceit_level?: number;
  is_challenger?: boolean;
}

const Pagination = ({ totalPages, currentPage }: { totalPages: number, currentPage: number }) => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const createPageURL = (pageNumber: number) => {
        const params = new URLSearchParams(searchParams);
        params.set('page', pageNumber.toString());
        return `${pathname}?${params.toString()}`;
    };
    if (totalPages <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-4 mt-12 text-white">
            <Link href={createPageURL(currentPage - 1)} className={`p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors ${currentPage <= 1 ? 'pointer-events-none opacity-30' : ''}`}>
                <ChevronLeft size={20} />
            </Link>
            <span className="text-sm font-medium italic">Página {currentPage} de {totalPages}</span>
            <Link href={createPageURL(currentPage + 1)} className={`p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors ${currentPage >= totalPages ? 'pointer-events-none opacity-30' : ''}`}>
                <ChevronRight size={20} />
            </Link>
        </div>
    );
};

export default function PlayersList({ initialPlayers, totalPages, currentPage, lastUpdate }: { initialPlayers: Player[], totalPages: number, currentPage: number, lastUpdate: string }) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchLevels = async () => {
      const updatedPlayers = await Promise.all((initialPlayers || []).map(async (player) => {
        if (!player.faceit_guid || player.id === 0) return player;
        try {
          const res = await fetch(`https://open.faceit.com/data/v4/players/${player.faceit_guid}`, {
            headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
          });
          if (res.ok) {
            const data = await res.json();
            return { 
              ...player, 
              faceit_level: data.games?.cs2?.skill_level || 0,
              is_challenger: data.games?.cs2?.skill_level === 10 && data.faceit_rank <= 1000 
            };
          }
        } catch (e) { console.error(e); }
        return player;
      }));
      setPlayers(updatedPlayers);
    };
    fetchLevels();
  }, [initialPlayers]);

  const filteredPlayers = players.filter(p =>
    p.nickname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto px-4 py-8">
       <AdPropaganda videoSrc="/videosad/radiante.mp4" redirectUrl="https://industriaradiante.com.br/" />
       
       <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          <div>
             <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">Jogadores</h1>
             <p className="text-zinc-500 text-sm font-medium uppercase tracking-widest mt-1">Lista Geral de Atletas</p>
          </div>
          <div className="relative w-full md:w-96">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
             <input
                type="text"
                placeholder="PROCURAR JOGADOR..."
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all uppercase text-sm font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
          </div>
       </div>

       <UpdateTimer lastUpdate={lastUpdate} />

       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-8">
          {filteredPlayers.map((player) => (
             <Link href={`/perfil/${player.id}`} key={player.id} className="group">
                  <PremiumCard className="h-full hover:scale-[1.03] transition-all duration-300 border-white/5 group-hover:border-gold/30 shadow-2xl">
                    <div className="relative p-8 flex flex-col items-center text-center h-full">
                       
                       <div className="relative w-28 h-28 mb-6">
                          <div className="absolute inset-0 bg-gold/10 group-hover:bg-gold/20 blur-3xl rounded-full transition-colors" />
                          <div className="relative w-full h-full rounded-full border-2 border-white/10 p-1.5 bg-black/40 group-hover:border-gold/50 transition-all">
                             <Image
                                src={player.avatar || "/images/cs2-player.png"}
                                alt={player.nickname}
                                fill
                                className="rounded-full object-cover"
                                unoptimized
                             />
                          </div>
                       </div>

                       <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2 group-hover:text-gold transition-colors">
                          {player.nickname}
                       </h3>

                       <div className="mt-auto w-full pt-6 border-t border-white/10 flex flex-col items-center gap-4">
                          
                          <div className="flex flex-col items-center gap-1">
                             <span className="text-[10px] text-zinc-500 font-bold uppercase">Querido ID: {player.id}</span>
                             
                             <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-md">
                                 <img 
                                     src={player.id === 0 ? "/faceitlevel/-1.png" : (player.is_challenger ? "/faceitlevel/challenger.png" : `/faceitlevel/${player.faceit_level || 1}.png`)}
                                     alt="Level"
                                     className="w-5 h-5"
                                 />
                                 <span className="text-xs font-black text-gold italic uppercase tracking-tighter">
                                     Level {player.id === 0 ? '-1' : (player.faceit_level || '...')}
                                 </span>
                             </div>
                          </div>

                          {player.team_name ? (
                             <div className="flex items-center justify-center gap-3 text-zinc-300 bg-white/5 w-full py-2 rounded-lg border border-transparent group-hover:border-white/5 group-hover:bg-white/10 transition-all">
                                {player.team_logo ? (
                                   <div className="relative w-6 h-6">
                                      <Image src={player.team_logo} alt={player.team_name} fill className="object-contain" unoptimized />
                                   </div>
                                ) : (
                                   <Shield size={16} className="text-gold" />
                                )}
                                <span className="font-bold text-sm tracking-tight">{player.team_name}</span>
                             </div>
                          ) : (
                             <div className="flex items-center justify-center gap-2 text-zinc-600 text-xs uppercase font-bold tracking-widest py-2">
                                <User size={14} />
                                <span>Sem time</span>
                             </div>
                          )}
                       </div>
                    </div>
                  </PremiumCard>
             </Link>
          ))}
       </div>
       <Pagination totalPages={totalPages} currentPage={currentPage} />
    </div>
  )
}
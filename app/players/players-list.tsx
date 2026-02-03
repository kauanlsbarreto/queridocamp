"use client"

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Shield, User } from "lucide-react";
import PremiumCard from "@/components/premium-card";

interface Player {
  id: number;
  nickname: string;
  avatar: string;
  faceit_guid: string;
  team_name?: string;
  team_logo?: string;
}

export default function PlayersList({ initialPlayers }: { initialPlayers: Player[] }) {
  const [players, setPlayers] = useState<any[]>(initialPlayers.map(p => ({ ...p, faceit_level: 0, is_challenger: false })));
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOption, setSortOption] = useState("level-desc");

  // Busca Níveis da Faceit
  useEffect(() => {
    const fetchLevels = async () => {
      const fetchPlayerLevel = async (player: any) => {
          if (!player.faceit_guid) return player;
          try {
              const res = await fetch(`https://open.faceit.com/data/v4/players/${player.faceit_guid}`, {
                  headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
              });
              if (res.ok) {
                  const data = await res.json();
                  if (data.games?.cs2?.skill_level) {
                      let isChallenger = false;
                      // Verifica Challenger se for level 10
                      if (data.games.cs2.skill_level === 10 && data.games.cs2.region) {
                          try {
                              const rankRes = await fetch(`https://open.faceit.com/data/v4/rankings/games/cs2/regions/${data.games.cs2.region}/players/${player.faceit_guid}`, {
                                  headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
                              });
                              if (rankRes.ok) {
                                  const rankData = await rankRes.json();
                                  if (rankData.position && rankData.position <= 1000) {
                                      isChallenger = true;
                                  }
                              }
                          } catch (e) {
                              console.error("Failed to fetch rank", e);
                          }
                      }
                      return { ...player, faceit_level: data.games.cs2.skill_level, is_challenger: isChallenger };
                  }
              }
          } catch (e) {
              console.error(`Erro ao buscar level para ${player.nickname}`, e);
          }
          return player;
      };

      // Executa as requisições (limitado pelo navegador, mas ok para essa quantidade)
      const promises = initialPlayers.map(p => fetchPlayerLevel(p));
      const results = await Promise.all(promises);
      setPlayers(results);
    };

    fetchLevels();
  }, [initialPlayers]);

  const filteredPlayers = players
    .filter(p => p.nickname.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const [criteria, order] = sortOption.split('-');
      const isAsc = order === 'asc';

      if (criteria === 'level') {
        if (a.faceit_level === b.faceit_level) return 0;
        return isAsc ? a.faceit_level - b.faceit_level : b.faceit_level - a.faceit_level;
      }
      if (criteria === 'id') {
        return isAsc ? a.id - b.id : b.id - a.id;
      }
      if (criteria === 'name') {
        return isAsc ? a.nickname.localeCompare(b.nickname) : b.nickname.localeCompare(a.nickname);
      }
      if (criteria === 'team') {
        const teamA = a.team_name || "";
        const teamB = b.team_name || "";
        if (!teamA && !teamB) return 0;
        if (!teamA) return 1;
        if (!teamB) return -1;
        return isAsc ? teamA.localeCompare(teamB) : teamB.localeCompare(teamA);
      }
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 pt-24">
       {/* Barra de Pesquisa e Filtro */}
       <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-800 rounded-md leading-5 bg-gray-900/60 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:border-gold focus:ring-1 focus:ring-gold sm:text-sm transition duration-150 ease-in-out"
              placeholder="Pesquisar jogador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select 
            className="bg-gray-900/60 border border-gray-800 text-gray-300 rounded-md px-4 py-3 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold sm:text-sm"
            onChange={(e) => setSortOption(e.target.value)}
            value={sortOption}
          >
            <option value="level-desc">Maior Nível</option>
            <option value="level-asc">Menor Nível</option>
            <option value="id-asc">Querido ID (Menor)</option>
            <option value="id-desc">Querido ID (Maior)</option>
            <option value="name-asc">Nome (A-Z)</option>
            <option value="name-desc">Nome (Z-A)</option>
            <option value="team-asc">Time (A-Z)</option>
            <option value="team-desc">Time (Z-A)</option>
          </select>
       </div>

       {/* Grid de Cards */}
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {filteredPlayers.map((player, index) => (
             <Link href={`/perfil/${player.id}`} key={player.id} className="block h-full">
                  <PremiumCard hoverEffect={true} delay={index * 0.05} className="h-full">
                    <div className="p-6 flex flex-col items-center gap-4">
                       {/* Avatar */}
                       <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gold/30">
                          <Image 
                            src={player.avatar || '/images/cs2-player.png'} 
                            alt={player.nickname} 
                            fill 
                            className="object-cover"
                            unoptimized
                          />
                       </div>

                       {/* Nome e Level */}
                       <div className="text-center">
                          <h3 className="text-xl font-bold text-white mb-1">{player.nickname}</h3>
                          <p className="text-xs text-zinc-500 font-mono mb-2">ID: {player.id}</p>
                          {player.faceit_level > 0 && (
                             <div className="flex items-center justify-center gap-2 mt-2">
                                <img 
                                  src={player.id === 1 ? "/faceitlevel/-1.png" : (player.is_challenger ? "/faceitlevel/challenger.png" : `/faceitlevel/${player.faceit_level}.png`)}
                                  alt={`Level ${player.faceit_level}`}
                                  className="w-8 h-8"
                                />
                                <span className="text-gold font-bold text-sm">Level {player.faceit_level}</span>
                             </div>
                          )}
                       </div>

                       {/* Time */}
                       <div className="w-full pt-4 border-t border-white/10 mt-2">
                          {player.team_name ? (
                             <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm">
                                {player.team_logo ? (
                                   <div className="relative w-5 h-5">
                                      <Image 
                                        src={player.team_logo} 
                                        alt={player.team_name} 
                                        fill 
                                        className="object-contain"
                                        unoptimized
                                      />
                                   </div>
                                ) : (
                                   <Shield size={14} className="text-gold" />
                                )}
                                <span>{player.team_name}</span>
                             </div>
                          ) : (
                             <div className="flex items-center justify-center gap-2 text-zinc-600 text-sm">
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
    </div>
  )
}

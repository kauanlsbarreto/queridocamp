"use client"

import { useState, useEffect, useMemo, memo } from "react";
import { motion } from "framer-motion";
import PremiumCard from "@/components/premium-card";
import Image from "next/image";
import Link from "next/link";
import { Shield, Search } from "lucide-react";

interface Player {
  id: number;
  nick: string;
  pote: number;
  faceit_image?: string;
  faceit_url?: string;
  discord_id?: string;
}

const PlayerAvatar = ({ src, alt }: { src?: string; alt: string }) => {
  const placeholder = '/images/player-placeholder.png';
  const [imgSrc, setImgSrc] = useState(src || placeholder);

  useEffect(() => {
    setImgSrc(src || placeholder);
  }, [src]);

  return (
    <Image 
      src={imgSrc} 
      alt={alt}
      fill
      className="object-cover"
      onError={() => setImgSrc(placeholder)}
      unoptimized={imgSrc.startsWith('http')}
    />
  );
};

interface TeamData {
  team_name: string;
  team_nick: string;
  team_image: string;
  players: Player[];
}

const TeamsList = memo(function TeamsList({ teams }: { teams: TeamData[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTeams = useMemo(() => {
    return teams.filter(team => 
      team.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.players.some(p => p.nick.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [teams, searchTerm]);

  return (
    <div className="space-y-8">
      {/* Barra de Busca */}
      <div className="relative max-w-md mx-auto mb-12">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={20} />
        <input 
          type="text" 
          placeholder="BUSCAR TIME OU JOGADOR..." 
          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white uppercase text-xs font-black italic tracking-widest focus:ring-2 focus:ring-gold/50 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredTeams.map((team, index) => (
        <motion.div
          key={team.team_nick}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <Link href={`/times/${team.team_nick.toLowerCase()}`}>
            <PremiumCard className="group hover:scale-[1.01] transition-all cursor-pointer overflow-hidden border-white/5 hover:border-gold/30">
              <div className="p-6 md:p-8">
                <div className="flex flex-col gap-10 items-center">
                  
                  <div className="w-full flex flex-col items-center text-center space-y-4">
                    <div className="relative w-32 h-32 md:w-40 md:h-40">
                      <div className="absolute inset-0 bg-gold/20 blur-3xl rounded-full group-hover:bg-gold/40 transition-all" />
                      <div className="relative w-full h-full rounded-full overflow-hidden border-2 border-white/10 group-hover:border-gold/50 transition-all shadow-2xl bg-black flex items-center justify-center">
                        <Image 
                          src={team.team_image || '/images/team-placeholder.png'} 
                          alt={team.team_name} 
                          fill 
                          className="object-contain p-4"
                          unoptimized
                        />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-3xl md:text-4xl font-black italic uppercase text-white tracking-tighter group-hover:text-gold transition-colors">
                        {team.team_name}
                      </h2>
                      <div className="flex items-center justify-center gap-2 mt-1">
                        <Shield size={14} className="text-gold" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest italic">LINE-UP OFICIAL</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-5xl">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8">
                      {team.players.map((player) => (
                        <div key={player.id} className={`group/player flex flex-col items-center ${!player.faceit_url ? 'opacity-40' : ''}`}>
                          <div className="relative mb-4">
                            
                            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-gold p-1 shadow-[0_0_15px_rgba(212,175,55,0.15)] group-hover/player:shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-all duration-300">
                                <div className="relative w-full h-full rounded-full overflow-hidden bg-zinc-900">
                                    <PlayerAvatar src={player.faceit_image} alt={player.nick} />
                                </div>
                            </div>
                            
                            {player.faceit_url && (
                              <div 
                                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/player:opacity-100 transition-all duration-300 z-20"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="absolute inset-0 bg-black/40 rounded-full backdrop-blur-[2px]" />
                                <a 
                                  href={player.faceit_url} 
                                  target="_blank" 
                                  className="relative w-12 h-12 bg-[#ff5500] rounded-full flex items-center justify-center text-white shadow-2xl hover:scale-110 transition-transform border-2 border-white/20 overflow-hidden"
                                  title="Ver Faceit"
                                >
                                  <Image 
                                    src="/images/faceit.png" 
                                    alt="Faceit" 
                                    width={28} 
                                    height={28} 
                                    className="object-contain"
                                  />
                                </a>
                              </div>
                            )}
                          </div>

                          <span className="text-white font-black text-lg text-center truncate w-full uppercase italic tracking-tighter group-hover/player:text-gold transition-colors">
                            {player.nick}
                          </span>
                          
                          <span className={`text-[10px] font-black px-3 py-0.5 rounded-full border mt-2 uppercase tracking-widest
                            ${player.pote === 1 ? 'bg-gold text-black border-gold' : 
                              'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            Pote {player.pote}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w-full border-t border-white/5 pt-6 flex justify-center">
                     <span className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.3em] group-hover:text-gold transition-colors">
                        Ver estatísticas completas
                     </span>
                  </div>

                </div>
              </div>
            </PremiumCard>
          </Link>
        </motion.div>
      ))}

      {filteredTeams.length === 0 && (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <p className="text-zinc-500 font-black italic uppercase tracking-widest">Nenhum time ou jogador encontrado.</p>
        </div>
      )}
    </div>
  );
});

export default TeamsList;
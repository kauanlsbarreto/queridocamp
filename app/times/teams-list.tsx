"use client"

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import PremiumCard from "@/components/premium-card";
import Image from "next/image";
import Link from "next/link"; // Adicionado para navegação
import { User, Shield, Gamepad2, MessageSquare, Search } from "lucide-react";

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

export default function TeamsList({ teams }: { teams: TeamData[] }) {
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
          {/* Link para a página individual do time */}
          <Link href={`/times/${team.team_nick.toLowerCase()}`}>
            <PremiumCard className="group hover:scale-[1.01] transition-all cursor-pointer overflow-hidden border-white/5 hover:border-gold/30">
              <div className="p-6 md:p-8">
                <div className="flex flex-col lg:flex-row gap-8 items-start">
                  
                  {/* Cabeçalho do Time (Lado Esquerdo) */}
                  <div className="w-full lg:w-1/4 flex flex-col items-center text-center space-y-4">
                    <div className="relative w-32 h-32 md:w-40 md:h-40">
                      <div className="absolute inset-0 bg-gold/20 blur-3xl rounded-full group-hover:bg-gold/40 transition-all" />
                      <div className="relative w-full h-full rounded-2xl overflow-hidden border-2 border-white/10 group-hover:border-gold/50 transition-all bg-black shadow-2xl">
                        <Image 
                          src={team.team_image || '/images/team-placeholder.png'} 
                          alt={team.team_name} 
                          fill 
                          className="object-contain p-2"
                          unoptimized
                        />
                      </div>
                    </div>
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black italic uppercase text-white tracking-tighter group-hover:text-gold transition-colors">
                        {team.team_name}
                      </h2>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <Shield size={14} className="text-gold" />
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Organização Ativa</span>
                      </div>
                      {/* Botão Visual apenas para feedback do usuário */}
                      <div className="mt-4 px-4 py-2 bg-white/5 rounded-lg border border-white/10 text-[9px] font-black uppercase text-zinc-400 group-hover:bg-gold group-hover:text-black transition-all">
                        Ver Estatísticas Completas
                      </div>
                    </div>
                  </div>

                  {/* Lista de Jogadores (Lado Direito) */}
                  <div className="w-full lg:w-3/4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4">
                      {team.players.map((player) => (
                        <div key={player.id} className="flex flex-col items-center bg-black/40 p-4 rounded-2xl border border-white/5 group-hover:border-white/10 transition-all">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 mb-3">
                              <PlayerAvatar src={player.faceit_image} alt={player.nick} />
                            </div>
                            
                            {/* Overlay de Links Rápidos (Parando propagação para não entrar no link do time se clicar neles) */}
                            <div className="absolute -top-1 -right-1 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                              {player.faceit_url && (
                                <a 
                                  href={player.faceit_url} 
                                  target="_blank" 
                                  className="p-1.5 bg-[#ff5500] rounded-full text-white hover:scale-110 transition-transform shadow-lg"
                                  title="Faceit"
                                >
                                  <Gamepad2 size={10} />
                                </a>
                              )}
                              {player.discord_id ? (
                                <div 
                                  className="p-1.5 bg-[#5865F2] rounded-full text-white shadow-lg cursor-help"
                                  title={`Discord: ${player.discord_id}`}
                                >
                                  <MessageSquare size={10} />
                                </div>
                              ) : (
                                <a 
                                  href="/perfil" 
                                  className="p-1.5 bg-zinc-800 rounded-full text-zinc-400 hover:scale-110 transition-transform uppercase tracking-wider shadow-lg"
                                  title="Vincular Conta"
                                >
                                  <User size={10} />
                                </a>
                              )}
                            </div>
                          </div>

                          <span className="text-white font-bold text-sm mt-1 text-center truncate w-full uppercase italic">
                            {player.nick}
                          </span>
                          
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border mt-2 uppercase tracking-tighter
                            ${player.pote === 1 ? 'bg-gold/20 text-gold border-gold/30' : 
                              player.pote === 2 ? 'bg-zinc-100/10 text-zinc-300 border-white/10' :
                              'bg-zinc-800/50 text-zinc-500 border-zinc-700'
                            }`}
                          >
                            Pote {player.pote}
                          </span>
                        </div>
                      ))}
                      
                      {team.players.length === 0 && (
                        <div className="col-span-full text-center py-8 text-zinc-600 text-[10px] font-black uppercase italic tracking-widest bg-white/5 rounded-2xl border border-dashed border-white/10">
                          Aguardando definição dos jogadores...
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </PremiumCard>
          </Link>
        </motion.div>
      ))}

      {filteredTeams.length === 0 && (
        <div className="text-center py-20">
          <p className="text-zinc-500 font-black italic uppercase tracking-widest">Nenhum time encontrado com esse termo.</p>
        </div>
      )}
    </div>
  );
}
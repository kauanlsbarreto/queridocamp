"use client"

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import PremiumCard from "@/components/premium-card";
import Image from "next/image";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const poteOrder = [4, 5, 1, 2, 3];

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 600000);
    return () => clearInterval(interval);
  }, [router]);

  const filteredTeams = teams.filter(team => 
    team.team_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.players.some(player => player.nick.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-3 border border-gray-800 rounded-md leading-5 bg-gray-900/60 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-gray-900 focus:border-gold focus:ring-1 focus:ring-gold sm:text-sm transition duration-150 ease-in-out"
          placeholder="Pesquisar time ou jogador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredTeams.map((team, index) => (
        <motion.div
          key={`${team.team_name}-${index}`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: (index % 5) * 0.1 }}
        >
          <PremiumCard hoverEffect={false}>
            <div className="p-6 md:p-8">
              <div className="flex flex-col items-center gap-8">
                
                <div className="flex flex-col items-center justify-center min-w-[220px]">
                  <div className="relative w-36 h-36 mb-4 rounded-full overflow-hidden border-4 border-gold/20 shadow-[0_0_20px_rgba(255,215,0,0.15)] bg-black">
                    {team.team_image ? (
                      <Image 
                        src={team.team_image} 
                        alt={team.team_name}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, 150px"
                        unoptimized={team.team_image.startsWith('http')}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-600">
                        <Shield size={48} />
                      </div>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-gold text-center uppercase tracking-wide">
                    {team.team_name === "Só Desculpa Nunca Erramos" ? (
                      <>
                        Só Desculpa
                        <br />
                        Nunca Erramos
                      </>
                    ) : (
                      team.team_name
                    )}
                  </h3>
                  <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-gold inline-block"></span>
                    Capitão: {team.team_nick}
                  </p>
                </div>

                <div className="flex-1 w-full">
                  <h4 className="text-white font-bold mb-8 border-b border-gray-800 pb-2 flex items-center justify-center">
                    <User className="text-gold mr-2" size={20} />
                    Line-up
                  </h4>
                  
                  <div className="flex flex-wrap justify-center gap-8 md:gap-12">
                    {[...team.players].sort((a, b) => {
                      const indexA = poteOrder.indexOf(a.pote);
                      const indexB = poteOrder.indexOf(b.pote);
                      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
                    }).map((player) => (
                      <div 
                        key={player.id} 
                        className="group relative flex flex-col items-center"
                      >
                        <div className={`relative w-28 h-28 rounded-full overflow-hidden border-2 ${!player.faceit_url ? 'border-gray-800 opacity-20 group-hover:opacity-100' : 'border-gray-700'} bg-black shadow-lg group-hover:border-gold/50 transition-all duration-300`}>
                          <PlayerAvatar 
                            src={player.faceit_image} 
                            alt={player.nick}
                          />
                          
                          {/* Hover Overlay Buttons */}
                          <div className="absolute inset-0 bg-black/80 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {player.faceit_url ? (
                              <a 
                                href={player.faceit_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 bg-[#ff5500] rounded-full text-white hover:scale-110 transition-transform"
                                title="Perfil Faceit"
                              >
                                <div className="relative w-5 h-5">
                                  <Image 
                                    src="/images/faceit.png" 
                                    alt="Faceit" 
                                    fill 
                                    className="object-contain" 
                                  />
                                </div>
                              </a>
                            ) : (
                              <a 
                                href="https://discord.com/channels/1357681113358930010/1403748672373657650" 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-3 py-1 bg-[#5865F2] rounded-full text-white text-[10px] font-bold hover:scale-105 transition-transform uppercase tracking-wider shadow-lg"
                                title="Vincular Conta"
                              >
                                Vincular
                              </a>
                            )}
                          </div>
                        </div>

                        <span className="text-white font-bold text-xl mt-3 text-center">{player.nick}</span>
                        
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border mt-2
                          ${player.pote === 1 ? 'bg-gold/20 text-gold border-gold/30' : 
                            player.pote === 2 ? 'bg-gray-300/20 text-gray-300 border-gray-300/30' :
                            'bg-gray-700/30 text-gray-400 border-gray-700'
                          }`}
                        >
                          Pote {player.pote}
                        </span>
                      </div>
                    ))}
                    
                    {team.players.length === 0 && (
                      <div className="col-span-full text-center py-4 text-gray-500 italic bg-gray-900/30 rounded border border-dashed border-gray-800">
                        Aguardando definição dos jogadores...
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </PremiumCard>
        </motion.div>
      ))}
    </div>
  );
}
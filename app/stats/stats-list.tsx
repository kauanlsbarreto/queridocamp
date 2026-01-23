"use client"

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import PremiumCard from "@/components/premium-card";
import { Trophy, ChevronDown, ExternalLink } from "lucide-react";

const tabs = ["Pote 1", "Pote 2", "Pote 3", "Pote 4", "Pote 5", "MVP"];

const PlayerAvatar = ({ src, alt }: { src?: string; alt: string }) => {
  const placeholder = "/images/cs2-player.png";
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
      unoptimized={!!imgSrc?.startsWith("http")}
    />
  );
};

export default function StatsList({ allStats }: { allStats: any[] }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("Pote 1");
  const [selectedRound, setSelectedRound] = useState<string>("Geral");

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), 600000);
    return () => clearInterval(interval);
  }, [router]);

  const TOTAL_ROUNDS = 17;

  const getPlayedRounds = (player: any) => {
    return Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)
      .filter(r => Number(player[`r${r}_k`] || 0) > 0)
      .length;
  };

  const getDisplayData = () => {
    const isGeral = selectedRound === "Geral";
    
    // Identificação das chaves de dados
    const kKey = isGeral ? 'k' : `r${selectedRound}_k`;
    const dKey = isGeral ? 'd' : `r${selectedRound}_d`;
    const kdKey = isGeral ? 'kd' : `r${selectedRound}_kd`;
    const krKey = isGeral ? 'kr' : `r${selectedRound}_kr`;
    const playedKey = 'played'; // Altere aqui se o nome da coluna de rodadas jogadas for diferente

    const sorted = [...allStats].sort((a, b) => {
      const valAK = Number(a[kKey]) || 0;
      const valBK = Number(b[kKey]) || 0;

      // 1. PRIORIDADE ZERO: Jogadores inativos (0 kills) sempre vão para o fim
      if (valAK === 0 && valBK > 0) return 1;
      if (valAK > 0 && valBK === 0) return -1;
      
      // 2. PRIORIDADE GERAL: Quem jogou mais rodadas fica em cima
      if (isGeral) {
        const playedA = getPlayedRounds(a);
        const playedB = getPlayedRounds(b);
        if (playedB !== playedA) return playedB - playedA;
      }

      // 3. DESEMPATE: K/D Ratio
      const valAKD = parseFloat(a[kdKey]) || 0;
      const valBKD = parseFloat(b[kdKey]) || 0;
      if (valBKD !== valAKD) return valBKD - valAKD;

      // 4. DESEMPATE: Volume de Kills
      if (valBK !== valAK) return valBK - valAK;

      // 5. DESEMPATE: K/R (Kills per Round)
      const valAKR = parseFloat(a[krKey]) || 0;
      const valBKR = parseFloat(b[krKey]) || 0;
      return valBKR - valAKR;
    });

    if (activeTab === "MVP") return sorted.slice(0, 1);
    
    const poteNum = parseInt(activeTab.split(" ")[1]);
    return sorted.filter(p => p.pote === poteNum);
  };

  const displayData = getDisplayData();
  const isGeral = selectedRound === "Geral";

  return (
    <div className="space-y-8">
      {/* Barra de Filtros e Select */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white/5 p-4 rounded-xl border border-white/10 shadow-2xl">
        <div className="flex flex-wrap justify-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2 rounded-lg font-black uppercase text-[11px] tracking-tighter transition-all border ${
                activeTab === tab 
                ? "bg-gold text-black border-gold shadow-[0_0_20px_rgba(255,215,0,0.3)] scale-105" 
                : "bg-black/40 text-gray-500 border-gray-800 hover:border-gold/40 hover:text-gray-300"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <select 
            value={selectedRound}
            onChange={(e) => setSelectedRound(e.target.value)}
            className="w-full bg-black border-2 border-gray-800 text-gold font-black py-3 px-5 rounded-xl appearance-none cursor-pointer focus:border-gold outline-none text-xs uppercase tracking-widest transition-colors"
          >
            <option value="Geral">📊 ESTATÍSTICAS GERAIS</option>
            {Array.from({length: 17}, (_, i) => i + 1).map(num => (
              <option key={num} value={num}>🔥 RODADA {num}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-3.5 text-gold pointer-events-none" size={18} />
        </div>
      </div>

      {/* Grid de Jogadores */}
      <div className={activeTab === "MVP" ? "max-w-xl mx-auto" : "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"}>
        <AnimatePresence mode="wait">
          {displayData.map((player, index) => {
            const k = isGeral ? player.k : player[`r${selectedRound}_k`];
            const d = isGeral ? player.d : player[`r${selectedRound}_d`];
            const kd = isGeral ? player.kd : player[`r${selectedRound}_kd`];
            const kr = isGeral ? player.kr : player[`r${selectedRound}_kr`];
            const m1Link = !isGeral ? player[`r${selectedRound}_m1_link`] : null;
            const m2Link = !isGeral ? player[`r${selectedRound}_m2_link`] : null;

            return (
              <motion.div
                key={`${activeTab}-${selectedRound}-${player.nick}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.3, delay: (index % 20) * 0.03 }}
                className="relative"
              >
                {/* Ranking Badge */}
                {activeTab !== "MVP" && k > 0 && (
                  <div className={`absolute -top-3 -left-3 z-10 w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shadow-2xl border-2 ${
                    index === 0 ? "bg-gold text-black border-yellow-200" : 
                    index === 1 ? "bg-slate-300 text-black border-white" :
                    index === 2 ? "bg-amber-700 text-white border-amber-400" :
                    "bg-gray-900 text-gray-400 border-gray-800"
                  }`}>
                    #{index + 1}
                  </div>
                )}

                <PremiumCard>
                  <div className={`p-6 transition-opacity duration-500 ${k === 0 ? 'opacity-30 grayscale' : 'opacity-100'}`}>
                    <div className="flex items-center gap-5">
                      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-800 bg-black shadow-inner group">
                        <PlayerAvatar src={player.faceit_image} alt={player.nick} />
                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                          {player.faceit_url && (
                            <a href={player.faceit_url} target="_blank" className="p-2 bg-[#ff5500] rounded-full hover:scale-110 transition-transform">
                              <Image src="/images/faceit.png" width={16} height={16} alt="F" />
                            </a>
                          )}
                        </div>
                      </div>

                      <div className="flex-1">
                        {activeTab === "MVP" && (
                          <div className="text-gold font-black text-[9px] uppercase flex items-center gap-1 mb-1 tracking-tighter">
                            <Trophy size={10}/> MVP {isGeral ? 'DA TEMPORADA' : `RD ${selectedRound}`}
                          </div>
                        )}
                        <h3 className="text-2xl font-black text-white italic uppercase truncate leading-none">{player.nick}</h3>
                        <div className="flex flex-col gap-1 mt-1">
                          <p className="text-gray-500 text-[10px] font-bold tracking-widest">POTE {player.pote}</p>
                          {isGeral && (
                             <p className="text-gold text-[10px] font-extrabold tracking-widest uppercase">
                               {getPlayedRounds(player)} Rodadas Jogadas
                             </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">K/D Ratio</p>
                        <p className="text-2xl font-black text-gold">{Number(kd).toFixed(2)}</p>
                      </div>
                      <div className="bg-white/5 p-3 rounded-xl border border-white/5 text-center">
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">K/R Ratio</p>
                        <p className="text-2xl font-black text-white">{Number(kr).toFixed(2)}</p>
                      </div>
                    </div>

                    <div className="flex justify-between mt-5 px-2">
                      <div className="text-center">
                        <span className="text-[9px] text-gray-600 font-bold uppercase block tracking-tighter">Kills</span>
                        <span className="text-lg text-gray-300 font-black">{k}</span>
                      </div>
                      <div className="text-center border-x border-white/5 px-6">
                        <span className="text-[9px] text-gray-600 font-bold uppercase block tracking-tighter">Mortes</span>
                        <span className="text-lg text-gray-300 font-black">{d}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[9px] text-gray-600 font-bold uppercase block tracking-tighter">Clutches</span>
                        <span className="text-lg text-gray-300 font-black">{isGeral ? player.clt : '-'}</span>
                      </div>
                    </div>

                    {!isGeral && (m1Link || m2Link) && (
                      <div className="flex justify-center gap-3 mt-5">
                        {m1Link && (
                          <a 
                            href={m1Link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-gold/20 border border-white/10 hover:border-gold/50 transition-all group/link"
                          >
                            <span className="text-[10px] font-bold text-gray-400 group-hover/link:text-gold uppercase tracking-wider">Mapa 1</span>
                            <ExternalLink size={10} className="text-gray-500 group-hover/link:text-gold" />
                          </a>
                        )}
                        {m2Link && (
                          <a 
                            href={m2Link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 hover:bg-gold/20 border border-white/10 hover:border-gold/50 transition-all group/link"
                          >
                            <span className="text-[10px] font-bold text-gray-400 group-hover/link:text-gold uppercase tracking-wider">Mapa 2</span>
                            <ExternalLink size={10} className="text-gray-500 group-hover/link:text-gold" />
                          </a>
                        )}
                      </div>
                    )}
                    
                    {k === 0 && (
                      <div className="mt-4 py-1 bg-red-500/5 rounded border border-red-500/10 text-center">
                        <p className="text-[9px] text-red-500/40 font-black uppercase italic tracking-widest">Inativo na seleção</p>
                      </div>
                    )}
                  </div>
                </PremiumCard>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
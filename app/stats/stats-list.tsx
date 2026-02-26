"use client"

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import PremiumCard from "@/components/premium-card";
import { Trophy, ChevronDown, ExternalLink } from "lucide-react";
import { useSearchParams } from "next/navigation";


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
  const [selectedRound, setSelectedRound] = useState<string>("Geral");
  const searchParams = useSearchParams();
  const filterMe = searchParams.get('filter') === 'me';
  const [myNick, setMyNick] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedPote, setSelectedPote] = useState<string>("All");
  const [sortBy, setSortBy] = useState<string>("kd");
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('faceit_user');
      if (saved) {
          try {
            const user = JSON.parse(saved);
            setMyNick(user.nickname || user.nick);
            if (user.admin === 1 || user.admin === 2 || user.Admin === 1 || user.Admin === 2) {
              setIsAdmin(true);
            }
          } catch (e) {
            console.error("Erro ao ler usuário:", e);
          }
      }
    }
  }, []);

  useEffect(() => {
    if (cooldownUntil > Date.now()) {
        const interval = setInterval(() => {
            const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
            setTimeLeft(remaining > 0 ? remaining : 0);
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 1000);
        return () => clearInterval(interval);
    }
  }, [cooldownUntil]);


  const TOTAL_ROUNDS = 17;

  const getPlayedRounds = (player: any) => {
    return Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)
      .filter(r => Number(player[`r${r}_k`] || 0) > 0)
      .length;
  };

  const displayData = useMemo(() => {
    const isGeral = selectedRound === "Geral";
    
    const kKey = isGeral ? 'k' : `r${selectedRound}_k`;
    const dKey = isGeral ? 'd' : `r${selectedRound}_d`;
    const kdKey = isGeral ? 'kd' : `r${selectedRound}_kd`;
    const krKey = isGeral ? 'kr' : `r${selectedRound}_kr`;
    const adrKey = isGeral ? 'adr' : `r${selectedRound}_adr`;

    let sorted = [...(allStats || [])].sort((a, b) => {
      const k_a = Number(a[kKey]) || 0;
      const k_b = Number(b[kKey]) || 0;

      if (k_a === 0 && k_b > 0) return 1;
      if (k_a > 0 && k_b === 0) return -1;
      
      const poteA = Number(a.pote);
      const poteB = Number(b.pote);
      let penaltyA = poteA === 0;
      let penaltyB = poteB === 0;

      if (isGeral) {
        const roundsA = getPlayedRounds(a);
        const roundsB = getPlayedRounds(b);
        if (roundsA <= 4) penaltyA = true;
        if (roundsB <= 4) penaltyB = true;
      }

      if (penaltyA && !penaltyB) return 1;
      if (!penaltyA && penaltyB) return -1;

      const kd_a = parseFloat(a[kdKey]) || 0;
      const kd_b = parseFloat(b[kdKey]) || 0;
      const adr_a = parseFloat(a[adrKey]) || 0;
      const adr_b = parseFloat(b[adrKey]) || 0;
      const kr_a = parseFloat(a[krKey]) || 0;
      const kr_b = parseFloat(b[krKey]) || 0;

      switch (sortBy) {
        case 'adr':
          if (adr_b !== adr_a) return adr_b - adr_a;
          break;
        case 'kills':
          if (k_b !== k_a) return k_b - k_a;
          break;
        case 'kr':
          if (kr_b !== kr_a) return kr_b - kr_a;
          break;
        case 'kd':
        default:
          if (kd_b !== kd_a) return kd_b - kd_a;
          break;
      }

      if (kd_b !== kd_a) return kd_b - kd_a;
      if (adr_b !== adr_a) return adr_b - adr_a;
      if (kr_b !== kr_a) return kr_b - kr_a;
      return k_b - k_a;
    });

    if (selectedPote !== "All") {
      sorted = sorted.filter(p => p.pote === Number(selectedPote));
    }

    if (filterMe && myNick) {
      return sorted.filter(p => p.nick?.toLowerCase() === myNick.toLowerCase());
    }

    return sorted;
  }, [allStats, selectedRound, filterMe, myNick, selectedPote, sortBy]);

  const isGeral = selectedRound === "Geral";

  const potes = [
    { label: "Geral", value: "All" },
    { label: "Pote 1", value: "1" },
    { label: "Pote 2", value: "2" },
    { label: "Pote 3", value: "3" },
    { label: "Pote 4", value: "4" },
    { label: "Pote 5", value: "5" },
    { label: "Completes", value: "0" },
  ];

  const isSortDisabled = !isAdmin && timeLeft > 0;

  const handleSortChange = (newSort: string) => {
    if (isSortDisabled) return;
    setSortBy(newSort);
    if (!isAdmin) {
      setCooldownUntil(Date.now() + 15 * 1000);
      setTimeLeft(15);
    }
  };

  return (
    <div className="space-y-8">
      {!filterMe && (
      <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white/5 p-4 rounded-xl border border-white/10 shadow-2xl">
        <div className="relative flex flex-wrap justify-center gap-2">
          {potes.map((pote) => (
            <button
              key={pote.value}
              onClick={() => setSelectedPote(pote.value)}
              className={`px-3 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-wider transition-all ${
                selectedPote === pote.value
                  ? "bg-gold text-black shadow-lg shadow-gold/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            >
              {pote.label}
            </button>
          ))}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
          <div className={`relative min-w-[180px] w-full sm:w-auto ${isSortDisabled ? 'opacity-50' : ''}`}>
            {isSortDisabled && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-max px-3 py-1 bg-red-900/80 border border-red-500/50 rounded-md text-white text-xs z-10">
                Aguarde {timeLeft}s para ordenar novamente.
              </div>
            )}
            <select 
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              disabled={isSortDisabled}
              className="w-full bg-black border-2 border-gray-800 text-gold font-black py-3 px-5 rounded-xl appearance-none cursor-pointer focus:border-gold outline-none text-xs uppercase tracking-widest transition-colors disabled:cursor-not-allowed"
            >
              <option value="kd">🏆 K/D RATIO</option>
              <option value="adr">💥 ADR</option>
              <option value="kills">🔫 KILLS</option>
              <option value="kr">💀 K/R</option>
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-gold pointer-events-none" size={18} />
          </div>

          <div className="relative min-w-[220px] w-full sm:w-auto">
            <select 
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              className="w-full bg-black border-2 border-gray-800 text-gold font-black py-3 px-5 rounded-xl appearance-none cursor-pointer focus:border-gold outline-none text-xs uppercase tracking-widest transition-colors disabled:cursor-not-allowed"
            >
              <option value="Geral">📊 ESTATÍSTICAS GERAIS</option>
              {Array.from({length: 17}, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>🔥 RODADA {num}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-3.5 text-gold pointer-events-none" size={18} />
          </div>
        </div>
      </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode="wait">
          {displayData.map((player, index) => {
            const k = Number(isGeral ? player.k : player[`r${selectedRound}_k`]) || 0;
            const d = Number(isGeral ? player.d : player[`r${selectedRound}_d`]) || 0;
            const kd = Number(isGeral ? player.kd : player[`r${selectedRound}_kd`]) || 0;
            const kr = Number(isGeral ? player.kr : player[`r${selectedRound}_kr`]) || 0;
            const adr = Number(isGeral ? player.adr : player[`r${selectedRound}_adr`]) || 0;
            const m1Link = !isGeral ? player[`r${selectedRound}_m1_link`] : null;
            const m2Link = !isGeral ? player[`r${selectedRound}_m2_link`] : null;
            
            const rawMatchResult = !isGeral ? player[`r${selectedRound}_result`] : null;
            const matchResult = rawMatchResult ? rawMatchResult.replace(' X', '') : null;
            const hasWOIndicator = rawMatchResult ? rawMatchResult.includes(' X') : false;

            const matchId = !isGeral ? player[`r${selectedRound}_m1_id`] : null;
            
            const m1K = !isGeral ? player[`r${selectedRound}_m1_k`] : undefined;
            const m2K = !isGeral ? player[`r${selectedRound}_m2_k`] : undefined;
            const m2Id = !isGeral ? player[`r${selectedRound}_m2_id`] : undefined;
            const isWO = !isGeral && (m1K === null || (m2Id && m2K === null) || hasWOIndicator);

            return (
              <motion.div
                key={`${selectedRound}-${player.nick}`}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.3, delay: (index % 20) * 0.03 }}
                className="relative"
              >
                {!filterMe && k > 0 && (
                  <div className={`absolute -top-3 -left-3 z-10 w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shadow-2xl border-2 ${
                    index === 0 ? "bg-gold text-black border-yellow-200" : 
                    index === 1 ? "bg-slate-300 text-black border-white" :
                    index === 2 ? "bg-amber-700 text-white border-amber-400" :
                    "bg-gray-900 text-gray-400 border-gray-800"
                  }`}>
                    #{index + 1}
                  </div>
                )}

                <PremiumCard hoverEffect={true}>
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
                        <h3 className="text-2xl font-black text-white italic uppercase truncate leading-none">{player.nick}</h3>
                        <div className="flex flex-col gap-1 mt-1">
                          <p className="text-gray-500 text-[10px] font-bold tracking-widest">POTE {player.pote}</p>
                          {isGeral && (
                             <p className="text-gold text-[10px] font-extrabold tracking-widest uppercase">
                               {getPlayedRounds(player)} Rodadas Jogadas
                             </p>
                          )}
                          {!isGeral && matchResult && (
                             <p className={`text-[10px] font-extrabold tracking-widest uppercase ${
                               matchResult === '2-0' ? 'text-green-500' : 
                               matchResult === '1-1' ? 'text-yellow-500' : 
                               matchResult === '0-2' ? 'text-red-500' : 'text-gray-400'
                             }`}>
                               Resultado: {matchResult} {isWO && <span className="text-red-500">W.O</span>}
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
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">ADR</p>
                        <p className="text-2xl font-black text-white">{Number(adr).toFixed(1)}</p>
                      </div>
                    </div>

                    <div className="flex justify-between mt-5 px-2">
                      <div className="text-center">
                        <span className="text-[9px] text-gray-600 font-bold uppercase block tracking-tighter">K/R</span>
                        <span className="text-lg text-gray-300 font-black">{Number(kr).toFixed(2)}</span>
                      </div>
                      <div className="text-center border-x border-white/5 px-6">
                        <span className="text-[9px] text-gray-600 font-bold uppercase block tracking-tighter">Kills</span>
                        <span className="text-lg text-gray-300 font-black">{k}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[9px] text-gray-600 font-bold uppercase block tracking-tighter">Mortes</span>
                        <span className="text-lg text-gray-300 font-black">{d}</span>
                      </div>
                    </div>

                    {!isGeral && (m1Link || m2Link) && (
                      <div className="flex justify-center gap-3 mt-5">
                        {m1Link && (
                          <a 
                            href={m1Link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#ff5500]/10 hover:bg-[#ff5500] border border-[#ff5500]/30 hover:border-[#ff5500] transition-all group/link"
                          >
                            <span className="text-[10px] font-bold text-gray-400 group-hover/link:text-white uppercase tracking-wider">Mapa 1</span>
                            <ExternalLink size={10} className="text-gray-500 group-hover/link:text-white" />
                          </a>
                        )}
                        {m2Link && (
                          <a 
                            href={m2Link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#ff5500]/10 hover:bg-[#ff5500] border border-[#ff5500]/30 hover:border-[#ff5500] transition-all group/link"
                          >
                            <span className="text-[10px] font-bold text-gray-400 group-hover/link:text-white uppercase tracking-wider">Mapa 2</span>
                            <ExternalLink size={10} className="text-gray-500 group-hover/link:text-white" />
                          </a>
                        )}
                      </div>
                    )}

                    {!isGeral && matchId && (
                      <div className="flex justify-center mt-4">
                        <a 
                          href={`https://www.faceit.com/en/cs2/room/${matchId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 bg-[#ff5500] hover:bg-[#ff5500]/90 rounded-lg transition-all shadow-lg shadow-[#ff5500]/20 group/btn"
                        >
                          <Image src="/images/faceit.png" width={16} height={16} alt="Faceit" />
                          <span className="text-[10px] font-bold text-white uppercase tracking-widest">Ir para Partida</span>
                          <ExternalLink size={12} className="text-white/70 group-hover/btn:text-white" />
                        </a>
                      </div>
                    )}
                    
                    {((isGeral && k === 0) || (!isGeral && isWO)) && (
                      <div className="mt-4 py-1 bg-red-500/5 rounded border border-red-500/10 text-center">
                        <p className="text-[9px] text-red-500/40 font-black uppercase italic tracking-widest">Inativo para MVP</p>
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

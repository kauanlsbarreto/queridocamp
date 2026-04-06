"use client"

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, ChevronLeft, ChevronRight, Crown, Medal } from "lucide-react";
import PremiumCard from "@/components/premium-card";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import AdPropaganda from "@/components/ad-propaganda";
import UpdateTimer from "@/components/update-timer";

const SPECIAL_ROLES: Record<string, { label: string; emoji: string; cardGlow: string; shimmer: string; badgeClass: string }> = {
  '0124bfce-db9e-4d4f-b3f4-b66084a8a484': {
    label: 'DONO',
    emoji: '👑',
    cardGlow: 'ring-2 ring-yellow-400/50 shadow-[0_0_40px_rgba(251,191,36,0.2)]',
    shimmer: 'from-yellow-400/10',
    badgeClass: 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black',
  },
  'fcb1b15c-f3d4-47d1-bd27-b478b7ada9ee': {
    label: 'ADMIN',
    emoji: '',
    cardGlow: 'ring-2 ring-purple-500/50 shadow-[0_0_40px_rgba(168,85,247,0.2)]',
    shimmer: 'from-purple-500/10',
    badgeClass: 'bg-gradient-to-r from-purple-500 to-violet-600 text-white',
  },
};

interface Achievement {
  tipo: string;
  count: number;
}

interface PlayerAdicionado {
  codigo: string;
  label: string;
  imagem: string;
}

interface HallItem {
  key: string;
  type: 'tipo' | 'image';
  label: string;
  tipo?: string;
  image?: string;
  count: number;
}

interface Player {
  id: number;
  nickname: string;
  avatar: string;
  faceit_guid: string;
  fundoperfil?: string;
  achievements: Achievement[];
  playerAdicionados: PlayerAdicionado[];
  punicao?: number;
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

export default function PlayersList({ initialPlayers, totalPages, currentPage, lastUpdate, search }: { initialPlayers: Player[], totalPages: number, currentPage: number, lastUpdate: string, search: string }) {
  const [faceitLevels, setFaceitLevels] = useState<Record<string, { level: number; challenger: boolean }>>({});
  const [inputValue, setInputValue] = useState(search);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => { setInputValue(search); }, [search]);

  const handleSearch = (value: string) => {
    setInputValue(value);
    startTransition(() => {
      const params = new URLSearchParams(searchParams);
      if (value.trim()) {
        params.set('search', value);
        params.delete('page');
      } else {
        params.delete('search');
      }
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  useEffect(() => {
    setFaceitLevels({});
    const fetchLevels = async () => {
      const results: Record<string, { level: number; challenger: boolean }> = {};
      await Promise.all((initialPlayers || []).map(async (player) => {
        if (!player.faceit_guid || player.id === 0) return;
        try {
          const res = await fetch(`https://open.faceit.com/data/v4/players/${player.faceit_guid}`, {
            headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
          });
          if (res.ok) {
            const data = await res.json();
            results[String(player.id)] = {
              level: data.games?.cs2?.skill_level || 0,
              challenger: data.games?.cs2?.skill_level === 10 && data.faceit_rank <= 1000,
            };
          }
        } catch (e) { /* skip */ }
      }));
      setFaceitLevels(results);
    };
    fetchLevels();
  }, [initialPlayers]);

  const players = initialPlayers
    .map(p => ({
      ...p,
      faceit_level: faceitLevels[String(p.id)]?.level ?? p.faceit_level,
      is_challenger: faceitLevels[String(p.id)]?.challenger ?? p.is_challenger,
    }))
    .sort((a, b) => {
      const roleA = SPECIAL_ROLES[a.faceit_guid || ''] ? 1 : 0;
      const roleB = SPECIAL_ROLES[b.faceit_guid || ''] ? 1 : 0;
      return roleB - roleA;
    });

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
                value={inputValue}
                onChange={(e) => handleSearch(e.target.value)}
             />
          </div>
       </div>

       <UpdateTimer lastUpdate={lastUpdate} />

       <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 ${isPending ? 'opacity-60' : ''} transition-opacity`}>
          {players.map((player) => {
            const allItems: HallItem[] = [];
            const role = SPECIAL_ROLES[player.faceit_guid || ''] || null;
            const rawCardBackground = typeof player.fundoperfil === 'string' ? player.fundoperfil.trim() : '';
            const cardBackground = rawCardBackground
              ? (rawCardBackground.startsWith('/public/') ? rawCardBackground.replace('/public/', '/') : rawCardBackground)
              : '';

            for (const ach of (player.achievements || [])) {
              allItems.push({
                key: `tipo-${ach.tipo}`,
                type: 'tipo',
                label: ach.tipo,
                tipo: ach.tipo,
                count: ach.count,
              });
            }

            for (const ad of (player.playerAdicionados || [])) {
              if (ad.imagem) {
                allItems.push({
                  key: `ad-${ad.codigo}`,
                  type: 'image',
                  image: ad.imagem,
                  label: ad.label,
                  count: 1,
                });
              }
            }

            // Punição: mostra 1, 2 ou 3 imagens, label só na última
            let punicao = player.punicao;
            let iconSize = player.nickname && player.nickname.length > 10 ? 16 : 20;
            let punicaoContent = null;
            if (punicao === 1) {
              punicaoContent = (
                <div className="flex items-center">
                  <div className="relative group">
                    <img src="/queridafila/punicao.png" alt="Aviso" width={iconSize} height={iconSize} />
                    <span className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 hidden group-hover:block px-2 py-1 rounded bg-black/90 text-yellow-400 text-[10px] font-bold uppercase whitespace-nowrap shadow-lg border border-yellow-400">
                      AVISO
                    </span>
                  </div>
                </div>
              );
            } else if (punicao === 2) {
              punicaoContent = (
                <div className="flex items-center gap-1">
                  <img src="/queridafila/punicao.png" alt="Aviso" width={iconSize} height={iconSize} />
                  <div className="relative group">
                    <img src="/queridafila/punicao.png" alt="Ban 3 Dias" width={iconSize} height={iconSize} />
                    <span className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 hidden group-hover:block px-2 py-1 rounded bg-black/90 text-red-500 text-[10px] font-bold uppercase whitespace-nowrap shadow-lg border border-red-500">
                      Ban 3 Dias
                    </span>
                  </div>
                </div>
              );
            } else if (punicao === 3) {
              punicaoContent = (
                <div className="flex items-center gap-1">
                  <img src="/queridafila/punicao.png" alt="Aviso" width={iconSize} height={iconSize} />
                  <img src="/queridafila/punicao.png" alt="Ban 3 Dias" width={iconSize} height={iconSize} />
                  <div className="relative group">
                    <img src="/queridafila/punicao.png" alt="Ban 7 Dias" width={iconSize} height={iconSize} />
                    <span className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 hidden group-hover:block px-2 py-1 rounded bg-black/90 text-red-700 text-[10px] font-bold uppercase whitespace-nowrap shadow-lg border border-red-700">
                      Ban 7 Dias
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <Link href={`/perfil/${player.id}`} key={player.id} className="group">
                <PremiumCard className={`hover:scale-[1.02] transition-all duration-300 shadow-xl ${role ? `${role.cardGlow} border-transparent` : 'border-white/5 group-hover:border-gold/30'}`}>
                  <div
                    className="p-5 flex items-center gap-5 relative overflow-hidden"
                    style={cardBackground
                      ? {
                          backgroundImage: `linear-gradient(rgba(6,13,21,0.72), rgba(6,13,21,0.88)), url(${cardBackground})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: 'no-repeat',
                        }
                      : undefined}
                  >
                    {role && (
                      <div className={`absolute inset-0 bg-gradient-to-r ${role.shimmer} to-transparent pointer-events-none`} />
                    )}

                    {/* Avatar */}
                    <div className="relative w-20 h-20 flex-shrink-0">
                      <div className="absolute inset-0 bg-gold/10 group-hover:bg-gold/20 blur-xl rounded-full transition-colors" />
                      <div className="relative w-full h-full rounded-full border-2 border-white/10 bg-black/40 group-hover:border-gold/50 transition-all overflow-hidden">
                        <Image
                          src={player.avatar || "/images/cs2-player.png"}
                          alt={player.nickname}
                          fill
                          className="rounded-full object-cover"
                          unoptimized
                        />
                      </div>
                      {role && (
                        <div className="absolute -top-1 -right-1 z-10 text-xl leading-none drop-shadow-lg">
                          {role.emoji}
                        </div>
                      )}
                      {/* Punição */}
                      {/* punicaoContent removido daqui para evitar duplicidade */}
                    </div>

                    {/* Name + Level */}
                    <div className="flex-1 min-w-0 flex flex-col items-start">
                      {role && (
                        <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full mb-1 ${role.badgeClass}`}>
                          {role.emoji} {role.label}
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1">
                          <h3 className="text-lg font-black text-white italic uppercase tracking-tighter truncate group-hover:text-gold transition-colors">
                            {player.nickname}
                          </h3>
                        </span>
                        {punicaoContent}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <img
                          src={player.id === 0 ? "/faceitlevel/-1.png" : (player.is_challenger ? "/faceitlevel/challenger.png" : `/faceitlevel/${player.faceit_level || 1}.png`)}
                          alt="Level"
                          className="w-6 h-6"
                        />
                        <span className="text-sm font-black text-gold italic">
                          {player.id === 0 ? 'Level -1' : `Level ${player.faceit_level || '...'}`}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-600 font-mono uppercase mt-1">ID: {player.id}</p>
                    </div>

                    {/* Achievements */}
                    {allItems.length > 0 && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[130px] flex-shrink-0">
                        {allItems.map((item) => {
                          const tipoUpper = String(item.tipo || '').toUpperCase();
                          const isMvp = tipoUpper === 'MVP';
                          const isVice = tipoUpper.includes('VICE');
                          const iconColor = isVice ? 'text-cyan-300' : 'text-amber-400';

                          return (
                            <div key={item.key} className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-white/5 border border-white/10" title={item.label}>
                              {item.type === 'image' ? (
                                <div className="relative w-7 h-7 flex-shrink-0">
                                  <Image src={item.image || ''} alt={item.label} fill className="object-contain" unoptimized />
                                </div>
                              ) : (
                                <>
                                  <div className={iconColor}>
                                    {isMvp ? <Medal size={18} /> : <Crown size={18} />}
                                  </div>
                                  <span className="text-[11px] font-black text-white/90">x{item.count}</span>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                </PremiumCard>
              </Link>
            );
          })}
       </div>
       <Pagination totalPages={totalPages} currentPage={currentPage} />
    </div>
  )
}
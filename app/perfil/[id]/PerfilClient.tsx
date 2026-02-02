"use client"

import { useState, useEffect } from 'react';
import Image from 'next/image';
import PremiumCard from '@/components/premium-card';
import { Button } from '@/components/ui/button';
import { Trophy, Crown, Medal, Ticket } from 'lucide-react';
import PlayerMatches from './PlayerMatches';

export default function PerfilClient({ player, initialConquistas, upcomingMatches, teamName }: { player: any, initialConquistas: any[], upcomingMatches?: any[], teamName?: string }) {
    const [codigo, setCodigo] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<{msg: string, type: 'success' | 'error'} | null>(null);
    const [conquistas, setConquistas] = useState(initialConquistas);
    const [faceitLevel, setFaceitLevel] = useState<number | null>(null);
    const [isChallenger, setIsChallenger] = useState(false);

    useEffect(() => {
        const fetchLevel = async () => {
            if (player?.faceit_guid) {
                try {
                    const res = await fetch(`https://open.faceit.com/data/v4/players/${player.faceit_guid}`, {
                        headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.games?.cs2?.skill_level) {
                            setFaceitLevel(data.games.cs2.skill_level);

                            if (data.games.cs2.skill_level === 10 && data.games.cs2.region) {
                                try {
                                    const rankRes = await fetch(`https://open.faceit.com/data/v4/rankings/games/cs2/regions/${data.games.cs2.region}/players/${player.faceit_guid}`, {
                                        headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
                                    });
                                    if (rankRes.ok) {
                                        const rankData = await rankRes.json();
                                        if (rankData.position && rankData.position <= 1000) {
                                            setIsChallenger(true);
                                        }
                                    }
                                } catch (e) {
                                    console.error("Failed to fetch rank", e);
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error("Failed to fetch Faceit level", error);
                }
            }
        };
        fetchLevel();
    }, [player]);

    const handleResgatar = async () => {
        if (!codigo) return;
        setLoading(true);
        setStatus(null);
        try {
            const res = await fetch('/api/conquistas/resgatar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ codigo: codigo.trim(), playerId: player.id }),
            });
            const data = await res.json();
            if (res.ok) {
                setStatus({ msg: 'Conquista resgatada!', type: 'success' });
                setCodigo('');
                setConquistas(prev => [data.novaConquista, ...prev]);
            } else {
                setStatus({ msg: data.message || 'Código inválido', type: 'error' });
            }
        } catch (err) {
            setStatus({ msg: 'Erro na conexão', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] pt-24 pb-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <div className="sticky top-24">
                            <PremiumCard>
                                <div className="p-8 flex flex-col items-center text-center">
                                    <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-gold mb-6">
                                        <Image 
                                            src={player?.avatar || '/images/cs2-player.png'} 
                                            alt={player?.nickname || "Player"} 
                                            fill 
                                            className="object-cover" 
                                            unoptimized 
                                        />
                                    </div>
                                    <h1 className="text-3xl font-black text-white uppercase italic tracking-wider mb-2">
                                        {player?.nickname}
                                    </h1>
                                    
                                    {faceitLevel && (
                                        <div className="mb-4 flex justify-center" title={`Faceit Level ${faceitLevel}`}>
                                            <img 
                                                src={player.id === 1 ? "/faceitlevel/-1.png" : (isChallenger ? "/faceitlevel/challenger.png" : `/faceitlevel/${faceitLevel}.png`)} 
                                                alt={`Level ${faceitLevel}`} 
                                                width={36} 
                                                height={36} 
                                            />
                                        </div>
                                    )}
                                    
                                    {/* O ID DE VOLTA AQUI */}
                                    <p className="text-sm text-zinc-500 font-mono mb-6 uppercase tracking-tighter">
                                        Querido ID: {player?.id}
                                    </p>
                                    
                                    <Button asChild className="w-full bg-[#ff5500] hover:bg-[#e04b00] text-white font-bold py-6 rounded-xl mb-4">
                                        <a href={`https://www.faceit.com/pt/players/${player?.nickname}`} target="_blank">
                                            Perfil Faceit
                                        </a>
                                    </Button>

                                    <div className="w-full pt-4 border-t border-white/10 mt-2">
                                        <label className="text-[10px] text-zinc-400 uppercase font-black tracking-widest mb-3 block">
                                            Resgatar:
                                        </label>
                                        <div className="flex flex-col gap-2">
                                            <input 
                                                type="text" 
                                                value={codigo} 
                                                onChange={(e) => setCodigo(e.target.value)}
                                                placeholder="DIGITE O CÓDIGO" 
                                                className="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:border-gold/50 outline-none uppercase font-mono text-center"
                                            />
                                            <Button 
                                                onClick={handleResgatar} 
                                                disabled={loading} 
                                                className="bg-gold hover:bg-gold/80 text-black font-black uppercase text-xs py-5 rounded-lg flex gap-2"
                                            >
                                                <Ticket size={16} />
                                                {loading ? 'Validando...' : 'Colocar código'}
                                            </Button>
                                            {status && (
                                                <p className={`text-[10px] font-bold uppercase mt-2 ${status.type === 'success' ? 'text-green-400' : 'text-red-500'}`}>
                                                    {status.msg}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </PremiumCard>

                            <div className="mt-6">
                                <PremiumCard>
                                    <div className="p-6">
                                        <div className="flex items-center justify-center gap-2 mb-6 text-gold">
                                            <Trophy size={20} />
                                            <h3 className="text-lg font-bold uppercase tracking-widest">Hall da Fama</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {conquistas.length > 0 ? (
                                                conquistas.map((conq, i) => {
                                                    const isVice = conq.nome.toUpperCase().startsWith('VICE');
                                                    return (
                                                        <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4 hover:border-gold/40 transition-all">
                                                            <div className={isVice ? "text-blue-400" : "text-gold"}>
                                                                {conq.tipo === 'MVP' ? <Medal size={28} /> : <Crown size={28} />}
                                                            </div>
                                                            <div className="text-left">
                                                                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isVice ? "text-blue-400 bg-blue-400/10" : "text-gold bg-gold/10"}`}>
                                                                    {conq.tipo}
                                                                </span>
                                                                <p className="text-white font-bold text-sm uppercase mt-1">{conq.nome}</p>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="text-center text-[10px] text-zinc-500 uppercase font-bold py-4">Sem troféus ainda</p>
                                            )}
                                        </div>
                                    </div>
                                </PremiumCard>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                        <PlayerMatches 
                            faceitId={player?.faceit_guid} 
                            upcomingMatches={upcomingMatches} 
                            teamName={teamName} 
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
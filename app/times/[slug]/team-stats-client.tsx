"use client"
import { useEffect, useState } from 'react';
import Image from 'next/image';
import PremiumCard from '@/components/premium-card';

export default function TeamStatsClient({ team }: { team: any }) {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeamStats = async () => {
            try {
                const allPlayersStats = await Promise.all(
                    team.players.map(async (p: any) => {
                        if (!p.faceit_guid) return null;
                        const res = await fetch(`https://open.faceit.com/data/v4/players/${p.faceit_guid}/stats/cs2`, {
                            headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
                        });
                        return res.ok ? await res.json() : null;
                    })
                );

                const validStats = allPlayersStats.filter(s => s !== null);
                const mapStats: any = {};

                validStats.forEach(pStats => {
                    pStats.segments.forEach((seg: any) => {
                        if (seg.mode === '5v5') {
                            if (!mapStats[seg.label]) mapStats[seg.label] = { wins: 0, matches: 0 };
                            mapStats[seg.label].wins += parseInt(seg.stats.Wins);
                            mapStats[seg.label].matches += parseInt(seg.stats.Matches);
                        }
                    });
                });

                setStats(mapStats);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchTeamStats();
    }, [team]);

    if (loading) return <div className="text-gold text-center py-20 animate-pulse font-black italic">CARREGANDO DADOS DA FACEIT...</div>;

    return (
        <div className="container mx-auto px-4 py-12 text-white">
            <div className="flex items-center gap-6 mb-12">
                <Image src={team.image} alt={team.name} width={100} height={100} className="rounded-xl border-2 border-gold/50" />
                <h1 className="text-5xl font-black italic uppercase tracking-tighter text-white">{team.name}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Win Rate por Mapa */}
                <PremiumCard>
                    <div className="p-6">
                        <h2 className="text-xl font-black italic uppercase text-gold mb-6 border-b border-gold/20 pb-2">Performance por Mapa</h2>
                        <div className="space-y-4">
                            {Object.entries(stats || {}).map(([map, data]: any) => {
                                const winRate = ((data.wins / data.matches) * 100).toFixed(1);
                                return (
                                    <div key={map} className="flex flex-col">
                                        <div className="flex justify-between text-xs font-bold mb-1 uppercase italic">
                                            <span>{map}</span>
                                            <span className="text-gold">{winRate}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                                            <div 
                                                className="bg-gold h-full transition-all duration-1000" 
                                                style={{ width: `${winRate}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PremiumCard>

                {/* Análise Tática */}
                <PremiumCard>
                    <div className="p-6">
                        <h2 className="text-xl font-black italic uppercase text-gold mb-6 border-b border-gold/20 pb-2">Análise Tática</h2>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <span className="text-zinc-500 font-bold uppercase text-sm">Mapa Favorito</span>
                                <span className="text-xl font-black italic text-white">
                                    {Object.entries(stats || {}).sort((a: any, b: any) => b[1].matches - a[1].matches)[0]?.[0] || 'N/A'}
                                </span>
                            </div>
                            <div className="text-center">
                                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Baseado nos últimos jogos da Faceit dos membros</p>
                            </div>
                        </div>
                    </div>
                </PremiumCard>
            </div>
        </div>
    );
}
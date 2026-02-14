"use client"
import { useEffect, useState } from 'react';
import Image from 'next/image';
import PremiumCard from '@/components/premium-card';
import StatsList from '@/app/stats/stats-list';
import { Trophy, Map as MapIcon, TrendingUp, AlertTriangle } from 'lucide-react';

const API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
const HUB_IDS = [
    "fdd5221c-408c-4148-bc63-e2940da4a490",
    "04a14d7f-0511-451b-8208-9a6c3215ccaa"
];
const START_TIMESTAMP = 1769308800;

const MAP_IMAGES: Record<string, string> = {
  de_mirage: "https://static.draft5.gg/news/2023/03/23112933/Bomb-A-Mirage-CS-2.jpg",
  de_inferno: "https://static.draft5.gg/news/2025/03/31221125/Banana-Inferno-CS2-31.03.2025.jpg",
  de_overpass: "https://esportsinsider.com/wp-content/uploads/2025/07/esl-blast-map-pool-update-july-2025.jpg",
  de_nuke: "https://static.draft5.gg/news/2023/03/23114203/Bomb-B-Nuke-CS-2.jpg",
  de_ancient: "https://static.draft5.gg/news/2023/03/23114157/Bomb-B-Ancient-CS-2.jpg",
  de_anubis: "https://static.draft5.gg/news/2023/06/07112727/Anubis-CS2.jpg",
  de_dust2: "https://static.draft5.gg/news/2023/04/04161748/dust2_ct_ramp_Cs2.jpg",
};

export default function TeamStatsClient({ team }: { team: any }) {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTeamStats = async () => {
            try {
                const allHistories = await Promise.all(
                    team.players.map(async (p: any) => {
                        if (!p.faceit_guid) return null;
                        const res = await fetch(`https://open.faceit.com/data/v4/players/${p.faceit_guid}/history?game=cs2&from=${START_TIMESTAMP}&limit=50`, {
                            headers: { 'Authorization': `Bearer ${API_KEY}` }
                        });
                        if (!res.ok) return null;
                        const data = await res.json();
                        return { player_id: p.faceit_guid, items: data.items };
                    })
                );

                const validHistories = allHistories.filter(h => h !== null);
                const mapStats: any = {};
                const vetoStats: any = {};
                const matchStats = { wins: 0, losses: 0, draws: 0, total: 0 };
                const processedMatches = new Set();

                validHistories.forEach((history: any) => {
                    history.items.forEach((match: any) => {
                        if (HUB_IDS.includes(match.competition_id)) {
                            if (!processedMatches.has(match.match_id)) {
                                processedMatches.add(match.match_id);
                            }
                        }
                    });
                });
                
                const uniqueMatchIds = Array.from(processedMatches);
                const matchDetailsPromises = uniqueMatchIds.map(id => 
                    fetch(`https://open.faceit.com/data/v4/matches/${id}`, {
                        headers: { 'Authorization': `Bearer ${API_KEY}` }
                    }).then(r => r.json())
                );
                
                const matchesDetails = await Promise.all(matchDetailsPromises);
                
                matchesDetails.forEach((m: any) => {
                    if (!m || !m.voting) return;
                    
                    let mapName = "Unknown";
                    if (m.voting?.map?.pick && m.voting.map.pick.length > 0) {
                        mapName = m.voting.map.pick[0];
                    } else if (m.maps && m.maps.length > 0) {
                        mapName = m.maps[0];
                    }
                    
                    if (!mapStats[mapName]) mapStats[mapName] = { wins: 0, matches: 0 };
                    mapStats[mapName].matches++;
                    
                    const teamPlayerIds = team.players.map((p: any) => p.faceit_guid);
                    const faction1Ids = m.teams.faction1.roster.map((p: any) => p.player_id);
                    
                    const isFaction1 = faction1Ids.some((id: string) => teamPlayerIds.includes(id));
                    const winner = m.results?.winner;
                    
                    const score1 = Number(m.results?.score?.faction1 || 0);
                    const score2 = Number(m.results?.score?.faction2 || 0);
                    const myScore = isFaction1 ? score1 : score2;
                    const enemyScore = isFaction1 ? score2 : score1;

                    matchStats.total++;
                    if (myScore > enemyScore) matchStats.wins++;
                    else if (myScore < enemyScore) matchStats.losses++;
                    else matchStats.draws++;
                    
                    if ((isFaction1 && winner === 'faction1') || (!isFaction1 && winner === 'faction2')) {
                        mapStats[mapName].wins++;
                    }

                    // Captura os vetos seguindo a estrutura da API: voting -> map -> veto
                    if (m.voting?.map?.veto && Array.isArray(m.voting.map.veto)) {
                        // Assume que a Faction 1 bane no índice 0 e Faction 2 no índice 1 (padrão Faceit)
                        const firstBanIndex = isFaction1 ? 0 : 1;
                        const firstBanMap = m.voting.map.veto[firstBanIndex];
                        if (firstBanMap) {
                            if (!vetoStats[firstBanMap]) vetoStats[firstBanMap] = 0;
                            vetoStats[firstBanMap]++;
                        }
                    }
                });

                setStats({ mapStats, vetoStats, matchStats });
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchTeamStats();
    }, [team]);

    if (loading) return <div className="text-gold text-center py-20 animate-pulse font-black italic">CARREGANDO DADOS DA FACEIT...</div>;

    const { mapStats, vetoStats, matchStats } = stats || { 
        mapStats: {}, 
        vetoStats: {}, 
        matchStats: { wins: 0, losses: 0, draws: 0, total: 0 } 
    };

    const sortedMaps = Object.entries(mapStats).sort((a: any, b: any) => b[1].matches - a[1].matches);
    const mostPlayedMap = sortedMaps[0];
    
    const sortedVetos = Object.entries(vetoStats).sort((a: any, b: any) => b[1] - a[1]);
    let mostBannedMap = sortedVetos.length > 0 ? sortedVetos[0] : null;
    let banLabel = "Mapa Mais Banido";

    // Fallback: Se não houver dados de veto, usar o mapa menos jogado (ou nunca jogado)
    if (!mostBannedMap) {
        const allMaps = Object.keys(MAP_IMAGES);
        const sortedByPlayed = allMaps.sort((a, b) => {
            return (mapStats[a]?.matches || 0) - (mapStats[b]?.matches || 0);
        });
        mostBannedMap = [sortedByPlayed[0], 0];
        banLabel = "Menos Jogado (Provável Ban)";
    }
    
    const bestPlayer = team.tournamentStats?.reduce((prev: any, current: any) => {
        return (parseFloat(current.kd) > parseFloat(prev.kd)) ? current : prev;
    }, { kd: 0, nick: 'N/A' });

    const winRateTotal = matchStats.total > 0 ? ((matchStats.wins / matchStats.total) * 100).toFixed(0) : 0;

    return (
        <div className="container mx-auto px-4 py-12 text-white">
            <div className="flex flex-col md:flex-row items-center gap-8 mb-16 bg-white/5 p-8 rounded-3xl border border-white/10">
                <div className="relative w-32 h-32 md:w-40 md:h-40">
                    <div className="absolute inset-0 bg-gold/20 blur-3xl rounded-full" />
                    <Image src={team.image} alt={team.name} fill className="object-contain drop-shadow-2xl" />
                </div>
                <div className="text-center md:text-left">
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-white mb-2">{team.name}</h1>
                    <p className="text-gold font-bold tracking-widest uppercase text-sm">Perfil Oficial do Time</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                <PremiumCard>
                    <div className="p-6 flex flex-col items-center text-center h-full justify-center">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4 text-green-500">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">Win Rate Geral</h3>
                        <p className="text-4xl font-black text-white italic">{winRateTotal}%</p>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">
                            {matchStats.wins} Vitórias 
                            {matchStats.draws > 0 && ` / ${matchStats.draws} Empates`} 
                            / {matchStats.losses} Derrotas
                        </p>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6 flex flex-col items-center text-center h-full justify-center">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 text-blue-500">
                            <MapIcon size={24} />
                        </div>
                        <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">Mapa Mais Pickado</h3>
                        <p className="text-3xl font-black text-white italic uppercase">{mostPlayedMap ? mostPlayedMap[0] : 'N/A'}</p>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">
                            {mostPlayedMap ? `${(mostPlayedMap[1] as any).matches} Partidas` : '-'}
                        </p>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6 flex flex-col items-center text-center h-full justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 text-red-500">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">First Ban (Provável)</h3>
                        <p className="text-3xl font-black text-white italic uppercase">{mostBannedMap ? mostBannedMap[0].replace('de_', '') : 'N/A'}</p>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">{banLabel}</p>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6 flex flex-col items-center text-center h-full justify-center">
                        <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center mb-4 text-gold">
                            <Trophy size={24} />
                        </div>
                        <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">Destaque do Time</h3>
                        <p className="text-3xl font-black text-white italic uppercase truncate w-full">{bestPlayer.nick}</p>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">K/D: {Number(bestPlayer.kd).toFixed(2)}</p>
                    </div>
                </PremiumCard>
            </div>

            <div className="mb-16">
                <h2 className="text-3xl font-black italic uppercase text-gold mb-8 border-l-4 border-gold pl-4">Estatísticas do Elenco</h2>
                {team.tournamentStats && team.tournamentStats.length > 0 ? (
                    <StatsList allStats={team.tournamentStats} />
                ) : (
                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-zinc-500 font-bold uppercase">Nenhuma estatística de torneio encontrada para este time.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <PremiumCard>
                    <div className="p-6">
                        <h2 className="text-xl font-black italic uppercase text-gold mb-6 border-b border-gold/20 pb-2">Win Rate por Mapa</h2>
                        <div className="space-y-4">
                            {Object.keys(MAP_IMAGES).map((mapName) => {
                                const data = mapStats[mapName] || { wins: 0, matches: 0 };
                                const matches = data.matches;
                                const wins = data.wins;
                                const losses = matches - wins;
                                
                                const winRate = matches > 0 ? ((wins / matches) * 100).toFixed(0) : 0;
                                const lossRate = matches > 0 ? ((losses / matches) * 100).toFixed(0) : 0;

                                return (
                                    <div key={mapName} className="relative h-24 rounded-xl overflow-hidden border border-white/10 group">
                                        <Image 
                                            src={MAP_IMAGES[mapName]} 
                                            alt={mapName} 
                                            fill 
                                            className="object-cover opacity-20 group-hover:opacity-40 transition-all duration-500" 
                                        />
                                        
                                        <div className="absolute inset-0 flex flex-col justify-center px-5 z-10">
                                            <span className="text-lg font-black text-white uppercase italic tracking-tighter mb-2 drop-shadow-lg">
                                                {mapName.replace('de_', '')}
                                            </span>

                                            <div className="flex justify-between items-end">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Jogos / Win Rate</span>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl font-black text-white">{matches}</span>
                                                        <span className="text-xs font-bold text-green-500">{winRate}%</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Derrotas / Loss Rate</span>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl font-black text-white">{losses}</span>
                                                        <span className="text-xs font-bold text-red-500">{lossRate}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="w-full h-1 bg-white/5 mt-2 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-green-500" style={{ width: `${winRate}%` }} />
                                                <div className="h-full bg-red-500" style={{ width: `${lossRate}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6">
                        <h2 className="text-xl font-black italic uppercase text-gold mb-6 border-b border-gold/20 pb-2">Análise Tática</h2>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <span className="text-zinc-500 font-bold uppercase text-sm">Mapa Mais Jogado</span>
                                <span className="text-xl font-black italic text-white">
                                    {Object.entries(mapStats).sort((a: any, b: any) => b[1].matches - a[1].matches)[0]?.[0] || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <span className="text-zinc-500 font-bold uppercase text-sm">Melhor Win Rate</span>
                                <span className="text-xl font-black italic text-green-400">
                                    {Object.entries(mapStats).sort((a: any, b: any) => (b[1].wins/b[1].matches) - (a[1].wins/a[1].matches))[0]?.[0] || 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>
                </PremiumCard>
            </div>
        </div>
    );
}
"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"

interface MatchDetails {
    match_id: string;
    status: string;
    game: string;
    teams: { 
        faction1: { name: string; avatar: string }; 
        faction2: { name: string; avatar: string } 
    };
    results?: {
        score: { faction1: number; faction2: number };
    };
    stats?: {
        rounds: {
            round_stats: {
                Map: string;
                Score: string;
            }
        }[]
    };
    voting?: {
        map?: {
            pick?: string[];
        };
    };
    maps?: string[];
}

const API_KEY_FACEIT = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

export default function MatchOverlay() {
    const params = useParams();
    const matchId = params.matchid as string;
    const [match, setMatch] = useState<MatchDetails | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMatch = useCallback(async () => {
        try {
            const res = await fetch(
                `https://open.faceit.com/data/v4/matches/${matchId}`,
                { headers: { 'Authorization': `Bearer ${API_KEY_FACEIT}` } }
            );
            if (!res.ok) throw new Error('Failed to fetch match');
            const matchData = await res.json();

            try {
                const statsRes = await fetch(
                    `https://open.faceit.com/data/v4/matches/${matchId}/stats`,
                    { headers: { 'Authorization': `Bearer ${API_KEY_FACEIT}` } }
                );
                if (statsRes.ok) {
                    const stats = await statsRes.json();
                    setMatch({ ...matchData, stats });
                } else {
                    setMatch(matchData);
                }
            } catch (e) {
                console.error("Erro ao buscar stats:", e);
                setMatch(matchData);
            }
            
            setLoading(false);
        } catch (e) {
            console.error("Erro ao buscar partida:", e);
            setLoading(false);
        }
    }, [matchId]);

    useEffect(() => {
        fetchMatch();
        
        const interval = setInterval(fetchMatch, 10000);
        return () => clearInterval(interval);
    }, [fetchMatch]);

    if (loading || !match) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center">
                <div className="text-gold text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold mx-auto mb-4"></div>
                    <p>Carregando...</p>
                </div>
            </div>
        );
    }

    const finishedMapsCount = match.stats?.rounds?.length || 0;
    const resultScore = match.results?.score || { faction1: 0, faction2: 0 };

    let currentMapScore = "-";
    let currentMapLabel = "ROUNDS";
    
    if (match.stats?.rounds && match.stats.rounds.length > 0 && match.status === 'ONGOING' && finishedMapsCount < 2) {
        const currentMapIndex = finishedMapsCount;
        const currentMapStats = match.stats.rounds[currentMapIndex]?.round_stats;
        if (currentMapStats?.Score) {
            currentMapScore = currentMapStats.Score.replace(" / ", " - ");
            currentMapLabel = `MAPA ${finishedMapsCount + 2}`;
        }
    } else {
        currentMapScore = `${resultScore.faction1} - ${resultScore.faction2}`;
    }

    return (
        <div className="w-full min-h-screen bg-gradient-to-b from-black via-gray-900 to-black overflow-hidden">
            <div className="absolute inset-0 opacity-50">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
            </div>

            <div className="relative w-full h-screen flex flex-col items-center justify-center p-8">
                <div className="w-full max-w-4xl">
                    <div className="flex items-center justify-center mb-8">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold uppercase text-sm tracking-wider ${
                            match.status === 'READY' 
                                ? 'bg-blue-600/30 text-blue-300 border border-blue-500/50' 
                                : 'bg-red-600/30 text-red-300 border border-red-500/50'
                        }`}>
                            <div className={`w-2.5 h-2.5 rounded-full ${
                                match.status === 'READY' ? 'bg-blue-500' : 'bg-red-600 animate-pulse'
                            }`}></div>
                            {match.status === 'READY' ? '⏳ Pronto para começar' : '🔴 AO VIVO'}
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-6 items-center">
                        <div className="flex flex-col items-center gap-4 text-center transform hover:scale-105 transition-transform duration-300">
                            <div className="w-32 h-32 relative rounded-2xl overflow-hidden border-4 border-gold/40 shadow-2xl shadow-gold/20 ring-2 ring-gold/20">
                                <Image 
                                    src={match.teams.faction1.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"} 
                                    alt={match.teams.faction1.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tight line-clamp-2 max-w-xs">
                                    {match.teams.faction1.name}
                                </h2>
                                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Time 1</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-center gap-6 py-8">
                            <div className="text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">
                                    {currentMapLabel}
                                </p>
                                <div className="bg-gradient-to-br from-black via-gray-950 to-black rounded-2xl border-2 border-gold/60 p-6 shadow-2xl shadow-gold/20 min-w-[180px]">
                                    <p className="text-6xl font-black text-gold tabular-nums leading-none">
                                        {currentMapScore}
                                    </p>
                                </div>
                            </div>

                            {match.stats?.rounds && match.stats.rounds.length > 0 && (
                                <div className="flex flex-col gap-2">
                                    {match.stats.rounds.slice(0, 3).map((round, idx) => {
                                        const mapName = round.round_stats?.Map || `Mapa ${idx + 1}`;
                                        const score = round.round_stats?.Score.replace(" / ", " - ") || "-";
                                        const isCurrent = idx === finishedMapsCount && match.status === 'ONGOING';
                                        
                                        return (
                                            <div 
                                                key={idx} 
                                                className={`px-4 py-2 rounded-lg border text-sm font-bold uppercase transition-all ${
                                                    isCurrent 
                                                        ? 'bg-gold/20 border-gold/60 text-gold shadow-lg shadow-gold/30' 
                                                        : 'bg-gray-900/50 border-gray-700/50 text-gray-300'
                                                }`}
                                            >
                                                <div className="flex justify-between gap-4">
                                                    <span>{mapName.replace('de_', '')}</span>
                                                    <span>{score}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Time 2 */}
                        <div className="flex flex-col items-center gap-4 text-center transform hover:scale-105 transition-transform duration-300">
                            <div className="w-32 h-32 relative rounded-2xl overflow-hidden border-4 border-gold/40 shadow-2xl shadow-gold/20 ring-2 ring-gold/20">
                                <Image 
                                    src={match.teams.faction2.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"} 
                                    alt={match.teams.faction2.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tight line-clamp-2 max-w-xs">
                                    {match.teams.faction2.name}
                                </h2>
                                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Time 2</p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center text-gray-600 text-xs uppercase tracking-wider">
                        <p>Querido Camp • {match.game?.toUpperCase()} • Match ID: {matchId.slice(0, 8)}...</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

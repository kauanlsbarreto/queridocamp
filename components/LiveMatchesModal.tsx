"use client"

import { useEffect, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader, ExternalLink } from "lucide-react"
import Image from "next/image"

// --- Configurações das Streams ---
const STREAMS_CONFIG = {
    youtube: {
        url: "https://www.youtube.com/@SMK_T1/streams",
        img: "https://m.media-amazon.com/images/I/31Ue93HLLgL.png"
    },
    twitch1: {
        name: "TV Querido Camp",
        url: "https://www.twitch.tv/tvqueridocamp",
        img: "https://cdn.m7g.twitch.tv/ba46b4e5e395b11efd34/assets/uploads/core-header.png?h=600&w=1200"
    },
    twitch2: {
        name: "Querido Camp",
        url: "https://www.twitch.tv/queridocamp",
        img: "https://cdn.m7g.twitch.tv/ba46b4e5e395b11efd34/assets/uploads/core-header.png?h=600&w=1200"
    }
}

interface MatchDetails {
    match_id: string;
    status: string;
    game: string;
    best_of?: number;
    teams: { 
        faction1: { name: string; avatar: string }; 
        faction2: { name: string; avatar: string } 
    };
    results?: {
        score: { faction1: number; faction2: number };
    };
    detailed_results?: {
        factions?: {
            faction1?: { score?: number };
            faction2?: { score?: number };
        };
    }[];
    voting?: {
        map?: {
            pick?: string[];
        };
    };
    maps?: string[];
}

interface ScheduledMatch {
    id: string;
    team1: { name: string; avatar: string };
    team2: { name: string; avatar: string };
    scheduled_time: string; // ISO string
    live_platform?: 'youtube' | 'twitch1' | 'twitch2';
}

const API_KEY_FACEIT = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

const HUB_IDS = [
    "fdd5221c-408c-4148-bc63-e2940da4a490",
    "04a14d7f-0511-451b-8208-9a6c3215ccaa"
];

export default function LiveMatchesModal() {
    const [internalOpen, setInternalOpen] = useState(false);
    const [matches, setMatches] = useState<MatchDetails[]>([]);
    const [scheduledMatches, setScheduledMatches] = useState<ScheduledMatch[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isYoutubeLive] = useState(true);
    const [isTwitch1Live] = useState(true);
    const [isTwitch2Live] = useState(true);

    const fetchScheduledMatches = useCallback(async () => {
        try {
            const res = await fetch('/api/scheduled-matches');
            if (!res.ok) throw new Error('Failed to fetch scheduled matches');
            const data = await res.json();

            const now = new Date();
            const formattedMatches = data
                .filter((match: any) => new Date(match.scheduled_time) > now)
                .map((match: any) => ({
                id: match.id.toString(),
                team1: { name: match.team1_name, avatar: match.team1_avatar },
                team2: { name: match.team2_name, avatar: match.team2_avatar },
                scheduled_time: match.scheduled_time,
                live_platform: match.live_platform,
            }));
            setScheduledMatches(formattedMatches);
        } catch (error) {
            console.error("Error fetching scheduled matches:", error);
            setScheduledMatches([]);
        }
    }, []);

    const fetchFaceitMatches = useCallback(async () => {
        setLoading(true);
        try {
            const hubPromises = HUB_IDS.map(hubId => 
                fetch(`https://open.faceit.com/data/v4/hubs/${hubId}/matches?type=ongoing&limit=15`, {
                    headers: { 'Authorization': `Bearer ${API_KEY_FACEIT}` }
                }).then(res => res.json())
            );

            const hubResults = await Promise.all(hubPromises);
            const allOngoingItems = hubResults.flatMap(data => data.items || []);

            if (allOngoingItems.length > 0) {
                const detailPromises = allOngoingItems.map((m: any) =>
                    fetch(`https://open.faceit.com/data/v4/matches/${m.match_id}`, {
                        headers: { 'Authorization': `Bearer ${API_KEY_FACEIT}` }
                    }).then(r => r.json())
                );
                
                const details = await Promise.all(detailPromises);
                const activeMatches = details.filter(match => 
                    match && (match.status === 'ONGOING' || match.status === 'READY')
                );

                setMatches(activeMatches);
                window.dispatchEvent(new CustomEvent('liveMatchesUpdated', { detail: { matches: activeMatches, loading: false } }));
                return activeMatches;
            } else {
                setMatches([]);
                window.dispatchEvent(new CustomEvent('liveMatchesUpdated', { detail: { matches: [], loading: false } }));
                return [];
            }
        } catch (e) {
            console.error("Erro ao sincronizar com as hubs:", e);
            setMatches([]);
            window.dispatchEvent(new CustomEvent('liveMatchesUpdated', { detail: { matches: [], loading: false } }));
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const handleOpen = () => {
            fetchFaceitMatches();
            fetchScheduledMatches();
            setInternalOpen(true);
        };
        window.addEventListener('openLiveMatchesModal', handleOpen);

        const handleRequest = () => {
            window.dispatchEvent(new CustomEvent('liveMatchesUpdated', { detail: { matches, loading } }));
        };
        window.addEventListener('requestLiveMatches', handleRequest);

        return () => {
            window.removeEventListener('openLiveMatchesModal', handleOpen);
            window.removeEventListener('requestLiveMatches', handleRequest);
        };
    }, [fetchFaceitMatches, fetchScheduledMatches, matches, loading]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const hasSeen = sessionStorage.getItem("QC_liveModalSeen");
        if (hasSeen) {
            fetchFaceitMatches();
            fetchScheduledMatches();
            return;
        }

        fetchFaceitMatches().then(data => {
            fetchScheduledMatches();
            if (data && data.length > 0) {
                setInternalOpen(true);
                sessionStorage.setItem("QC_liveModalSeen", "true");
            }
        });
    }, [fetchFaceitMatches, fetchScheduledMatches]);

    const handleClose = () => {
        setInternalOpen(false);
    };

    useEffect(() => {
        if (!internalOpen) return;
        
        const interval = setInterval(() => {
            fetchFaceitMatches();
            fetchScheduledMatches();
        }, 10000);
        return () => clearInterval(interval);
    }, [internalOpen, fetchFaceitMatches, fetchScheduledMatches]);

    return (
        <Dialog open={internalOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="bg-gray-900 border-gold/20 text-white max-w-lg overflow-hidden">
                <DialogHeader className="flex flex-row justify-between items-start border-b border-white/5 pb-4">
                    <div className="flex flex-col">
                        <DialogTitle className="text-2xl font-bold text-gold uppercase tracking-tighter">Partidas Ao vivo</DialogTitle>
                        <DialogDescription className="text-gray-400 text-xs">Querido Draft</DialogDescription>
                    </div>

                    <div className="flex gap-2">
                        {isYoutubeLive && (
                            <a href={STREAMS_CONFIG.youtube.url} target="_blank" className="hover:scale-110 transition-transform animate-pulse">
                                <Image src={STREAMS_CONFIG.youtube.img} alt="Youtube" width={38} height={38} className="rounded-full border-2 border-red-600 w-9 h-9 object-cover" />
                            </a>
                        )}
                        {isTwitch1Live && (
                            <a href={STREAMS_CONFIG.twitch1.url} target="_blank" className="hover:scale-110 transition-transform animate-pulse">
                                <Image src={STREAMS_CONFIG.twitch1.img} alt="Twitch 1" width={38} height={38} className="rounded-md border-2 border-purple-600 w-9 h-9 object-cover" />
                            </a>
                        )}
                        {isTwitch2Live && (
                            <a href={STREAMS_CONFIG.twitch2.url} target="_blank" className="hover:scale-110 transition-transform animate-pulse">
                                <Image src={STREAMS_CONFIG.twitch2.img} alt="Twitch 2" width={38} height={38} className="rounded-md border-2 border-purple-500 w-9 h-9 object-cover" />
                            </a>
                        )}
                    </div>
                </DialogHeader>

                <div className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto pr-2 custom-scrollbar">
                    {scheduledMatches.length > 0 && (
                        <>
                            <h3 className="text-lg font-bold text-gold uppercase tracking-tighter my-4 border-b border-gold/20 pb-2">
                                Jogos de Hoje
                            </h3>
                            {scheduledMatches.map((match) => (
                                <div key={match.id} className="relative bg-white/5 p-4 rounded-lg border border-white/10 flex flex-col gap-3">
                                    <div className="flex justify-between items-center gap-2">
                                        {/* Time 1 */}
                                        <div className="flex flex-col items-center w-1/3 gap-2">
                                            <div className="w-12 h-12 relative rounded-full overflow-hidden border-2 border-white/10 bg-black/20">
                                                <Image 
                                                    src={match.team1.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"} 
                                                    alt={match.team1.name} fill className="object-cover" 
                                                />
                                            </div>
                                            <span className="text-[11px] font-black text-center line-clamp-1 uppercase">{match.team1.name}</span>
                                        </div>

                                        <div className="flex flex-col items-center justify-center w-1/3">
                                            <div className="bg-black/80 px-4 py-1.5 rounded border border-white/20 mb-2 flex flex-col items-center min-w-[90px]">
                                                <span className="text-xl font-black text-white tabular-nums leading-none">
                                                    {String(match.scheduled_time).replace('T', ' ').substring(11, 16)}
                                                </span>
                                            </div>
                                            
                                            {match.live_platform && STREAMS_CONFIG[match.live_platform] && (
                                                <a href={STREAMS_CONFIG[match.live_platform].url} target="_blank" rel="noopener noreferrer" className="mt-1 flex items-center gap-1.5 bg-red-600/80 hover:bg-red-600 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                                                    <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                                                    Assistir
                                                </a>
                                            )}
                                        </div>

                                        {/* Time 2 */}
                                        <div className="flex flex-col items-center w-1/3 gap-2">
                                            <div className="w-12 h-12 relative rounded-full overflow-hidden border-2 border-white/10 bg-black/20">
                                                <Image 
                                                    src={match.team2.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"} 
                                                    alt={match.team2.name} fill className="object-cover" 
                                                />
                                            </div>
                                            <span className="text-[11px] font-black text-center line-clamp-1 uppercase">{match.team2.name}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}

                    {/* PARTIDAS AO VIVO */}
                    {matches.length > 0 && (
                        <>
                        <h3 className="text-lg font-bold text-gold uppercase tracking-tighter my-4 border-b border-gold/20 pb-2">
                            Partidas Ao Vivo
                        </h3>
                        {matches.map((match) => (
                            <div key={match.match_id} className="relative bg-white/5 p-4 rounded-lg border border-white/10 flex flex-col gap-3 hover:bg-white/10 transition-all">
                                <div className="flex justify-between items-center gap-2">
                                    {/* Time 1 */}
                                    <div className="flex flex-col items-center w-1/3 gap-2">
                                        <div className="w-12 h-12 relative rounded-full overflow-hidden border-2 border-white/10 bg-black/20">
                                            <Image 
                                                src={match.teams.faction1.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"} 
                                                alt="T1" fill className="object-cover" 
                                            />
                                        </div>
                                        <span className="text-[11px] font-black text-center line-clamp-1 uppercase">{match.teams.faction1.name}</span>
                                    </div>

                                    {/* Score Central */}
                                    <div className="flex flex-col items-center justify-center w-1/3">
                                        {(() => {
                                            const resultScore = match.results?.score || { faction1: 0, faction2: 0 };
                                            const detailedResults = match.detailed_results || [];
                                            const secondMap = detailedResults[1];
                                            const firstMap = detailedResults[0];

                                            if (
                                                match.best_of === 2 &&
                                                secondMap?.factions?.faction1?.score != null &&
                                                secondMap?.factions?.faction2?.score != null
                                            ) {
                                                return (
                                                    <div className="bg-black/80 px-4 py-1.5 rounded border border-gold/40 mb-2 flex flex-col items-center min-w-[90px]">
                                                        <span className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5 font-bold">
                                                            MAPA 2
                                                        </span>
                                                        <span className="text-xl font-black text-gold tabular-nums leading-none">
                                                            {`${secondMap.factions.faction1.score} - ${secondMap.factions.faction2.score}`}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            if (
                                                firstMap?.factions?.faction1?.score != null &&
                                                firstMap?.factions?.faction2?.score != null
                                            ) {
                                                return (
                                                    <div className="bg-black/80 px-4 py-1.5 rounded border border-gold/40 mb-2 flex flex-col items-center min-w-[90px]">
                                                        <span className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5 font-bold">
                                                            MAPA 1
                                                        </span>
                                                        <span className="text-xl font-black text-gold tabular-nums leading-none">
                                                            {`${firstMap.factions.faction1.score} - ${firstMap.factions.faction2.score}`}
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="bg-black/80 px-4 py-1.5 rounded border border-gold/40 mb-2 flex flex-col items-center min-w-[90px]">
                                                    <span className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5 font-bold">
                                                        ROUNDS
                                                    </span>
                                                    <span className="text-xl font-black text-gold tabular-nums leading-none">
                                                        {`${resultScore.faction1} - ${resultScore.faction2}`}
                                                    </span>
                                                </div>
                                            );
                                        })()}
                                        
                                        <div className="flex flex-col gap-1 w-full px-1">
                                            {(() => {
                                                const picks = match.voting?.map?.pick || match.maps || [];
                                                const detailedResults = match.detailed_results || [];
                                                const currentMapIndex = match.status === 'ONGOING'
                                                    ? Math.max(detailedResults.length - 1, 0)
                                                    : -1;
                                                
                                                if (picks.length > 0) {
                                                    return picks.map((mapName, idx) => {
                                                        const mapResult = detailedResults[idx];
                                                        const mapScoreLeft = mapResult?.factions?.faction1?.score;
                                                        const mapScoreRight = mapResult?.factions?.faction2?.score;
                                                        const score =
                                                            mapScoreLeft != null && mapScoreRight != null
                                                                ? `${mapScoreLeft} - ${mapScoreRight}`
                                                                : "-";
                                                        const isCurrent = idx === currentMapIndex && match.status === 'ONGOING';
                                                        
                                                        return (
                                                            <div key={idx} className={`flex flex-col items-center bg-black/40 rounded p-1 border ${isCurrent ? 'border-gold/60 shadow-[0_0_8px_rgba(255,215,0,0.15)]' : 'border-white/5'}`}>
                                                                <div className="flex justify-between w-full text-[9px] font-bold uppercase text-gray-300">
                                                                    <span className={isCurrent ? "text-gold" : ""}>{mapName.replace('de_', '')}</span>
                                                                    <span className={score !== "-" ? "text-white" : "text-gray-500"}>{score}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                }
                                                return null;
                                            })()}
                                        </div>

                                        <a 
                                            href={`https://www.faceit.com/pt/${match.game}/room/${match.match_id}`} 
                                            target="_blank" 
                                            className="mt-2 text-[9px] flex items-center gap-1 text-gray-400 hover:text-gold transition-colors font-bold uppercase tracking-widest"
                                        >
                                            SALA <ExternalLink size={10} />
                                        </a>
                                    </div>

                                    {/* Time 2 */}
                                    <div className="flex flex-col items-center w-1/3 gap-2">
                                        <div className="w-12 h-12 relative rounded-full overflow-hidden border-2 border-white/10 bg-black/20">
                                            <Image 
                                                src={match.teams.faction2.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"} 
                                                alt="T2" fill className="object-cover" 
                                            />
                                        </div>
                                        <span className="text-[11px] font-black text-center line-clamp-1 uppercase">{match.teams.faction2.name}</span>
                                    </div>
                                </div>

                                <div className="absolute top-2 right-2">
                                    <span className={`flex h-2 w-2 rounded-full ${match.status === 'READY' ? 'bg-blue-500' : 'bg-red-600 animate-pulse'}`}></span>
                                </div>
                            </div>
                        ))}
                        </>
                    )}

                    {/* ESTADOS DE CARREGAMENTO E VAZIO */}
                    {loading && matches.length === 0 && scheduledMatches.length === 0 && (
                        <div className="flex flex-col items-center justify-center p-10 gap-3">
                            <Loader className="animate-spin text-gold" size={32} />
                        </div>
                    )}

                    {!loading && matches.length === 0 && scheduledMatches.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-gray-500 italic text-sm">Nenhuma partida em andamento ou agendada para hoje.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
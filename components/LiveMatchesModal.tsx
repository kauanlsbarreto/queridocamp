"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Loader, ExternalLink } from "lucide-react"
import Image from "next/image"
import { usePathname } from "next/navigation"

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

const getCalculatedSeriesScore = (match: MatchDetails) => {
    let f1 = 0;
    let f2 = 0;
    if (match.stats?.rounds) {
        match.stats.rounds.forEach(r => {
            const parts = r.round_stats.Score.split(' / ');
            if (parts.length === 2) {
                const s1 = parseInt(parts[0], 10);
                const s2 = parseInt(parts[1], 10);
                if (!isNaN(s1) && !isNaN(s2)) {
                    if (s1 > s2) f1++;
                    else if (s2 > s1) f2++;
                }
            }
        });
    }
    return { faction1: f1, faction2: f2 };
};

const HUB_IDS = [
    "fdd5221c-408c-4148-bc63-e2940da4a490",
    "04a14d7f-0511-451b-8208-9a6c3215ccaa"
];

export default function LiveMatchesModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const pathname = usePathname();
    const [internalOpen, setInternalOpen] = useState(false);
    const [matches, setMatches] = useState<MatchDetails[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isYoutubeLive] = useState(true);
    const [isTwitch1Live] = useState(true);
    const [isTwitch2Live] = useState(true);

    const fetchFaceitMatches = async () => {
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

                const matchesWithStats = await Promise.all(activeMatches.map(async (match: any) => {
                    try {
                        const statsRes = await fetch(`https://open.faceit.com/data/v4/matches/${match.match_id}/stats`, {
                            headers: { 'Authorization': `Bearer ${API_KEY_FACEIT}` }
                        });
                        if (statsRes.ok) {
                            const stats = await statsRes.json();
                            return { ...match, stats };
                        }
                    } catch (e) {
                        console.error("Erro ao buscar stats:", e);
                    }
                    return match;
                }));

                setMatches(matchesWithStats);
                return matchesWithStats;
            } else {
                setMatches([]);
                return [];
            }
        } catch (e) {
            console.error("Erro ao sincronizar com as hubs:", e);
            setMatches([]);
            return [];
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const lastPath = sessionStorage.getItem("QC_lastPath");
        
        if (lastPath === pathname) return;

        sessionStorage.setItem("QC_lastPath", pathname);
        
        const count = parseInt(sessionStorage.getItem("QC_navCount") || "0");
        const newCount = count + 1;
        sessionStorage.setItem("QC_navCount", newCount.toString());

        if (newCount > 0 && newCount % 2 === 0) {
            fetchFaceitMatches().then(data => {
                if (data && data.length > 0) {
                    setInternalOpen(true);
                }
            });
        }
    }, [pathname]);

    const show = isOpen || internalOpen;

    const handleClose = () => {
        setInternalOpen(false);
        onClose();
    };

    useEffect(() => {
        if (!show) return;

        // Se abriu manualmente (isOpen) e não tem dados, busca.
        if (matches.length === 0) {
            fetchFaceitMatches();
        }
        
        const interval = setInterval(fetchFaceitMatches, 45000);
        return () => clearInterval(interval);

    }, [show]);

    return (
        <Dialog open={show} onOpenChange={handleClose}>
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
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-10 gap-3">
                            <Loader className="animate-spin text-gold" size={32} />
                        </div>
                    ) : matches.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-gray-500 italic text-sm">Nenhuma partida agora.</p>
                        </div>
                    ) : (
                        matches.map((match) => (
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

                                    {/* Score */}
                                    <div className="flex flex-col items-center justify-center w-1/3">
                                        {(() => {
                                            const isBo3 = match.voting?.map?.pick && match.voting.map.pick.length > 1;
                                            const hasFinishedMaps = match.stats?.rounds && match.stats.rounds.length > 0;
                                            const finishedMapsCount = match.stats?.rounds?.length || 0;
                                            
                                            const resultScore = match.results?.score || { faction1: 0, faction2: 0 };
                                            const calculatedSeries = getCalculatedSeriesScore(match);
                                            
                                            // Se for BO3 e tiver mapas finalizados, verificamos se o placar da API é o da série
                                            const isSeriesScore = isBo3 && hasFinishedMaps && 
                                                (resultScore.faction1 === calculatedSeries.faction1 && resultScore.faction2 === calculatedSeries.faction2);

                                            if (hasFinishedMaps && match.status === 'ONGOING') {
                                                return (
                                                    <div className="bg-black/80 px-2 py-1.5 rounded border border-gold/40 mb-2 flex flex-col items-center min-w-[90px]">
                                                        <span className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5 font-bold">
                                                            {finishedMapsCount === 1 ? "MAPA 2" : "MAPA 3"}
                                                        </span>
                                                        <span className="text-[9px] font-black text-gold leading-tight text-center">
                                                            VER NA FACEIT
                                                        </span>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div className="bg-black/80 px-4 py-1.5 rounded border border-gold/40 mb-2 flex flex-col items-center min-w-[90px]">
                                                    <span className="text-[7px] text-gray-400 uppercase tracking-widest mb-0.5 font-bold">
                                                        {isSeriesScore && match.status !== 'ONGOING' ? "PLACAR SÉRIE" : "ROUNDS"}
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
                                                const finishedMapsCount = match.stats?.rounds?.length || 0;
                                                
                                                if (picks.length > 0) {
                                                    return picks.map((mapName, idx) => {
                                                        const stats = match.stats?.rounds?.find(r => 
                                                            r.round_stats?.Map === mapName || 
                                                            r.round_stats?.Map.replace('de_', '') === mapName.replace('de_', '')
                                                        );
                                                        
                                                        let score = stats ? stats.round_stats.Score.replace(" / ", " - ") : "-";

                                                        const pickedBy = match.voting?.map?.pick ? (idx === 0 ? match.teams.faction1.name : (idx === 1 ? match.teams.faction2.name : "Decider")) : null;
                                                        const isCurrent = idx === finishedMapsCount && match.status === 'ONGOING';
                                                        
                                                        return (
                                                            <div key={idx} className={`flex flex-col items-center bg-black/40 rounded p-1 border ${isCurrent ? 'border-gold/60 shadow-[0_0_8px_rgba(255,215,0,0.15)]' : 'border-white/5'}`}>
                                                                <div className="flex justify-between w-full text-[9px] font-bold uppercase text-gray-300">
                                                                    <span className={isCurrent ? "text-gold" : ""}>{mapName.replace('de_', '')}</span>
                                                                    <span className={score !== "-" ? "text-white" : "text-gray-500"}>{score}</span>
                                                                </div>
                                                                {pickedBy && (
                                                                    <span className="text-[7px] text-gold/50 uppercase tracking-wider truncate max-w-full">
                                                                        {pickedBy === "Decider" ? "Decider" : `Pick: ${pickedBy}`}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                } else {
                                                    return match.stats?.rounds?.map((round, idx) => (
                                                        <div key={idx} className="flex justify-between w-full text-[9px] font-bold uppercase text-gray-300 bg-black/40 rounded p-1 border border-white/5 px-1">
                                                            <span>{round.round_stats?.Map.replace('de_', '')}</span>
                                                            <span className="text-white">{round.round_stats?.Score.replace(" / ", " - ")}</span>
                                                        </div>
                                                    ));
                                                }
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
                        ))
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
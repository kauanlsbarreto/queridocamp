"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"

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

            setMatch(matchData);
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
            <div style={{
                width: '100%',
                height: '100vh',
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 0,
                padding: 0,
                overflow: 'hidden'
            }}>
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                <div style={{ color: '#FFD700', textAlign: 'center' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        border: '3px solid #FFD700',
                        borderRadius: '50%',
                        borderTop: 'transparent',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto 16px'
                    }}></div>
                    <p>Carregando...</p>
                </div>
            </div>
        );
    }

    const resultScore = match.results?.score || { faction1: 0, faction2: 0 };
    const detailedResults = match.detailed_results || [];
    const secondMap = detailedResults[1];
    const firstMap = detailedResults[0];
    const pickedMaps = match.voting?.map?.pick?.length ? match.voting.map.pick : (match.maps || []);

    let currentMapName = "-";
    if (pickedMaps.length > 0) {
        const currentMapIndex = match.status === "ONGOING"
            ? Math.min(detailedResults.length, pickedMaps.length - 1)
            : Math.max(Math.min(detailedResults.length - 1, pickedMaps.length - 1), 0);
        currentMapName = pickedMaps[currentMapIndex]?.replace(/^de_/i, "").toUpperCase() || "-";
    }

    // Em BO2, prioriza sempre o placar do mapa 2 quando ele estiver disponível.
    let faction1CurrentScore = resultScore.faction1;
    let faction2CurrentScore = resultScore.faction2;

    if (match.best_of === 2 && secondMap?.factions?.faction1?.score != null && secondMap?.factions?.faction2?.score != null) {
        faction1CurrentScore = secondMap.factions.faction1.score;
        faction2CurrentScore = secondMap.factions.faction2.score;
    } else if (firstMap?.factions?.faction1?.score != null && firstMap?.factions?.faction2?.score != null) {
        faction1CurrentScore = firstMap.factions.faction1.score;
        faction2CurrentScore = firstMap.factions.faction2.score;
    }

    const teamNameColor = '#ffffff';
    const faction1Color = faction1CurrentScore > faction2CurrentScore ? '#86efac' : faction1CurrentScore < faction2CurrentScore ? '#fca5a5' : '#f7cf66';
    const faction2Color = faction2CurrentScore > faction1CurrentScore ? '#86efac' : faction2CurrentScore < faction1CurrentScore ? '#fca5a5' : '#f7cf66';
    const faction1Glow = faction1CurrentScore > faction2CurrentScore ? '0 0 22px rgba(34, 197, 94, 0.28)' : faction1CurrentScore < faction2CurrentScore ? '0 0 22px rgba(239, 68, 68, 0.2)' : 'none';
    const faction2Glow = faction2CurrentScore > faction1CurrentScore ? '0 0 22px rgba(34, 197, 94, 0.28)' : faction2CurrentScore < faction1CurrentScore ? '0 0 22px rgba(239, 68, 68, 0.2)' : 'none';

    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            background: 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0,
            margin: 0
        }}>
            <style>{`
                * { margin: 0; padding: 0; box-sizing: border-box; }
            `}</style>
            <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: '16px',
                width: '100%',
                maxWidth: '760px',
                padding: '8px 12px',
                background: 'linear-gradient(180deg, rgba(15, 11, 3, 0.92), rgba(8, 6, 2, 0.88))',
                border: '1px solid rgba(247, 207, 102, 0.75)',
                borderRadius: '16px',
                boxShadow: 'inset 0 0 0 1px rgba(128, 88, 16, 0.35), 0 0 18px rgba(247, 207, 102, 0.14)'
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '8px',
                    minWidth: 0
                }}>
                    <h2 style={{
                        fontSize: '22px',
                        fontWeight: 900,
                        color: teamNameColor,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textShadow: '0 0 12px rgba(0, 0, 0, 0.55)'
                    }}>
                        {match.teams.faction1.name}
                    </h2>
                    <div style={{
                        position: 'relative',
                        width: '30px',
                        height: '30px',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                        border: '1px solid rgba(247, 207, 102, 0.75)',
                        flexShrink: 0,
                        boxShadow: '0 0 10px rgba(247, 207, 102, 0.18)'
                    }}>
                        <Image
                            src={match.teams.faction1.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"}
                            alt={match.teams.faction1.name}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="30px"
                        />
                    </div>
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(0, 0, 0, 0.28)'
                }}>
                    <Image
                        src="/logo.png"
                        alt="Querido Camp"
                        width={44}
                        height={44}
                        priority
                    />
                    <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        color: '#f7cf66',
                        textShadow: '0 0 8px rgba(247, 207, 102, 0.2)'
                    }}>
                        MAPA ATUAL: {currentMapName}
                    </span>
                    <p style={{
                        fontSize: '34px',
                        fontWeight: 900,
                        fontFamily: 'monospace',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        textShadow: '0 0 18px rgba(247, 207, 102, 0.2)'
                    }}>
                        <span style={{ color: faction1Color, textShadow: faction1Glow }}>{faction1CurrentScore}</span>
                        <span style={{ color: '#f7cf66' }}> - </span>
                        <span style={{ color: faction2Color, textShadow: faction2Glow }}>{faction2CurrentScore}</span>
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: '8px',
                    minWidth: 0
                }}>
                    <div style={{
                        position: 'relative',
                        width: '30px',
                        height: '30px',
                        borderRadius: '9999px',
                        overflow: 'hidden',
                        border: '1px solid rgba(247, 207, 102, 0.75)',
                        flexShrink: 0,
                        boxShadow: '0 0 10px rgba(247, 207, 102, 0.18)'
                    }}>
                        <Image
                            src={match.teams.faction2.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_red.png"}
                            alt={match.teams.faction2.name}
                            fill
                            style={{ objectFit: 'cover' }}
                            sizes="30px"
                        />
                    </div>
                    <h2 style={{
                        fontSize: '22px',
                        fontWeight: 900,
                        color: teamNameColor,
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textShadow: '0 0 12px rgba(0, 0, 0, 0.55)'
                    }}>
                        {match.teams.faction2.name}
                    </h2>
                </div>
            </div>
        </div>
    );
}

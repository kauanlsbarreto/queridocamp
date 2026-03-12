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

    const finishedMapsCount = match.stats?.rounds?.length || 0;
    const resultScore = match.results?.score || { faction1: 0, faction2: 0 };

    let faction1CurrentScore = 0;
    let faction2CurrentScore = 0;
    let currentMapScore = "-";
    
    if (match.stats?.rounds && match.stats.rounds.length > 0 && match.status === 'ONGOING' && finishedMapsCount < 2) {
        const currentMapIndex = finishedMapsCount;
        const currentMapStats = match.stats.rounds[currentMapIndex]?.round_stats;
        if (currentMapStats?.Score) {
            const [leftScore, rightScore] = currentMapStats.Score.split(" / ").map((value) => Number.parseInt(value, 10) || 0);
            faction1CurrentScore = leftScore;
            faction2CurrentScore = rightScore;
            currentMapScore = `${leftScore} - ${rightScore}`;
        }
    } else {
        faction1CurrentScore = resultScore.faction1;
        faction2CurrentScore = resultScore.faction2;
        currentMapScore = `${resultScore.faction1} - ${resultScore.faction2}`;
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
                background: 'transparent',
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
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0',
                    background: 'transparent'
                }}>
                    <Image
                        src="/logo.png"
                        alt="Querido Camp"
                        width={44}
                        height={44}
                        priority
                    />
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

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
    const [copied, setCopied] = useState(false);

    const copyLink = () => {
        const url = `${window.location.origin}/overlay/placar/${matchId}`;
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

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
                background: '#000',
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
        <div style={{
            width: '100vw',
            height: '100vh',
            background: 'linear-gradient(to bottom, #000, #1a1a2e, #000)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0,
            margin: 0
        }}>
            <style>{`
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                button:hover {
                    border-color: rgba(255, 215, 0, 0.8) !important;
                    background-color: rgba(255, 215, 0, 0.2) !important;
                }
            `}</style>

            <div style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.5,
                pointerEvents: 'none'
            }}>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '25%',
                    width: '384px',
                    height: '384px',
                    background: 'rgba(255, 215, 0, 0.2)',
                    borderRadius: '50%',
                    filter: 'blur(96px)'
                }}></div>
                <div style={{
                    position: 'absolute',
                    bottom: 0,
                    right: '25%',
                    width: '384px',
                    height: '384px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    borderRadius: '50%',
                    filter: 'blur(96px)'
                }}></div>
            </div>

            <div style={{ position: 'relative', width: '100%', maxWidth: '1024px' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '32px'
                }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 16px',
                        borderRadius: '9999px',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        fontSize: '14px',
                        letterSpacing: '0.05em',
                        backgroundColor: match.status === 'READY' ? 'rgba(37, 99, 235, 0.3)' : 'rgba(220, 38, 38, 0.3)',
                        color: match.status === 'READY' ? '#93c5fd' : '#fca5a5',
                        border: match.status === 'READY' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid rgba(239, 68, 68, 0.5)'
                    }}>
                        <div style={{
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            backgroundColor: match.status === 'READY' ? '#3b82f6' : '#dc2626',
                            animation: match.status !== 'READY' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
                        }}></div>
                        {match.status === 'READY' ? '⏳ Pronto' : '🔴 AO VIVO'}
                    </div>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '24px',
                    alignItems: 'center'
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            position: 'relative',
                            width: '128px',
                            height: '128px',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            border: '4px solid rgba(255, 215, 0, 0.4)',
                            boxShadow: '0 20px 25px -5px rgba(255, 215, 0, 0.2)'
                        }}>
                            <Image 
                                src={match.teams.faction1.avatar}
                                alt={match.teams.faction1.name}
                                fill
                                style={{ objectFit: 'cover' }}
                                priority
                            />
                        </div>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: 900,
                            color: '#fff',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.05em',
                            maxWidth: '200px'
                        }}>
                            {match.teams.faction1.name}
                        </h2>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '24px',
                        paddingTop: '32px',
                        paddingBottom: '32px'
                    }}>
                        <div style={{ textAlign: 'center' }}>
                            <p style={{
                                fontSize: '12px',
                                color: '#9ca3af',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                fontWeight: 'bold',
                                marginBottom: '8px'
                            }}>
                                {currentMapLabel}
                            </p>
                            <div style={{
                                background: 'linear-gradient(to bottom-right, #000, #111, #000)',
                                borderRadius: '16px',
                                border: '2px solid rgba(255, 215, 0, 0.6)',
                                padding: '24px',
                                boxShadow: '0 20px 25px -5px rgba(255, 215, 0, 0.2)',
                                minWidth: '180px'
                            }}>
                                <p style={{
                                    fontSize: '60px',
                                    fontWeight: 900,
                                    color: '#FFD700',
                                    fontFamily: 'monospace',
                                    lineHeight: 1
                                }}>
                                    {currentMapScore}
                                </p>
                            </div>
                        </div>

                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            {match.stats?.rounds.slice(0, 3).map((round, idx) => {
                                const mapName = round.round_stats?.Map || `Mapa ${idx + 1}`;
                                const score = round.round_stats?.Score.replace(" / ", " - ") || "-";
                                const isCurrent = idx === finishedMapsCount && match.status === 'ONGOING';
                                
                                return (
                                    <div 
                                        key={idx} 
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            border: isCurrent ? '2px solid rgba(255, 215, 0, 0.6)' : '1px solid rgba(107, 114, 128, 0.5)',
                                            fontSize: '14px',
                                            fontWeight: 'bold',
                                            textTransform: 'uppercase',
                                            backgroundColor: isCurrent ? 'rgba(255, 215, 0, 0.2)' : 'rgba(17, 24, 39, 0.5)',
                                            color: isCurrent ? '#FFD700' : '#d1d5db',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: '16px'
                                        }}
                                    >
                                        <span>{mapName.replace('de_', '')}</span>
                                        <span>{score}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px',
                        textAlign: 'center'
                    }}>
                        <div style={{
                            position: 'relative',
                            width: '128px',
                            height: '128px',
                            borderRadius: '16px',
                            overflow: 'hidden',
                            border: '4px solid rgba(255, 215, 0, 0.4)',
                            boxShadow: '0 20px 25px -5px rgba(255, 215, 0, 0.2)'
                        }}>
                            <Image 
                                src={match.teams.faction2.avatar}
                                alt={match.teams.faction2.name}
                                fill
                                style={{ objectFit: 'cover' }}
                                priority
                            />
                        </div>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: 900,
                            color: '#fff',
                            textTransform: 'uppercase',
                            letterSpacing: '-0.05em',
                            maxWidth: '200px'
                        }}>
                            {match.teams.faction2.name}
                        </h2>
                    </div>
                </div>

                <div style={{
                    marginTop: '32px',
                    textAlign: 'center',
                    color: '#4b5563',
                    fontSize: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}>
                    <p>Querido Camp • {match.game?.toUpperCase()}</p>
                    <button 
                        onClick={copyLink}
                        style={{
                            marginTop: '16px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 215, 0, 0.4)',
                            backgroundColor: 'rgba(255, 215, 0, 0.1)',
                            color: copied ? '#4ade80' : '#FFD700',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'all 200ms',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}
                    >
                        {copied ? '✓ Copiado!' : '📋 Copiar Link'}
                    </button>
                </div>
            </div>
        </div>
    );
}

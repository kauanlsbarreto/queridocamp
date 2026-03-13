"use client"

import Image from "next/image"

export default function TestOverlay() {
    const mockMatch = {
        match_id: "test-match-001",
        status: "ONGOING",
        game: "cs2",
        best_of: 2,
        teams: {
            faction1: {
                name: "TIME TESTE A",
                avatar: "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"
            },
            faction2: {
                name: "TIME TESTE B",
                avatar: "https://cdn.faceit.com/static/stats/avatar/default_user_red.png"
            }
        },
        results: {
            score: { faction1: 2, faction2: 1 }
        },
        maps: ["de_mirage", "de_inferno"],
        detailed_results: [
            {
                factions: {
                    faction1: { score: 16 },
                    faction2: { score: 12 }
                }
            },
            {
                factions: {
                    faction1: { score: 8 },
                    faction2: { score: 5 }
                }
            }
        ]
    };

    const secondMap = mockMatch.detailed_results[1];
    const faction1CurrentScore = secondMap?.factions?.faction1?.score ?? 0;
    const faction2CurrentScore = secondMap?.factions?.faction2?.score ?? 0;
    const currentMapIndex = Math.min(mockMatch.detailed_results.length, mockMatch.maps.length - 1);
    const currentMapName = mockMatch.maps[currentMapIndex]?.replace(/^de_/i, "").toUpperCase() || "-";
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
                        {mockMatch.teams.faction1.name}
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
                            src={mockMatch.teams.faction1.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_blue.png"}
                            alt={mockMatch.teams.faction1.name}
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
                            src={mockMatch.teams.faction2.avatar || "https://cdn.faceit.com/static/stats/avatar/default_user_red.png"}
                            alt={mockMatch.teams.faction2.name}
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
                        {mockMatch.teams.faction2.name}
                    </h2>
                </div>
            </div>
        </div>
    );
}

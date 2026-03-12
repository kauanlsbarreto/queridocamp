"use client"

import Image from "next/image"

export default function TestOverlay() {
    const mockMatch = {
        match_id: "test-match-001",
        status: "ONGOING",
        game: "cs2",
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
        stats: {
            rounds: [
                {
                    round_stats: {
                        Map: "de_mirage",
                        Score: "16 / 13"
                    }
                },
                {
                    round_stats: {
                        Map: "de_inferno",
                        Score: "16 / 14"
                    }
                },
                {
                    round_stats: {
                        Map: "de_ancient",
                        Score: "8 / 5"
                    }
                }
            ]
        }
    };

    const finishedMapsCount = mockMatch.stats?.rounds?.length || 0;
    const resultScore = mockMatch.results?.score || { faction1: 0, faction2: 0 };

    let currentMapScore = "8 - 5";
    let currentMapLabel = "MAPA 3";

    return (
        <div className="w-full min-h-screen bg-gradient-to-b from-black via-gray-900 to-black overflow-hidden">
            {/* Background gradient effect */}
            <div className="absolute inset-0 opacity-50">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-gold/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
            </div>

            {/* Content */}
            <div className="relative w-full h-screen flex flex-col items-center justify-center p-8">
                {/* Main Score Container */}
                <div className="w-full max-w-4xl">
                    {/* Status Badge */}
                    <div className="flex items-center justify-center mb-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold uppercase text-sm tracking-wider bg-red-600/30 text-red-300 border border-red-500/50">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></div>
                            🔴 AO VIVO
                        </div>
                    </div>

                    {/* Match Display */}
                    <div className="grid grid-cols-3 gap-6 items-center">
                        {/* Time 1 */}
                        <div className="flex flex-col items-center gap-4 text-center transform hover:scale-105 transition-transform duration-300">
                            <div className="w-32 h-32 relative rounded-2xl overflow-hidden border-4 border-gold/40 shadow-2xl shadow-gold/20 ring-2 ring-gold/20">
                                <Image 
                                    src={mockMatch.teams.faction1.avatar} 
                                    alt={mockMatch.teams.faction1.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tight line-clamp-2 max-w-xs">
                                    {mockMatch.teams.faction1.name}
                                </h2>
                                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Time 1</p>
                            </div>
                        </div>

                        {/* Central Score */}
                        <div className="flex flex-col items-center gap-6 py-8">
                            {/* Map/Round Label */}
                            <div className="text-center">
                                <p className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-2">
                                    {currentMapLabel}
                                </p>
                                {/* Score Display */}
                                <div className="bg-gradient-to-br from-black via-gray-950 to-black rounded-2xl border-2 border-gold/60 p-6 shadow-2xl shadow-gold/20 min-w-[180px]">
                                    <p className="text-6xl font-black text-gold tabular-nums leading-none">
                                        {currentMapScore}
                                    </p>
                                </div>
                            </div>

                            {/* Maps Info */}
                            <div className="flex flex-col gap-2">
                                {mockMatch.stats?.rounds.slice(0, 3).map((round, idx) => {
                                    const mapName = round.round_stats?.Map || `Mapa ${idx + 1}`;
                                    const score = round.round_stats?.Score.replace(" / ", " - ") || "-";
                                    const isCurrent = idx === finishedMapsCount && mockMatch.status === 'ONGOING';
                                    
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
                        </div>

                        {/* Time 2 */}
                        <div className="flex flex-col items-center gap-4 text-center transform hover:scale-105 transition-transform duration-300">
                            <div className="w-32 h-32 relative rounded-2xl overflow-hidden border-4 border-gold/40 shadow-2xl shadow-gold/20 ring-2 ring-gold/20">
                                <Image 
                                    src={mockMatch.teams.faction2.avatar} 
                                    alt={mockMatch.teams.faction2.name}
                                    fill
                                    className="object-cover"
                                    priority
                                />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tight line-clamp-2 max-w-xs">
                                    {mockMatch.teams.faction2.name}
                                </h2>
                                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1">Time 2</p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Info */}
                    <div className="mt-8 text-center text-gray-600 text-xs uppercase tracking-wider">
                        <p>Querido Camp • {mockMatch.game?.toUpperCase()} • OVERLAY DE TESTE</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

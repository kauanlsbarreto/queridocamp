"use client"

import Image from "next/image";
import { Calendar, Swords, MapPin } from "lucide-react";

export default function PlayerUpcomingMatches({ matches, teamName }: { matches: any[], teamName?: string }) {
    return (
        <div className="mt-8">
            <div className="flex items-center gap-2 mb-4 text-gold">
                <Calendar size={20} />
                <h3 className="text-lg font-bold uppercase tracking-widest">
                    Próximas Partidas {teamName ? `- ${teamName}` : ""}
                </h3>
            </div>
            
            {matches && matches.length > 0 ? (
                <div className="space-y-3">
                    {matches.map((match: any, i: number) => {
                        const isTeam1 = match.team1?.toLowerCase() === (teamName || "").toLowerCase();
                        const isTeam2 = match.team2?.toLowerCase() === (teamName || "").toLowerCase();
                        
                        return (
                            <div key={i} className="bg-zinc-900/50 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:border-gold/30 transition-colors relative overflow-hidden">
                                {/* Indicador de Status (opcional, baseado na data) */}
                                <div className="absolute top-0 left-0 w-1 h-full bg-gold/20"></div>

                                <div className="flex items-center gap-4 flex-1 justify-center md:justify-start w-full z-10">
                                    {/* Time 1 */}
                                    <div className={`flex-1 flex items-center justify-end gap-3 text-right font-bold text-lg ${isTeam1 ? 'text-gold' : 'text-white'}`}>
                                        <span className="truncate">{match.team1}</span>
                                        <div className="relative w-8 h-8 flex-shrink-0">
                                            <Image 
                                                src={match.team1Logo || "/images/team-placeholder.png"} 
                                                alt={match.team1} 
                                                fill 
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* VS */}
                                    <div className="flex flex-col items-center flex-shrink-0">
                                        <div className="bg-black/50 p-2 rounded-full border border-white/5 text-zinc-500">
                                            <Swords size={20} />
                                        </div>
                                        {match.mapa && (
                                            <span className="text-[9px] text-zinc-500 mt-1 uppercase flex items-center gap-1">
                                                <MapPin size={8} /> {match.mapa}
                                            </span>
                                        )}
                                    </div>

                                    {/* Time 2 */}
                                    <div className={`flex-1 flex items-center justify-start gap-3 text-left font-bold text-lg ${isTeam2 ? 'text-gold' : 'text-white'}`}>
                                        <div className="relative w-8 h-8 flex-shrink-0">
                                            <Image 
                                                src={match.team2Logo || "/images/team-placeholder.png"} 
                                                alt={match.team2} 
                                                fill 
                                                className="object-contain"
                                                unoptimized
                                            />
                                        </div>
                                        <span className="truncate">{match.team2}</span>
                                    </div>
                                </div>
                                
                                {/* Apenas Rodada */}
                                <div className="flex flex-row md:flex-col items-center gap-4 md:gap-1 border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-6 w-full md:w-auto justify-center md:justify-end min-w-[120px]">
                                    {match.rodada && (
                                        <span className="text-sm font-bold text-gold uppercase font-mono bg-white/5 px-3 py-1 rounded border border-white/5">
                                            {match.rodada}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-zinc-900/30 border border-white/5 rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
                    <Calendar className="text-zinc-700" size={32} />
                    <p className="text-zinc-500 text-sm">
                        {teamName 
                            ? <>Nenhuma partida agendada para o time <span className="text-zinc-400 font-bold">{teamName}</span>.</>
                            : "Nenhuma partida agendada."
                        }
                    </p>
                </div>
            )}
        </div>
    )
}

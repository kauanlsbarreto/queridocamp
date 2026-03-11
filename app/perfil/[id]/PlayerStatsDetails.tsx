"use client"

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import PremiumCard from "@/components/premium-card";

export default function PlayerStatsDetails({ playerStatsList }: { playerStatsList: any[] }) {
    if (!playerStatsList || playerStatsList.length === 0 || playerStatsList.every(ps => ps.k === 0)) {
        return (
            <div className="w-full mt-4 border-t border-gold/20 pt-6 text-center">
                <h3 className="text-xl font-bold text-gold mb-4">Estatísticas</h3>
                <p className="text-gray-300">
                    Nenhuma estatística de campeonato encontrada para este jogador.
                </p>
            </div>
        );
    }

    const TOTAL_ROUNDS = 17;

    return (
        <div className="w-full mt-8">
            <h3 className="text-2xl font-bold text-gold mb-6 text-center">Estatísticas do Campeonato</h3>
            {playerStatsList.map((playerStats, idx) => {
                const playedRounds = Array.from({ length: TOTAL_ROUNDS }, (_, i) => i + 1)
                    .filter(r => Number(playerStats[`r${r}_k`] || 0) > 0 || Number(playerStats[`r${r}_d`]) > 0);

                return (
                    <div key={idx}>
                        <PremiumCard className="mb-8">
                            <div className="p-6">
                                <h4 className="text-xl font-bold text-white mb-4">Geral</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div>
                                        <p className="text-sm text-gray-400">K/D Ratio</p>
                                        <p className="text-2xl font-bold text-gold">{Number(playerStats.kd).toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-400">ADR</p>
                                        <p className="text-2xl font-bold text-white">{Number(playerStats.adr).toFixed(1)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-400">Kills</p>
                                        <p className="text-2xl font-bold text-white">{playerStats.k}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-400">Mortes</p>
                                        <p className="text-2xl font-bold text-white">{playerStats.d}</p>
                                    </div>
                                </div>
                            </div>
                        </PremiumCard>

                        <h4 className="text-xl font-bold text-white mb-4 text-center">Desempenho por Rodada</h4>
                        <div className="space-y-4">
                            {playedRounds.map((round, index) => {
                                const k = Number(playerStats[`r${round}_k`]) || 0;
                                const d = Number(playerStats[`r${round}_d`]) || 0;
                                const kd = Number(playerStats[`r${round}_kd`]) || 0;
                                const adr = Number(playerStats[`r${round}_adr`]) || 0;
                                const m1Link = playerStats[`r${round}_m1_link`];
                                const m2Link = playerStats[`r${round}_m2_link`];
                                const matchId = playerStats[`r${round}_m1_id`];
                                const opponent = playerStats[`r${round}_opponent`];

                                return (
                                    <motion.div
                                        key={round}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ duration: 0.3, delay: index * 0.05 }}
                                    >
                                        <PremiumCard>
                                            <div className="p-4">
                                                <h5 className="font-bold text-lg text-gold">
                                                    Rodada {round}
                                                    {opponent ? ` - ${opponent}` : ""}
                                                </h5>
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 text-center">
                                                    <div><p className="text-xs text-gray-400">K/D</p><p className="font-bold text-lg text-white">{kd.toFixed(2)}</p></div>
                                                    <div><p className="text-xs text-gray-400">ADR</p><p className="font-bold text-lg text-white">{adr.toFixed(1)}</p></div>
                                                    <div><p className="text-xs text-gray-400">Kills</p><p className="font-bold text-lg text-white">{k}</p></div>
                                                    <div><p className="text-xs text-gray-400">Mortes</p><p className="font-bold text-lg text-white">{d}</p></div>
                                                </div>
                                                {(m1Link || m2Link || matchId) && (
                                                    <div className="flex flex-col items-center gap-2 mt-4 border-t border-white/10 pt-3">
                                                        {(m1Link || m2Link) && (
                                                            <div className="flex justify-center gap-4">
                                                                {m1Link && <a href={m1Link} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 uppercase font-bold tracking-wider">Mapa 1 <ExternalLink size={10}/></a>}
                                                                {m2Link && <a href={m2Link} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 uppercase font-bold tracking-wider">Mapa 2 <ExternalLink size={10}/></a>}
                                                            </div>
                                                        )}
                                                        {matchId && (
                                                            <a href={`https://www.faceit.com/en/cs2/room/${matchId}`} target="_blank" rel="noopener noreferrer" className="text-xs text-[#ff5500] hover:text-[#ff5500]/80 flex items-center gap-1 uppercase font-black tracking-widest">
                                                                Ver Lobby Faceit <ExternalLink size={10}/>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </PremiumCard>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                );
            })}

            <div className="w-full mt-12 border-t border-gold/20 pt-6 text-center">
                <h3 className="text-xl font-bold text-gold mb-4">Histórico em Campeonatos</h3>
                <p className="text-gray-300">
                    Em breve, você poderá ver os campeonatos que o jogador participou e suas conquistas.
                </p>
            </div>
        </div>
    );
}
"use client"
import { useEffect, useState } from 'react';
import Image from 'next/image';
import PremiumCard from '@/components/premium-card';
import StatsList from '@/app/stats/stats-list';
import { Trophy, Map as MapIcon, TrendingUp, AlertTriangle, Crosshair, Shield, Swords, Target, Skull, Zap, Bomb, Eye, Activity, Users, Flame, ExternalLink } from 'lucide-react';


const MAP_IMAGES: Record<string, string> = {
  de_mirage: "https://static.draft5.gg/news/2023/03/23112933/Bomb-A-Mirage-CS-2.jpg",
  de_inferno: "https://static.draft5.gg/news/2025/03/31221125/Banana-Inferno-CS2-31.03.2025.jpg",
  de_overpass: "https://esportsinsider.com/wp-content/uploads/2025/07/esl-blast-map-pool-update-july-2025.jpg",
  de_nuke: "https://static.draft5.gg/news/2023/03/23114203/Bomb-B-Nuke-CS-2.jpg",
  de_ancient: "https://static.draft5.gg/news/2023/03/23114157/Bomb-B-Ancient-CS-2.jpg",
  de_anubis: "https://static.draft5.gg/news/2023/06/07112727/Anubis-CS2.jpg",
  de_dust2: "https://static.draft5.gg/news/2023/04/04161748/dust2_ct_ramp_Cs2.jpg",
};

const normalizeText = (value: string | null | undefined): string => {
        if (!value) return '';
        return value
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]/g, '');
};

export default function TeamStatsClient({ team, initialStats }: { team: any, initialStats?: any }) {
    const [stats, setStats] = useState<any>(initialStats || null);
    const [loading, setLoading] = useState(!initialStats);
    const [isAdmin12, setIsAdmin12] = useState(false);
    const [adminUser, setAdminUser] = useState<any>(null);
    const [roundByMatch, setRoundByMatch] = useState<Record<string, number>>({});
    const [savingMatchId, setSavingMatchId] = useState<string | null>(null);
    const [resettingMatchId, setResettingMatchId] = useState<string | null>(null);
    const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
    const [feedbackVisible, setFeedbackVisible] = useState(false);
    const [usedRounds, setUsedRounds] = useState<Record<string, { matchOrder: number; matchId: string }>>({});
    const [saveStatusByMatch, setSaveStatusByMatch] = useState<Record<string, 'saved' | 'error' | 'unsaved'>>({});

    useEffect(() => {
        if (initialStats) {
            setStats(initialStats);
            setLoading(false);
        }
    }, [initialStats]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const syncAdminState = () => {
            const storedUser = localStorage.getItem('manual_user') || localStorage.getItem('faceit_user');
            if (!storedUser) {
                setIsAdmin12(false);
                setAdminUser(null);
                return;
            }

            try {
                const parsed = JSON.parse(storedUser);
                const level = parsed?.admin ?? parsed?.Admin;
                if (level === 1 || level === 2) {
                    setIsAdmin12(true);
                    setAdminUser(parsed);
                } else {
                    setIsAdmin12(false);
                    setAdminUser(null);
                }
            } catch (error) {
                console.error('Erro ao identificar admin:', error);
                setIsAdmin12(false);
                setAdminUser(null);
            }
        };

        syncAdminState();
        const interval = setInterval(syncAdminState, 10000);

        return () => clearInterval(interval);
    }, []);

    const { mapStats, vetoStats, matchStats } = stats || { 
        mapStats: {}, 
        vetoStats: {}, 
        matchStats: { wins: 0, losses: 0, draws: 0, total: 0, players: {}, halfDrawsDetails: [], halfWinsDetails: [], matchesList: [] } 
    };

    const sortedMaps = Object.entries(mapStats).sort((a: any, b: any) => b[1].matches - a[1].matches);
    const mostPlayedMap = sortedMaps[0];
    
    const sortedVetos = Object.entries(vetoStats).sort((a: any, b: any) => b[1] - a[1]);
    let mostBannedMap = sortedVetos.length > 0 ? sortedVetos[0] : null;
    let banLabel = "Mapa Mais Banido";
    let banCount: number = mostBannedMap ? (mostBannedMap[1] as number) : 0;

    if (!mostBannedMap) {
        const allMaps = Object.keys(MAP_IMAGES);
        const sortedByPlayed = allMaps.sort((a, b) => {
            return (mapStats[a]?.matches || 0) - (mapStats[b]?.matches || 0);
        });
        mostBannedMap = [sortedByPlayed[0], 0];
        banLabel = "Menos Jogado (Provável Ban)";
        banCount = 0;
    }
    
    const bestPlayer = team.tournamentStats?.reduce((prev: any, current: any) => {
        return (parseFloat(current.kd) > parseFloat(prev.kd)) ? current : prev;
    }, { kd: 0, nick: 'N/A' });

    const winRateTotal = matchStats.total > 0 ? ((matchStats.wins / matchStats.total) * 100).toFixed(0) : 0;

    const playerStatsArray = matchStats.players ? Object.values(matchStats.players) : [];
    
    const bestClutcher: any = playerStatsArray.reduce((prev: any, current: any) => 
        (current.clutches > prev.clutches) ? current : prev
    , { nickname: 'N/A', clutches: 0 });

    const bestEntry: any = playerStatsArray.reduce((prev: any, current: any) => 
        (current.entryKills > prev.entryKills) ? current : prev
    , { nickname: 'N/A', entryKills: 0 });

    const bestAwper: any = playerStatsArray.reduce((prev: any, current: any) => 
        (current.sniperKills > prev.sniperKills) ? current : prev
    , { nickname: 'N/A', sniperKills: 0 });

    const bestHeadshotter: any = playerStatsArray.reduce((prev: any, current: any) => 
        (current.headshots > prev.headshots) ? current : prev
    , { nickname: 'N/A', headshots: 0 });

    const bestPistol: any = playerStatsArray.reduce((prev: any, current: any) => 
        (current.pistolKills > prev.pistolKills) ? current : prev
    , { nickname: 'N/A', pistolKills: 0 });

    const bestUtility: any = playerStatsArray.reduce((prev: any, current: any) => 
        (current.utilitySuccesses > prev.utilitySuccesses) ? current : prev
    , { nickname: 'N/A', utilitySuccesses: 0 });

    const bestFlash: any = playerStatsArray.reduce((prev: any, current: any) => 
        (current.enemiesFlashed > prev.enemiesFlashed) ? current : prev
    , { nickname: 'N/A', enemiesFlashed: 0 });

    const bestDamage: any = playerStatsArray.reduce((prev: any, current: any) => 
        (current.damage > prev.damage) ? current : prev
    , { nickname: 'N/A', damage: 0 });

    const totalQuadro = playerStatsArray.reduce((acc: number, curr: any) => acc + (curr.quadroKills || 0), 0);
    const totalPenta = playerStatsArray.reduce((acc: number, curr: any) => acc + (curr.pentaKills || 0), 0);
    const totalKnife = playerStatsArray.reduce((acc: number, curr: any) => acc + (curr.knifeKills || 0), 0);
    const totalZeus = playerStatsArray.reduce((acc: number, curr: any) => acc + (curr.zeusKills || 0), 0);

    const totalHalfDraws = Object.values(mapStats).reduce((acc: number, curr: any) => acc + (curr.halfDraws || 0), 0);
    const totalHalfWins = Object.values(mapStats).reduce((acc: number, curr: any) => acc + (curr.halfWins || 0), 0);
    const adminMatchesInOrder = [...(matchStats.matchesList || [])].sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

    useEffect(() => {
        if (!saveFeedback) return;
        setFeedbackVisible(true);
        const timer = setTimeout(() => {
            setFeedbackVisible(false);
            setTimeout(() => setSaveFeedback(null), 300);
        }, 3500);
        return () => clearTimeout(timer);
    }, [saveFeedback]);

    useEffect(() => {
        if (!isAdmin12 || !adminUser?.faceit_guid || !team?.name) return;

        const loadUsedRounds = async () => {
            try {
                const accessToken = adminUser?.accessToken || adminUser?.access_token;
                const query = new URLSearchParams({
                    teamName: team.name,
                    faceit_guid: adminUser.faceit_guid,
                }).toString();

                const response = await fetch(`/api/admin/team-match-order?${query}`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken || ''}`,
                    },
                });

                const data = await response.json();
                if (!response.ok) return;

                const fetchedUsedRounds = data?.usedRounds || {};
                setUsedRounds(fetchedUsedRounds);

                setRoundByMatch((prev) => {
                    const next = { ...prev };
                    Object.keys(fetchedUsedRounds).forEach((roundKey) => {
                        const item = fetchedUsedRounds[roundKey];
                        if (item?.matchId) {
                            next[String(item.matchId)] = Number(roundKey);
                        }
                    });
                    return next;
                });
            } catch (error) {
                console.error('Erro ao carregar rodadas usadas:', error);
            }
        };

        loadUsedRounds();
    }, [isAdmin12, adminUser, team?.name, adminMatchesInOrder]);

    if (loading) return <div className="text-gold text-center py-20 animate-pulse font-black italic">CARREGANDO DADOS DA FACEIT...</div>;

    const handleSaveMatchRound = async (match: any, matchOrder: number) => {
        const matchKey = String(match.id);
        const selectedRound = Number(roundByMatch[match.id]);
        if (!selectedRound || selectedRound < 1 || selectedRound > 17) {
            setSaveFeedback('Selecione uma rodada entre 1 e 17 antes de confirmar.');
            setSaveStatusByMatch((prev) => ({ ...prev, [matchKey]: 'error' }));
            return;
        }

        const accessToken = adminUser?.accessToken || adminUser?.access_token;
        if (!adminUser?.faceit_guid) {
            setSaveFeedback('Não foi possível validar o usuário admin.');
            setSaveStatusByMatch((prev) => ({ ...prev, [matchKey]: 'error' }));
            return;
        }

        try {
            setSavingMatchId(matchKey);
            setSaveFeedback(null);

            const response = await fetch('/api/admin/team-match-order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken || ''}`
                },
                body: JSON.stringify({
                    faceit_guid: adminUser.faceit_guid,
                    teamName: team.name,
                    matchId: match.id,
                    matchOrder,
                    roundNumber: selectedRound,
                    players: (match.players || []).map((p: any) => ({
                        nickname: getCurrentNickname(p),
                        player_id: p.player_id
                    })),
                    matchesTimeline: adminMatchesInOrder.map((timelineMatch: any) => ({
                        matchId: timelineMatch.id,
                        players: (timelineMatch.players || []).map((p: any) => ({
                            nickname: getCurrentNickname(p),
                            player_id: p.player_id,
                        })),
                    })),
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Falha ao salvar a ordem da partida.');
            }

            setUsedRounds((prev) => {
                const next = { ...prev };

                Object.keys(next).forEach((roundKey) => {
                    const item = next[roundKey];
                    if (!item) return;

                    if (String(item.matchId) === String(match.id) || Number(item.matchOrder) === matchOrder) {
                        delete next[roundKey];
                    }
                });

                next[String(selectedRound)] = {
                    matchOrder,
                    matchId: String(match.id),
                };

                return next;
            });

            setSaveStatusByMatch((prev) => ({ ...prev, [matchKey]: 'saved' }));
            setSaveFeedback(`Partida #${matchOrder} salva no banco com sucesso (Rodada ${selectedRound}).`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro ao salvar.';
            setSaveStatusByMatch((prev) => ({ ...prev, [matchKey]: 'error' }));
            setSaveFeedback(message);
        } finally {
            setSavingMatchId(null);
        }
    };

    const handleResetMatchRound = async (match: any, matchOrder: number) => {
        const matchKey = String(match.id);

        const accessToken = adminUser?.accessToken || adminUser?.access_token;
        if (!adminUser?.faceit_guid) {
            setSaveFeedback('Não foi possível validar o usuário admin.');
            setSaveStatusByMatch((prev) => ({ ...prev, [matchKey]: 'error' }));
            return;
        }

        try {
            setResettingMatchId(matchKey);
            setSaveFeedback(null);

            const response = await fetch('/api/admin/team-match-order', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken || ''}`
                },
                body: JSON.stringify({
                    faceit_guid: adminUser.faceit_guid,
                    teamName: team.name,
                    matchId: match.id,
                    players: (match.players || []).map((p: any) => ({
                        nickname: getCurrentNickname(p),
                        player_id: p.player_id
                    })),
                    matchesTimeline: adminMatchesInOrder.map((timelineMatch: any) => ({
                        matchId: timelineMatch.id,
                        players: (timelineMatch.players || []).map((p: any) => ({
                            nickname: getCurrentNickname(p),
                            player_id: p.player_id,
                        })),
                    })),
                })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.message || 'Falha ao resetar a partida.');
            }

            setUsedRounds((prev) => {
                const next = { ...prev };

                Object.keys(next).forEach((roundKey) => {
                    const item = next[roundKey];
                    if (!item) return;

                    if (String(item.matchId) === String(match.id) || Number(item.matchOrder) === matchOrder) {
                        delete next[roundKey];
                    }
                });

                return next;
            });

            setRoundByMatch((prev) => {
                const next = { ...prev };
                delete next[matchKey];
                return next;
            });

            setSaveStatusByMatch((prev) => ({ ...prev, [matchKey]: 'unsaved' }));
            setSaveFeedback(`Partida #${matchOrder} resetada com sucesso.`);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro ao resetar.';
            setSaveStatusByMatch((prev) => ({ ...prev, [matchKey]: 'error' }));
            setSaveFeedback(message);
        } finally {
            setResettingMatchId(null);
        }
    };

    const getCurrentNickname = (player: any) => {
        const byGuid = team.players?.find((tp: any) => String(tp.faceit_guid || '') === String(player.player_id || ''));
        if (byGuid?.nickname) return byGuid.nickname;

        const byNormalized = team.players?.find((tp: any) => normalizeText(tp.nickname) === normalizeText(player.nickname));
        if (byNormalized?.nickname) return byNormalized.nickname;

        return player.nickname || 'N/A';
    };

    return (
        <div className="container mx-auto px-4 py-12 text-white">
            {saveFeedback && (
                <div
                    className={`fixed top-24 md:top-28 right-4 md:right-6 z-[9999] max-w-sm px-5 py-4 rounded-xl shadow-xl border font-bold text-sm transition-all duration-300 ${
                        feedbackVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
                    } ${
                        saveFeedback.toLowerCase().includes('sucesso')
                            ? 'bg-green-900/90 border-green-500/60 text-green-300'
                            : 'bg-zinc-900/95 border-gold/40 text-gold'
                    }`}
                >
                    {saveFeedback}
                </div>
            )}
            <div className="flex flex-col md:flex-row items-center gap-8 mb-16 bg-white/5 p-8 rounded-3xl border border-white/10">
                <div className="relative w-32 h-32 md:w-40 md:h-40">
                    <div className="absolute inset-0 bg-gold/20 blur-3xl rounded-full" />
                    <Image src={team.image} alt={team.name} fill className="object-contain drop-shadow-2xl" />
                </div>
                <div className="text-center md:text-left">
                    <h1 className="text-5xl md:text-7xl font-black italic uppercase tracking-tighter text-white mb-2">{team.name}</h1>
                    <p className="text-gold font-bold tracking-widest uppercase text-sm">Perfil Oficial do Time</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                <PremiumCard>
                    <div className="p-6 flex flex-col items-center text-center h-full justify-center">
                        <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-4 text-green-500">
                            <TrendingUp size={24} />
                        </div>
                        <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">Win Rate Geral</h3>
                        <p className="text-4xl font-black text-white italic">{winRateTotal}%</p>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">
                            {matchStats.wins} Vitórias 
                            {matchStats.draws > 0 && ` / ${matchStats.draws} Empates`} 
                            / {matchStats.losses} Derrotas
                        </p>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6 flex flex-col items-center text-center h-full justify-center">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 text-blue-500">
                            <MapIcon size={24} />
                        </div>
                        <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">Mapa Mais Pickado</h3>
                        <p className="text-3xl font-black text-white italic uppercase">{mostPlayedMap ? mostPlayedMap[0] : 'N/A'}</p>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">
                            {mostPlayedMap ? `${(mostPlayedMap[1] as any).matches} Partidas` : '-'}
                        </p>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6 flex flex-col items-center text-center h-full justify-center">
                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4 text-red-500">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">First Ban (Provável)</h3>
                        <p className="text-3xl font-black text-white italic uppercase">{mostBannedMap ? mostBannedMap[0].replace('de_', '') : 'N/A'}</p>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">
                            {banLabel === "Mapa Mais Banido" && matchStats.total > 0
                                ? `${((banCount / matchStats.total) * 100).toFixed(0)}% (${banCount} jogos)`
                                : banLabel}
                        </p>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6 flex flex-col items-center text-center h-full justify-center">
                        <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center mb-4 text-gold">
                            <Trophy size={24} />
                        </div>
                        <h3 className="text-zinc-400 text-xs font-black uppercase tracking-widest mb-1">Destaque do Time</h3>
                        <p className="text-3xl font-black text-white italic uppercase truncate w-full">{bestPlayer.nick}</p>
                        <p className="text-[10px] text-zinc-500 mt-2 uppercase font-bold">K/D: {Number(bestPlayer.kd).toFixed(2)}</p>
                    </div>
                </PremiumCard>
            </div>

            <div className="mb-16">
                <h2 className="text-3xl font-black italic uppercase text-gold mb-8 border-l-4 border-gold pl-4">Estatísticas do Elenco</h2>
                {team.tournamentStats && team.tournamentStats.length > 0 ? (
                    <StatsList allStats={team.tournamentStats} />
                ) : (
                    <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-zinc-500 font-bold uppercase">Nenhuma estatística de torneio encontrada para este time.</p>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <PremiumCard>
                    <div className="p-6">
                        <h2 className="text-xl font-black italic uppercase text-gold mb-6 border-b border-gold/20 pb-2">Win Rate por Mapa</h2>
                        <div className="space-y-4">
                            {Object.keys(MAP_IMAGES).map((mapName) => {
                                const data = mapStats[mapName] || { wins: 0, matches: 0 };
                                const matches = data.matches;
                                const wins = data.wins;
                                const losses = matches - wins;
                                
                                const winRate = matches > 0 ? ((wins / matches) * 100).toFixed(0) : 0;
                                const lossRate = matches > 0 ? ((losses / matches) * 100).toFixed(0) : 0;

                                return (
                                    <div key={mapName} className="relative h-24 rounded-xl overflow-hidden border border-white/10 group">
                                        <Image 
                                            src={MAP_IMAGES[mapName]} 
                                            alt={mapName} 
                                            fill 
                                            className="object-cover opacity-20 group-hover:opacity-40 transition-all duration-500" 
                                        />
                                        
                                        <div className="absolute inset-0 flex flex-col justify-center px-5 z-10">
                                            <div className="flex items-baseline gap-2 mb-2">
                                                <span className="text-lg font-black text-white uppercase italic tracking-tighter drop-shadow-lg">
                                                    {mapName.replace('de_', '')}
                                                </span>
                                                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">({matches})</span>
                                            </div>

                                            <div className="flex justify-between items-end">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Vitórias</span>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl font-black text-white">{wins}</span>
                                                        <span className="text-xs font-bold text-green-500">{winRate}%</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end">
                                                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Derrotas</span>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-xl font-black text-white">{losses}</span>
                                                        <span className="text-xs font-bold text-red-500">{lossRate}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="w-full h-1 bg-white/5 mt-2 rounded-full overflow-hidden flex">
                                                <div className="h-full bg-green-500" style={{ width: `${winRate}%` }} />
                                                <div className="h-full bg-red-500" style={{ width: `${lossRate}%` }} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6">
                        <h2 className="text-xl font-black italic uppercase text-gold mb-6 border-b border-gold/20 pb-2">Análise Tática</h2>
                        <div className="space-y-6">
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <span className="text-zinc-500 font-bold uppercase text-sm">Mapa Mais Jogado</span>
                                <span className="text-xl font-black italic text-white">
                                    {Object.entries(mapStats).sort((a: any, b: any) => b[1].matches - a[1].matches)[0]?.[0] || 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <span className="text-zinc-500 font-bold uppercase text-sm">Melhor Win Rate</span>
                                <span className="text-xl font-black italic text-green-400">
                                    {Object.entries(mapStats).sort((a: any, b: any) => (b[1].wins/b[1].matches) - (a[1].wins/a[1].matches))[0]?.[0] || 'N/A'}
                                </span>
                            </div>

                            <div className="border-b border-white/5 pb-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-500/10 rounded-lg text-green-400"><Shield size={18} /></div>
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Vitórias 1º Half</span>
                                    </div>
                                    <span className="text-xl font-black italic text-white">{totalHalfWins}</span>
                                </div>
                                {matchStats.halfWinsDetails?.length > 0 && (
                                    <div className="mt-3 pl-11 space-y-2 max-h-40 overflow-y-auto pr-2">
                                        {matchStats.halfWinsDetails.map((detail: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-[10px] font-bold uppercase">
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-500">{detail.map.replace('de_', '')}</span>
                                                    <span className="text-[9px] text-zinc-600 truncate max-w-[120px]">vs {detail.opponent}</span>
                                                </div>
                                                <span className="text-green-500">{detail.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-b border-white/5 pb-4">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Shield size={18} /></div>
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Empates 6-6 (Half)</span>
                                    </div>
                                    <span className="text-xl font-black italic text-white">{totalHalfDraws}</span>
                                </div>
                                {matchStats.halfDrawsDetails?.length > 0 && (
                                    <div className="mt-3 pl-11 space-y-2 max-h-40 overflow-y-auto pr-2">
                                        {matchStats.halfDrawsDetails.map((detail: any, idx: number) => (
                                            <div key={idx} className="flex justify-between items-center text-[10px] font-bold uppercase">
                                                <div className="flex flex-col">
                                                    <span className="text-zinc-500">{detail.map.replace('de_', '')}</span>
                                                    <span className="text-[9px] text-zinc-600 truncate max-w-[120px]">vs {detail.opponent}</span>
                                                </div>
                                                <span className="text-blue-400">{detail.score}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400"><Swords size={18} /></div>
                                    <div className="flex flex-col">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Vencedor de 1v1 e 1v2</span>
                                        <span className="text-sm text-white font-black italic">{bestClutcher.nickname}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black italic text-white">{bestClutcher.clutches} <span className="text-[10px] text-zinc-500 not-italic">Vitórias</span></span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/10 rounded-lg text-red-400"><Crosshair size={18} /></div>
                                    <div className="flex flex-col">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Entry Fragger</span>
                                        <span className="text-sm text-white font-black italic">{bestEntry.nickname}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black italic text-white">{bestEntry.entryKills} <span className="text-[10px] text-zinc-500 not-italic">kills</span></span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-400"><Target size={18} /></div>
                                    <div className="flex flex-col">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">AWPer</span>
                                        <span className="text-sm text-white font-black italic">{bestAwper.nickname}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black italic text-white">{bestAwper.sniperKills} <span className="text-[10px] text-zinc-500 not-italic">kills</span></span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400"><Skull size={18} /></div>
                                    <div className="flex flex-col">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Rei do HS</span>
                                        <span className="text-sm text-white font-black italic">{bestHeadshotter.nickname}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black italic text-white">{bestHeadshotter.headshots} <span className="text-[10px] text-zinc-500 not-italic">HS</span></span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-pink-500/10 rounded-lg text-pink-400"><Flame size={18} /></div>
                                    <div className="flex flex-col">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Maior Dano</span>
                                        <span className="text-sm text-white font-black italic">{bestDamage.nickname}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black italic text-white">{(bestDamage.damage / 1000).toFixed(1)}k <span className="text-[10px] text-zinc-500 not-italic">dmg</span></span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400"><Bomb size={18} /></div>
                                    <div className="flex flex-col">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Mestre das Granadas</span>
                                        <span className="text-sm text-white font-black italic">{bestUtility.nickname}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black italic text-white">{bestUtility.utilitySuccesses} <span className="text-[10px] text-zinc-500 not-italic">sucessos</span></span>
                            </div>

                            <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Eye size={18} /></div>
                                    <div className="flex flex-col">
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Cega Tudo (Flash)</span>
                                        <span className="text-sm text-white font-black italic">{bestFlash.nickname}</span>
                                    </div>
                                </div>
                                <span className="text-xl font-black italic text-white">{bestFlash.enemiesFlashed} <span className="text-[10px] text-zinc-500 not-italic">cegos</span></span>
                            </div>

                            {(totalPenta > 0 || totalQuadro > 0) && (
                                <div className="flex justify-between items-center border-b border-white/5 pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-rose-500/10 rounded-lg text-rose-400"><Zap size={18} /></div>
                                        <span className="text-zinc-400 font-bold uppercase text-xs">Multikills (Time)</span>
                                    </div>
                                    <div className="text-right">
                                        {totalPenta > 0 && <div className="text-sm font-black text-white italic">{totalPenta} PENTA</div>}
                                        {totalQuadro > 0 && <div className="text-sm font-bold text-zinc-400">{totalQuadro} ROUNDS </div>}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </PremiumCard>

                <PremiumCard>
                    <div className="p-6">
                        <h2 className="text-xl font-black italic uppercase text-gold mb-6 border-b border-gold/20 pb-2">Histórico de Partidas</h2>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {matchStats.matchesList?.map((match: any) => (
                                <a 
                                    key={match.id}
                                    href={match.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 hover:border-gold/30 transition-all group"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                                            {new Date(match.timestamp * 1000).toLocaleDateString('pt-BR')}
                                        </span>
                                        <span className="text-xs font-bold text-white group-hover:text-gold transition-colors uppercase">
                                            {match.label}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-sm font-black ${
                                            match.result === 'W' ? 'text-green-500' : 
                                            match.result === 'L' ? 'text-red-500' : 'text-yellow-500'
                                        }`}>
                                            {match.score}
                                        </span>
                                        <ExternalLink size={14} className="text-zinc-600 group-hover:text-white" />
                                    </div>
                                </a>
                            ))}
                            {(!matchStats.matchesList || matchStats.matchesList.length === 0) && (
                                <p className="text-zinc-500 text-xs italic text-center py-4">Nenhuma partida registrada.</p>
                            )}
                        </div>
                    </div>
                </PremiumCard>
            </div>

            {isAdmin12 && (
                <div className="mt-16">
                    <h2 className="text-3xl font-black italic uppercase text-gold border-l-4 border-gold pl-4 mb-6">Painel Admin - Ordem por Rodada</h2>
                    <div className="space-y-4">
                        {adminMatchesInOrder.map((match: any, index: number) => (
                            <PremiumCard key={`admin-${match.id}`}>
                                <div className="p-5 space-y-4">
                                    {(() => {
                                        const existingRoundEntry = Object.entries(usedRounds).find(([, value]) => String(value.matchId) === String(match.id));
                                        const inferredRound =
                                            Number(roundByMatch[match.id]) ||
                                            Number(existingRoundEntry?.[0] || 0);
                                        const hasRoundSelected = inferredRound > 0;
                                        const matchKey = String(match.id);
                                        const isSaving = savingMatchId === matchKey;
                                        const isResetting = resettingMatchId === matchKey;
                                        const saveStatus = saveStatusByMatch[matchKey];
                                        const wasLoadedFromDb = Boolean(existingRoundEntry);
                                        const roundsSelectedInOtherMatches = new Set<number>();

                                        Object.entries(roundByMatch).forEach(([otherMatchId, selectedRound]) => {
                                            const selected = Number(selectedRound || 0);
                                            if (!selected || selected < 1 || selected > 17) return;
                                            if (String(otherMatchId) === matchKey) return;
                                            roundsSelectedInOtherMatches.add(selected);
                                        });

                                        return (
                                            <>
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Partida #{index + 1}</p>
                                            <p className="text-sm md:text-base font-black italic text-white uppercase">{match.label}</p>
                                            <p className="text-[11px] text-zinc-400 font-bold">ID: {match.id}</p>
                                            {hasRoundSelected && (
                                                <p className="text-[11px] text-gold font-black uppercase mt-1">Rodada atual: {inferredRound}</p>
                                            )}
                                            {isSaving && (
                                                <p className="text-[11px] text-blue-300 font-black uppercase mt-1">Salvando no banco...</p>
                                            )}
                                            {isResetting && (
                                                <p className="text-[11px] text-blue-300 font-black uppercase mt-1">Resetando no banco...</p>
                                            )}
                                            {!isSaving && (saveStatus === 'saved' || (!saveStatus && wasLoadedFromDb)) && (
                                                <p className="text-[11px] text-green-300 font-black uppercase mt-1">Salvo no banco</p>
                                            )}
                                            {!isSaving && !isResetting && (saveStatus === 'error' || saveStatus === 'unsaved') && (
                                                <p className="text-[11px] text-red-300 font-black uppercase mt-1">Nao salvo no banco</p>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <select
                                                value={inferredRound || ''}
                                                onChange={(event) => setRoundByMatch((prev) => ({
                                                    ...prev,
                                                    [match.id]: Number(event.target.value)
                                                }))}
                                                className="bg-black/40 border border-gold/30 rounded-lg px-3 py-2 text-sm text-white font-bold"
                                            >
                                                <option value="">Selecionar rodada</option>
                                                {Array.from({ length: 17 }, (_, i) => i + 1)
                                                    .filter((round) => {
                                                        if (round === inferredRound) return true;
                                                        if (roundsSelectedInOtherMatches.has(round)) return false;

                                                        const used = usedRounds[String(round)];
                                                        if (!used) return true;
                                                        if (String(used.matchId) === String(match.id)) return true;
                                                        return false;
                                                    })
                                                    .map((round) => (
                                                        <option key={round} value={round}>Rodada {round}</option>
                                                    ))}
                                            </select>

                                            {hasRoundSelected && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveMatchRound(match, index + 1)}
                                                    disabled={isSaving || isResetting}
                                                    className="px-4 py-2 rounded-lg bg-gold text-black text-xs font-black uppercase disabled:opacity-50"
                                                >
                                                    {isSaving ? 'Salvando...' : 'Alterar'}
                                                </button>
                                            )}

                                            {hasRoundSelected && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleResetMatchRound(match, index + 1)}
                                                    disabled={isSaving || isResetting}
                                                    className="px-4 py-2 rounded-lg border border-red-500/60 text-red-300 text-xs font-black uppercase hover:bg-red-900/20 disabled:opacity-50"
                                                >
                                                    {isResetting ? 'Resetando...' : 'Resetar'}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {(match.players || []).map((player: any, playerIndex: number) => (
                                            <div key={`${match.id}-${player.player_id || player.nickname}-${playerIndex}`} className="flex items-center gap-3 p-2 rounded-lg border border-white/10 bg-white/5">
                                                <div className="text-[10px] text-gold font-black w-6">#{player.position || (playerIndex + 1)}</div>
                                                <div className="relative w-9 h-9 rounded-full overflow-hidden border border-gold/20 bg-black/40">
                                                    <Image
                                                        src={player.avatar || '/images/cs2-player.png'}
                                                        alt={player.nickname || 'Player'}
                                                        fill
                                                        className="object-cover"
                                                    />
                                                </div>
                                                <p className="text-xs font-bold text-white uppercase truncate">{getCurrentNickname(player)}</p>
                                            </div>
                                        ))}
                                        {(!match.players || match.players.length === 0) && (
                                            <p className="text-xs text-zinc-500 italic">Sem jogadores detectados para esta partida.</p>
                                        )}
                                    </div>
                                            </>
                                        );
                                    })()}
                                </div>
                            </PremiumCard>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
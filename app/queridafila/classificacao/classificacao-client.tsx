"use client";

import { useEffect, useMemo, useState } from "react";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import PremiumCard from "@/components/premium-card";

type NextLeaderboard = {
  leaderboard_id: string;
  leaderboard_name: string;
  start_date: number;
  end_date: number;
  status: string;
};

type RankingPlayer = {
  position: number;
  points: number;
  played: number;
  won: number;
  lost: number;
  draw: number;
  win_rate: number;
  current_streak: number;
  player: {
    user_id: string;
    nickname: string;
    avatar?: string;
    country?: string;
    skill_level?: number;
    faceit_url?: string;
  };
  isPremium: boolean;
};

function formatDate(unixSeconds: number) {
  if (!unixSeconds) return "-";

  return new Date(unixSeconds * 1000).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default function QueridaFilaClassificacaoClient({
  nextLeaderboard,
  players,
  showGeral = true,
  pastLeaderboards = [],
}: {
  nextLeaderboard: NextLeaderboard | null;
  players: RankingPlayer[];
  showGeral?: boolean;
  pastLeaderboards?: NextLeaderboard[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'premium'>('all');
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<'geral' | string>('geral');
  const [loading, setLoading] = useState(false);
  const [dynamicPlayers, setDynamicPlayers] = useState<RankingPlayer[] | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, 30000);
    return () => clearInterval(timer);
  }, [router]);

  // O filtro premium é feito via API
  const filteredPlayers = useMemo(() => {
    return dynamicPlayers !== null ? dynamicPlayers : players;
  }, [players, dynamicPlayers]);

  // Buscar ranking de leaderboard passada OU premium

  const fetchLeaderboardPlayers = useCallback(async (leaderboardId: string, premium: boolean) => {
    setLoading(true);
    try {
      let url = '';
      if (leaderboardId === 'geral') {
        url = premium
          ? `/queridafila/api/leaderboard/geral?premium=1`
          : `/queridafila/api/leaderboard/geral`;
      } else {
        url = premium
          ? `/queridafila/api/leaderboard/${leaderboardId}?premium=1`
          : `/queridafila/api/leaderboard/${leaderboardId}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Erro ao buscar leaderboard');
      const data = await res.json();

      // Se vier players, já está no formato esperado
      if (Array.isArray(data.players)) {
        setDynamicPlayers(data.players);
        return;
      }

      // Se vier items (Faceit API), adaptar para RankingPlayer[]
      if (Array.isArray(data.items)) {
        const players: RankingPlayer[] = data.items.map((item: any, idx: number) => ({
          position: item.rank || idx + 1,
          points: item.score ?? 0,
          played: item.played ?? item.stats?.played ?? 0,
          won: item.won ?? item.stats?.won ?? 0,
          lost: item.lost ?? item.stats?.lost ?? 0,
          draw: item.draw ?? item.stats?.draw ?? 0,
          win_rate: item.win_rate ?? item.stats?.win_rate ?? 0,
          current_streak: item.current_streak ?? item.stats?.current_streak ?? 0,
          player: {
            user_id: item.player_id || item.player?.user_id || '',
            nickname: item.player_name || item.player?.nickname || '',
            avatar: item.player?.avatar || '',
            country: item.player?.country || '',
            skill_level: item.player?.skill_level,
            faceit_url: item.player?.faceit_url,
          },
          isPremium: false, // Não temos como saber para leaderboards antigas
        }));
        setDynamicPlayers(players);
        return;
      }

      setDynamicPlayers([]);
    } catch (e) {
      setDynamicPlayers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (filter === 'all' && selectedLeaderboard === 'geral') {
      setDynamicPlayers(null);
    } else {
      fetchLeaderboardPlayers(selectedLeaderboard, filter === 'premium');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaderboard, filter]);

  return (
    <section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-7xl space-y-6">
          <PremiumCard>
            <div className="p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gold/80">Querida Fila</p>
                  <h1 className="mt-1 text-3xl font-black uppercase text-white md:text-4xl">Classificação</h1>
                </div>
                <div className="flex flex-col gap-2 md:gap-4 md:flex-row md:items-center">
                  <div>
                    <label htmlFor="leaderboard-select" className="text-sm font-semibold text-zinc-300 mr-2">Ranking</label>
                    <select
                      id="leaderboard-select"
                      value={selectedLeaderboard}
                      onChange={e => {
                        const value = e.target.value;
                        setSelectedLeaderboard(value);
                      }}
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-gold min-w-[180px]"
                    >
                      <option value="geral">Ranking Geral</option>
                      {pastLeaderboards.map(lb => {
                        return (
                          <option key={lb.leaderboard_id} value={lb.leaderboard_id}>
                            {lb.leaderboard_name} ({formatDate(lb.start_date)} - {formatDate(lb.end_date)})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="flex gap-2 mt-2 md:mt-0">
                    <button
                      className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${filter === 'all' ? 'bg-gold text-black border-gold' : 'bg-black/40 text-white border-white/10 hover:border-gold'}`}
                      onClick={() => setFilter('all')}
                      type="button"
                    >
                      Todos
                    </button>
                    <button
                      className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${filter === 'premium' ? 'bg-gold text-black border-gold' : 'bg-black/40 text-white border-white/10 hover:border-gold'}`}
                      onClick={() => setFilter('premium')}
                      type="button"
                    >
                      Premium
                    </button>
                    <a
                      href="/regras.pdf"
                      download
                      className="px-4 py-2 rounded-lg text-sm font-bold border border-white/10 bg-black/40 text-white hover:border-gold transition-colors"
                    >
                      Regras
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </PremiumCard>

          {/* Removido o card de Leaderboard ao vivo */}
          {nextLeaderboard && (
            <PremiumCard>
              <div className="p-6 md:p-8">
                <h2 className="text-lg font-black uppercase text-white">Próximo Ranking</h2>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Nome</p>
                    <p className="mt-1 font-bold text-white">{nextLeaderboard.leaderboard_name}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Início</p>
                    <p className="mt-1 font-bold text-white">{formatDate(nextLeaderboard.start_date)}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs uppercase tracking-[0.15em] text-zinc-400">Fim</p>
                    <p className="mt-1 font-bold text-white">{formatDate(nextLeaderboard.end_date)}</p>
                  </div>
                </div>
              </div>
            </PremiumCard>
          )}
          {!nextLeaderboard && (
            <PremiumCard>
              <div className="p-6 md:p-8 text-center">
                <h2 className="text-lg font-black uppercase text-white">Nenhuma leaderboard encontrada</h2>
                <p className="mt-3 text-sm text-zinc-400">Nenhuma leaderboard futura encontrada no momento.</p>
              </div>
            </PremiumCard>
          )}

          {showGeral ? (
            <PremiumCard>
              <div className="p-0">
                <div className="border-b border-white/10 px-6 py-4">
                  <h3 className="text-lg font-black uppercase text-white">
                    {selectedLeaderboard === 'geral' ? 'Jogadores do ranking geral' : 'Jogadores da leaderboard selecionada'} ({filteredPlayers.length})
                  </h3>
                </div>
                {loading ? (
                  <div className="p-8 text-center text-zinc-400">Carregando...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="bg-white/5 text-zinc-300">
                        <tr>
                          <th className="px-4 py-3 text-left">#</th>
                          <th className="px-4 py-3 text-left">Jogador</th>
                          <th className="px-3 py-3 text-center">Pontos</th>
                          <th className="px-3 py-3 text-center">Partidas</th>
                          <th className="px-3 py-3 text-center">Vitorias</th>
                          <th className="px-3 py-3 text-center">Derrotas</th>
                          <th className="px-3 py-3 text-center">WR</th>
                          <th className="px-3 py-3 text-center">Streak</th>
                          <th className="px-3 py-3 text-center">Premium</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPlayers.map((row) => (
                          <tr key={row.player.user_id} className="border-t border-white/5 bg-black/20 text-zinc-200 hover:bg-white/5">
                            <td className="px-4 py-3 font-bold text-white">{row.position}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="relative h-9 w-9 overflow-hidden rounded-full border border-white/10 bg-white/5">
                                  <Image
                                    src={row.player.avatar || "/images/cs2-player.png"}
                                    alt={row.player.nickname}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-white">{row.player.nickname}</p>
                                  <p className="text-xs text-zinc-400 uppercase">{row.player.country || "-"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center font-bold text-gold tabular-nums">{row.points}</td>
                            <td className="px-3 py-3 text-center tabular-nums">{row.played}</td>
                            <td className="px-3 py-3 text-center tabular-nums">{row.won}</td>
                            <td className="px-3 py-3 text-center tabular-nums">{row.lost}</td>
                            <td className="px-3 py-3 text-center tabular-nums">{Math.round((row.win_rate || 0) * 100)}%</td>
                            <td className="px-3 py-3 text-center tabular-nums">{row.current_streak}</td>
                            <td className="px-3 py-3 text-center">
                              {row.isPremium ? (
                                <span className="rounded-full bg-gold/80 px-2 py-1 text-xs font-black uppercase text-black border border-gold">★ Premium</span>
                              ) : (
                                <span className="text-zinc-500">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </PremiumCard>
          ) : (
            <PremiumCard>
              <div className="p-8 text-center">
                <h3 className="text-lg font-black uppercase text-white mb-2">Ranking geral indisponível</h3>
                <p className="text-zinc-400">Há uma leaderboard ativa no momento. O ranking geral só é exibido quando não há leaderboard ao vivo.</p>
              </div>
            </PremiumCard>
          )}
        </div>
      </div>
    </section>
  );
}

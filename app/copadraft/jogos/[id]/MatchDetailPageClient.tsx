"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

type PlayerStats = { K: number; D: number; A: number; HSK: number; HS: number; MVK: number };

type Lineup = {
  player_id: string;
  nickname: string;
  faceit_id: string;
  avatar?: string;
  steam_id?: string;
  stats?: PlayerStats | null;
};

type MatchData = {
  match_id: string;
  match_name: string;
  scheduled_at: number;
  status: string;
  best_of: number;
  queue_type: string;
  region: string;
  team1_name: string;
  team1_avatar: string;
  team2_name: string;
  team2_avatar: string;
  current_score_1: number;
  current_score_2: number;
  competition_name: string | null;
  server_name: string | null;
  selected_map: string | null;
  selected_map_image?: string | null;
  maps_picked?: string[];
  maps_banned?: string[];
  map_voting?: {
    picked_maps?: Array<{ map: string; selected_by: string | null; image?: string | null; order?: number }>;
    banned_maps?: Array<{ map: string; selected_by: string | null; image?: string | null; order?: number }>;
  } | null;
  rounds_won_1: number;
  rounds_won_2: number;
  team1_captain: string | null;
  team2_captain: string | null;
  team1_lineup: Lineup[];
  team2_lineup: Lineup[];
  maps_data?: Array<{ map: string; rounds_t1: number; rounds_t2: number; picked_by_team?: string | null; map_image?: string | null }> | null;
  maps_player_stats?: Record<string, Record<string, PlayerStats>> | null;
};

function asText(value: unknown, fallback = "-") {
  if (value == null) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const asAny = value as any;
    if (typeof asAny.name === "string") return asAny.name.trim() || fallback;
    if (typeof asAny.id === "string" || typeof asAny.id === "number") return String(asAny.id);
  }
  return fallback;
}

const TEAM_FLAG_BY_NAME: Record<string, string> = {
  argentina: "/selecoes/argentina.jpg",
  alemanha: "/selecoes/alemanha.jpg",
  mexico: "/selecoes/m%C3%A9xico.jpg",
  holanda: "/selecoes/holanda.jpg",
  franca: "/selecoes/fran%C3%A7a.jpg",
  inglaterra: "/selecoes/inglaterra.jpg",
  brasil: "/selecoes/brasil.jpg",
  italia: "/selecoes/it%C3%A1lia.jpg",
  portugal: "/selecoes/portugal.jpg",
  espanha: "/selecoes/espanha.jpg",
  japao: "/selecoes/jap%C3%A3o.jpg",
  croacia: "/selecoes/cro%C3%A1cia.jpg",
  belgica: "/selecoes/b%C3%A9lgica.jpg",
  uruguai: "/selecoes/uruguai.jpg",
};

function normalizeTeamKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(value: unknown) {
  return normalizeTeamKey(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTeamFlagSrc(teamName: unknown) {
  const key = normalizeTeamKey(teamName);
  return TEAM_FLAG_BY_NAME[key] || null;
}

function getMapWinChances(matchData: MatchData) {
  const series1 = Number(matchData.current_score_1 || 0);
  const series2 = Number(matchData.current_score_2 || 0);
  const rounds1 = Number(matchData.rounds_won_1 || 0);
  const rounds2 = Number(matchData.rounds_won_2 || 0);

  const seriesTotal = series1 + series2;
  const roundsTotal = rounds1 + rounds2;

  if (seriesTotal <= 0 && roundsTotal <= 0) {
    return { team1: 50, team2: 50 };
  }

  const seriesRatio1 = seriesTotal > 0 ? series1 / seriesTotal : 0.5;
  const roundsRatio1 = roundsTotal > 0 ? rounds1 / roundsTotal : 0.5;

  const weightedTeam1 = seriesRatio1 * 0.7 + roundsRatio1 * 0.3;
  const team1 = Math.max(1, Math.min(99, Math.round(weightedTeam1 * 100)));
  const team2 = 100 - team1;

  return { team1, team2 };
}

export default function MatchDetailPageClient() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMapTab, setActiveMapTab] = useState(0);
  const [statsTab, setStatsTab] = useState<string>("geral");

  const handleBack = () => {
    router.push("/copadraft/jogos/");
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/copadraft/prediction/match-details?match_id=${encodeURIComponent(matchId)}`);
        const data = await res.json();

        if (!data.ok) {
          setError(data.message || "Erro ao carregar partida");
          return;
        }

        setMatchData(data.matchData);
        setError(null);
      } catch (err) {
        console.error("Erro:", err);
        setError("Erro ao carregar dados da partida");
      } finally {
        setLoading(false);
      }
    };

    load();

    // Auto-refresh a cada 10 segundos
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [matchId]);

  const formatScheduledAt = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString("pt-BR");
  };

  const getStatusBadge = (status: string) => {
    const map: { [key: string]: { color: string; label: string } } = {
      UPCOMING: { color: "bg-yellow-100 text-yellow-800", label: "Próximo" },
      ONGOING: { color: "bg-blue-100 text-blue-800", label: "Ao Vivo" },
      FINISHED: { color: "bg-gray-100 text-gray-800", label: "Finalizado" },
    };
    const info = map[status] || { color: "bg-gray-100 text-gray-800", label: status };
    return <span className={`px-3 py-1 rounded-full text-sm font-bold ${info.color}`}>{info.label}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold mb-4">Carregando partida...</div>
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error || !matchData) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-4">Erro</h1>
          <p className="text-gray-400 mb-6">{error || "Partida não encontrada"}</p>
          <button onClick={handleBack} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-bold">
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const winChance = getMapWinChances(matchData);
  const hasMapsData = Array.isArray(matchData.maps_data) && matchData.maps_data.length > 0;
  const hasMultipleMaps = hasMapsData && matchData.maps_data!.length > 1;
  const showWinChance = String(matchData.status || "").toUpperCase() !== "FINISHED";

  // Current map data for rounds display
  let currentMapData: { map: string | null; rounds_t1: number; rounds_t2: number; picked_by_team?: string | null; map_image?: string | null } = {
    map: matchData.selected_map,
    rounds_t1: matchData.rounds_won_1,
    rounds_t2: matchData.rounds_won_2,
    picked_by_team: null,
    map_image: matchData.selected_map_image || null,
  };

  if (hasMapsData && matchData.maps_data) {
    currentMapData = matchData.maps_data[activeMapTab] || currentMapData;
  }

  const currentMapHeaderImage = currentMapData.map_image || matchData.selected_map_image || null;

  // Stats tab helpers
  const mapNames = (matchData.maps_data ?? []).map((m) => m.map).filter(Boolean);
  const allStatsTabs = ["geral", ...mapNames];
  const hasPerMapStats = Boolean(matchData.maps_player_stats && Object.keys(matchData.maps_player_stats).length > 0);
  const pickedMaps = Array.isArray(matchData.map_voting?.picked_maps) ? matchData.map_voting!.picked_maps! : [];
  const bannedMaps = Array.isArray(matchData.map_voting?.banned_maps) ? matchData.map_voting!.banned_maps! : [];

  function getPickedByLabel(selectedBy: string | null | undefined, index: number) {
    const team1Name = matchData?.team1_name || "Team 1";
    const team2Name = matchData?.team2_name || "Team 2";
    const raw = String(selectedBy || "").trim();
    const normalized = normalizeTeamKey(raw);

    if (normalized === "faction1") return team1Name;
    if (normalized === "faction2") return team2Name;
    if (raw) return raw;

    // Fallback de turno: primeiro pick eh faction1, depois alterna por ordem.
    return index % 2 === 0 ? team1Name : team2Name;
  }

  function getPlayerStats(nickname: string, aggregateStats: PlayerStats | null | undefined): PlayerStats | null {
    if (statsTab === "geral" || !hasPerMapStats) return aggregateStats ?? null;
    return matchData!.maps_player_stats?.[statsTab]?.[nickname] ?? null;
  }

  function fmtKD(stats: PlayerStats | null) {
    if (!stats) return "-";
    return (stats.K / Math.max(stats.D, 1)).toFixed(2);
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Voltar */}
        <div className="mb-6">
          <button onClick={handleBack} className="text-blue-400 hover:text-blue-300">
            ← Voltar
          </button>
        </div>

        {/* Match Header */}
        <div className="relative bg-gray-800 rounded-lg p-8 mb-6 overflow-hidden">
          {currentMapHeaderImage && (
            <Image
              src={currentMapHeaderImage}
              alt={currentMapData.map || matchData.selected_map || "Mapa"}
              fill
              className="object-cover opacity-20"
            />
          )}
          <div className="absolute inset-0 bg-gray-900/55" />
          <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{matchData.match_name}</h1>
              <div className="flex gap-3 flex-wrap">
                {getStatusBadge(matchData.status)}
                <span className="px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-800">
                  {matchData.best_of === 1 ? "MD1" : matchData.best_of === 2 ? "BO2" : matchData.best_of === 3 ? "MD3" : `MD${matchData.best_of}`}
                </span>
              </div>
            </div>
          </div>

          {/* Abas de mapas */}
          {hasMapsData && (
            <div className="flex gap-2 mb-6 border-b border-gray-600 flex-wrap">
              {matchData.maps_data!.map((mapData, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveMapTab(idx)}
                  className={`px-4 py-2 font-bold transition-all ${
                    activeMapTab === idx
                      ? "border-b-2 border-cyan-400 text-cyan-300"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  Mapa {idx + 1}: {mapData.map}
                </button>
              ))}
            </div>
          )}

          {/* Score */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-center py-4">
            <div className="relative rounded-xl border border-gray-600 bg-gray-900/60 overflow-hidden min-h-[180px] flex items-center justify-center">
              {getTeamFlagSrc(matchData.team1_name) && (
                <Image
                  src={getTeamFlagSrc(matchData.team1_name) as string}
                  alt={`Bandeira ${matchData.team1_name}`}
                  fill
                  className="object-cover opacity-20"
                />
              )}
              <div className="relative z-10 py-6">
                {showWinChance && (
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-1">Chance: {winChance.team1}%</p>
                )}
                <Link
                  href={`/copadraft/times/${slugify(matchData.team1_name)}`}
                  className="text-2xl font-black mb-2 underline underline-offset-4 text-cyan-300 hover:text-cyan-200 block"
                >
                  {matchData.team1_name}
                </Link>
                <div className="text-5xl font-bold text-yellow-400">{matchData.current_score_1}</div>
              </div>
            </div>
            <div className="text-gray-500 text-2xl flex flex-col items-center gap-3">
              <span>VS</span>
              <a
                href={`https://www.faceit.com/pt/cs2/room/${encodeURIComponent(matchData.match_id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-700/70 hover:bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 flex items-center gap-2 text-sm"
              >
                <Image src="/images/faceit.png" alt="FACEIT" width={16} height={16} />
                Abrir na FACEIT
              </a>
            </div>
            <div className="relative rounded-xl border border-gray-600 bg-gray-900/60 overflow-hidden min-h-[180px] flex items-center justify-center">
              {getTeamFlagSrc(matchData.team2_name) && (
                <Image
                  src={getTeamFlagSrc(matchData.team2_name) as string}
                  alt={`Bandeira ${matchData.team2_name}`}
                  fill
                  className="object-cover opacity-20"
                />
              )}
              <div className="relative z-10 py-6">
                {showWinChance && (
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-1">Chance: {winChance.team2}%</p>
                )}
                <Link
                  href={`/copadraft/times/${slugify(matchData.team2_name)}`}
                  className="text-2xl font-black mb-2 underline underline-offset-4 text-cyan-300 hover:text-cyan-200 block"
                >
                  {matchData.team2_name}
                </Link>
                <div className="text-5xl font-bold text-yellow-400">{matchData.current_score_2}</div>
              </div>
            </div>
          </div>

          {/* Rounds por mapa */}
          {hasMapsData && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-center py-4 mt-4">
              <div className="relative rounded-xl border border-gray-600 bg-gray-900/60 overflow-hidden min-h-[120px] flex items-center justify-center">
                <div className="relative z-10 py-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Rounds</p>
                  <div className="text-4xl font-bold text-yellow-400">{currentMapData.rounds_t1}</div>
                </div>
              </div>
              <div className="text-gray-500 text-lg">
                <p className="text-xs text-gray-400">{hasMultipleMaps ? "Mapa Selecionado" : "Mapa"}</p>
                <p className="font-bold text-cyan-300">{currentMapData.map}</p>
                {currentMapData.picked_by_team && (
                  <p className="text-xs text-emerald-400 mt-1">Pick: {currentMapData.picked_by_team}</p>
                )}
              </div>
              <div className="relative rounded-xl border border-gray-600 bg-gray-900/60 overflow-hidden min-h-[120px] flex items-center justify-center">
                <div className="relative z-10 py-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Rounds</p>
                  <div className="text-4xl font-bold text-yellow-400">{currentMapData.rounds_t2}</div>
                </div>
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Lineups com abas Geral / por mapa */}
        <div className="flex flex-col gap-6 w-full">
          {/* Tabs de stats */}
          {(hasPerMapStats || matchData.team1_lineup.some(p => p.stats)) && (
            <div className="flex gap-2 border-b border-gray-700 flex-wrap">
              {allStatsTabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatsTab(tab)}
                  className={`px-4 py-2 text-sm font-bold transition-all ${
                    statsTab === tab
                      ? "border-b-2 border-cyan-400 text-cyan-300"
                      : "text-gray-400 hover:text-gray-300"
                  }`}
                >
                  {tab === "geral" ? "Geral" : tab}
                </button>
              ))}
            </div>
          )}

          {[{ name: matchData.team1_name, lineup: matchData.team1_lineup }, { name: matchData.team2_name, lineup: matchData.team2_lineup }].map(({ name, lineup }) => (
            <div key={name} className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">{name}</h2>
              {lineup && lineup.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-600">
                        <th className="text-left px-3 py-2 font-bold text-gray-400 sticky left-0 bg-gray-800">Jogador</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400">K</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400">D</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400">A</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400">K/D</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400">HS%</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400">MVP</th>
                        <th className="text-center px-2 py-2 font-bold text-gray-400">Perfil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineup.map((player, idx) => {
                        const s = getPlayerStats(player.nickname, player.stats);
                        return (
                          <tr key={idx} className="border-b border-gray-700 hover:bg-gray-700/50">
                            <td className="px-3 py-3 font-semibold flex items-center gap-2 sticky left-0 bg-gray-800">
                              <Image
                                src={player.avatar || "/placeholder-user.jpg"}
                                alt={player.nickname}
                                width={24}
                                height={24}
                                className="rounded-full border border-gray-600"
                              />
                              <span>{player.nickname}</span>
                            </td>
                            <td className="px-2 py-3 text-center"><span className="font-bold text-white">{s?.K ?? "-"}</span></td>
                            <td className="px-2 py-3 text-center"><span className="font-bold text-white">{s?.D ?? "-"}</span></td>
                            <td className="px-2 py-3 text-center"><span className="font-bold text-white">{s?.A ?? "-"}</span></td>
                            <td className="px-2 py-3 text-center"><span className="font-semibold text-white">{fmtKD(s)}</span></td>
                            <td className="px-2 py-3 text-center"><span className="font-bold text-white">{s ? `${s.HS}%` : "-"}</span></td>
                            <td className="px-2 py-3 text-center"><span className="font-bold text-white">{s?.MVK ?? "-"}</span></td>
                            <td className="px-2 py-3 text-center">
                              {player.nickname && (
                                <a
                                  href={`https://www.faceit.com/pt/players/${encodeURIComponent(player.nickname)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold"
                                >
                                  Ver
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-400">Sem dados</p>
              )}
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="mb-6 mt-6">
          {/* Match Info */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Informações</h2>
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm">Data/Hora</p>
                <p className="font-bold">{formatScheduledAt(matchData.scheduled_at)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Tipo de Fila</p>
                <p className="font-bold">{asText(matchData.queue_type)}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Região</p>
                <p className="font-bold">{asText(matchData.region)}</p>
              </div>
              {matchData.competition_name && (
                <div>
                  <p className="text-gray-400 text-sm">Competição</p>
                  <p className="font-bold">{asText(matchData.competition_name)}</p>
                </div>
              )}
              {matchData.server_name && (
                <div>
                  <p className="text-gray-400 text-sm">Servidor</p>
                  <p className="font-bold">{asText(matchData.server_name)}</p>
                </div>
              )}
              {matchData.selected_map && (
                <div>
                  <p className="text-gray-400 text-sm">Mapa</p>
                  <p className="font-bold">{asText(matchData.selected_map)}</p>
                </div>
              )}
              <div>
                <p className="text-gray-400 text-sm">Mapas Pickados</p>
                {pickedMaps.length > 0 ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {pickedMaps.map((item, idx) => {
                      const pickBy = getPickedByLabel(item.selected_by, idx);
                      return (
                        <div key={`pick-${idx}-${item.map}`} className="rounded-lg border border-white/10 bg-black/20 p-2">
                          <div className="flex items-center gap-2">
                            {item.image ? (
                              <Image src={item.image} alt={item.map} width={58} height={34} className="rounded border border-white/10 object-cover" />
                            ) : null}
                            <div>
                              <p className="text-xs text-cyan-300">Pick #{item.order || idx + 1}</p>
                              <p className="font-bold">{item.map}</p>
                              <p className="text-xs text-zinc-300">Por: {pickBy || "-"}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="font-bold">-</p>
                )}
              </div>
              <div>
                <p className="text-gray-400 text-sm">Mapas Banidos</p>
                {bannedMaps.length > 0 ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {bannedMaps.map((item, idx) => (
                      <div key={`ban-${idx}-${item.map}`} className="rounded-lg border border-white/10 bg-black/20 p-2">
                        <div className="flex items-center gap-2">
                          {item.image ? (
                            <Image src={item.image} alt={item.map} width={58} height={34} className="rounded border border-white/10 object-cover" />
                          ) : null}
                          <div>
                            <p className="text-xs text-amber-300">Ban #{item.order || idx + 1}</p>
                            <p className="font-bold">{item.map}</p>
                            <p className="text-xs text-zinc-300">Por: {item.selected_by || "-"}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="font-bold">-</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Auto-refresh info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Esta página se atualiza a cada 10 segundos</p>
        </div>
      </div>
    </div>
  );
}

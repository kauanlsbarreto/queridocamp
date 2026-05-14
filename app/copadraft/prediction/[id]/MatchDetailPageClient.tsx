"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

type Lineup = {
  player_id: string;
  nickname: string;
  faceit_id: string;
  avatar?: string;
  steam_id?: string;
  stats?: {
    K: number;
    D: number;
    A: number;
    HSK: number;
    HS: number;
    MVK: number;
  } | null;
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
  rounds_won_1: number;
  rounds_won_2: number;
  team1_captain: string | null;
  team2_captain: string | null;
  team1_lineup: Lineup[];
  team2_lineup: Lineup[];
  maps_data?: Array<{ map: string; rounds_t1: number; rounds_t2: number }> | null;
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
  const matchId = params.id as string;

  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMapTab, setActiveMapTab] = useState(0);

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
          <Link href="/copadraft/prediction" className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-bold">
            Voltar
          </Link>
        </div>
      </div>
    );
  }

  const winChance = getMapWinChances(matchData);
  const isBO2 = matchData.best_of === 2;
  const hasMultipleMaps = isBO2 && matchData.maps_data && matchData.maps_data.length > 1;

  // Get current map data for BO2+
  let currentMapData = {
    map: matchData.selected_map,
    rounds_t1: matchData.rounds_won_1,
    rounds_t2: matchData.rounds_won_2,
  };

  if (hasMultipleMaps && matchData.maps_data) {
    currentMapData = matchData.maps_data[activeMapTab] || currentMapData;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Voltar */}
        <div className="mb-6">
          <Link href="/copadraft/prediction" className="text-blue-400 hover:text-blue-300">
            ← Voltar
          </Link>
        </div>

        {/* Match Header */}
        <div className="relative bg-gray-800 rounded-lg p-8 mb-6 overflow-hidden">
          {matchData.selected_map_image && (
            <Image
              src={matchData.selected_map_image}
              alt={matchData.selected_map || "Mapa"}
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
                  {matchData.best_of === 1 ? "MD1" : matchData.best_of === 3 ? "MD3" : "MD5"}
                </span>
              </div>
            </div>
          </div>

          {/* Abas para BO2 */}
          {hasMultipleMaps && (
            <div className="flex gap-2 mb-6 border-b border-gray-600">
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
                <p className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-1">Chance: {winChance.team1}%</p>
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
                <p className="text-xs font-black uppercase tracking-wider text-emerald-300 mb-1">Chance: {winChance.team2}%</p>
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

          {/* Rounds para BO2 */}
          {hasMultipleMaps && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center text-center py-4 mt-4">
              <div className="relative rounded-xl border border-gray-600 bg-gray-900/60 overflow-hidden min-h-[120px] flex items-center justify-center">
                <div className="relative z-10 py-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Rounds</p>
                  <div className="text-4xl font-bold text-yellow-400">{currentMapData.rounds_t1}</div>
                </div>
              </div>
              <div className="text-gray-500 text-lg">
                <p className="text-xs text-gray-400">Mapa Atual</p>
                <p className="font-bold text-cyan-300">{currentMapData.map}</p>
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

        {/* Lineups */}
        <div className="grid grid-cols-1 gap-6 w-full">
          {/* Team 1 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">{matchData.team1_name}</h2>
            {matchData.team1_lineup && matchData.team1_lineup.length > 0 ? (
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
                    {matchData.team1_lineup.map((player, idx) => (
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
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.K || "-"}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.D || "-"}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.A || "-"}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-semibold text-white">
                            {player.stats ? ((player.stats.K / Math.max(player.stats.D, 1)).toFixed(2)) : "-"}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.HS || "-"}%</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.MVK || "-"}</span>
                        </td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">Sem dados</p>
            )}
          </div>

          {/* Team 2 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">{matchData.team2_name}</h2>
            {matchData.team2_lineup && matchData.team2_lineup.length > 0 ? (
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
                    {matchData.team2_lineup.map((player, idx) => (
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
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.K || "-"}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.D || "-"}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.A || "-"}</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-semibold text-white">
                            {player.stats ? ((player.stats.K / Math.max(player.stats.D, 1)).toFixed(2)) : "-"}
                          </span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.HS || "-"}%</span>
                        </td>
                        <td className="px-2 py-3 text-center">
                          <span className="font-bold text-white">{player.stats?.MVK || "-"}</span>
                        </td>
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
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-400">Sem dados</p>
            )}
          </div>
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
                <p className="font-bold">
                  {Array.isArray(matchData.maps_picked) && matchData.maps_picked.length > 0
                    ? matchData.maps_picked.join(", ")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Mapas Banidos</p>
                <p className="font-bold">
                  {Array.isArray(matchData.maps_banned) && matchData.maps_banned.length > 0
                    ? matchData.maps_banned.join(", ")
                    : "-"}
                </p>
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

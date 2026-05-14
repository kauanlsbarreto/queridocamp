import { NextRequest, NextResponse } from "next/server";
import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const QUERY_TIMEOUT_MS = 30000;

function toSimpleText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const asAny = value as any;
    if (typeof asAny.name === "string") return asAny.name.trim();
    if (typeof asAny.id === "string" || typeof asAny.id === "number") return String(asAny.id).trim();
  }
  return "";
}

function uniqueStrings(values: unknown[]) {
  const set = new Set<string>();
  for (const value of values) {
    const normalized = toSimpleText(value);
    if (normalized) set.add(normalized);
  }
  return Array.from(set);
}

function uniqueMaps(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const mapName = toSimpleText(value);
    if (mapName) {
      const normalized = normalizeMapToken(mapName);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(mapName);
      }
    }
  }
  return result;
}

function normalizeMapToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^de_/, "");
}

function normalizeStatus(value: unknown) {
  const status = String(value || "").trim().toUpperCase();
  if (!status) return "UPCOMING";
  if (["FINISHED", "CANCELLED", "ABORTED"].includes(status)) return "FINISHED";
  if (["ONGOING", "READY", "CONFIGURING", "VOTING", "CHECK_IN"].includes(status)) return "ONGOING";
  return "UPCOMING";
}

function extractPlayerStats(matchStats: any) {
  const playerStats: Record<string, any> = {}; // Map by nickname

  if (!matchStats?.rounds?.length) {
    return playerStats;
  }

  // Process all rounds and all teams
  for (let roundIdx = 0; roundIdx < matchStats.rounds.length; roundIdx++) {
    const round = matchStats.rounds[roundIdx];
    
    if (!round.teams || !Array.isArray(round.teams)) {
      continue;
    }

    // Process each team in this round
    for (let teamIdx = 0; teamIdx < round.teams.length; teamIdx++) {
      const teamData = round.teams[teamIdx];
      
      if (!teamData?.players || !Array.isArray(teamData.players)) {
        continue;
      }

      for (const player of teamData.players) {
        const nickname = player.nickname;
        const stats = player.player_stats;
        
        if (!nickname || !stats) {
          continue;
        }

        if (!playerStats[nickname]) {
          playerStats[nickname] = {
            K: 0,
            D: 0,
            A: 0,
            HSK: 0,
            HS: 0,
            MVK: 0,
          };
        }

        // Convert all stats values to numbers and aggregate
        const kills = Number(stats["Kills"]) || 0;
        const deaths = Number(stats["Deaths"]) || 0;
        const assists = Number(stats["Assists"]) || 0;
        const headshots = Number(stats["Headshots"] || stats["Headshot Kills"] || 0) || 0;
        const mvps = Number(stats["MVPs"]) || 0;

        playerStats[nickname].K += kills;
        playerStats[nickname].D += deaths;
        playerStats[nickname].A += assists;
        playerStats[nickname].HSK += headshots;
        playerStats[nickname].MVK += mvps;
      }
    }
  }

  // Calculate HS% (headshot percentage)
  for (const nickname in playerStats) {
    const total = playerStats[nickname].K;
    if (total > 0) {
      playerStats[nickname].HS = Math.round((playerStats[nickname].HSK / total) * 100);
    } else {
      playerStats[nickname].HS = 0;
    }
  }

  return playerStats;
}

async function fetchFaceitMatch(matchId: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${FACEIT_API_BASE}/matches/${matchId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`FACEIT error: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFaceitMatchStats(matchId: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${FACEIT_API_BASE}/matches/${matchId}/stats`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    // Stats endpoint is optional for this page; never fail the whole request.
    if (!response.ok) return null;
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPlayerData(faceitId: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${FACEIT_API_BASE}/players/${faceitId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`FACEIT error: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: NextRequest) {
  let mainConn: any = null;

  try {
    const matchId = request.nextUrl.searchParams.get("match_id");
    const env = (await getRuntimeEnv()) as Env;
    const faceitApiKey = process.env.FACEIT_API_KEY || "";

    if (!matchId) {
      return NextResponse.json({ ok: false, message: "match_id obrigatório." }, { status: 400 });
    }

    if (!faceitApiKey) {
      return NextResponse.json({ ok: false, message: "FACEIT API key não configurada." }, { status: 500 });
    }

    mainConn = await createMainConnection(env);

    // Fetch from FACEIT API
    const [matchData, matchStats] = await Promise.all([
      fetchFaceitMatch(matchId, faceitApiKey),
      fetchFaceitMatchStats(matchId, faceitApiKey),
    ]);

    if (!matchData || !matchData.match_id) {
      return NextResponse.json({ ok: false, message: "Match não encontrado." }, { status: 404 });
    }

    // Build lineup data
    const team1_lineup = matchData.teams?.faction1?.roster || [];
    const team2_lineup = matchData.teams?.faction2?.roster || [];

    // Extract player stats if match is finished
    const normalizedStatus = normalizeStatus(matchData.status);
    const allPlayerStats = normalizedStatus === "FINISHED" ? extractPlayerStats(matchStats) : {};
    const team1PlayerStats = Object.fromEntries(
      team1_lineup.map((p: any) => [p.nickname, allPlayerStats[p.nickname] || null]).filter(([_, v]: [any, any]) => v !== null)
    );
    const team2PlayerStats = Object.fromEntries(
      team2_lineup.map((p: any) => [p.nickname, allPlayerStats[p.nickname] || null]).filter(([_, v]: [any, any]) => v !== null)
    );

    // Extract Steam IDs if available
    const team1WithSteam = await Promise.all(
      team1_lineup.map(async (player: any) => {
        try {
          const playerData = await fetchPlayerData(player.faceit_id, faceitApiKey);
          return {
            ...player,
            avatar: player.avatar || playerData.avatar || null,
            steam_id: playerData.steam_id_64 || null,
            stats: team1PlayerStats[player.nickname] || null,
          };
        } catch {
          return {
            ...player,
            stats: team1PlayerStats[player.nickname] || null,
          };
        }
      })
    );

    const team2WithSteam = await Promise.all(
      team2_lineup.map(async (player: any) => {
        try {
          const playerData = await fetchPlayerData(player.faceit_id, faceitApiKey);
          return {
            ...player,
            avatar: player.avatar || playerData.avatar || null,
            steam_id: playerData.steam_id_64 || null,
            stats: team2PlayerStats[player.nickname] || null,
          };
        } catch {
          return {
            ...player,
            stats: team2PlayerStats[player.nickname] || null,
          };
        }
      })
    );

    // Calculate rounds won and map flow (stats maps are authoritative when available)
    let roundsWon1 = 0, roundsWon2 = 0;
    let statsMapOrder: string[] = [];
    let mapsData: Array<{ map: string; rounds_t1: number; rounds_t2: number }> = [];
    
    if (matchStats?.rounds?.length) {
      const lastRound = matchStats.rounds[matchStats.rounds.length - 1];
      roundsWon1 = lastRound.results?.faction1 || 0;
      roundsWon2 = lastRound.results?.faction2 || 0;
      statsMapOrder = uniqueStrings(
        matchStats.rounds.map((round: any) => String(round?.round_stats?.Map || "").trim()).filter(Boolean)
      );
      
      // For BO2+, extract individual map scores
      const groupedByMap: Record<string, { t1: number; t2: number }> = {};
      for (const round of matchStats.rounds) {
        const mapName = String(round?.round_stats?.Map || "").trim();
        if (mapName) {
          if (!groupedByMap[mapName]) {
            groupedByMap[mapName] = { t1: 0, t2: 0 };
          }
          groupedByMap[mapName].t1 = round.results?.faction1 || 0;
          groupedByMap[mapName].t2 = round.results?.faction2 || 0;
        }
      }
      mapsData = Object.entries(groupedByMap).map(([map, scores]) => ({
        map,
        rounds_t1: scores.t1,
        rounds_t2: scores.t2,
      }));
    }

    const votingMap = matchData?.voting?.map || {};
    const rawEntities = Array.isArray(votingMap?.entities) ? votingMap.entities : [];
    const entityRows: Array<{ label: string; tokens: string[]; image: string | null }> = rawEntities
      .map((entry: any) => ({
        label:
          toSimpleText(entry?.name) ||
          toSimpleText(entry?.class_name) ||
          toSimpleText(entry?.game_map_id) ||
          toSimpleText(entry?.guid),
        tokens: [
          normalizeMapToken(entry?.name),
          normalizeMapToken(entry?.class_name),
          normalizeMapToken(entry?.game_map_id),
          normalizeMapToken(entry?.guid),
        ].filter(Boolean),
        image: toSimpleText(entry?.image_lg) || toSimpleText(entry?.image_sm) || null,
      }))
      .filter((row: { label: string; tokens: string[]; image: string | null }) => row.label);

    const pickedTokens = new Set(
      uniqueStrings([
        ...statsMapOrder,
        ...(Array.isArray(votingMap?.pick) ? votingMap.pick : []),
        ...(Array.isArray(votingMap?.picked) ? votingMap.picked : []),
        ...(Array.isArray(votingMap?.selected) ? votingMap.selected : []),
      ]).map((value) => normalizeMapToken(value))
    );

    const mapsPicked = uniqueMaps([
      ...statsMapOrder,
      ...entityRows
        .filter((row: { label: string; tokens: string[]; image: string | null }) => row.tokens.some((t: string) => pickedTokens.has(t)))
        .map((row: { label: string; tokens: string[]; image: string | null }) => row.label),
    ]);

    const mapsBanned = uniqueMaps(
      entityRows
        .filter((row: { label: string; tokens: string[]; image: string | null }) => !row.tokens.some((t: string) => pickedTokens.has(t)))
        .map((row: { label: string; tokens: string[]; image: string | null }) => row.label)
    );
    const selectedMap = toSimpleText(matchData?.voting?.map?.map) || toSimpleText(mapsPicked[0]) || null;
    const selectedMapToken = normalizeMapToken(selectedMap || mapsPicked[0] || "");
    const selectedMapImage =
      entityRows.find((row: { label: string; tokens: string[]; image: string | null }) =>
        row.tokens.some((t: string) => t === selectedMapToken)
      )?.image || null;

    const team1CaptainId = String(matchData.teams?.faction1?.captain || "").trim();
    const team2CaptainId = String(matchData.teams?.faction2?.captain || "").trim();
    const team1CaptainName =
      team1WithSteam.find((p: any) => String(p?.faceit_id || "").trim() === team1CaptainId)?.nickname ||
      team1CaptainId ||
      null;
    const team2CaptainName =
      team2WithSteam.find((p: any) => String(p?.faceit_id || "").trim() === team2CaptainId)?.nickname ||
      team2CaptainId ||
      null;

    const matchDataResponse = {
      match_id: matchId,
      match_name: `${matchData.teams?.faction1?.name} vs ${matchData.teams?.faction2?.name}`,
      scheduled_at: matchData.started_at || matchData.scheduled_at || Math.floor(Date.now() / 1000),
      status: normalizedStatus,
      best_of: matchData.best_of || 3,
      queue_type: toSimpleText(matchData.competition_type) || toSimpleText(matchData.type) || toSimpleText(matchData.game) || "CS2",
      region: toSimpleText(matchData.region) || toSimpleText(matchData?.voting?.location) || "-",
      team1_name: matchData.teams?.faction1?.name || "Team 1",
      team1_avatar: matchData.teams?.faction1?.avatar || null,
      team2_name: matchData.teams?.faction2?.name || "Team 2",
      team2_avatar: matchData.teams?.faction2?.avatar || null,
      current_score_1: matchData.results?.score?.faction1 || 0,
      current_score_2: matchData.results?.score?.faction2 || 0,
      competition_name: toSimpleText(matchData.competition_name) || toSimpleText(matchData.competition_id) || null,
      server_name: toSimpleText(matchData?.voting?.location) || toSimpleText(matchData?.broadcast) || null,
      selected_map: selectedMap,
      selected_map_image: selectedMapImage,
      maps_picked: mapsPicked,
      maps_banned: mapsBanned,
      team1_captain: team1CaptainName,
      team2_captain: team2CaptainName,
      rounds_won_1: roundsWon1,
      rounds_won_2: roundsWon2,
      team1_lineup: team1WithSteam,
      team2_lineup: team2WithSteam,
      // For BO2+, include individual map data
      maps_data: mapsData.length > 0 ? mapsData : null,
    };

    return NextResponse.json({
      ok: true,
      matchData: matchDataResponse,
    });
  } catch (error) {
    console.error("[copadraft/prediction/match-details]", error);
    return NextResponse.json({ ok: false, message: "Erro ao carregar partida." }, { status: 500 });
  } finally {
    if (mainConn) mainConn.end();
  }
}

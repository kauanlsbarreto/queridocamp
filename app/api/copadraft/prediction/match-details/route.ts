import { NextRequest, NextResponse } from "next/server";
import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const revalidate = 3600;

const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const QUERY_TIMEOUT_MS = 30000;
const FACEIT_REVALIDATE_SECONDS = 3600;

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

type MapVoteItem = {
  map: string;
  selected_by: string | null;
  image: string | null;
  order: number;
};

function normalizeTeamKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function resolveSelectedByLabel(value: unknown, team1Name: string, team2Name: string) {
  const raw = toSimpleText(value);
  if (!raw) return null;
  const normalized = normalizeTeamKey(raw);
  if (normalized === "faction1" || normalized === normalizeTeamKey(team1Name)) return team1Name;
  if (normalized === "faction2" || normalized === normalizeTeamKey(team2Name)) return team2Name;
  return raw;
}

function buildMapVotingSummary(votingMap: any, team1Name: string, team2Name: string): {
  picked_maps: MapVoteItem[];
  banned_maps: MapVoteItem[];
} {
  const entities = Array.isArray(votingMap?.entities) ? votingMap.entities : [];
  const byToken = new Map<
    string,
    { map: string; image: string | null; pickBy: string | null; banBy: string | null }
  >();

  for (const entry of entities) {
    const label =
      toSimpleText(entry?.name) ||
      toSimpleText(entry?.class_name) ||
      toSimpleText(entry?.game_map_id) ||
      toSimpleText(entry?.guid);
    if (!label) continue;

    const image = toSimpleText(entry?.image_lg) || toSimpleText(entry?.image_sm) || null;
    const pickBy =
      resolveSelectedByLabel(entry?.selected_by ?? entry?.picked_by ?? entry?.pick_by, team1Name, team2Name) || null;
    const banBy =
      resolveSelectedByLabel(
        entry?.dropped_by ?? entry?.drop_by ?? entry?.removed_by ?? entry?.banned_by ?? entry?.ban_by,
        team1Name,
        team2Name
      ) || null;

    const tokens = [
      normalizeMapToken(entry?.name),
      normalizeMapToken(entry?.class_name),
      normalizeMapToken(entry?.game_map_id),
      normalizeMapToken(entry?.guid),
      normalizeMapToken(label),
    ].filter(Boolean) as string[];

    for (const token of tokens) {
      if (!byToken.has(token)) {
        byToken.set(token, { map: label, image, pickBy, banBy });
      }
    }
  }

  const pickRaw = [
    ...(Array.isArray(votingMap?.pick) ? votingMap.pick : []),
    ...(Array.isArray(votingMap?.picked) ? votingMap.picked : []),
    ...(Array.isArray(votingMap?.selected) ? votingMap.selected : []),
  ];
  const dropRaw = [
    ...(Array.isArray(votingMap?.drop) ? votingMap.drop : []),
    ...(Array.isArray(votingMap?.dropped) ? votingMap.dropped : []),
    ...(Array.isArray(votingMap?.ban) ? votingMap.ban : []),
    ...(Array.isArray(votingMap?.banned) ? votingMap.banned : []),
  ];

  const picked_maps: MapVoteItem[] = [];
  const seenPick = new Set<string>();
  pickRaw.forEach((value: unknown, idx: number) => {
    const token = normalizeMapToken(value);
    if (!token || seenPick.has(token)) return;
    seenPick.add(token);
    const meta = byToken.get(token);
    picked_maps.push({
      map: meta?.map || toSimpleText(value) || `Mapa ${idx + 1}`,
      selected_by: meta?.pickBy || null,
      image: meta?.image || null,
      order: idx + 1,
    });
  });

  const allBans: MapVoteItem[] = [];
  const seenBan = new Set<string>();
  dropRaw.forEach((value: unknown, idx: number) => {
    const token = normalizeMapToken(value);
    if (!token || seenBan.has(token)) return;
    seenBan.add(token);
    const meta = byToken.get(token);
    allBans.push({
      map: meta?.map || toSimpleText(value) || `Ban ${idx + 1}`,
      selected_by: meta?.banBy || null,
      image: meta?.image || null,
      order: idx + 1,
    });
  });

  // Rule requested: keep only the first banned map per team (or first 2 if side attribution is missing)
  const firstBanByTeam = new Map<string, MapVoteItem>();
  const fallbackBans: MapVoteItem[] = [];
  for (const ban of allBans) {
    const key = normalizeTeamKey(ban.selected_by);
    if (key && !firstBanByTeam.has(key)) {
      firstBanByTeam.set(key, ban);
      continue;
    }
    if (!key) fallbackBans.push(ban);
  }

  const banned_maps: MapVoteItem[] = [];
  const t1Key = normalizeTeamKey(team1Name);
  const t2Key = normalizeTeamKey(team2Name);
  if (firstBanByTeam.has(t1Key)) banned_maps.push(firstBanByTeam.get(t1Key)!);
  if (firstBanByTeam.has(t2Key)) banned_maps.push(firstBanByTeam.get(t2Key)!);

  if (banned_maps.length === 0) {
    banned_maps.push(...allBans.slice(0, 2));
  } else if (banned_maps.length < 2) {
    for (const ban of fallbackBans) {
      if (banned_maps.length >= 2) break;
      if (!banned_maps.find((item) => normalizeMapToken(item.map) === normalizeMapToken(ban.map))) {
        banned_maps.push(ban);
      }
    }
  }

  return { picked_maps, banned_maps };
}

type PlayerStats = { K: number; D: number; A: number; HSK: number; HS: number; MVK: number };

function calcHS(stats: PlayerStats) {
  stats.HS = stats.K > 0 ? Math.round((stats.HSK / stats.K) * 100) : 0;
}

function extractPlayerStatsPerMap(matchStats: any): {
  aggregate: Record<string, PlayerStats>;
  byMap: Record<string, Record<string, PlayerStats>>;
} {
  const aggregate: Record<string, PlayerStats> = {};
  const byMap: Record<string, Record<string, PlayerStats>> = {};

  if (!matchStats?.rounds?.length) return { aggregate, byMap };

  for (const round of matchStats.rounds) {
    const mapName = String(round?.round_stats?.Map || "").trim();
    if (mapName && !byMap[mapName]) byMap[mapName] = {};

    if (!round.teams || !Array.isArray(round.teams)) continue;

    for (const teamData of round.teams) {
      if (!teamData?.players || !Array.isArray(teamData.players)) continue;

      for (const player of teamData.players) {
        const nickname = player.nickname;
        const stats = player.player_stats;
        if (!nickname || !stats) continue;

        const K = Number(stats["Kills"]) || 0;
        const D = Number(stats["Deaths"]) || 0;
        const A = Number(stats["Assists"]) || 0;
        const HSK = Number(stats["Headshots"] || stats["Headshot Kills"] || 0) || 0;
        const MVK = Number(stats["MVPs"]) || 0;

        // aggregate
        if (!aggregate[nickname]) aggregate[nickname] = { K: 0, D: 0, A: 0, HSK: 0, HS: 0, MVK: 0 };
        aggregate[nickname].K += K;
        aggregate[nickname].D += D;
        aggregate[nickname].A += A;
        aggregate[nickname].HSK += HSK;
        aggregate[nickname].MVK += MVK;

        // per-map
        if (mapName) {
          if (!byMap[mapName][nickname]) byMap[mapName][nickname] = { K: 0, D: 0, A: 0, HSK: 0, HS: 0, MVK: 0 };
          byMap[mapName][nickname].K += K;
          byMap[mapName][nickname].D += D;
          byMap[mapName][nickname].A += A;
          byMap[mapName][nickname].HSK += HSK;
          byMap[mapName][nickname].MVK += MVK;
        }
      }
    }
  }

  for (const s of Object.values(aggregate)) calcHS(s);
  for (const mapStats of Object.values(byMap)) for (const s of Object.values(mapStats)) calcHS(s);

  return { aggregate, byMap };
}


async function fetchFaceitMatch(matchId: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${FACEIT_API_BASE}/matches/${matchId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      cache: "force-cache",
      next: { revalidate: FACEIT_REVALIDATE_SECONDS },
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
      cache: "force-cache",
      next: { revalidate: FACEIT_REVALIDATE_SECONDS },
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
      cache: "force-cache",
      next: { revalidate: FACEIT_REVALIDATE_SECONDS },
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
    const { aggregate: allPlayerStats, byMap: playerStatsByMap } =
      normalizedStatus === "FINISHED" ? extractPlayerStatsPerMap(matchStats) : { aggregate: {}, byMap: {} };
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

    // Calculate rounds won and map flow
    let roundsWon1 = 0, roundsWon2 = 0;
    let statsMapOrder: string[] = [];
    let mapsData: Array<{ map: string; rounds_t1: number; rounds_t2: number; picked_by_team?: string | null; map_image?: string | null }> = [];

    // Primary source: detailed_results (always reliable, present for FINISHED and ONGOING)
    if (Array.isArray(matchData.detailed_results) && matchData.detailed_results.length > 0) {
      const picks: string[] = Array.isArray(matchData?.voting?.map?.pick) ? matchData.voting.map.pick : [];
      mapsData = (matchData.detailed_results as any[])
        .map((dr: any, idx: number) => ({
          map: toSimpleText(picks[idx]) || `Mapa ${idx + 1}`,
          rounds_t1: Number(dr?.factions?.faction1?.score || 0),
          rounds_t2: Number(dr?.factions?.faction2?.score || 0),
        }))
        .filter((m: any) => m.rounds_t1 > 0 || m.rounds_t2 > 0);

      // Derive overall score totals from map results
      roundsWon1 = mapsData.reduce((s, m) => s + m.rounds_t1, 0);
      roundsWon2 = mapsData.reduce((s, m) => s + m.rounds_t2, 0);
      statsMapOrder = mapsData.map((m) => m.map);
    }

    // Fallback: build from stats API rounds (when detailed_results absent)
    if (mapsData.length === 0 && matchStats?.rounds?.length) {
      const lastRound = matchStats.rounds[matchStats.rounds.length - 1];
      roundsWon1 = Number(lastRound.results?.score?.faction1) || 0;
      roundsWon2 = Number(lastRound.results?.score?.faction2) || 0;
      statsMapOrder = uniqueStrings(
        matchStats.rounds.map((round: any) => String(round?.round_stats?.Map || "").trim()).filter(Boolean)
      );

      const groupedByMap: Record<string, { t1: number; t2: number }> = {};
      for (const round of matchStats.rounds) {
        const mapName = String(round?.round_stats?.Map || "").trim();
        if (mapName) {
          if (!groupedByMap[mapName]) groupedByMap[mapName] = { t1: 0, t2: 0 };
          groupedByMap[mapName].t1 = Number(round.results?.score?.faction1) || 0;
          groupedByMap[mapName].t2 = Number(round.results?.score?.faction2) || 0;
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

    // Enrich mapsData with the team that picked each map (from FACEIT voting entities)
    {
      const t1Name = matchData.teams?.faction1?.name || "Team 1";
      const t2Name = matchData.teams?.faction2?.name || "Team 2";
      const tokenToTeam: Record<string, string | null> = {};
      for (const entry of rawEntities) {
        const pb = toSimpleText(entry?.picked_by);
        if (!pb) continue;
        const teamName = pb === "faction1" ? t1Name : pb === "faction2" ? t2Name : null;
        for (const token of [
          normalizeMapToken(entry?.name),
          normalizeMapToken(entry?.class_name),
          normalizeMapToken(entry?.game_map_id),
          normalizeMapToken(entry?.guid),
        ].filter(Boolean) as string[]) {
          tokenToTeam[token] = teamName;
        }
      }
      if (mapsData.length > 0 && Object.keys(tokenToTeam).length > 0) {
        mapsData = mapsData.map((m) => ({
          ...m,
          picked_by_team: tokenToTeam[normalizeMapToken(m.map)] ?? null,
        }));
      }
    }

    // Enrich mapsData with map image to allow background switch per selected map tab
    {
      const tokenToImage: Record<string, string | null> = {};
      for (const row of entityRows) {
        for (const token of row.tokens) {
          if (row.image) tokenToImage[token] = row.image;
        }
      }
      if (mapsData.length > 0 && Object.keys(tokenToImage).length > 0) {
        mapsData = mapsData.map((m) => ({
          ...m,
          map_image: tokenToImage[normalizeMapToken(m.map)] ?? null,
        }));
      }
    }

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
    const votingSummary = buildMapVotingSummary(votingMap, matchData.teams?.faction1?.name || "Team 1", matchData.teams?.faction2?.name || "Team 2");

    const selectedMap =
      toSimpleText(matchData?.voting?.map?.map) ||
      toSimpleText(votingSummary.picked_maps[0]?.map) ||
      toSimpleText(mapsPicked[0]) ||
      null;
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
      map_voting: {
        picked_maps: votingSummary.picked_maps,
        banned_maps: votingSummary.banned_maps,
      },
      team1_captain: team1CaptainName,
      team2_captain: team2CaptainName,
      rounds_won_1: roundsWon1,
      rounds_won_2: roundsWon2,
      team1_lineup: team1WithSteam,
      team2_lineup: team2WithSteam,
      // For BO2+, include individual map data
      maps_data: mapsData.length > 0 ? mapsData : null,
      // Per-map player stats: { [mapName]: { [nickname]: Stats } }
      maps_player_stats: Object.keys(playerStatsByMap).length > 0 ? playerStatsByMap : null,
    };

    const response = NextResponse.json({
      ok: true,
      matchData: matchDataResponse,
    });
    response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=300");
    return response;
  } catch (error) {
    console.error("[copadraft/prediction/match-details]", error);
    return NextResponse.json({ ok: false, message: "Erro ao carregar partida." }, { status: 500 });
  } finally {
    if (mainConn) mainConn.end();
  }
}

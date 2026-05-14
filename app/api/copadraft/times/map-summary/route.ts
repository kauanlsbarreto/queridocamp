import { NextRequest, NextResponse } from "next/server";

import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FACEIT_REVALIDATE_SECONDS = 3600;

type MapVoteItem = {
  map: string;
  selected_by: string | null;
  image: string | null;
  order: number;
};

type TeamMatchRow = {
  matchid: string | null;
  time1: string | null;
  time2: string | null;
};

type TeamMatchRef = {
  matchId: string;
  time1: string;
  time2: string;
};

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

function normalizeMapToken(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^de_/, "");
}

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

function inferTurnTeam(order: number, team1Name: string, team2Name: string) {
  return order % 2 === 1 ? team1Name : team2Name;
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
    const order = idx + 1;
    const token = normalizeMapToken(value);
    if (!token || seenPick.has(token)) return;
    seenPick.add(token);
    const meta = byToken.get(token);
    picked_maps.push({
      map: meta?.map || toSimpleText(value) || `Mapa ${order}`,
      selected_by: meta?.pickBy || inferTurnTeam(order, team1Name, team2Name),
      image: meta?.image || null,
      order,
    });
  });

  if (picked_maps.length === 0) {
    let fallbackPickOrder = 1;
    for (const [, meta] of Array.from(byToken.entries())) {
      if (!meta.pickBy) continue;
      if (picked_maps.some((item) => normalizeMapToken(item.map) === normalizeMapToken(meta.map))) continue;
      picked_maps.push({
        map: meta.map,
        selected_by: meta.pickBy,
        image: meta.image,
        order: fallbackPickOrder,
      });
      fallbackPickOrder += 1;
    }
  }

  const allBans: MapVoteItem[] = [];
  const seenBan = new Set<string>();
  dropRaw.forEach((value: unknown, idx: number) => {
    const order = idx + 1;
    const token = normalizeMapToken(value);
    if (!token || seenBan.has(token)) return;
    seenBan.add(token);
    const meta = byToken.get(token);
    allBans.push({
      map: meta?.map || toSimpleText(value) || `Ban ${order}`,
      selected_by: meta?.banBy || inferTurnTeam(order, team1Name, team2Name),
      image: meta?.image || null,
      order,
    });
  });

  if (allBans.length === 0) {
    let fallbackBanOrder = 1;
    for (const [, meta] of Array.from(byToken.entries())) {
      if (!meta.banBy) continue;
      if (allBans.some((item) => normalizeMapToken(item.map) === normalizeMapToken(meta.map))) continue;
      allBans.push({
        map: meta.map,
        selected_by: meta.banBy,
        image: meta.image,
        order: fallbackBanOrder,
      });
      fallbackBanOrder += 1;
    }
  }

  const firstBanByTeam = new Map<string, MapVoteItem>();
  for (const ban of allBans.sort((a, b) => a.order - b.order)) {
    const key = normalizeTeamKey(ban.selected_by);
    if (!key || firstBanByTeam.has(key)) continue;
    firstBanByTeam.set(key, ban);
  }

  const banned_maps = Array.from(firstBanByTeam.values());
  return { picked_maps, banned_maps };
}

async function fetchFaceitMatch(matchId: string, apiKey: string) {
  const response = await fetch(`${FACEIT_API_BASE}/matches/${encodeURIComponent(matchId)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "force-cache",
    next: { revalidate: FACEIT_REVALIDATE_SECONDS },
  });

  if (!response.ok) return null;
  return await response.json();
}

async function loadTeamMatchRefs(env: Env, teamName: string): Promise<TeamMatchRef[]> {
  let connection: any = null;
  try {
    connection = await createMainConnection(env);
    const [rows] = await connection.query(
      "SELECT matchid, time1, time2 FROM jogos WHERE (time1 = ? OR time2 = ?) AND matchid IS NOT NULL AND TRIM(matchid) <> ''",
      [teamName, teamName]
    );

    const byMatchId = new Map<string, TeamMatchRef>();
    for (const row of (Array.isArray(rows) ? rows : []) as TeamMatchRow[]) {
      const matchId = String(row?.matchid || "").trim();
      if (!matchId || byMatchId.has(matchId)) continue;
      byMatchId.set(matchId, {
        matchId,
        time1: String(row?.time1 || "").trim(),
        time2: String(row?.time2 || "").trim(),
      });
    }

    return Array.from(byMatchId.values());
  } catch {
    return [];
  } finally {
    await connection?.end?.();
  }
}

export async function GET(request: NextRequest) {
  const teamName = String(request.nextUrl.searchParams.get("team") || "").trim();
  if (!teamName) {
    return NextResponse.json({ ok: false, message: "time obrigatório." }, { status: 400 });
  }

  const faceitApiKey = String(process.env.FACEIT_API_KEY || "").trim();
  if (!faceitApiKey) {
    return NextResponse.json({ ok: false, message: "FACEIT_API_KEY não configurada." }, { status: 500 });
  }

  let env: Env;
  try {
    env = (await getRuntimeEnv()) as Env;
  } catch {
    return NextResponse.json({ ok: false, message: "Falha ao carregar ambiente." }, { status: 500 });
  }

  const teamMatches = await loadTeamMatchRefs(env, teamName);
  if (teamMatches.length === 0) {
    return NextResponse.json({
      ok: true,
      summary: { picked: [], firstBanned: [], banMatches: [] },
      total_matches: 0,
      analyzed_matches: 0,
    });
  }

  const normalizedTeam = normalizeTeamKey(teamName);
  const pickedCount = new Map<string, { map: string; image: string | null; count: number }>();
  const firstBanCount = new Map<string, { map: string; image: string | null; count: number }>();
  const banMatches: Array<{ matchId: string; map: string; image: string | null; opponent: string }> = [];
  let analyzedMatches = 0;

  for (const teamMatch of teamMatches) {
    const matchId = teamMatch.matchId;
    try {
      const matchData = await fetchFaceitMatch(matchId, faceitApiKey);
      if (!matchData) continue;
      analyzedMatches += 1;

      const team1Name = String(matchData?.teams?.faction1?.name || "Team 1").trim();
      const team2Name = String(matchData?.teams?.faction2?.name || "Team 2").trim();
      const voting = buildMapVotingSummary(matchData?.voting?.map || {}, team1Name, team2Name);

      for (const item of voting.picked_maps) {
        if (normalizeTeamKey(item.selected_by) !== normalizedTeam) continue;
        const key = normalizeMapToken(item.map);
        if (!key) continue;

        const current = pickedCount.get(key) || {
          map: item.map,
          image: item.image || null,
          count: 0,
        };
        current.count += 1;
        if (!current.image && item.image) current.image = item.image;
        pickedCount.set(key, current);
      }

      const firstBan = voting.banned_maps.find((item) => normalizeTeamKey(item.selected_by) === normalizedTeam) || null;
      if (firstBan) {
        const key = normalizeMapToken(firstBan.map);
        if (key) {
          const current = firstBanCount.get(key) || {
            map: firstBan.map,
            image: firstBan.image || null,
            count: 0,
          };
          current.count += 1;
          if (!current.image && firstBan.image) current.image = firstBan.image;
          firstBanCount.set(key, current);

          const normalizedT1 = normalizeTeamKey(teamMatch.time1);
          const normalizedT2 = normalizeTeamKey(teamMatch.time2);
          const opponent =
            normalizedT1 === normalizedTeam
              ? teamMatch.time2 || "Adversario"
              : normalizedT2 === normalizedTeam
                ? teamMatch.time1 || "Adversario"
                : "Adversario";

          banMatches.push({
            matchId,
            map: firstBan.map,
            image: firstBan.image || null,
            opponent,
          });
        }
      }
    } catch {
      // ignora erro de uma partida individual
    }
  }

  const pickedSorted = Array.from(pickedCount.values())
    .sort((a, b) => b.count - a.count || a.map.localeCompare(b.map))
    .map((item) => ({ map: item.map, count: item.count, image: item.image }));

  return NextResponse.json({
    ok: true,
    summary: {
      picked: pickedSorted.slice(0, 1),
      firstBanned: Array.from(firstBanCount.values())
        .sort((a, b) => b.count - a.count || a.map.localeCompare(b.map))
        .map((item) => ({ map: item.map, count: item.count, image: item.image })),
      banMatches,
    },
    total_matches: teamMatches.length,
    analyzed_matches: analyzedMatches,
  });
}

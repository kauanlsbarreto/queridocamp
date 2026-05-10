import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";
import StatsCardsClient from "./StatsCardsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATS_DIR = path.join(process.cwd(), "public", "stats-json");
const COPADRAFT_TIMES_FILE = path.join(process.cwd(), "copadraft-times.json");
const DEFAULT_AVATAR = "/images/cs2-player.png";
const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FALLBACK_FACEIT_API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

type MatchMeta = {
  fileName: string;
  round: number;
  map: number | null;
  matchKey: string;
};

type RawPlayerStats = {
  name?: string;
  steamId?: string | number;
  steamid?: string | number;
  teamName?: string;
  killCount?: number;
  assistCount?: number;
  deathCount?: number;
  killDeathRatio?: number;
  hltvRating2?: number;
  damageHealth?: number;
  averageDamagePerRound?: number;
  utilityDamage?: number;
  averageUtilityDamagePerRound?: number;
  headshotCount?: number;
  headshotPercentage?: number;
  kast?: number;
  tradeKillCount?: number;
  firstKillCount?: number;
  firstDeathCount?: number;
  mvpCount?: number;
  bombPlantedCount?: number;
  bombDefusedCount?: number;
  score?: number;
};

type LoadedMatch = {
  meta: MatchMeta;
  players: RawPlayerStats[];
};

type DbPlayerRow = {
  steamid: string | null;
  faceit_guid: string | null;
  nickname: string | null;
  avatar: string | null;
};

type DbJogadorRow = {
  faceit_guid: string | null;
  pote: number | string | null;
};

type FaceitProfile = {
  faceitGuid: string;
  nickname: string;
  avatar: string;
};

type CopaDraftTeam = {
  nome_time?: string;
  jogadores?: Array<{
    faceit_guid?: string;
    nickname?: string;
  }>;
};

export type StatsEntry = {
  steamId: string;
  nickname: string;
  avatar: string;
  teamName: string | null;
  pote: number;
  round: number;
  map: number | null;
  matchKey: string;
  hltvRating2: number;
  killCount: number;
  assistCount: number;
  deathCount: number;
  killDeathRatio: number;
  damageHealth: number;
  averageDamagePerRound: number;
  utilityDamage: number;
  averageUtilityDamagePerRound: number;
  headshotCount: number;
  headshotPercentage: number;
  kast: number;
  tradeKillCount: number;
  firstKillCount: number;
  firstDeathCount: number;
  mvpCount: number;
  bombPlantedCount: number;
  bombDefusedCount: number;
  score: number;
};

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toSteamId(value: unknown) {
  return String(value || "").trim();
}

function parseMatchMeta(fileName: string): MatchMeta | null {
  const baseName = fileName.replace(/\.json$/i, "");
  const xIndex = baseName.indexOf("x");
  if (xIndex <= 0 || xIndex >= baseName.length - 1) return null;

  const leftPart = baseName.slice(0, xIndex);
  const rightPart = baseName.slice(xIndex + 1);

  const leftMatch = leftPart.match(/^(.*?)(\d+)$/);
  const rightMatch = rightPart.match(/^(.*?)(\d+)$/);
  if (!leftMatch || !rightMatch) return null;

  const teamA = String(leftMatch[1] || "").trim();
  const roundA = Number(leftMatch[2] || 0);
  const teamB = String(rightMatch[1] || "").trim();
  const rightDigits = String(rightMatch[2] || "");

  if (!teamA || !teamB || !rightDigits) return null;

  let roundB = 0;
  let map: number | null = null;

  if (rightDigits.length >= 2) {
    roundB = Number(rightDigits.slice(0, -1));
    const mapCandidate = Number(rightDigits.slice(-1));
    map = Number.isFinite(mapCandidate) && mapCandidate > 0 ? Math.trunc(mapCandidate) : null;
  } else {
    roundB = Number(rightDigits);
    // Backward-compatible fallback: if only round is present on team B side,
    // treat it as map 1 so older filenames still compose M1 + M2 correctly.
    map = 1;
  }

  const round = Number.isFinite(roundA) && roundA > 0 ? roundA : roundB;
  if (!Number.isFinite(round) || round <= 0) return null;

  const normalizedA = normalize(teamA);
  const normalizedB = normalize(teamB);

  return {
    fileName,
    round,
    map,
    matchKey: `${normalizedA}${roundA}x${normalizedB}${roundB}`,
  };
}

function extractPlayers(payload: any): RawPlayerStats[] {
  if (Array.isArray(payload?.players)) return payload.players as RawPlayerStats[];

  if (Array.isArray(payload?.teams)) {
    return (payload.teams as any[])
      .flatMap((team) => (Array.isArray(team?.players) ? team.players : []))
      .filter(Boolean) as RawPlayerStats[];
  }

  if (Array.isArray(payload?.playerStats)) return payload.playerStats as RawPlayerStats[];

  return [];
}

function buildInClause(values: string[]) {
  if (values.length === 0) return { clause: "", params: [] as string[] };
  return {
    clause: values.map(() => "?").join(","),
    params: values,
  };
}

async function loadJsonMatches(): Promise<LoadedMatch[]> {
  let fileNames: string[] = [];

  try {
    const entries = await readdir(STATS_DIR, { withFileTypes: true });
    fileNames = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json")).map((entry) => entry.name);
  } catch {
    return [];
  }

  const loaded = await Promise.all(
    fileNames.map(async (fileName) => {
      const meta = parseMatchMeta(fileName);
      if (!meta) return null;

      try {
        const fullPath = path.join(STATS_DIR, fileName);
        const content = await readFile(fullPath, "utf-8");
        const parsed = JSON.parse(content);
        const players = extractPlayers(parsed);

        return {
          meta,
          players,
        } satisfies LoadedMatch;
      } catch {
        return null;
      }
    })
  );

  return loaded.filter(Boolean) as LoadedMatch[];
}

async function loadTeamNameByGuidMap() {
  const teamNameByGuid = new Map<string, string>();

  try {
    const content = await readFile(COPADRAFT_TIMES_FILE, "utf-8");
    const parsed = JSON.parse(content) as CopaDraftTeam[];

    for (const team of Array.isArray(parsed) ? parsed : []) {
      const teamName = String(team?.nome_time || "").trim();
      if (!teamName) continue;

      for (const player of Array.isArray(team?.jogadores) ? team.jogadores : []) {
        const guid = normalize(player?.faceit_guid);
        if (guid) teamNameByGuid.set(guid, teamName);
      }
    }
  } catch (err) {
    console.error("[copadraft/stats] erro ao ler copadraft-times.json:", err);
  }

  return teamNameByGuid;
}

function getFaceitApiKey() {
  const envKey = String(process.env.FACEIT_API_KEY || "").trim();
  return envKey || FALLBACK_FACEIT_API_KEY;
}

async function fetchFaceitBySteamId(steamId: string, fallbackNickname: string, cache: Map<string, FaceitProfile | null>) {
  const normalizedSteamId = toSteamId(steamId);
  if (!normalizedSteamId) return null;

  const cached = cache.get(normalizedSteamId);
  if (cached !== undefined) return cached;

  const headers = {
    Authorization: `Bearer ${getFaceitApiKey()}`,
  };

  const candidates = [
    `${FACEIT_API_BASE}/players?game=cs2&game_player_id=${encodeURIComponent(normalizedSteamId)}`,
    `${FACEIT_API_BASE}/players?game=csgo&game_player_id=${encodeURIComponent(normalizedSteamId)}`,
    fallbackNickname ? `${FACEIT_API_BASE}/players?nickname=${encodeURIComponent(fallbackNickname)}` : "",
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeout);

      if (!res.ok) continue;
      const data = await res.json();

      const profile: FaceitProfile = {
        faceitGuid: String(data?.player_id || "").trim(),
        nickname: String(data?.nickname || fallbackNickname || "").trim(),
        avatar: String(data?.avatar || data?.avatar_url || "").trim(),
      };

      if (profile.faceitGuid || profile.avatar || profile.nickname) {
        cache.set(normalizedSteamId, profile);
        return profile;
      }
    } catch {
      // ignora e tenta próximo endpoint
    }
  }

  cache.set(normalizedSteamId, null);
  return null;
}

async function getDbData(env: Env, steamIds: Set<string>) {
  const steamIdList = Array.from(steamIds).map(toSteamId).filter(Boolean);
  const playersBySteamId = new Map<string, DbPlayerRow>();
  const poteByGuid = new Map<string, number>();

  if (steamIdList.length === 0) {
    return { playersBySteamId, poteByGuid };
  }

  let connection: any = null;

  try {
    connection = await createMainConnection(env);

    const inSteam = buildInClause(steamIdList);
    const [playerRows] = await connection.query(
      `SELECT steamid, faceit_guid, nickname, avatar FROM players WHERE steamid IN (${inSteam.clause})`,
      inSteam.params
    );

    const typedPlayerRows = (Array.isArray(playerRows) ? playerRows : []) as DbPlayerRow[];
    for (const row of typedPlayerRows) {
      const key = toSteamId(row?.steamid);
      if (key) playersBySteamId.set(key, row);
    }

    const guidList = Array.from(new Set(typedPlayerRows.map((row) => normalize(row?.faceit_guid)).filter(Boolean)));

    if (guidList.length > 0) {
      const inGuid = buildInClause(guidList);
      const [jogadorRows] = await connection.query(
        `SELECT faceit_guid, pote FROM jogadores WHERE faceit_guid IN (${inGuid.clause})`,
        inGuid.params
      );

      const typedJogadorRows = (Array.isArray(jogadorRows) ? jogadorRows : []) as DbJogadorRow[];
      for (const row of typedJogadorRows) {
        const guid = normalize(row?.faceit_guid);
        const pote = Math.trunc(toNumber(row?.pote));
        if (guid && pote >= 1 && pote <= 5) {
          poteByGuid.set(guid, pote);
        }
      }
    }
  } catch (err) {
    console.error("[copadraft/stats] erro ao carregar dados do banco:", err);
  } finally {
    await connection?.end?.();
  }

  return { playersBySteamId, poteByGuid };
}

async function loadPageData() {
  const matches = await loadJsonMatches();
  const teamNameByGuid = await loadTeamNameByGuidMap();
  const steamIds = new Set<string>();

  for (const match of matches) {
    for (const player of match.players) {
      const steamId = toSteamId(player?.steamId ?? player?.steamid);
      if (steamId) steamIds.add(steamId);
    }
  }

  let env: Env | null = null;
  try {
    env = (await getRuntimeEnv()) as Env;
  } catch {
    env = null;
  }

  const { playersBySteamId, poteByGuid } = env
    ? await getDbData(env, steamIds)
    : { playersBySteamId: new Map<string, DbPlayerRow>(), poteByGuid: new Map<string, number>() };

  const faceitCache = new Map<string, FaceitProfile | null>();
  const missingProfiles = Array.from(steamIds).filter((steamId) => !playersBySteamId.has(steamId));

  await Promise.all(
    missingProfiles.map(async (steamId) => {
      await fetchFaceitBySteamId(steamId, "", faceitCache);
    })
  );

  if (env) {
    const faceitGuidsToResolve = Array.from(faceitCache.values())
      .map((profile) => normalize(profile?.faceitGuid))
      .filter(Boolean);

    if (faceitGuidsToResolve.length > 0) {
      let connection: any = null;
      try {
        connection = await createMainConnection(env);
        const inGuid = buildInClause(Array.from(new Set(faceitGuidsToResolve)));
        const [rows] = await connection.query(
          `SELECT faceit_guid, pote FROM jogadores WHERE faceit_guid IN (${inGuid.clause})`,
          inGuid.params
        );

        const typedRows = (Array.isArray(rows) ? rows : []) as DbJogadorRow[];
        for (const row of typedRows) {
          const guid = normalize(row?.faceit_guid);
          const pote = Math.trunc(toNumber(row?.pote));
          if (guid && pote >= 1 && pote <= 5) {
            poteByGuid.set(guid, pote);
          }
        }
      } catch (err) {
        console.error("[copadraft/stats] erro ao complementar potes via FACEIT:", err);
      } finally {
        await connection?.end?.();
      }
    }
  }

  const entries: StatsEntry[] = [];

  for (const match of matches) {
    for (const rawPlayer of match.players) {
      const steamId = toSteamId(rawPlayer?.steamId ?? rawPlayer?.steamid);
      if (!steamId) continue;

      const dbPlayer = playersBySteamId.get(steamId);
      const faceitProfile = faceitCache.get(steamId) || null;
      const faceitGuid = normalize(dbPlayer?.faceit_guid || faceitProfile?.faceitGuid);
      const teamName = faceitGuid ? teamNameByGuid.get(faceitGuid) || null : null;
      const poteResolved = poteByGuid.get(faceitGuid) || 0;
      const pote = poteResolved >= 1 && poteResolved <= 5 ? poteResolved : 5;

      entries.push({
        steamId,
        nickname: String(dbPlayer?.nickname || faceitProfile?.nickname || rawPlayer?.name || "Sem nickname"),
        avatar: String(dbPlayer?.avatar || faceitProfile?.avatar || DEFAULT_AVATAR),
        teamName,
        pote,
        round: match.meta.round,
        map: match.meta.map,
        matchKey: match.meta.matchKey,
        hltvRating2: toNumber(rawPlayer?.hltvRating2),
        killCount: Math.trunc(toNumber(rawPlayer?.killCount)),
        assistCount: Math.trunc(toNumber(rawPlayer?.assistCount)),
        deathCount: Math.trunc(toNumber(rawPlayer?.deathCount)),
        killDeathRatio: toNumber(rawPlayer?.killDeathRatio),
        damageHealth: Math.trunc(toNumber(rawPlayer?.damageHealth)),
        averageDamagePerRound: toNumber(rawPlayer?.averageDamagePerRound),
        utilityDamage: Math.trunc(toNumber(rawPlayer?.utilityDamage)),
        averageUtilityDamagePerRound: toNumber(rawPlayer?.averageUtilityDamagePerRound),
        headshotCount: Math.trunc(toNumber(rawPlayer?.headshotCount)),
        headshotPercentage: toNumber(rawPlayer?.headshotPercentage),
        kast: toNumber(rawPlayer?.kast),
        tradeKillCount: Math.trunc(toNumber(rawPlayer?.tradeKillCount)),
        firstKillCount: Math.trunc(toNumber(rawPlayer?.firstKillCount)),
        firstDeathCount: Math.trunc(toNumber(rawPlayer?.firstDeathCount)),
        mvpCount: Math.trunc(toNumber(rawPlayer?.mvpCount)),
        bombPlantedCount: Math.trunc(toNumber(rawPlayer?.bombPlantedCount)),
        bombDefusedCount: Math.trunc(toNumber(rawPlayer?.bombDefusedCount)),
        score: Math.trunc(toNumber(rawPlayer?.score)),
      });
    }
  }

  return entries;
}

export default async function CopaDraftStatsPage() {
  const entries = await loadPageData();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030a1e] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_35%),linear-gradient(125deg,rgba(14,165,233,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(120deg,transparent_0%,transparent_35%,rgba(56,189,248,0.35)_50%,transparent_65%,transparent_100%)]" />

      <div className="relative mx-auto max-w-7xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200/90">Copa Draft</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Stats</h1>

        </header>

        <StatsCardsClient entries={entries} />
      </div>
    </main>
  );
}

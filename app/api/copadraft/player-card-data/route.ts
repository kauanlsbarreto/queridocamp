import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { buildTeamStatsKillCountIndex } from "@/lib/copadraft-kills";

const STATS_DIR = path.join(process.cwd(), "public", "stats-json");
const COPADRAFT_TIMES_FILE = path.join(process.cwd(), "copadraft-times.json");

function toNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function toStr(v: unknown) {
  return String(v || "").trim();
}

function normalize(v: unknown) {
  return toStr(v).toLowerCase();
}

function extractPlayers(payload: any): any[] {
  if (Array.isArray(payload?.players)) return payload.players;
  if (Array.isArray(payload?.teams))
    return (payload.teams as any[]).flatMap((t) => (Array.isArray(t?.players) ? t.players : []));
  if (Array.isArray(payload?.playerStats)) return payload.playerStats;
  return [];
}

function parseRoundFromPayload(payload: any) {
  const candidates = [
    payload?.round,
    payload?.roundNumber,
    payload?.meta?.round,
    payload?.match?.round,
    payload?.teamA?.round,
    payload?.teamB?.round,
  ];

  for (const value of candidates) {
    const parsed = Math.trunc(toNum(value));
    if (parsed > 0) return parsed;
  }

  return 0;
}

function parseRoundFromFileName(fileName: string, payload: any) {
  const baseName = fileName.replace(/\.json$/i, "");
  const xRawMatch = baseName.match(/\d[xX]/);

  if (xRawMatch && xRawMatch.index !== undefined) {
    const xIndex = xRawMatch.index + 1;
    const leftPart = baseName.slice(0, xIndex);
    const rightPart = baseName.slice(xIndex + 1);
    const leftMatch = leftPart.match(/^(.*?)(\d+)$/);
    const rightMatch = rightPart.match(/^(.*?)(\d+)$/);

    if (leftMatch && rightMatch) {
      const roundA = Number(leftMatch[2] || 0);
      const rightDigits = String(rightMatch[2] || "");

      let roundB = 0;
      if (rightDigits.length >= 2) {
        roundB = Number(rightDigits.slice(0, -1));
      } else {
        roundB = Number(rightDigits);
      }

      const round = Number.isFinite(roundA) && roundA > 0 ? roundA : roundB;
      if (Number.isFinite(round) && round > 0) return Math.trunc(round);
    }
  }

  const fallback = parseRoundFromPayload(payload);
  return fallback > 0 ? fallback : 1;
}

export async function GET(req: NextRequest) {
  const faceitGuid = normalize(req.nextUrl.searchParams.get("faceit_guid") || "");
  const rawRound = String(req.nextUrl.searchParams.get("round") || "geral").trim().toLowerCase();
  const parsedRound = Math.trunc(toNum(rawRound));
  const selectedRound = rawRound === "geral" ? null : parsedRound >= 1 && parsedRound <= 7 ? parsedRound : null;
  if (!faceitGuid) {
    return NextResponse.json({ error: "faceit_guid is required" }, { status: 400 });
  }

  /* ── 1. Find team + player index from copadraft-times.json ── */
  let teamName: string | null = null;
  let playerIndex = 0;
  let guessedNickname = "";

  try {
    const raw = await readFile(COPADRAFT_TIMES_FILE, "utf-8");
    const times = JSON.parse(raw) as Array<{ nome_time?: string; jogadores?: Array<{ faceit_guid?: string; nickname?: string }> }>;

    outer: for (const time of Array.isArray(times) ? times : []) {
      const jogadores = Array.isArray(time?.jogadores) ? time.jogadores : [];
      for (let i = 0; i < jogadores.length; i++) {
        if (normalize(jogadores[i]?.faceit_guid) === faceitGuid) {
          teamName = toStr(time?.nome_time) || null;
          playerIndex = i;
          guessedNickname = toStr(jogadores[i]?.nickname);
          break outer;
        }
      }
    }
  } catch { /* times file unavailable */ }

  /* ── 2. DB: player row + banner avatar + pote ── */
  let steamId = "";
  let nickname = guessedNickname;
  let dbAvatar = "";
  let bannerAvatar = "";
  let pote = 0;

  try {
    const env = await getRuntimeEnv() as Env;
    const conn = await createMainConnection(env);
    (conn as any).setPage?.("/api/copadraft/player-card-data");

    try {
      // Player row
      const [playerRows] = await conn.query(
        "SELECT steamid, nickname, avatar FROM players WHERE LOWER(faceit_guid) = ? LIMIT 1",
        [faceitGuid]
      ) as [any[], any];
      const pr = playerRows?.[0];
      if (pr) {
        steamId = toStr(pr.steamid);
        nickname = toStr(pr.nickname) || nickname;
        dbAvatar = toStr(pr.avatar);
      }

      // Pote from jogadores table
      const [jogRows] = await conn.query(
        "SELECT pote FROM jogadores WHERE LOWER(faceit_guid) = ? LIMIT 1",
        [faceitGuid]
      ) as [any[], any];
      const jr = jogRows?.[0];
      if (jr) pote = Math.trunc(toNum(jr.pote));

      // Banner config for team avatar
      if (teamName) {
        const [bannerRows] = await conn.query(
          "SELECT avatar0, avatar1, avatar2, avatar3, avatar4 FROM banner WHERE time = ? LIMIT 1",
          [teamName]
        ) as [any[], any];
        const br = bannerRows?.[0];
        if (br) {
          const avatarKey = `avatar${playerIndex}` as keyof typeof br;
          bannerAvatar = toStr(br[avatarKey]);
        }
      }
    } finally {
      await conn.end?.();
    }
  } catch { /* DB unavailable */ }

  /* ── 3. Aggregate stats from stats-json files ── */
  type Acc = {
    appearances: number;
    kills: number;
    deaths: number;
    hltvSum: number;
    adrSum: number;
    scoreSum: number;
    hsSum: number;
    kastSum: number;
  };

  const acc: Acc = {
    appearances: 0, kills: 0, deaths: 0,
    hltvSum: 0, adrSum: 0, scoreSum: 0, hsSum: 0, kastSum: 0,
  };

  const availableRoundsSet = new Set<number>();

  const normalizedNick = normalize(nickname);

  try {
    const entries = await readdir(STATS_DIR, { withFileTypes: true });
    const fileNames = entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".json"))
      .map((e) => e.name);

    await Promise.all(
      fileNames.map(async (fileName) => {
        try {
          const content = await readFile(path.join(STATS_DIR, fileName), "utf-8");
          const parsed = JSON.parse(content);
          const round = parseRoundFromFileName(fileName, parsed);
          const killIndex = buildTeamStatsKillCountIndex(parsed);
          const players = extractPlayers(parsed);
          let matchFoundInFile = false;

          for (const p of players) {
            const pSteam = toStr(p?.steamId ?? p?.steamid);
            const pNick = normalize(p?.name);
            const matches =
              (steamId && pSteam === steamId) ||
              (normalizedNick && pNick === normalizedNick);
            if (!matches) continue;

            matchFoundInFile = true;
            if (round >= 1 && round <= 7) {
              availableRoundsSet.add(round);
            }
            if (selectedRound !== null && round !== selectedRound) continue;

            acc.appearances++;
            const resolvedKills = steamId && killIndex[steamId] ? toNum(killIndex[steamId]) : toNum(p?.killCount);
            acc.kills += Math.trunc(resolvedKills);
            acc.deaths += Math.trunc(toNum(p?.deathCount));
            acc.hltvSum += toNum(p?.hltvRating2);
            acc.adrSum += toNum(p?.averageDamagePerRound);
            acc.scoreSum += toNum(p?.score);
            acc.hsSum += toNum(p?.headshotPercentage);
            acc.kastSum += toNum(p?.kast);
          }

          if (!matchFoundInFile) return;
        } catch { /* skip bad file */ }
      })
    );
  } catch { /* stats dir unavailable */ }

  const n = Math.max(1, acc.appearances);
  const kd = acc.deaths > 0 ? acc.kills / acc.deaths : acc.kills > 0 ? acc.kills : 0;
  const availableRounds = Array.from(availableRoundsSet.values()).sort((a, b) => a - b);

  // Avatar priority: banner custom photo > DB faceit avatar
  const resolvedAvatar = bannerAvatar || dbAvatar || "";

  // Convert /fotostime/ path to the API route
  const avatarUrl = resolvedAvatar.startsWith("/fotostime/")
    ? `/api/fotostime?path=${encodeURIComponent(resolvedAvatar)}`
    : resolvedAvatar;

  return NextResponse.json({
    nickname,
    teamName,
    pote,
    selectedRound: selectedRound ?? "geral",
    availableRounds,
    avatar: avatarUrl,
    stats: {
      appearances: acc.appearances,
      kills: acc.kills,
      deaths: acc.deaths,
      kd: parseFloat(kd.toFixed(2)),
      hltv: parseFloat((acc.hltvSum / n).toFixed(2)),
      adr: parseFloat((acc.adrSum / n).toFixed(1)),
      score: parseFloat((acc.scoreSum / n).toFixed(1)),
      hs: parseFloat((acc.hsSum / n).toFixed(1)),
      kast: parseFloat((acc.kastSum / n).toFixed(1)),
    },
  });
}

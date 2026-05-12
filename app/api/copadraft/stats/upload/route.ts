import { NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";

import { createMainConnection } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

const STATS_DIR = path.join(process.cwd(), "public", "stats-json");
const COPADRAFT_TIMES_FILE = path.join(process.cwd(), "copadraft-times.json");
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FALLBACK_FACEIT_API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

type CopaDraftTeam = {
  nome_time?: string;
  jogadores?: Array<{
    faceit_guid?: string;
    nickname?: string;
  }>;
};

type RawPlayerStats = {
  steamId?: string | number;
  steamid?: string | number;
};

type FaceitLookupPayload = {
  player_id?: string;
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
};

type DbPlayerRow = {
  id: number;
  faceit_guid: string | null;
  steamid: string | null;
};

function sanitizeFileName(name: string) {
  return path.basename(String(name || "")).replace(/[^a-zA-Z0-9._()\-]/g, "");
}

function normalize(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toSteamId(value: unknown) {
  return String(value || "").trim();
}

function getFaceitApiKey() {
  const envKey = String(process.env.FACEIT_API_KEY || "").trim();
  return envKey || FALLBACK_FACEIT_API_KEY;
}

function parseStatsFileName(fileName: string) {
  const baseName = fileName.replace(/\.json$/i, "");
  const xIndex = baseName.indexOf("x");
  if (xIndex <= 0 || xIndex >= baseName.length - 1) return null;

  const leftPart = baseName.slice(0, xIndex);
  const rightPart = baseName.slice(xIndex + 1);
  const leftMatch = leftPart.match(/^(.*?)(\d+)$/);
  const rightMatch = rightPart.match(/^(.*?)(\d+)$/);
  if (!leftMatch || !rightMatch) return null;

  const teamA = String(leftMatch[1] || "").trim();
  const teamB = String(rightMatch[1] || "").trim();
  const roundA = Number(leftMatch[2] || 0);
  const rightDigits = String(rightMatch[2] || "");

  if (!teamA || !teamB || !Number.isFinite(roundA) || roundA <= 0 || !rightDigits) return null;

  let roundB = 0;
  let map: number | null = null;
  if (rightDigits.length >= 2) {
    roundB = Number(rightDigits.slice(0, -1));
    const mapCandidate = Number(rightDigits.slice(-1));
    map = Number.isFinite(mapCandidate) && mapCandidate > 0 ? Math.trunc(mapCandidate) : null;
  } else {
    roundB = Number(rightDigits);
  }

  if (!Number.isFinite(roundB) || roundB <= 0) return null;

  return {
    teamA,
    teamB,
    roundA,
    roundB,
    map,
  };
}

function extractPlayers(payload: any): RawPlayerStats[] {
  if (Array.isArray(payload?.players)) return payload.players as RawPlayerStats[];
  if (Array.isArray(payload?.playerStats)) return payload.playerStats as RawPlayerStats[];
  if (Array.isArray(payload?.teams)) {
    return (payload.teams as any[])
      .flatMap((team) => (Array.isArray(team?.players) ? team.players : []))
      .filter(Boolean) as RawPlayerStats[];
  }
  return [];
}

async function loadAvailableTeams() {
  const parsed = JSON.parse(await readFile(COPADRAFT_TIMES_FILE, "utf-8")) as CopaDraftTeam[];
  const teams = Array.isArray(parsed) ? parsed : [];
  const teamNames = teams.map((team) => String(team?.nome_time || "").trim()).filter(Boolean);
  return {
    teams,
    teamNames,
    teamNamesNormalized: new Set(teamNames.map((name) => normalize(name))),
  };
}

async function fetchFaceitBySteamId(steamId: string) {
  const normalizedSteamId = toSteamId(steamId);
  if (!normalizedSteamId) return null;

  const headers = { Authorization: `Bearer ${getFaceitApiKey()}` };
  const candidates = [
    `${FACEIT_API_BASE}/players?game=cs2&game_player_id=${encodeURIComponent(normalizedSteamId)}`,
    `${FACEIT_API_BASE}/players?game=csgo&game_player_id=${encodeURIComponent(normalizedSteamId)}`,
  ];

  for (const url of candidates) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(url, { headers, signal: controller.signal, cache: "no-store" });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = (await res.json()) as FaceitLookupPayload;
      const faceitGuid = String(data?.player_id || "").trim();
      if (faceitGuid) {
        return {
          faceitGuid,
          nickname: String(data?.nickname || "").trim(),
        };
      }
    } catch {
      // ignore and try next endpoint
    }
  }

  return null;
}

async function syncMissingSteamIds(connection: any, players: RawPlayerStats[]) {
  const steamIds = Array.from(
    new Set(players.map((player) => toSteamId(player?.steamId ?? player?.steamid)).filter(Boolean))
  );

  if (steamIds.length === 0) {
    return { warnings: [] as string[] };
  }

  const placeholders = steamIds.map(() => "?").join(",");
  const [existingRows] = await connection.query(
    `SELECT id, faceit_guid, steamid FROM players WHERE steamid IN (${placeholders})`,
    steamIds
  );

  const existingBySteam = new Map<string, DbPlayerRow>();
  for (const row of (Array.isArray(existingRows) ? existingRows : []) as DbPlayerRow[]) {
    const steamId = toSteamId(row?.steamid);
    if (steamId) existingBySteam.set(steamId, row);
  }

  const warnings: string[] = [];

  for (const steamId of steamIds) {
    if (existingBySteam.has(steamId)) continue;

    const faceitProfile = await fetchFaceitBySteamId(steamId);
    if (!faceitProfile?.faceitGuid) {
      warnings.push(`SteamID ${steamId}: não foi possível descobrir faceit_guid pela FACEIT.`);
      continue;
    }

    const [playerRows] = await connection.query(
      "SELECT id, faceit_guid, steamid FROM players WHERE faceit_guid = ? LIMIT 1",
      [faceitProfile.faceitGuid]
    );
    const player = Array.isArray(playerRows) ? (playerRows as DbPlayerRow[])[0] : null;

    if (player?.id) {
      await connection.query(
        "UPDATE players SET steamid = ? WHERE id = ?",
        [steamId, player.id]
      );
      warnings.push(`SteamID ${steamId}: sincronizado na tabela players para ${faceitProfile.nickname || faceitProfile.faceitGuid}.`);
      continue;
    }

    warnings.push(
      `SteamID ${steamId}: faceit_guid ${faceitProfile.faceitGuid} encontrado na FACEIT, mas o jogador não existe na tabela players.`
    );
  }

  return { warnings };
}

async function isAdminOneOrTwo(connection: any, faceitGuid: string) {
  const [rows] = await connection.query("SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1", [faceitGuid]);
  const adminRows = rows as Array<{ admin: number | null }>;
  if (!adminRows.length) return false;
  return adminRows[0].admin === 1 || adminRows[0].admin === 2;
}

export async function POST(request: Request) {
  let connection: any = null;

  try {
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    const form = await request.formData();
    const faceitGuid = String(form.get("faceit_guid") || "").trim();
    const file = form.get("file");

    if (!faceitGuid) {
      return NextResponse.json({ message: "faceit_guid ausente." }, { status: 400 });
    }

    const allowed = await isAdminOneOrTwo(connection, faceitGuid);
    if (!allowed) {
      return NextResponse.json({ message: "Apenas Admin 1 e 2 podem enviar JSON." }, { status: 403 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ message: "Arquivo não enviado." }, { status: 400 });
    }

    const safeFileName = sanitizeFileName(file.name || "");
    if (!safeFileName.toLowerCase().endsWith(".json")) {
      return NextResponse.json({ message: "Envie apenas arquivos .json" }, { status: 400 });
    }

    const availableTeams = await loadAvailableTeams();
    const parsedFileName = parseStatsFileName(safeFileName);
    if (!parsedFileName) {
      return NextResponse.json(
        {
          message: "Nome do arquivo fora do padrão. Use algo como holanda4xbrasil21.json ou holanda4xbrasil2.json.",
          availableTeams: availableTeams.teamNames,
        },
        { status: 400 }
      );
    }

    const teamAExists = availableTeams.teamNamesNormalized.has(normalize(parsedFileName.teamA));
    const teamBExists = availableTeams.teamNamesNormalized.has(normalize(parsedFileName.teamB));
    if (!teamAExists || !teamBExists) {
      return NextResponse.json(
        {
          message: "Os times do nome do arquivo não coincidem com o copadraft-times.json.",
          availableTeams: availableTeams.teamNames,
        },
        { status: 400 }
      );
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { message: `Arquivo inválido. Tamanho máximo: ${Math.floor(MAX_FILE_SIZE_BYTES / (1024 * 1024))}MB.` },
        { status: 400 }
      );
    }

    const raw = Buffer.from(await file.arrayBuffer());

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(raw.toString("utf-8"));
    } catch {
      return NextResponse.json({ message: "JSON inválido." }, { status: 400 });
    }

    const jsonPlayers = extractPlayers(parsedJson);
    if (jsonPlayers.length === 0) {
      return NextResponse.json(
        {
          message: "JSON sem jogadores válidos. Use players, playerStats ou teams[].players[].",
          availableTeams: availableTeams.teamNames,
        },
        { status: 400 }
      );
    }

    const playersWithoutSteamId = jsonPlayers.filter((player) => !toSteamId(player?.steamId ?? player?.steamid));
    if (playersWithoutSteamId.length > 0) {
      return NextResponse.json(
        {
          message: "Há jogadores no JSON sem steamId/steamid.",
          availableTeams: availableTeams.teamNames,
        },
        { status: 400 }
      );
    }

    const syncResult = await syncMissingSteamIds(connection, jsonPlayers);

    await mkdir(STATS_DIR, { recursive: true });
    const destPath = path.join(STATS_DIR, safeFileName);
    await writeFile(destPath, raw);

    revalidatePath("/copadraft/stats");

    return NextResponse.json({
      success: true,
      fileName: safeFileName,
      message: "Arquivo enviado com sucesso.",
      warnings: syncResult.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar arquivo.";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    await connection?.end?.();
  }
}

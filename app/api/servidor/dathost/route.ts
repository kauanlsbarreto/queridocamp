import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection, type Env } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { Client } from "basic-ftp";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DATHOST_API_BASE = "https://dathost.net/api/0.1";
const DEFAULT_SERVER_ID = "69e25c29817337ed7e1ff91c";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type DathostResponse = {
  ok: boolean;
  status: number;
  data: JsonValue | null;
  raw: string;
};

type Cs2GameMode = "competitive" | "casual" | "arms_race" | "ffa_deathmatch" | "retakes" | "wingman" | "custom";
type Cs2MapsSource = "mapgroup" | "workshop_collection" | "workshop_single_map";
type ModePreset = "1v1" | "mix";

type AccessRow = RowDataPacket & {
  lvlservidor: number | null;
};

type CommandLogRow = RowDataPacket & {
  id: number;
  usuario: string;
  comando: string;
  data: string | Date;
  hora: string | Date;
  nickname: string | null;
  avatar: string | null;
};

type AdminPlayerRow = RowDataPacket & {
  id: number;
  nickname: string | null;
  faceit_guid: string | null;
  steamid: string | null;
  avatar: string | null;
};

type AdminConfigEntry = {
  identity?: string;
  groups?: string[];
  [key: string]: unknown;
};

type AdminConfigMap = Record<string, AdminConfigEntry>;

const FTP_HOST = process.env.DATHOST_FTP_HOST || "loboda.dathost.net";
const FTP_PORT = Number(process.env.DATHOST_FTP_PORT || 21);
const FTP_USER = process.env.DATHOST_FTP_USER || "69e25c29817337ed7e1ff91c";
const FTP_PASSWORD = process.env.DATHOST_FTP_PASSWORD || "I2ISJT5UK3A";

const FTP_PLUGINS_PATH = "/addons/counterstrikesharp/plugins";
const FTP_DISABLED_PATH = "/addons/counterstrikesharp/plugins/Disabled";
const FTP_ADMINS_JSON_PATH = "/addons/counterstrikesharp/configs/admins.json";

const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FALLBACK_FACEIT_API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

function toModePreset(value: unknown): ModePreset | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "1v1") return "1v1";
  if (normalized === "mix") return "mix";
  return null;
}

function hasFolder(entries: Array<{ name: string }>, folderName: string) {
  return entries.some((entry) => entry.name === folderName);
}

async function loadLvlServidor(faceitGuid: string): Promise<number> {
  if (!faceitGuid) return 0;

  const ctx = await getCloudflareContext({ async: true });
  const env = ctx.env as unknown as Env;
  const connection = await createMainConnection(env);

  try {
    const [rows] = await connection.query<AccessRow[]>(
      "SELECT lvlservidor FROM players WHERE faceit_guid = ? LIMIT 1",
      [faceitGuid],
    );

    return Number(rows?.[0]?.lvlservidor ?? 0);
  } finally {
    await connection.end();
  }
}



function canSendConsoleByLevel(level: number) {
  return level >= 1 && level <= 5;
}

function canManageServerSettings(level: number) {
  return level === 1 || level === 2;
}

function extractSteamId(faceitPayload: unknown): string | null {
  if (!faceitPayload || typeof faceitPayload !== "object") return null;
  const payload = faceitPayload as Record<string, any>;

  const raw =
    payload?.steam_id_64 ||
    payload?.games?.cs2?.game_player_id ||
    payload?.games?.csgo?.game_player_id ||
    payload?.platforms?.steam?.id ||
    null;

  if (!raw) return null;
  const steamId = String(raw).trim();
  return steamId.length > 0 ? steamId : null;
}

async function fetchFaceitSteamId(faceitGuid: string): Promise<string | null> {
  const guid = String(faceitGuid || "").trim();
  if (!guid) return null;

  const apiKey = process.env.FACEIT_API_KEY || FALLBACK_FACEIT_API_KEY;
  const response = await fetch(`${FACEIT_API_BASE}/players/${encodeURIComponent(guid)}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = await response.json().catch(() => null);
  return extractSteamId(payload);
}

async function ensurePlayersSteamIds(connection: Awaited<ReturnType<typeof createMainConnection>>, players: AdminPlayerRow[]) {
  const normalized = players.map((player) => ({
    id: Number(player.id || 0),
    nickname: String(player.nickname || "").trim(),
    faceit_guid: String(player.faceit_guid || "").trim(),
    steamid: String(player.steamid || "").trim(),
    avatar: String(player.avatar || "").trim() || null,
  }));

  const syncResults: Array<{ id: number; nickname: string; steamid: string | null; synced: boolean }> = [];

  for (const player of normalized) {
    let steamid = player.steamid;
    let synced = false;

    if (!steamid && player.faceit_guid) {
      const fetchedSteamId = await fetchFaceitSteamId(player.faceit_guid);
      if (fetchedSteamId) {
        steamid = fetchedSteamId;
        synced = true;
        await connection.query("UPDATE players SET steamid = ? WHERE id = ?", [steamid, player.id]);
      }
    }

    syncResults.push({
      id: player.id,
      nickname: player.nickname,
      steamid: steamid || null,
      synced,
    });
  }

  return syncResults;
}

async function downloadRemoteFile(client: Client, remotePath: string): Promise<string> {
  const tempPath = path.join(tmpdir(), `dathost-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  try {
    await client.downloadTo(tempPath, remotePath);
    return await fs.readFile(tempPath, "utf8");
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

async function uploadRemoteFile(client: Client, remotePath: string, content: string) {
  const tempPath = path.join(tmpdir(), `dathost-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  try {
    await fs.writeFile(tempPath, content, "utf8");
    await client.uploadFrom(tempPath, remotePath);
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

async function readAdminsConfig(client: Client): Promise<AdminConfigMap> {
  const raw = await downloadRemoteFile(client, FTP_ADMINS_JSON_PATH).catch((error) => {
    const message = error instanceof Error ? error.message : String(error || "");
    // If the file does not exist yet on FTP, start with an empty object.
    if (message.includes("550")) {
      return "{}";
    }

    throw error;
  });
  const parsed = JSON.parse(raw || "{}") as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  return parsed as AdminConfigMap;
}

async function writeAdminsConfig(client: Client, config: AdminConfigMap) {
  await client.ensureDir("/addons/counterstrikesharp/configs");
  await client.cd("/");
  const serialized = `${JSON.stringify(config, null, 2)}\n`;
  await uploadRemoteFile(client, FTP_ADMINS_JSON_PATH, serialized);
}

async function withFtpClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client();
  client.ftp.verbose = false;

  try {
    await client.access({
      host: FTP_HOST,
      port: FTP_PORT,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false,
    });

    await client.cd("/");
    return await fn(client);
  } finally {
    client.close();
  }
}

function formatDbDate(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value).trim();
  return raw.includes("T") ? raw.slice(0, 10) : raw;
}

function formatDbTime(value: string | Date | null | undefined) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(11, 19);
  return String(value).trim().slice(0, 8);
}

async function applyServerSettingsPreset(serverId: string, mode: ModePreset) {
  const formData = new FormData();

  if (mode === "1v1") {
    formData.append("cs2_settings.game_mode", "custom");
    formData.append("cs2_settings.maps_source", "workshop_collection");
    formData.append("cs2_settings.mapgroup", "");
    formData.append("cs2_settings.mapgroup_start_map", "");
    formData.append("cs2_settings.workshop_single_map_id", "");
    formData.append("cs2_settings.workshop_collection_start_map_id", "3715378702");
  }

  if (mode === "mix") {
    formData.append("cs2_settings.game_mode", "competitive");
    formData.append("cs2_settings.maps_source", "mapgroup");
    formData.append("cs2_settings.mapgroup", "mg_active");
    formData.append("cs2_settings.mapgroup_start_map", "de_mirage");
    formData.append("cs2_settings.workshop_single_map_id", "");
    formData.append("cs2_settings.workshop_collection_start_map_id", "");
  }

  const result = await dathostRequest(`/game-servers/${serverId}`, {
    method: "PUT",
    body: formData,
  });

  if (!result.ok) {
    throw new Error("Falha ao aplicar configuracao de servidor.");
  }

  return result;
}

async function sendConsoleLine(serverId: string, line: string) {
  const command = line.trim();
  if (!command) return { ok: true, line: command, skipped: true as const };

  const formData = new FormData();
  formData.append("line", command);

  const result = await dathostRequest(`/game-servers/${serverId}/console`, {
    method: "POST",
    body: formData,
  });

  return {
    ok: result.ok,
    line: command,
    status: result.status,
    details: result.ok ? null : result.data || result.raw,
  };
}

function getPostPresetConsoleLines(mode: ModePreset): string[] {
  if (mode === "1v1") {
    return [
      "mp_death_drop_gun 0",
      "mp_death_drop_grenade 0",
      "mp_death_drop_defuser 0",
      "mp_restartgame 1",
    ];
  }

  return [
    "mp_death_drop_gun 1",
    "mp_death_drop_grenade 1",
    "mp_death_drop_defuser 1",
    "mp_restartgame 1",
  ];
}

async function applyPostPresetConsoleCleanup(serverId: string, mode: ModePreset) {
  const lines = getPostPresetConsoleLines(mode);
  const results: Array<{
    ok: boolean;
    line: string;
    status?: number;
    details?: JsonValue | string | null;
    skipped?: true;
  }> = [];

  for (const line of lines) {
    results.push(await sendConsoleLine(serverId, line));
  }

  return results;
}

async function moveFolderIfNeeded(client: Client, folderName: string, fromPath: string, toPath: string) {
  const fromEntries = await client.list(fromPath);
  const toEntries = await client.list(toPath);

  if (!hasFolder(fromEntries, folderName)) {
    return false;
  }

  if (hasFolder(toEntries, folderName)) {
    return false;
  }

  await client.rename(`${fromPath}/${folderName}`, `${toPath}/${folderName}`);
  return true;
}

async function applyFtpPreset(mode: ModePreset) {
  const client = new Client();
  client.ftp.verbose = false;

  let movedKsnToPlugins = false;
  let movedKsnToDisabled = false;
  let movedMatchToPlugins = false;
  let movedMatchToDisabled = false;

  try {
    await client.access({
      host: FTP_HOST,
      port: FTP_PORT,
      user: FTP_USER,
      password: FTP_PASSWORD,
      secure: false,
    });

    await client.ensureDir(FTP_DISABLED_PATH);
    await client.cd("/");

    if (mode === "1v1") {
      movedKsnToPlugins = await moveFolderIfNeeded(client, "KSN1v1", FTP_DISABLED_PATH, FTP_PLUGINS_PATH);
      movedMatchToDisabled = await moveFolderIfNeeded(client, "MatchKS", FTP_PLUGINS_PATH, FTP_DISABLED_PATH);
    }

    if (mode === "mix") {
      movedKsnToDisabled = await moveFolderIfNeeded(client, "KSN1v1", FTP_PLUGINS_PATH, FTP_DISABLED_PATH);
      movedMatchToPlugins = await moveFolderIfNeeded(client, "MatchKS", FTP_DISABLED_PATH, FTP_PLUGINS_PATH);
    }

    return {
      movedKsnToPlugins,
      movedKsnToDisabled,
      movedMatchToPlugins,
      movedMatchToDisabled,
    };
  } finally {
    client.close();
  }
}

function getCredentials() {
  const email = process.env.DATHOST_EMAIL;
  const password = process.env.DATHOST_PASSWORD;

  if (!email || !password) {
    return null;
  }

  const auth = Buffer.from(`${email}:${password}`).toString("base64");
  return `Basic ${auth}`;
}

function parseJson(raw: string): JsonValue | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as JsonValue;
  } catch {
    return null;
  }
}

async function dathostRequest(path: string, init?: RequestInit): Promise<DathostResponse> {
  const auth = getCredentials();
  if (!auth) {
    return {
      ok: false,
      status: 500,
      data: { error: "Credenciais DATHOST_EMAIL e DATHOST_PASSWORD nao configuradas." },
      raw: "",
    };
  }

  const response = await fetch(`${DATHOST_API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      accept: "application/json",
      Authorization: auth,
      ...(init?.headers || {}),
    },
  });

  const raw = await response.text();
  const data = parseJson(raw);

  return {
    ok: response.ok,
    status: response.status,
    data,
    raw,
  };
}

function jsonError(message: string, status = 500, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action") || "metrics";
    const serverId = searchParams.get("server_id") || process.env.DATHOST_SERVER_ID || DEFAULT_SERVER_ID;

    if (!serverId) {
      return jsonError("server_id nao informado.", 400);
    }

    if (action === "console") {
      const maxLines = Math.min(Math.max(Number(searchParams.get("max_lines") || 300), 1), 5000);
      const result = await dathostRequest(`/game-servers/${serverId}/console?max_lines=${maxLines}`);

      if (!result.ok) {
        return jsonError("Falha ao buscar console.", result.status, result.data || result.raw);
      }

      return NextResponse.json({
        serverId,
        action,
        fetchedAt: new Date().toISOString(),
        console: result.data,
      });
    }

    if (action === "metrics") {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 60 * 60 * 1000);

      const isoStart = searchParams.get("start_time") || startTime.toISOString();
      const isoEnd = searchParams.get("end_time") || endTime.toISOString();

      const [gameMetrics, monitoringOverview, monitoringMetrics] = await Promise.all([
        dathostRequest(`/game-servers/${serverId}/metrics`),
        dathostRequest(`/cs-monitoring/server/${serverId}/overview`),
        dathostRequest(
          `/cs-monitoring/server/${serverId}/metrics?start_time=${encodeURIComponent(isoStart)}&end_time=${encodeURIComponent(isoEnd)}`,
        ),
      ]);

      const sources = {
        gameMetrics,
        monitoringOverview,
        monitoringMetrics,
      };

      const succeeded = Object.values(sources).filter((item) => item.ok).length;

      if (succeeded === 0) {
        return jsonError("Falha ao buscar metricas.", 502, {
          gameMetrics: { status: gameMetrics.status, details: gameMetrics.data || gameMetrics.raw },
          monitoringOverview: { status: monitoringOverview.status, details: monitoringOverview.data || monitoringOverview.raw },
          monitoringMetrics: { status: monitoringMetrics.status, details: monitoringMetrics.data || monitoringMetrics.raw },
        });
      }

      return NextResponse.json({
        serverId,
        action,
        window: {
          start_time: isoStart,
          end_time: isoEnd,
        },
        fetchedAt: new Date().toISOString(),
        metrics: {
          gameServerMetrics: gameMetrics.ok ? gameMetrics.data : null,
          monitoringOverview: monitoringOverview.ok ? monitoringOverview.data : null,
          monitoringMetrics: monitoringMetrics.ok ? monitoringMetrics.data : null,
        },
        sourceStatus: {
          gameMetrics: {
            ok: gameMetrics.ok,
            status: gameMetrics.status,
            error: gameMetrics.ok ? null : gameMetrics.data || gameMetrics.raw,
          },
          monitoringOverview: {
            ok: monitoringOverview.ok,
            status: monitoringOverview.status,
            error: monitoringOverview.ok ? null : monitoringOverview.data || monitoringOverview.raw,
          },
          monitoringMetrics: {
            ok: monitoringMetrics.ok,
            status: monitoringMetrics.status,
            error: monitoringMetrics.ok ? null : monitoringMetrics.data || monitoringMetrics.raw,
          },
        },
      });
    }

    if (action === "server-settings") {
      const result = await dathostRequest(`/game-servers/${serverId}`);
      if (!result.ok) {
        return jsonError("Falha ao buscar configuracoes do servidor.", result.status, result.data || result.raw);
      }

      const payload = (result.data || {}) as Record<string, unknown>;
      const cs2Settings = ((payload.cs2_settings as Record<string, unknown> | undefined) || {}) as Record<string, unknown>;

      return NextResponse.json({
        serverId,
        action,
        fetchedAt: new Date().toISOString(),
        settings: {
          game_mode: String(cs2Settings.game_mode || "custom"),
          maps_source: String(cs2Settings.maps_source || "mapgroup"),
          mapgroup: String(cs2Settings.mapgroup || ""),
          mapgroup_start_map: String(cs2Settings.mapgroup_start_map || ""),
          workshop_collection_start_map_id: String(cs2Settings.workshop_collection_start_map_id || ""),
          workshop_single_map_id: String(cs2Settings.workshop_single_map_id || ""),
        },
      });
    }

    if (action === "access") {
      const faceitGuid = (searchParams.get("faceit_guid") || req.headers.get("x-faceit-guid") || "").trim();
      if (!faceitGuid) {
        return NextResponse.json({ ok: true, lvlservidor: 0, canUseRestrictedAreas: false });
      }

      const ctx = await getCloudflareContext({ async: true });
      const env = ctx.env as unknown as Env;
      const connection = await createMainConnection(env);

      try {
        const [rows] = await connection.query<AccessRow[]>(
          "SELECT lvlservidor FROM players WHERE faceit_guid = ? LIMIT 1",
          [faceitGuid],
        );

        const lvlservidor = Number(rows?.[0]?.lvlservidor ?? 0);
        const canUseRestrictedAreas = lvlservidor === 1 || lvlservidor === 2;
        const canSendConsoleCommands = canSendConsoleByLevel(lvlservidor);

        return NextResponse.json({
          ok: true,
          lvlservidor,
          canUseRestrictedAreas,
          canSendConsoleCommands,
        });
      } finally {
        await connection.end();
      }
    }

    if (action === "command-logs") {
      const rawLimit = Number(searchParams.get("limit") || 5);
      const limit = Math.min(Math.max(rawLimit, 1), 50);
      const direction = String(searchParams.get("direction") || "initial").trim().toLowerCase();
      const cursorId = Number(searchParams.get("cursor_id") || 0);

      const ctx = await getCloudflareContext({ async: true });
      const env = ctx.env as unknown as Env;
      const connection = await createMainConnection(env);

      try {
        let logs: CommandLogRow[] = [];
        if (direction === "older" && Number.isFinite(cursorId) && cursorId > 0) {
          const [rows] = await connection.query<CommandLogRow[]>(
            `SELECT lc.id, lc.usuario, lc.comando, lc.data, lc.hora, p.nickname, p.avatar
             FROM logs_comandos lc
             LEFT JOIN players p ON p.faceit_guid = lc.usuario
             WHERE lc.id < ?
             ORDER BY lc.id DESC
             LIMIT ?`,
            [cursorId, limit],
          );
          logs = rows;
        } else if (direction === "newer" && Number.isFinite(cursorId) && cursorId > 0) {
          const [rows] = await connection.query<CommandLogRow[]>(
            `SELECT lc.id, lc.usuario, lc.comando, lc.data, lc.hora, p.nickname, p.avatar
             FROM logs_comandos lc
             LEFT JOIN players p ON p.faceit_guid = lc.usuario
             WHERE lc.id > ?
             ORDER BY lc.id ASC
             LIMIT ?`,
            [cursorId, limit],
          );
          logs = rows.reverse();
        } else {
          const [rows] = await connection.query<CommandLogRow[]>(
            `SELECT lc.id, lc.usuario, lc.comando, lc.data, lc.hora, p.nickname, p.avatar
             FROM logs_comandos lc
             LEFT JOIN players p ON p.faceit_guid = lc.usuario
             ORDER BY lc.id DESC
             LIMIT ?`,
            [limit],
          );
          logs = rows;
        }

        const normalized = logs.map((row) => ({
          id: Number(row.id),
          usuario: String(row.usuario || ""),
          comando: String(row.comando || ""),
          data: formatDbDate(row.data),
          hora: formatDbTime(row.hora),
          nickname: String(row.nickname || "").trim() || null,
          avatar: String(row.avatar || "").trim() || null,
        }));

        const minId = normalized.length > 0 ? Math.min(...normalized.map((item) => item.id)) : null;
        const maxId = normalized.length > 0 ? Math.max(...normalized.map((item) => item.id)) : null;

        let hasMoreOlder = false;
        let hasMoreNewer = false;

        if (minId !== null) {
          const [olderRows] = await connection.query<Array<RowDataPacket & { total: number }>>(
            "SELECT COUNT(*) AS total FROM logs_comandos WHERE id < ?",
            [minId],
          );
          hasMoreOlder = Number(olderRows?.[0]?.total || 0) > 0;
        }

        if (maxId !== null) {
          const [newerRows] = await connection.query<Array<RowDataPacket & { total: number }>>(
            "SELECT COUNT(*) AS total FROM logs_comandos WHERE id > ?",
            [maxId],
          );
          hasMoreNewer = Number(newerRows?.[0]?.total || 0) > 0;
        }

        return NextResponse.json({
          ok: true,
          logs: normalized,
          hasMoreOlder,
          hasMoreNewer,
          limit,
          direction,
        });
      } finally {
        await connection.end();
      }
    }

    if (action === "admin-players") {
      const faceitGuid = (searchParams.get("faceit_guid") || req.headers.get("x-faceit-guid") || "").trim();
      const lvlServidor = await loadLvlServidor(faceitGuid);
      if (!canManageServerSettings(lvlServidor)) {
        return jsonError("Sem permissao para gerenciar admins.", 403, { lvlservidor: lvlServidor });
      }

      const query = String(searchParams.get("query") || "").trim();
      const rawLimit = Number(searchParams.get("limit") || 80);
      const limit = Math.min(Math.max(rawLimit, 1), 200);

      const ctx = await getCloudflareContext({ async: true });
      const env = ctx.env as unknown as Env;
      const connection = await createMainConnection(env);

      try {
        let rows: AdminPlayerRow[] = [];

        if (query) {
          const [queryRows] = await connection.query<AdminPlayerRow[]>(
            `SELECT id, nickname, faceit_guid, steamid, avatar
             FROM players
             WHERE nickname LIKE ?
             ORDER BY nickname ASC
             LIMIT ?`,
            [`%${query}%`, limit],
          );
          rows = queryRows;
        } else {
          const [queryRows] = await connection.query<AdminPlayerRow[]>(
            `SELECT id, nickname, faceit_guid, steamid, avatar
             FROM players
             ORDER BY id DESC
             LIMIT ?`,
            [limit],
          );
          rows = queryRows;
        }

        let adminNicknames = new Set<string>();
        let adminIdentities = new Set<string>();
        let adminConfigWarning: string | null = null;

        try {
          const adminConfig = await withFtpClient(async (client) => readAdminsConfig(client));
          adminNicknames = new Set(
            Object.keys(adminConfig)
              .map((key) => String(key || "").trim().toLowerCase())
              .filter(Boolean),
          );

          adminIdentities = new Set(
            Object.values(adminConfig)
              .map((entry) => String(entry?.identity || "").trim())
              .filter(Boolean),
          );
        } catch (error) {
          adminConfigWarning = error instanceof Error ? error.message : "Falha ao ler admins.json";
        }

        const players = rows.map((row) => {
          const nickname = String(row.nickname || "").trim();
          const steamid = String(row.steamid || "").trim() || null;
          const isAdmin = (nickname && adminNicknames.has(nickname.toLowerCase()))
            || (!!steamid && adminIdentities.has(steamid));

          return {
            id: Number(row.id || 0),
            nickname,
            faceit_guid: String(row.faceit_guid || "").trim() || null,
            steamid,
            avatar: String(row.avatar || "").trim() || null,
            is_admin: isAdmin,
          };
        });

        players.sort((a, b) => {
          if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
          return a.nickname.localeCompare(b.nickname, "pt-BR", { sensitivity: "base" });
        });

        return NextResponse.json({
          ok: true,
          players,
          adminConfigWarning,
        });
      } finally {
        await connection.end();
      }
    }

    return jsonError("action invalida. Use action=console, action=metrics, action=server-settings, action=access, action=command-logs ou action=admin-players.", 400);
  } catch (error) {
    return jsonError("Erro interno ao processar requisicao Dathost.", 500, error instanceof Error ? error.message : error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "console").trim().toLowerCase();
    const faceitGuid = String(body?.faceit_guid || req.headers.get("x-faceit-guid") || "").trim();

    if (action === "apply-mode-preset") {
      const preset = toModePreset(body?.mode);
      const serverId = String(body?.server_id || process.env.DATHOST_SERVER_ID || DEFAULT_SERVER_ID).trim();

      if (!preset) {
        return jsonError("Modo invalido. Use 1v1 ou mix.", 400);
      }

      if (!serverId) {
        return jsonError("server_id nao informado.", 400);
      }

      const lvlServidor = await loadLvlServidor(faceitGuid);
      if (lvlServidor !== 1) {
        return jsonError("Sem permissao para aplicar preset.", 403);
      }

      const ftpResult = await applyFtpPreset(preset);
      const settingsResult = await applyServerSettingsPreset(serverId, preset);
      const consoleCleanup = await applyPostPresetConsoleCleanup(serverId, preset);

      return NextResponse.json({
        ok: true,
        action,
        mode: preset,
        serverId,
        ftp: ftpResult,
        settingsStatus: settingsResult.status,
        consoleCleanup,
      });
    }

    if (action === "admin-add" || action === "admin-remove") {
      const selectedIdsRaw = Array.isArray(body?.player_ids) ? body.player_ids : [];
      const selectedIds = selectedIdsRaw
        .map((value: unknown) => Number(value))
        .filter((value: number) => Number.isFinite(value) && value > 0);

      if (selectedIds.length === 0) {
        return jsonError("Selecione ao menos um jogador.", 400);
      }

      const lvlServidor = await loadLvlServidor(faceitGuid);
      if (!canManageServerSettings(lvlServidor)) {
        return jsonError("Sem permissao para gerenciar admins.", 403, { lvlservidor: lvlServidor });
      }

      const ctx = await getCloudflareContext({ async: true });
      const env = ctx.env as unknown as Env;
      const connection = await createMainConnection(env);

      try {
        const placeholders = selectedIds.map(() => "?").join(", ");
        const [rows] = await connection.query<AdminPlayerRow[]>(
          `SELECT id, nickname, faceit_guid, steamid, avatar
           FROM players
           WHERE id IN (${placeholders})`,
          selectedIds,
        );

        if (!rows.length) {
          return jsonError("Nenhum jogador encontrado com os IDs selecionados.", 404);
        }

        const resolvedPlayers = await ensurePlayersSteamIds(connection, rows);

        const ftpResult = await withFtpClient(async (client) => {
          const config = await readAdminsConfig(client);
          let changed = 0;
          const applied: Array<{ id: number; nickname: string; steamid: string }> = [];
          const skipped: Array<{ id: number; nickname: string; reason: string }> = [];

          if (action === "admin-add") {
            for (const player of resolvedPlayers) {
              if (!player.nickname) {
                skipped.push({ id: player.id, nickname: "", reason: "nickname vazio" });
                continue;
              }

              if (!player.steamid) {
                skipped.push({ id: player.id, nickname: player.nickname, reason: "steamid nao encontrado" });
                continue;
              }

              config[player.nickname] = {
                identity: player.steamid,
                groups: ["#css/admin"],
              };
              changed += 1;
              applied.push({ id: player.id, nickname: player.nickname, steamid: player.steamid });
            }
          }

          if (action === "admin-remove") {
            for (const player of resolvedPlayers) {
              const nickname = String(player.nickname || "").trim();
              const steamid = String(player.steamid || "").trim();

              let removedThisPlayer = false;

              if (nickname && config[nickname]) {
                delete config[nickname];
                removedThisPlayer = true;
              }

              if (steamid) {
                for (const key of Object.keys(config)) {
                  if (String(config[key]?.identity || "").trim() === steamid) {
                    delete config[key];
                    removedThisPlayer = true;
                  }
                }
              }

              if (removedThisPlayer) {
                changed += 1;
                applied.push({ id: player.id, nickname, steamid });
              } else {
                skipped.push({ id: player.id, nickname, reason: "admin nao encontrado no arquivo" });
              }
            }
          }

          if (changed > 0) {
            await writeAdminsConfig(client, config);
          }

          return { changed, applied, skipped };
        }).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          throw new Error(`Falha ao editar admins.json via FTP: ${message}`);
        });

        return NextResponse.json({
          ok: true,
          action,
          changed: ftpResult.changed,
          applied: ftpResult.applied,
          skipped: ftpResult.skipped,
          steamSync: resolvedPlayers.map((player) => ({
            id: player.id,
            nickname: player.nickname,
            steamid: player.steamid,
            synced: player.synced,
          })),
        });
      } finally {
        await connection.end();
      }
    }

    const line = String(body?.line || "").trim();
    const serverId = String(body?.server_id || process.env.DATHOST_SERVER_ID || DEFAULT_SERVER_ID).trim();

    if (!line) {
      return jsonError("Comando vazio.", 400);
    }

    if (!serverId) {
      return jsonError("server_id nao informado.", 400);
    }

    const lvlServidor = await loadLvlServidor(faceitGuid);
    if (!canSendConsoleByLevel(lvlServidor)) {
      return jsonError("Sem permissao para enviar comandos no console.", 403, { lvlservidor: lvlServidor });
    }

    const formData = new FormData();
    formData.append("line", line);

    const result = await dathostRequest(`/game-servers/${serverId}/console`, {
      method: "POST",
      body: formData,
    });

    if (!result.ok) {
      return jsonError("Falha ao enviar comando para o console.", result.status, result.data || result.raw);
    }

    const shouldLogCommand = body?.log_command !== false;
    if (shouldLogCommand) {
      const ctx = await getCloudflareContext({ async: true });
      const env = ctx.env as unknown as Env;
      const connection = await createMainConnection(env);

      try {
        await connection.query(
          "INSERT INTO logs_comandos (usuario, comando, data, hora) VALUES (?, ?, CURDATE(), CURTIME())",
          [faceitGuid || "desconhecido", line],
        );
      } finally {
        await connection.end();
      }
    }

    return NextResponse.json({ ok: true, serverId, line, response: result.data, raw: result.raw });
  } catch (error) {
    return jsonError("Erro interno ao enviar comando.", 500, error instanceof Error ? error.message : error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const serverId = String(body?.server_id || process.env.DATHOST_SERVER_ID || DEFAULT_SERVER_ID).trim();

    const gameMode = String(body?.game_mode || "").trim() as Cs2GameMode;
    const mapsSource = String(body?.maps_source || "").trim() as Cs2MapsSource;
    const mapgroup = String(body?.mapgroup || "").trim();
    const startMap = String(body?.mapgroup_start_map || body?.start_map || "").trim();
    const workshopMapId = String(body?.workshop_map_id || "").trim();

    const allowedGameModes: Cs2GameMode[] = ["competitive", "casual", "arms_race", "ffa_deathmatch", "retakes", "wingman", "custom"];
    const allowedMapsSource: Cs2MapsSource[] = ["mapgroup", "workshop_collection", "workshop_single_map"];

    if (!serverId) {
      return jsonError("server_id nao informado.", 400);
    }

    if (!allowedGameModes.includes(gameMode)) {
      return jsonError("game_mode invalido.", 400, { allowed: allowedGameModes });
    }

    if (!allowedMapsSource.includes(mapsSource)) {
      return jsonError("maps_source invalido.", 400, { allowed: allowedMapsSource });
    }

    const formData = new FormData();
    formData.append("cs2_settings.game_mode", gameMode);
    formData.append("cs2_settings.maps_source", mapsSource);
    formData.append("cs2_settings.mapgroup", mapgroup);
    formData.append("cs2_settings.mapgroup_start_map", startMap);

    // Clear both fields first to avoid stale values when switching maps source mode.
    formData.append("cs2_settings.workshop_collection_start_map_id", "");
    formData.append("cs2_settings.workshop_single_map_id", "");

    if (workshopMapId) {
      if (mapsSource === "workshop_collection") {
        formData.append("cs2_settings.workshop_collection_start_map_id", workshopMapId);
      }

      if (mapsSource === "workshop_single_map") {
        formData.append("cs2_settings.workshop_single_map_id", workshopMapId);
      }
    }

    const result = await dathostRequest(`/game-servers/${serverId}`, {
      method: "PUT",
      body: formData,
    });

    if (!result.ok) {
      return jsonError("Falha ao atualizar configuracoes do servidor.", result.status, result.data || result.raw);
    }

    return NextResponse.json({
      ok: true,
      serverId,
      updated: {
        game_mode: gameMode,
        maps_source: mapsSource,
        mapgroup: mapgroup,
        mapgroup_start_map: startMap,
        workshop_map_id: workshopMapId,
      },
      response: result.data,
      raw: result.raw,
    });
  } catch (error) {
    return jsonError("Erro interno ao atualizar configuracoes.", 500, error instanceof Error ? error.message : error);
  }
}

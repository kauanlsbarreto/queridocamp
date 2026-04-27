import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection, type Env } from "@/lib/db";
import type { RowDataPacket } from "mysql2";
import { Client } from "basic-ftp";

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

const FTP_HOST = process.env.DATHOST_FTP_HOST || "loboda.dathost.net";
const FTP_PORT = Number(process.env.DATHOST_FTP_PORT || 21);
const FTP_USER = process.env.DATHOST_FTP_USER || "69e25c29817337ed7e1ff91c";
const FTP_PASSWORD = process.env.DATHOST_FTP_PASSWORD || "I2ISJT5UK3A";

const FTP_PLUGINS_PATH = "/addons/counterstrikesharp/plugins";
const FTP_DISABLED_PATH = "/addons/counterstrikesharp/plugins/Disabled";

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
    // Send sequentially so mp_restartgame runs after cvars are set.
    // eslint-disable-next-line no-await-in-loop
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

        return NextResponse.json({
          ok: true,
          lvlservidor,
          canUseRestrictedAreas,
        });
      } finally {
        await connection.end();
      }
    }

    return jsonError("action invalida. Use action=console, action=metrics, action=server-settings ou action=access.", 400);
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

    const line = String(body?.line || "").trim();
    const serverId = String(body?.server_id || process.env.DATHOST_SERVER_ID || DEFAULT_SERVER_ID).trim();

    if (!line) {
      return jsonError("Comando vazio.", 400);
    }

    if (!serverId) {
      return jsonError("server_id nao informado.", 400);
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

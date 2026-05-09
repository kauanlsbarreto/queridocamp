import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { createMainConnection } from "@/lib/db";
import type { Connection } from "mysql2/promise";

export const dynamic = "force-dynamic";

type Env = {
  DB_PRINCIPAL: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
};

type SaveBody = {
  tab: "skins" | "agents" | "gloves" | "music" | "collectibles" | string;
  steamid?: string;
  faceit_guid?: string;
  item?: {
    weapon_defindex?: number;
    weapon_name?: string;
    paint?: string | number;
    id?: string | number;
    team?: number;
    model?: string;
  };
  settings?: {
    wear?: number;
    seed?: number;
    stattrak?: boolean;
    stattrakCount?: number;
    nametag?: string;
    teams?: number[];
    stickers?: string[];
    keychain?: string;
  };
};

const TEAM_T = 2;
const TEAM_CT = 3;

async function ensureTables(connection: Connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS wp_player_skins (
      steamid varchar(18) NOT NULL,
      weapon_team int NOT NULL,
      weapon_defindex int NOT NULL,
      weapon_paint_id int NOT NULL,
      weapon_wear float NOT NULL DEFAULT 0.000001,
      weapon_seed int NOT NULL DEFAULT 0,
      weapon_nametag varchar(128) DEFAULT NULL,
      weapon_stattrak tinyint(1) NOT NULL DEFAULT 0,
      weapon_stattrak_count int NOT NULL DEFAULT 0,
      weapon_sticker_0 varchar(128) NOT NULL DEFAULT '0;0;0;0;0;0;0',
      weapon_sticker_1 varchar(128) NOT NULL DEFAULT '0;0;0;0;0;0;0',
      weapon_sticker_2 varchar(128) NOT NULL DEFAULT '0;0;0;0;0;0;0',
      weapon_sticker_3 varchar(128) NOT NULL DEFAULT '0;0;0;0;0;0;0',
      weapon_sticker_4 varchar(128) NOT NULL DEFAULT '0;0;0;0;0;0;0',
      weapon_keychain varchar(128) NOT NULL DEFAULT '0;0;0;0;0',
      UNIQUE KEY steamid (steamid, weapon_team, weapon_defindex)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS wp_player_pins (
      steamid varchar(64) NOT NULL,
      weapon_team int NOT NULL,
      id int NOT NULL,
      UNIQUE KEY steamid (steamid, weapon_team)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS wp_player_music (
      steamid varchar(64) NOT NULL,
      weapon_team int NOT NULL,
      music_id int NOT NULL,
      UNIQUE KEY steamid (steamid, weapon_team)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS wp_player_knife (
      steamid varchar(18) NOT NULL,
      weapon_team int NOT NULL,
      knife varchar(64) NOT NULL,
      UNIQUE KEY steamid (steamid, weapon_team)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS wp_player_gloves (
      steamid varchar(18) NOT NULL,
      weapon_team int NOT NULL,
      weapon_defindex int NOT NULL,
      UNIQUE KEY steamid (steamid, weapon_team)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS wp_player_agents (
      steamid varchar(18) NOT NULL,
      agent_ct varchar(64) DEFAULT NULL,
      agent_t varchar(64) DEFAULT NULL,
      UNIQUE KEY steamid (steamid)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
  `);
}

async function resolveSteamId(
  connection: Connection,
  body: SaveBody,
): Promise<string | null> {
  if (body.steamid && String(body.steamid).trim()) {
    return String(body.steamid).trim();
  }

  const guid = body.faceit_guid?.trim();
  if (guid) {
    const [rows] = await connection.query<any[]>(
      "SELECT steamid FROM players WHERE faceit_guid = ? LIMIT 1",
      [guid],
    );

    const steamid = rows?.[0]?.steamid;
    if (steamid) return String(steamid).trim();
  }

  return null;
}

function isKnifeWeaponName(name?: string): boolean {
  if (!name) return false;
  return name.includes("knife") || name.includes("bayonet");
}

async function saveSkin(
  connection: Connection,
  steamid: string,
  body: SaveBody,
) {
  const defindex = Number(body.item?.weapon_defindex);
  const paintId = Number(body.item?.paint ?? 0);

  if (!Number.isFinite(defindex) || !Number.isFinite(paintId)) {
    throw new Error("Dados de skin inválidos.");
  }

  const wear = Number(body.settings?.wear ?? 0.000001);
  const seed = Number(body.settings?.seed ?? 0);
  const stattrak = body.settings?.stattrak ? 1 : 0;
  const stattrakCount = Number.isFinite(Number(body.settings?.stattrakCount))
    ? Math.max(0, Math.floor(Number(body.settings?.stattrakCount ?? 0)))
    : 0;
  const nametag = (body.settings?.nametag || "").trim() || null;
  const stickerValues = [0, 1, 2, 3, 4].map(
    (i) => (Array.isArray(body.settings?.stickers) ? body.settings!.stickers![i] : null) || "0;0;0;0;0;0;0",
  );
  const keychain = body.settings?.keychain || "0;0;0;0;0";

  const requestedTeams = Array.isArray(body.settings?.teams)
    ? body.settings.teams.filter((t) => t === TEAM_T || t === TEAM_CT)
    : [];
  const teams = requestedTeams.length > 0 ? requestedTeams : [TEAM_T, TEAM_CT];

  for (const team of teams) {
    await connection.query(
      `INSERT INTO wp_player_skins
       (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed, weapon_nametag, weapon_stattrak, weapon_stattrak_count,
        weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3, weapon_sticker_4, weapon_keychain)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         weapon_paint_id = VALUES(weapon_paint_id),
         weapon_wear = VALUES(weapon_wear),
         weapon_seed = VALUES(weapon_seed),
         weapon_nametag = VALUES(weapon_nametag),
         weapon_stattrak = VALUES(weapon_stattrak),
         weapon_stattrak_count = VALUES(weapon_stattrak_count),
         weapon_sticker_0 = VALUES(weapon_sticker_0),
         weapon_sticker_1 = VALUES(weapon_sticker_1),
         weapon_sticker_2 = VALUES(weapon_sticker_2),
         weapon_sticker_3 = VALUES(weapon_sticker_3),
         weapon_sticker_4 = VALUES(weapon_sticker_4),
         weapon_keychain = VALUES(weapon_keychain)`,
      [steamid, team, defindex, paintId, wear, seed, nametag, stattrak, stattrakCount, ...stickerValues, keychain],
    );
  }

  const weaponName = body.item?.weapon_name;
  if (isKnifeWeaponName(weaponName)) {
    for (const team of teams) {
      await connection.query(
        `INSERT INTO wp_player_knife (steamid, weapon_team, knife)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE knife = VALUES(knife)`,
        [steamid, team, weaponName],
      );
    }
  }
}

async function saveMusic(connection: Connection, steamid: string, body: SaveBody) {
  const musicId = Number(body.item?.id ?? 0);
  if (!Number.isFinite(musicId)) {
    throw new Error("Music ID inválido.");
  }

  for (const team of [TEAM_T, TEAM_CT]) {
    await connection.query(
      `INSERT INTO wp_player_music (steamid, weapon_team, music_id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE music_id = VALUES(music_id)`,
      [steamid, team, musicId],
    );
  }
}

async function savePin(connection: Connection, steamid: string, body: SaveBody) {
  const pinId = Number(body.item?.id ?? 0);
  if (!Number.isFinite(pinId)) {
    throw new Error("Pin ID inválido.");
  }

  for (const team of [TEAM_T, TEAM_CT]) {
    await connection.query(
      `INSERT INTO wp_player_pins (steamid, weapon_team, id)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE id = VALUES(id)`,
      [steamid, team, pinId],
    );
  }
}

async function saveGlove(connection: Connection, steamid: string, body: SaveBody) {
  const gloveDefindex = Number(body.item?.weapon_defindex ?? 0);
  if (!Number.isFinite(gloveDefindex)) {
    throw new Error("Defindex da luva inválido.");
  }

  const requestedTeams = Array.isArray(body.settings?.teams)
    ? body.settings.teams.filter((t) => t === TEAM_T || t === TEAM_CT)
    : [];
  const teams = requestedTeams.length > 0 ? requestedTeams : [TEAM_T, TEAM_CT];

  for (const team of teams) {
    await connection.query(
      `INSERT INTO wp_player_gloves (steamid, weapon_team, weapon_defindex)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE weapon_defindex = VALUES(weapon_defindex)`,
      [steamid, team, gloveDefindex],
    );
  }

  // Luva também precisa salvar o paint em wp_player_skins para destacar/exibir skin exata.
  await saveSkin(connection, steamid, body);
}

async function saveAgent(connection: Connection, steamid: string, body: SaveBody) {
  const modelRaw = body.item?.model;
  const team = Number(body.item?.team ?? 0);
  const model = !modelRaw || modelRaw === "null" ? null : modelRaw;

  if (team !== TEAM_T && team !== TEAM_CT) {
    throw new Error("Time do agente inválido.");
  }

  if (team === TEAM_CT) {
    await connection.query(
      `INSERT INTO wp_player_agents (steamid, agent_ct, agent_t)
       VALUES (?, ?, NULL)
       ON DUPLICATE KEY UPDATE agent_ct = VALUES(agent_ct)`,
      [steamid, model],
    );
    return;
  }

  await connection.query(
    `INSERT INTO wp_player_agents (steamid, agent_ct, agent_t)
     VALUES (?, NULL, ?)
     ON DUPLICATE KEY UPDATE agent_t = VALUES(agent_t)`,
    [steamid, model],
  );
}

export async function POST(req: Request) {
  let connection: Connection | null = null;

  try {
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    const body = (await req.json()) as SaveBody;

    await ensureTables(connection);

    const steamid = await resolveSteamId(connection, body);
    if (!steamid) {
      return NextResponse.json(
        { message: "SteamID não encontrado para este usuário." },
        { status: 400 },
      );
    }

    switch (body.tab) {
      case "skins":
        await saveSkin(connection, steamid, body);
        break;
      case "music":
        await saveMusic(connection, steamid, body);
        break;
      case "collectibles":
        await savePin(connection, steamid, body);
        break;
      case "gloves":
        await saveGlove(connection, steamid, body);
        break;
      case "agents":
        await saveAgent(connection, steamid, body);
        break;
      default:
        return NextResponse.json(
          { message: `Categoria não suportada para persistência: ${body.tab}` },
          { status: 400 },
        );
    }

    return NextResponse.json({ ok: true, steamid, tab: body.tab });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  } finally {
    if (connection) await connection.end();
  }
}

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import type { Connection, RowDataPacket } from "mysql2/promise";

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

async function resolveSteamId(
  connection: Connection,
  steamid?: string | null,
  faceitGuid?: string | null,
): Promise<string | null> {
  const guid = faceitGuid?.trim();
  if (guid) {
    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT steamid FROM players WHERE faceit_guid = ? LIMIT 1",
      [guid],
    );

    const dbSteamId = rows?.[0]?.steamid;
    if (dbSteamId) return String(dbSteamId).trim();
  }

  const trimmedSteamId = steamid?.trim();
  return trimmedSteamId || null;
}

export async function GET(req: Request) {
  let connection: Connection | null = null;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const url = new URL(req.url);
    const steamid = url.searchParams.get("steamid");
    const faceitGuid = url.searchParams.get("faceit_guid");

    const resolvedSteamId = await resolveSteamId(connection, steamid, faceitGuid);
    if (!resolvedSteamId) {
      return NextResponse.json(
        { message: "SteamID não encontrado." },
        { status: 404 },
      );
    }

    const [skins] = await connection.query<RowDataPacket[]>(
      `SELECT steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed,
              weapon_nametag, weapon_stattrak, weapon_stattrak_count,
              weapon_sticker_0, weapon_sticker_1, weapon_sticker_2, weapon_sticker_3, weapon_sticker_4, weapon_keychain
       FROM wp_player_skins WHERE steamid = ? ORDER BY weapon_team ASC, weapon_defindex ASC`,
      [resolvedSteamId],
    );

    const [knives] = await connection.query<RowDataPacket[]>(
      `SELECT steamid, weapon_team, knife
       FROM wp_player_knife WHERE steamid = ? ORDER BY weapon_team ASC`,
      [resolvedSteamId],
    );

    const [gloves] = await connection.query<RowDataPacket[]>(
      `SELECT steamid, weapon_team, weapon_defindex
       FROM wp_player_gloves WHERE steamid = ? ORDER BY weapon_team ASC`,
      [resolvedSteamId],
    );

    const [music] = await connection.query<RowDataPacket[]>(
      `SELECT steamid, weapon_team, music_id
       FROM wp_player_music WHERE steamid = ? ORDER BY weapon_team ASC`,
      [resolvedSteamId],
    );

    const [pins] = await connection.query<RowDataPacket[]>(
      `SELECT steamid, weapon_team, id
       FROM wp_player_pins WHERE steamid = ? ORDER BY weapon_team ASC`,
      [resolvedSteamId],
    );

    const [agentsRows] = await connection.query<RowDataPacket[]>(
      `SELECT steamid, agent_ct, agent_t
       FROM wp_player_agents WHERE steamid = ? LIMIT 1`,
      [resolvedSteamId],
    );

    const agents = agentsRows[0] || null;

    return NextResponse.json({
      ok: true,
      steamid: resolvedSteamId,
      loadout: {
        skins,
        knives,
        gloves,
        music,
        pins,
        agents,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  } finally {
    if (connection) await connection.end();
  }
}

export async function DELETE(req: Request) {
  let connection: Connection | null = null;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const body = (await req.json()) as {
      type: string;
      steamid?: string;
      faceit_guid?: string;
      weapon_team?: number;
      weapon_defindex?: number;
    };

    const resolvedSteamId = await resolveSteamId(connection, body.steamid, body.faceit_guid);
    if (!resolvedSteamId) {
      return NextResponse.json({ message: "SteamID não encontrado." }, { status: 404 });
    }

    switch (body.type) {
      case "skin":
        await connection.query(
          "DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?",
          [resolvedSteamId, body.weapon_team, body.weapon_defindex],
        );
        break;
      case "knife":
        await connection.query(
          "DELETE FROM wp_player_knife WHERE steamid = ? AND weapon_team = ?",
          [resolvedSteamId, body.weapon_team],
        );
        if (typeof body.weapon_defindex === "number") {
          await connection.query(
            "DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?",
            [resolvedSteamId, body.weapon_team, body.weapon_defindex],
          );
        }
        break;
      case "glove":
        await connection.query(
          "DELETE FROM wp_player_gloves WHERE steamid = ? AND weapon_team = ?",
          [resolvedSteamId, body.weapon_team],
        );
        if (typeof body.weapon_defindex === "number") {
          await connection.query(
            "DELETE FROM wp_player_skins WHERE steamid = ? AND weapon_team = ? AND weapon_defindex = ?",
            [resolvedSteamId, body.weapon_team, body.weapon_defindex],
          );
        }
        break;
      case "music":
        await connection.query(
          "DELETE FROM wp_player_music WHERE steamid = ? AND weapon_team = ?",
          [resolvedSteamId, body.weapon_team],
        );
        break;
      case "pin":
        await connection.query(
          "DELETE FROM wp_player_pins WHERE steamid = ? AND weapon_team = ?",
          [resolvedSteamId, body.weapon_team],
        );
        break;
      case "agent":
        await connection.query(
          "UPDATE wp_player_agents SET agent_ct = NULL, agent_t = NULL WHERE steamid = ?",
          [resolvedSteamId],
        );
        break;
      default:
        return NextResponse.json({ message: `Tipo desconhecido: ${body.type}` }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Erro interno." },
      { status: 500 },
    );
  } finally {
    if (connection) await connection.end();
  }
}

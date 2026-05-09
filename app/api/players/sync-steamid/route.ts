import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { createMainConnection } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

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

type PlayerRow = RowDataPacket & {
  id: number;
  faceit_guid: string | null;
  steamid: string | null;
};

const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FALLBACK_FACEIT_API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

function extractSteamId(faceitPayload: any): string | null {
  const raw =
    faceitPayload?.steam_id_64 ||
    faceitPayload?.games?.cs2?.game_player_id ||
    faceitPayload?.games?.csgo?.game_player_id ||
    faceitPayload?.platforms?.steam?.id ||
    null;

  if (!raw) return null;
  const steamId = String(raw).trim();
  return steamId.length > 0 ? steamId : null;
}

export async function POST(req: Request) {
  let connection: Awaited<ReturnType<typeof createMainConnection>> | null = null;

  try {
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    const body = (await req.json().catch(() => ({}))) as {
      id?: number;
      faceit_guid?: string;
    };

    const playerId = Number(body.id);
    const faceitGuid = body.faceit_guid?.trim();

    if (!Number.isFinite(playerId) && !faceitGuid) {
      return NextResponse.json(
        { message: "Informe id ou faceit_guid." },
        { status: 400 },
      );
    }

    try {
      await connection.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS steamid VARCHAR(32) NULL");
    } catch {
      // Compatibilidade com versões sem IF NOT EXISTS.
      try {
        await connection.query("ALTER TABLE players ADD COLUMN steamid VARCHAR(32) NULL");
      } catch {
        // Ignora se já existe.
      }
    }

    const [rows] = Number.isFinite(playerId)
      ? await connection.query<PlayerRow[]>(
          "SELECT id, faceit_guid, steamid FROM players WHERE id = ? LIMIT 1",
          [playerId],
        )
      : await connection.query<PlayerRow[]>(
          "SELECT id, faceit_guid, steamid FROM players WHERE faceit_guid = ? LIMIT 1",
          [faceitGuid],
        );

    const player = rows[0];

    if (!player) {
      return NextResponse.json({ message: "Jogador não encontrado." }, { status: 404 });
    }

    if (player.steamid) {
      return NextResponse.json({
        ok: true,
        updated: false,
        id: player.id,
        faceit_guid: player.faceit_guid,
        steamid: player.steamid,
      });
    }

    const guidToUse = player.faceit_guid || faceitGuid;
    if (!guidToUse) {
      return NextResponse.json(
        { message: "Jogador sem faceit_guid para sincronizar steamid." },
        { status: 400 },
      );
    }

    const apiKey = process.env.FACEIT_API_KEY || FALLBACK_FACEIT_API_KEY;
    const faceitRes = await fetch(`${FACEIT_API_BASE}/players/${encodeURIComponent(guidToUse)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    if (!faceitRes.ok) {
      return NextResponse.json(
        { message: "Falha ao consultar API da FACEIT." },
        { status: 502 },
      );
    }

    const faceitData = await faceitRes.json();
    const steamid = extractSteamId(faceitData);

    if (!steamid) {
      return NextResponse.json(
        { message: "SteamID não encontrado no perfil da FACEIT." },
        { status: 404 },
      );
    }

    await connection.query<ResultSetHeader>(
      "UPDATE players SET steamid = ? WHERE id = ?",
      [steamid, player.id],
    );

    return NextResponse.json({
      ok: true,
      updated: true,
      id: player.id,
      faceit_guid: guidToUse,
      steamid,
    });
  } catch {
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

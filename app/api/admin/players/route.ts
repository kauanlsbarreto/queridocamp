import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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
  DB_JOGADORES: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
};

type PlayerRow = RowDataPacket & {
  id: number;
  nickname: string;
  admin: number;
  faceit_guid: string;
  avatar: string;
  adicionados: number;
  points: number;
  ban?: number;
};

function isTransientConnectionError(error: unknown) {
  const err = error as { code?: string; message?: string } | null;
  const code = String(err?.code || "").toUpperCase();
  const message = String(err?.message || "").toLowerCase();

  if (["PROTOCOL_CONNECTION_LOST", "ECONNRESET", "EPIPE", "ETIMEDOUT"].includes(code)) {
    return true;
  }

  return (
    message.includes("connection lost") ||
    message.includes("server closed the connection") ||
    message.includes("can't add new command when connection is in closed state")
  );
}

async function closeQuietly(connection: { end: () => Promise<void> } | null) {
  if (!connection) return;
  try {
    await connection.end();
  } catch {
    // Ignore close errors to preserve primary API response.
  }
}

export async function GET(req: Request) {
  let connection: Awaited<ReturnType<typeof createMainConnection>> | null = null;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const faceit_guid = searchParams.get("faceit_guid");
    const nickname = searchParams.get("nickname");

    let query = "SELECT id, nickname, admin, faceit_guid, avatar, adicionados, points, ban FROM players";
    let params: any[] = [];

    if (id) {
      query += " WHERE id = ?";
      params.push(id);
    } else if (nickname) {
      query += " WHERE nickname = ?";
      params.push(nickname);
    } else if (faceit_guid) {
      query += " WHERE faceit_guid = ?";
      params.push(faceit_guid);
    } else {
      query += " ORDER BY nickname ASC";
    }

    let rows: PlayerRow[];
    try {
      const [result] = await connection.query<PlayerRow[]>(query, params);
      rows = result;
    } catch (error) {
      if (!isTransientConnectionError(error)) {
        throw error;
      }

      await closeQuietly(connection);
      connection = await createMainConnection(env);
      const [retryRows] = await connection.query<PlayerRow[]>(query, params);
      rows = retryRows;
    }

    if ((id || nickname || faceit_guid) && rows.length === 0)
      return NextResponse.json({ message: "Player not found" }, { status: 404 });

    return NextResponse.json((id || nickname || faceit_guid) ? rows[0] : rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 });
  } finally {
    await closeQuietly(connection);
  }
}

export async function POST(req: Request) {
  let connection: Awaited<ReturnType<typeof createMainConnection>> | null = null;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const { identifier, adminLevel } = await req.json();

    if (!identifier || adminLevel === undefined) {
      return NextResponse.json(
        { message: "Identifier and admin level are required." },
        { status: 400 }
      );
    }

    let query = "UPDATE players SET admin = ? WHERE faceit_guid = ? OR nickname = ?";
    let params: any[] = [adminLevel, identifier, identifier];

    if (/^\d+$/.test(identifier)) {
      query = "UPDATE players SET admin = ? WHERE id = ?";
      params = [adminLevel, identifier];
    }

    const [result] = await connection.query<ResultSetHeader>(query, params);

    if (result.affectedRows === 0)
      return NextResponse.json({ message: "Player not found." }, { status: 404 });

    return NextResponse.json({ message: "Admin level updated successfully." });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  } finally {
    await closeQuietly(connection);
  }
}

export async function PUT(req: Request) {
  let connection: Awaited<ReturnType<typeof createMainConnection>> | null = null;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const { userId, adminLevel, adicionados } = await req.json();

    if (!userId) {
      return NextResponse.json({ message: "User ID is required." }, { status: 400 });
    }

    if (adminLevel !== undefined) {
      await connection.query<ResultSetHeader>("UPDATE players SET admin = ? WHERE id = ?", [
        adminLevel,
        userId,
      ]);
    }

    if (adicionados !== undefined) {
      await connection.query<ResultSetHeader>("UPDATE players SET adicionados = ? WHERE id = ?", [
        adicionados,
        userId,
      ]);
    }

    return NextResponse.json({ message: "Player updated successfully." });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  } finally {
    await closeQuietly(connection);
  }
}

export async function PATCH(req: Request) {
  let connection: Awaited<ReturnType<typeof createMainConnection>> | null = null;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const body = await req.json();

    if (body.originalId !== undefined && body.newId !== undefined) {
      const { originalId, newId } = body;

      await connection.query("SET FOREIGN_KEY_CHECKS=0");

      await connection.query<ResultSetHeader>("UPDATE players SET id = ? WHERE id = ?", [
        newId,
        originalId,
      ]);

      await connection.query<ResultSetHeader>(
        "UPDATE codigos_conquistas SET resgatado_por = ? WHERE resgatado_por = ?",
        [newId, originalId]
      );

      await connection.query("SET FOREIGN_KEY_CHECKS=1");

      return NextResponse.json({ message: "Player ID updated successfully." });
    }

    const { userId, faceitGuid } = body;

    if (userId && faceitGuid) {
      await connection.query<ResultSetHeader>("UPDATE players SET faceit_guid = ? WHERE id = ?", [
        faceitGuid,
        userId,
      ]);

      return NextResponse.json({ message: "Faceit GUID updated successfully." });
    }

    return NextResponse.json(
      {
        message:
          "Invalid parameters. Required: (originalId, newId) or (userId, faceitGuid).",
      },
      { status: 400 }
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  } finally {
    await closeQuietly(connection);
  }
}

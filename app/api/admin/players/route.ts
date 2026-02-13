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
};

export async function GET(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const faceit_guid = searchParams.get("faceit_guid");
    const nickname = searchParams.get("nickname");

    if (id) {
      const [rows] = await connection.query<PlayerRow[]>(
        "SELECT id, nickname, admin, faceit_guid, avatar, adicionados FROM players WHERE id = ?",
        [id]
      );
      await connection.end();
      if (rows.length === 0)
        return NextResponse.json({ message: "Player not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    if (nickname) {
      const [rows] = await connection.query<PlayerRow[]>(
        "SELECT id, nickname, admin, faceit_guid, avatar, adicionados FROM players WHERE nickname = ?",
        [nickname]
      );
      await connection.end();
      if (rows.length === 0)
        return NextResponse.json({ message: "Player not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    if (faceit_guid) {
      const [rows] = await connection.query<PlayerRow[]>(
        "SELECT id, nickname, admin, faceit_guid, avatar, adicionados FROM players WHERE faceit_guid = ?",
        [faceit_guid]
      );
      await connection.end();
      if (rows.length === 0)
        return NextResponse.json({ message: "Player not found" }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    const [rows] = await connection.query<PlayerRow[]>(
      "SELECT id, nickname, admin, faceit_guid, adicionados FROM players ORDER BY nickname ASC"
    );

    await connection.end();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const { identifier, adminLevel } = await req.json();

    if (!identifier || adminLevel === undefined) {
      await connection.end();
      return NextResponse.json(
        { message: "Identifier and admin level are required." },
        { status: 400 }
      );
    }

    let query =
      "UPDATE players SET admin = ? WHERE faceit_guid = ? OR nickname = ?";
    let params: any[] = [adminLevel, identifier, identifier];

    if (/^\d+$/.test(identifier)) {
      query = "UPDATE players SET admin = ? WHERE id = ?";
      params = [adminLevel, identifier];
    }

    const [result] = await connection.query<ResultSetHeader>(query, params);

    await connection.end();

    if (result.affectedRows === 0)
      return NextResponse.json({ message: "Player not found." }, { status: 404 });

    return NextResponse.json({
      message: "Admin level updated successfully.",
    });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const { userId, adminLevel, adicionados } = await req.json();

    if (!userId) {
      await connection.end();
      return NextResponse.json(
        { message: "User ID is required." },
        { status: 400 }
      );
    }

    if (adminLevel !== undefined) {
      await connection.query<ResultSetHeader>(
        "UPDATE players SET admin = ? WHERE id = ?",
        [adminLevel, userId]
      );
    }

    if (adicionados !== undefined) {
      await connection.query<ResultSetHeader>(
        "UPDATE players SET adicionados = ? WHERE id = ?",
        [adicionados, userId]
      );
    }

    await connection.end();

    return NextResponse.json({
      message: "Player updated successfully.",
    });
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const body = await req.json();

    if (body.originalId !== undefined && body.newId !== undefined) {
      const { originalId, newId } = body;

      await connection.query("SET FOREIGN_KEY_CHECKS=0");

      await connection.query<ResultSetHeader>(
        "UPDATE players SET id = ? WHERE id = ?",
        [newId, originalId]
      );

      await connection.query<ResultSetHeader>(
        "UPDATE codigos_conquistas SET resgatado_por = ? WHERE resgatado_por = ?",
        [newId, originalId]
      );

      await connection.query("SET FOREIGN_KEY_CHECKS=1");

      await connection.end();

      return NextResponse.json({
        message: "Player ID updated successfully.",
      });
    }

    const { userId, faceitGuid } = body;

    if (userId && faceitGuid) {
      await connection.query<ResultSetHeader>(
        "UPDATE players SET faceit_guid = ? WHERE id = ?",
        [faceitGuid, userId]
      );

      await connection.end();

      return NextResponse.json({
        message: "Faceit GUID updated successfully.",
      });
    }

    await connection.end();

    return NextResponse.json(
      {
        message:
          "Invalid parameters. Required: (originalId, newId) or (userId, faceitGuid).",
      },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}

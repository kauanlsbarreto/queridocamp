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
  faceit_guid: string;
  nickname: string;
  avatar: string;
  created_at: string;
  updated_at: string;
};

export async function POST(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const { guid, nickname, avatar } = await req.json();

    if (!guid || !nickname) {
      await connection.end();
      return NextResponse.json(
        { message: "GUID e nickname são obrigatórios." },
        { status: 400 }
      );
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS players (
        id INT AUTO_INCREMENT PRIMARY KEY,
        faceit_guid VARCHAR(255) NOT NULL UNIQUE,
        nickname VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) AUTO_INCREMENT = 100
    `);

    const [rows] = await connection.query<PlayerRow[]>(
      "SELECT * FROM players WHERE faceit_guid = ?",
      [guid]
    );

    let user = rows[0];

    if (!user) {
      const [insertResult] = await connection.query<ResultSetHeader>(
        "INSERT INTO players (faceit_guid, nickname, avatar) VALUES (?, ?, ?)",
        [guid, nickname, avatar || ""]
      );

      const [newRows] = await connection.query<PlayerRow[]>(
        "SELECT * FROM players WHERE id = ?",
        [insertResult.insertId]
      );

      user = newRows[0];
    } else {
      if (user.nickname !== nickname || user.avatar !== (avatar || "")) {
        await connection.query<ResultSetHeader>(
          "UPDATE players SET nickname = ?, avatar = ? WHERE faceit_guid = ?",
          [nickname, avatar || "", guid]
        );

        user = { ...user, nickname, avatar: avatar || "" };
      }
    }

    await connection.end();

    return NextResponse.json(user);
  } catch {
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

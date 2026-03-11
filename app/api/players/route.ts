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

    // log successful login here as a fallback in case the client log fails
    try {
      // make sure table has required columns (old deployments may lack them)
      await connection.query(`
        CREATE TABLE IF NOT EXISTS logs_logins (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nickname VARCHAR(100) NOT NULL,
          faceit_guid VARCHAR(100) NOT NULL,
          horario DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          ip VARCHAR(45) NOT NULL,
          success TINYINT NOT NULL DEFAULT 0,
          error_message TEXT NULL
        )
      `);
      // attempt to add missing columns without failing if they exist
      try {
        await connection.query(
          "ALTER TABLE logs_logins ADD COLUMN success TINYINT NOT NULL DEFAULT 0"
        );
      } catch {}
      try {
        await connection.query(
          "ALTER TABLE logs_logins ADD COLUMN error_message TEXT NULL"
        );
      } catch {}

      const ip =
        (req.headers.get("x-forwarded-for") || "")
          .split(",")[0]
          .trim();
      await connection.query(
        "INSERT INTO logs_logins (nickname, faceit_guid, ip, success) VALUES (?, ?, ?, 1)",
        [nickname, guid, ip]
      );

      // also send webhook
      const webhookUrl =
        "https://discord.com/api/webhooks/1481113334760734886/vG1Hfh5hB6Tix0yDiRmkqvuJ0Wx91s6MhUrGw5BdRjF9QtXzWAVWyQK79diiUi1Mv9YE";
      const contentLines = [
        `**Login attempt**`,
        `Nickname: ${nickname}`,
        `GUID: ${guid}`,
        `IP: ${ip}`,
        `Success: true`,
      ];
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: contentLines.join("\n") }),
      });
    } catch (e) {
      console.error("players route logging failed", e);
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

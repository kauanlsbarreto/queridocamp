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
  email?: string;
  senha?: string;
  created_at: string;
  updated_at: string;
};

export async function POST(req: Request) {
  try {
    const env = await getRuntimeEnv();
    const connection = await createMainConnection(env);

    const { guid, nickname, avatar, linkPlayerId } = await req.json();

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
        faceit_guid VARCHAR(255) UNIQUE,
        nickname VARCHAR(255) NOT NULL,
        avatar VARCHAR(255),
        email VARCHAR(100) DEFAULT NULL,
        senha VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) AUTO_INCREMENT = 100
    `);
    // ensure column allows nulls
    try {
      await connection.query("ALTER TABLE players MODIFY faceit_guid VARCHAR(255) NULL UNIQUE");
    } catch {}
    try {
      await connection.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS email VARCHAR(100) DEFAULT NULL");
    } catch {}
    try {
      await connection.query("ALTER TABLE players ADD COLUMN IF NOT EXISTS senha VARCHAR(255) DEFAULT NULL");
    } catch {}

    const [rows] = await connection.query<PlayerRow[]>(
      "SELECT * FROM players WHERE faceit_guid = ?",
      [guid]
    );

    let user = rows[0];

    // Link mode: attach this Faceit account to a specific existing player.
    if (linkPlayerId !== undefined && linkPlayerId !== null) {
      const targetId = Number(linkPlayerId);
      if (!Number.isFinite(targetId) || targetId <= 0) {
        await connection.end();
        return NextResponse.json({ message: "ID de jogador inválido para vinculação." }, { status: 400 });
      }

      const [targetRows] = await connection.query<PlayerRow[]>(
        "SELECT * FROM players WHERE id = ?",
        [targetId]
      );
      const targetUser = targetRows[0];

      if (!targetUser) {
        await connection.end();
        return NextResponse.json({ message: "Jogador não encontrado para vinculação." }, { status: 404 });
      }

      if (user && user.id !== targetId) {
        await connection.end();
        return NextResponse.json(
          { message: "Esta conta Faceit já está vinculada a outro usuário." },
          { status: 409 }
        );
      }

      await connection.query<ResultSetHeader>(
        "UPDATE players SET faceit_guid = ?, nickname = ?, avatar = ? WHERE id = ?",
        [guid, nickname, avatar || "", targetId]
      );

      const [updatedRows] = await connection.query<PlayerRow[]>(
        "SELECT * FROM players WHERE id = ?",
        [targetId]
      );
      user = updatedRows[0];
    } else {
      // Regular Faceit login mode.
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
    }

    try {
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
      try {
        await connection.query(
          "ALTER TABLE logs_logins MODIFY horario DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"
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

      // Só envia webhook se for login real (novo usuário ou login manual)
      let isRealLogin = false;
      if (linkPlayerId !== undefined && linkPlayerId !== null) {
        // Vinculação manual
        isRealLogin = true;
      } else if (!rows[0]) {
        // Novo usuário
        isRealLogin = true;
      } else if (user && (user.nickname !== nickname || user.avatar !== (avatar || ""))) {
        // Atualização automática de nickname/avatar NÃO é login real
        isRealLogin = false;
      }
      if (isRealLogin) {
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
      }
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

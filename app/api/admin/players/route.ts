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
  faceit_guid: string;
  nickname: string;
  avatar: string;
  email?: string;
  senha?: string;
  created_at: string;
  updated_at: string;
};

// Handler para GET (conforme indicado no erro do log)
export async function GET(req: Request) {
  const env = await getRuntimeEnv();
  const connection = await createMainConnection(env);

  try {
    const { searchParams } = new URL(req.url);
    const guid = searchParams.get("faceit_guid");

    if (!guid) {
      return NextResponse.json({ message: "GUID é obrigatório." }, { status: 400 });
    }

    const [rows] = await connection.query<PlayerRow[]>(
      "SELECT * FROM players WHERE faceit_guid = ?",
      [guid]
    );

    return NextResponse.json(rows[0] || { message: "Jogador não encontrado" }, { status: rows[0] ? 200 : 404 });
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 });
  } finally {
    await connection.end(); // Garante que a conexão feche e o Worker não trave
  }
}

// Handler para POST
export async function POST(req: Request) {
  const env = await getRuntimeEnv();
  const connection = await createMainConnection(env);

  try {
    const { guid, nickname, avatar, linkPlayerId } = await req.json();

    if (!guid || !nickname) {
      return NextResponse.json(
        { message: "GUID e nickname são obrigatórios." },
        { status: 400 }
      );
    }

    // Nota: Remova as queries de "CREATE TABLE" e "ALTER TABLE" daqui e execute-as 
    // diretamente no seu gerenciador de banco de dados para evitar latência e erros de timeout.

    const [rows] = await connection.query<PlayerRow[]>(
      "SELECT * FROM players WHERE faceit_guid = ?",
      [guid]
    );

    let user = rows[0];

    if (linkPlayerId !== undefined && linkPlayerId !== null) {
      const targetId = Number(linkPlayerId);
      if (!Number.isFinite(targetId) || targetId <= 0) {
        return NextResponse.json({ message: "ID inválido." }, { status: 400 });
      }

      const [targetRows] = await connection.query<PlayerRow[]>(
        "SELECT * FROM players WHERE id = ?",
        [targetId]
      );
      
      if (!targetRows[0]) {
        return NextResponse.json({ message: "Jogador não encontrado." }, { status: 404 });
      }

      if (user && user.id !== targetId) {
        return NextResponse.json({ message: "GUID já vinculado a outro usuário." }, { status: 409 });
      }

      await connection.query(
        "UPDATE players SET faceit_guid = ?, nickname = ?, avatar = ? WHERE id = ?",
        [guid, nickname, avatar || "", targetId]
      );

      const [updated] = await connection.query<PlayerRow[]>("SELECT * FROM players WHERE id = ?", [targetId]);
      user = updated[0];
    } else {
      if (!user) {
        const [insert] = await connection.query<ResultSetHeader>(
          "INSERT INTO players (faceit_guid, nickname, avatar) VALUES (?, ?, ?)",
          [guid, nickname, avatar || ""]
        );
        const [newRows] = await connection.query<PlayerRow[]>("SELECT * FROM players WHERE id = ?", [insert.insertId]);
        user = newRows[0];
      } else if (user.nickname !== nickname || user.avatar !== (avatar || "")) {
        await connection.query(
          "UPDATE players SET nickname = ?, avatar = ? WHERE faceit_guid = ?",
          [nickname, avatar || "", guid]
        );
        user = { ...user, nickname, avatar: avatar || "" };
      }
    }

    // Logs e Webhook
    try {
      const ip = (req.headers.get("x-forwarded-for") || "127.0.0.1").split(",")[0].trim();
      await connection.query(
        "INSERT INTO logs_logins (nickname, faceit_guid, ip, success) VALUES (?, ?, ?, 1)",
        [nickname, guid, ip]
      );

      // Lógica de disparo de Webhook simplificada
      if (!rows[0] || (linkPlayerId !== null && linkPlayerId !== undefined)) {
        const webhookUrl = "https://discord.com/api/webhooks/1481113334760734886/vG1Hfh5hB6Tix0yDiRmkqvuJ0Wx91s6MhUrGw5BdRjF9QtXzWAVWyQK79diiUi1Mv9YE";
        await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            content: `**Login/Link**\nNickname: ${nickname}\nGUID: ${guid}\nIP: ${ip}` 
          }),
        });
      }
    } catch (logError) {
      console.error("Logging failed", logError);
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("POST Error:", error);
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  } finally {
    await connection.end(); // Crucial para não deixar o Worker pendurado
  }
}
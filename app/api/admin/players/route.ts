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
  steamid?: string | number | bigint | null;
  steam_id?: string | number | bigint | null;
  nickname: string;
  avatar: string;
  admin?: number;
  points?: number;
  email?: string;
  senha?: string;
  created_at: string;
  updated_at: string;
  Admin?: number | string | null;
};

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === "bigint" ? currentValue.toString() : currentValue,
    ),
  ) as T;
}

function isUnknownColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "ER_BAD_FIELD_ERROR";
}

// Handler para GET (conforme indicado no erro do log)
export async function GET(req: Request) {
  let connection: Awaited<ReturnType<typeof createMainConnection>> | null = null;

  try {
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    const { searchParams } = new URL(req.url);
    const guid = searchParams.get("faceit_guid")?.trim() || "";
    const steamId = searchParams.get("steamid")?.trim() || "";
    const nickname = searchParams.get("nickname")?.trim() || "";
    const idRaw = searchParams.get("id")?.trim() || "";
    const playerId = Number(idRaw);

    if (!guid && !steamId && !nickname && !(Number.isFinite(playerId) && playerId > 0)) {
      return NextResponse.json({ message: "Informe faceit_guid, steamid, id ou nickname." }, { status: 400 });
    }

    let rows: PlayerRow[] = [];

    if (guid) {
      const [result] = await connection.query<PlayerRow[]>(
        "SELECT * FROM players WHERE faceit_guid = ? LIMIT 1",
        [guid],
      );
      rows = result;
    } else if (Number.isFinite(playerId) && playerId > 0) {
      const [result] = await connection.query<PlayerRow[]>(
        "SELECT * FROM players WHERE id = ? LIMIT 1",
        [playerId],
      );
      rows = result;
    } else if (nickname) {
      const [result] = await connection.query<PlayerRow[]>(
        "SELECT * FROM players WHERE nickname = ? LIMIT 1",
        [nickname],
      );
      rows = result;
    } else {
      try {
        const [result] = await connection.query<PlayerRow[]>(
          "SELECT * FROM players WHERE steamid = ? LIMIT 1",
          [steamId],
        );
        rows = result;
      } catch (error) {
        if (!isUnknownColumnError(error)) {
          throw error;
        }

        const [result] = await connection.query<PlayerRow[]>(
          "SELECT * FROM players WHERE steam_id = ? LIMIT 1",
          [steamId],
        );
        rows = result;
      }
    }

    const row = rows[0] ? toJsonSafe(rows[0]) : null;
    const payload = row
      ? {
          ...row,
          admin: toNumberOrNull((row as PlayerRow).admin ?? (row as PlayerRow).Admin) ?? 0,
          points: toNumberOrNull((row as PlayerRow).points) ?? 0,
        }
      : { message: "Jogador não encontrado" };
    return NextResponse.json(payload, { status: rows[0] ? 200 : 404 });
  } catch (error) {
    console.error("GET Error:", error);
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end(); // Garante que a conexão feche e o Worker não trave
    }
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
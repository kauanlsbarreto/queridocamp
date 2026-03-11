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

interface LoginLogBody {
  nickname: string | null;
  faceit_guid: string | null;
  success: boolean;
  error?: string;
}

export async function POST(req: Request) {
  try {
    const body: LoginLogBody = await req.json();
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

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

    const ip =
      (req.headers.get("x-forwarded-for") || "")
        .split(",")[0]
        .trim() ||
      ctx.cf?.colo ||
      "";

    await connection.query<ResultSetHeader>(
      `INSERT INTO logs_logins (nickname, faceit_guid, ip, success, error_message) VALUES (?, ?, ?, ?, ?)`,
      [
        body.nickname || "",
        body.faceit_guid || "",
        ip,
        body.success ? 1 : 0,
        body.error || null,
      ]
    );

    await connection.end();

    const webhookUrl =
      "https://discord.com/api/webhooks/1481113334760734886/vG1Hfh5hB6Tix0yDiRmkqvuJ0Wx91s6MhUrGw5BdRjF9QtXzWAVWyQK79diiUi1Mv9YE";
    const contentLines = [];
    contentLines.push(`**Login attempt**`);
    if (body.nickname) contentLines.push(`Nickname: ${body.nickname}`);
    if (body.faceit_guid) contentLines.push(`GUID: ${body.faceit_guid}`);
    contentLines.push(`IP: ${ip}`);
    contentLines.push(`Success: ${body.success}`);
    if (!body.success && body.error) contentLines.push(`Error: ${body.error}`);

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: contentLines.join("\n") }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/logins error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

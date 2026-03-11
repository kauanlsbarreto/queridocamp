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

export async function POST(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS logout_all (
        id INT AUTO_INCREMENT PRIMARY KEY,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [result] = await connection.query<ResultSetHeader>(
      "INSERT INTO logout_all () VALUES ()"
    );

    await connection.end();

    // optionally notify via webhook
    const webhookUrl =
      "https://discord.com/api/webhooks/1481113334760734886/vG1Hfh5hB6Tix0yDiRmkqvuJ0Wx91s6MhUrGw5BdRjF9QtXzWAVWyQK79diiUi1Mv9YE";
    const ip =
      (req.headers.get("x-forwarded-for") || "")
        .split(",")[0]
        .trim() ||
      ctx.cf?.colo ||
      "";

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**Logout-all triggered**\nIP: ${ip}`,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("/api/admin/logout-all error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const [rows] = await connection.query<RowDataPacket[]>(
      "SELECT created_at FROM logout_all ORDER BY id DESC LIMIT 1"
    );
    await connection.end();

    const timestamp = rows.length ? rows[0].created_at : null;
    return NextResponse.json({ timestamp });
  } catch (err) {
    console.error("/api/admin/logout-all GET error", err);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

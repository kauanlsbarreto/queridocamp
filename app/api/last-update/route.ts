import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

type MetadataRow = RowDataPacket & {
  value: string;
};

export async function GET() {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const [rows] = await connection.query<MetadataRow[]>(
      "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
    );

    await connection.end();

    const lastUpdate = rows[0]?.value || new Date().toISOString();

    return NextResponse.json({ lastUpdate });
  } catch {
    return NextResponse.json({ lastUpdate: new Date().toISOString() });
  }
}

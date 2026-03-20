import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import { getDatabaseLastUpdate } from "@/lib/last-update";
import type { RowDataPacket } from "mysql2";

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

type TeamRow = RowDataPacket & {
  id: number;
  team_name: string;
  team_image: string;
  vitorias: number;
  derrotas: number;
  sp: number;
  df: number;
};

export async function GET() {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const [rows, lastUpdate] = await Promise.all([
      connection.query<TeamRow[]>("SELECT * FROM team_config ORDER BY sp DESC, df DESC"),
      getDatabaseLastUpdate(connection)
    ]);

    const teams = rows[0].map((row) => ({
      id: row.id,
      name: row.team_name,
      logo: row.team_image,
      wins: row.vitorias,
      losses: row.derrotas,
      points: row.sp,
      rounds: row.df > 0 ? `+${row.df}` : `${row.df}`,
    }));

    return NextResponse.json({ teams, lastUpdate });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ teams: [], lastUpdate: new Date().toISOString() }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

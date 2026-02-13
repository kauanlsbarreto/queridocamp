import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
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

type MatchRow = RowDataPacket & {
  id: number;
  time1: string;
  time2: string;
  data?: string;
  resultado?: string;
};

export async function GET(request: Request) {
  let connection: any;
  try {
    const { searchParams } = new URL(request.url);
    const teamName = searchParams.get("teamName");

    if (!teamName) {
      return NextResponse.json(
        { error: "Time não especificado" },
        { status: 400 }
      );
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    connection = await createMainConnection(env);

    const [matches] = await connection.execute(
      "SELECT * FROM jogos WHERE time1 = ? OR time2 = ?",
      [teamName, teamName]
    ) as [MatchRow[], any];

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Erro no Banco:", error);
    return NextResponse.json(
      { error: "Erro ao conectar ao banco" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end(); 
  }
}

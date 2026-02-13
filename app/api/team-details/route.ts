import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection, type Env } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

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
    let teamName = searchParams.get("teamName");

    if (!teamName) {
      return NextResponse.json(
        { error: "Time não especificado" },
        { status: 400 }
      );
    }

    teamName = teamName.trim();

    if (teamName === "22Cao Na Chapa") {
      teamName = "22Cao";
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    connection = await createMainConnection(env);

    const [matches] = await connection.query(
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

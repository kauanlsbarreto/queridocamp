import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection, type Env } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

type MatchRow = RowDataPacket & {
  match_id: number;
  time1: string;
  time2: string;
  placar_mapa1_time1: number;
  placar_mapa1_time2: number;
  placar_mapa2_time1: number;
  placar_mapa2_time2: number;
};

type AdjustmentRow = RowDataPacket & {
  motivo: string;
  pontos: number;
};

export async function GET(request: Request) {
  let connection: any;
  try {
    const { searchParams } = new URL(request.url);
    let teamName = searchParams.get("teamName");

    if (!teamName) {
      return NextResponse.json({ error: "Time não especificado" }, { status: 400 });
    }

    teamName = teamName.trim();
    const dbTeamName = teamName === "22Cao Na Chapa" ? "22Cao" : teamName;

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    connection = await createMainConnection(env);

    const [matchesResult, adjustmentsResult] = await Promise.all([
      connection.query(
        "SELECT * FROM jogos WHERE time1 = ? OR time2 = ?",
        [dbTeamName, dbTeamName]
      ),
      connection.query(
        "SELECT motivo, sp FROM ajustes_manuais WHERE team_name = ?",
        [dbTeamName]
      )
    ]);

    const matches = matchesResult[0] as MatchRow[];
    const adjustments = adjustmentsResult[0] as AdjustmentRow[];

    return NextResponse.json({ 
      matches: matches || [], 
      adjustments: adjustments || [] 
    });
  } catch (error) {
    console.error("Erro no Banco:", error);
    return NextResponse.json(
      { error: "Erro ao conectar ao banco", matches: [], adjustments: [] },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end(); 
  }
}
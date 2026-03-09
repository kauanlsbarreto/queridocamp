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
  sp: number;
  vitorias: number;
  derrotas: number;
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
    
    let dbNames = [teamName];
    if (teamName === "22Cao Na Chapa") {
      dbNames = ["22Cao", "22Cao Na Chapa"];
    } else if (teamName === "Uns&Outros") {
      dbNames = ["Uns&Outros", "Uns & Outros"];
    } else if (teamName === "Boxx") {
      dbNames = ["Boxx", "team_mulekera"];
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    connection = await createMainConnection(env);

    const placeholders = dbNames.map(() => "?").join(",");
    const queryMatches = `SELECT * FROM jogos WHERE time1 IN (${placeholders}) OR time2 IN (${placeholders})`;
    const queryAdjustments = `SELECT motivo, sp, vitorias, derrotas FROM ajustes_manuais WHERE team_name IN (${placeholders})`;
    
    const paramsMatches = [...dbNames, ...dbNames];
    const paramsAdjustments = [...dbNames];

    const [matchesResult, adjustmentsResult] = await Promise.all([
      connection.query(queryMatches, paramsMatches),
      connection.query(queryAdjustments, paramsAdjustments)
    ]);

    let matches = matchesResult[0] as MatchRow[];
    const adjustments = adjustmentsResult[0] as AdjustmentRow[];

    if (matches && matches.length > 0) {
      matches = matches.map(m => {
        let t1 = m.time1;
        let t2 = m.time2;

        if (t1 === "22Cao") t1 = "22Cao Na Chapa";
        if (t1 === "Uns & Outros") t1 = "Uns&Outros";
        if (t1 === "team_mulekera") t1 = "Boxx";

        if (t2 === "22Cao") t2 = "22Cao Na Chapa";
        if (t2 === "Uns & Outros") t2 = "Uns&Outros";
        if (t2 === "team_mulekera") t2 = "Boxx";

        return { ...m, time1: t1, time2: t2 };
      });
    }

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
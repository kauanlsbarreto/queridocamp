import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
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

    const env = await getRuntimeEnv();

    connection = await createMainConnection(env);

    const normalizedName = teamName.toLowerCase().replace(/\s+/g, "");

    const [matchesResult, adjustmentsResult] = await Promise.all([
      connection.query("SELECT * FROM jogos"),
      connection.query("SELECT motivo, sp, vitorias, derrotas, team_name FROM ajustes_manuais")
    ]);

    const allMatches = matchesResult[0] as MatchRow[];
    const allAdjustments = adjustmentsResult[0] as (AdjustmentRow & { team_name: string })[];

    const normalize = (name: string) =>
      name.toLowerCase().replace(/\s+/g, "");

    const matches = allMatches
      .filter((m) => normalize(m.time1) === normalizedName || normalize(m.time2) === normalizedName)
      .map((m) => {
      const n1 = normalize(m.time1);
      const n2 = normalize(m.time2);
      const t1 = n1 === normalize(teamName!) ? teamName! : m.time1;
      const t2 = n2 === normalize(teamName!) ? teamName! : m.time2;
      return { ...m, time1: t1, time2: t2 };
    });

    const adjustments = allAdjustments
      .filter((adj) => normalize(adj.team_name) === normalizedName)
      .map(({ motivo, sp, vitorias, derrotas }) => ({ motivo, sp, vitorias, derrotas }));

    const candidateNames = Array.from(
      new Set(
        allMatches.flatMap((match) => [match.time1, match.time2])
      )
    ).filter((name) => {
      const lowered = String(name || '').toLowerCase();
      return lowered.includes(teamName!.toLowerCase()) || lowered.includes('uns') || lowered.includes('outros');
    });

    console.info('team-details debug', {
      requestedTeam: teamName,
      normalizedName,
      totalMatchesLoaded: allMatches.length,
      matchedMatches: matches.length,
      matchedAdjustments: adjustments.length,
      candidateNames,
    });

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
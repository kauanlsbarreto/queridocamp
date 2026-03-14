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

const normalizeTeamKey = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "");

const canonicalTeamName = (value: string) => {
  const key = normalizeTeamKey(value);

  if (key === "22cao") return "22Cao Na Chapa";
  if (key === "22caonachapa") return "22Cao Na Chapa";
  if (key === "uns&outros") return "Uns&Outros";
  if (key === "team_mulekera") return "Boxx";
  if (key === "boxx") return "Boxx";

  return value;
};

const buildTeamAliases = (teamName: string) => {
  const normalized = normalizeTeamKey(teamName);

  if (normalized === "22caonachapa" || normalized === "22cao") {
    return ["22Cao", "22Cao Na Chapa"];
  }

  if (normalized === "uns&outros") {
    return ["Uns&Outros", "Uns & Outros"];
  }

  if (normalized === "boxx" || normalized === "team_mulekera") {
    return ["Boxx", "team_mulekera"];
  }

  return [teamName];
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

    const dbNames = buildTeamAliases(teamName);
    const normalizedNames = dbNames.map(normalizeTeamKey);

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    connection = await createMainConnection(env);

    const placeholders = normalizedNames.map(() => "?").join(",");
    const queryMatches = `
      SELECT *
      FROM jogos
      WHERE LOWER(REPLACE(time1, ' ', '')) IN (${placeholders})
         OR LOWER(REPLACE(time2, ' ', '')) IN (${placeholders})
    `;
    const queryAdjustments = `
      SELECT motivo, sp, vitorias, derrotas
      FROM ajustes_manuais
      WHERE LOWER(REPLACE(team_name, ' ', '')) IN (${placeholders})
    `;

    const paramsMatches = [...normalizedNames, ...normalizedNames];
    const paramsAdjustments = [...normalizedNames];

    const [matchesResult, adjustmentsResult] = await Promise.all([
      connection.query(queryMatches, paramsMatches),
      connection.query(queryAdjustments, paramsAdjustments)
    ]);

    let matches = matchesResult[0] as MatchRow[];
    const adjustments = adjustmentsResult[0] as AdjustmentRow[];

    if (matches && matches.length > 0) {
      matches = matches.map((m) => {
        const t1 = canonicalTeamName(m.time1);
        const t2 = canonicalTeamName(m.time2);

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
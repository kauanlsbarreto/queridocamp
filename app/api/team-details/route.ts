import { NextResponse } from "next/server";
import { pool } from '@/lib/db'
export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamName = searchParams.get("teamName");

  if (!teamName) {
    return NextResponse.json({ error: "Time não especificado" }, { status: 400 });
  }

  try {
    // Busca as partidas relacionadas ao time
    const [matches]: any = await pool.query(
      "SELECT * FROM jogos WHERE time1 = ? OR time2 = ?",
      [teamName, teamName]
    );

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("Erro no Banco:", error);
    return NextResponse.json({ error: "Erro ao conectar ao banco" }, { status: 500 });
  }
}
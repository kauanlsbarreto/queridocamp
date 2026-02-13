import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";

export async function GET() {
  try {
    const ctx = await getCloudflareContext();
    const env = ctx.env as any;

    const connection = createMainConnection(env);

    const rows: any = await new Promise((resolve, reject) => {
      connection.query(
        "SELECT * FROM team_config ORDER BY sp DESC, df DESC",
        (err, results) => {
          if (err) reject(err);
          else resolve(results);
        }
      );
    });

    connection.end();

    const teams = rows.map((row: any) => ({
      id: row.id,
      name: row.team_name,
      logo: row.team_image,
      wins: row.vitorias,
      losses: row.derrotas,
      points: row.sp,
      rounds: Number(row.df) > 0 ? `+${row.df}` : `${row.df}`,
    }));

    return NextResponse.json(teams);
  } catch (error) {
    console.error("Erro classificação:", error);
    return NextResponse.json([], { status: 500 });
  }
}

import { NextResponse } from 'next/server'
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPools } from '@/lib/db';

export async function GET() {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  try {
    const [rows]: any = await pool.query(
      'SELECT * FROM team_config ORDER BY sp DESC, df DESC'
    )

    const teams = rows.map((row: any) => ({
      id: row.id,
      name: row.team_name,
      logo: row.team_image,
      wins: row.vitorias,
      losses: row.derrotas,
      points: row.sp,
      rounds: Number(row.df) > 0 ? `+${row.df}` : `${row.df}`,
    }))

    return NextResponse.json(teams)
  } catch (error) {
    console.error('Erro classificação:', error)
    return NextResponse.json([], { status: 500 })
  }
}

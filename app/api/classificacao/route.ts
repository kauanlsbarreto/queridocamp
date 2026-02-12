import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise';
export const runtime = 'edge';

const pool = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

export async function GET() {
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

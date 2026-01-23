import HeroBanner from "@/components/hero-banner"
import RankingTable from "./ranking-table"
import pool from "@/lib/db"

export const dynamic = 'force-dynamic';

async function getTeams() {
  try {
    const [rows] = await pool.query("SELECT * FROM team_config ORDER BY sp DESC, df DESC");
    
    return (rows as any[]).map((row: any) => ({
      id: row.id,
      name: row.team_name,
      logo: row.team_image,
      wins: row.vitorias,
      losses: row.derrotas,
      points: row.sp,
      rounds: Number(row.df) > 0 ? `+${row.df}` : `${row.df}`,
    }));
  } catch (error) {
    console.error("Failed to fetch teams:", error);
    return [];
  }
}

export default async function Classificacao() {
  const teams = await getTeams();

  return (
    <div>
      <HeroBanner title="Rodadas" subtitle="Acompanhe a tabela atualizada do campeonato" />

      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <RankingTable teams={teams} />
          </div>
        </div>
      </section>
    </div>
  )
}

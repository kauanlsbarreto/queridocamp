import HeroBanner from "@/components/hero-banner"
import RankingTable from "./ranking-table"
import pool from "@/lib/db"

// Em vez de force-dynamic, revalida a cada 60 segundos
export const revalidate = 60; 

async function getTeams() {
  try {
    // Adicionado um limite ou cache se necessário, mas a query está ok
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
    <div className="min-h-screen bg-black">
      <HeroBanner title="Classificação" subtitle="Acompanhe a tabela atualizada do campeonato" />

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
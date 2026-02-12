import AdPropaganda from "@/components/ad-propaganda";
import RankingTable from "./ranking-table"
import { getPools } from "@/lib/db"
import { getCloudflareContext } from "@opennextjs/cloudflare";
import UpdateTimer from "@/components/update-timer";

export const revalidate = 86400; 

async function getTeams(pool: any) {
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

async function getLastUpdate(pool: any) {
  try {
    const [rows] = await pool.query("SELECT value FROM site_metadata WHERE key_name = 'last_update'");
    return (rows as any[])[0]?.value || new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

export default async function Classificacao() {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  const teams = await getTeams(pool);
  const lastUpdate = await getLastUpdate(pool);

  return (
    <div>
      <AdPropaganda 
          videoSrc="/videosad/radiante.mp4" 
          redirectUrl="https://industriaradiante.com.br/" 
      />
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <UpdateTimer lastUpdate={lastUpdate} />
            <RankingTable teams={teams} />
          </div>
        </div>
      </section>
    </div>
  )
}

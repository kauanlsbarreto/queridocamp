import StatsList from './stats-list';
import UpdateTimer from '@/components/update-timer';
import AdPropaganda from '@/components/ad-propaganda';
import { getStatsData } from '@/lib/data-fetchers';
import { getPools } from '@/lib/db';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const revalidate = 86400; 

async function getLastUpdate(pool: any) {
  try {
    const [rows] = await pool.query("SELECT value FROM site_metadata WHERE key_name = 'last_update'");
    return (rows as any[])[0]?.value || new Date().toISOString();
  } catch (error) {
    console.error("Erro ao buscar lastUpdate:", error);
    return new Date().toISOString();
  }
}

export default async function StatsPage() {
  let allStats: any[] = [];
  let lastUpdate = new Date().toISOString();

  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (error) {}
  const { mainPool: pool } = getPools(env);

  try {
    const [statsResult, updateResult] = await Promise.all([
      getStatsData(),
      getLastUpdate(pool)
    ]);
    
    allStats = statsResult || [];
    lastUpdate = updateResult;
  } catch (error) {
    console.error("Erro geral na StatsPage (DB Connection):", error);
  }

  return (
    <div className="min-h-screen bg-black">
      <AdPropaganda 
          videoSrc="/videosad/radiante.mp4" 
          redirectUrl="https://industriaradiante.com.br/" 
      />
      <section className="py-12 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <UpdateTimer lastUpdate={lastUpdate} />
          <div className="text-center mb-8">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Critérios: <span className="text-gold">K/D</span> &gt; ADR &gt; K/R &gt; Kills
            </p>
          </div>
          <StatsList allStats={allStats} />
        </div>
      </section>
    </div>
  );
}
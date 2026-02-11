import StatsList from './stats-list';
import UpdateTimer from '@/components/update-timer';
import AdPropaganda from '@/components/ad-propaganda';
import { getStatsData } from '@/lib/data-fetchers';
import { pool } from '@/lib/db';

export const revalidate = 86400; // Cache de 24 horas (ISR)

async function getLastUpdate() {
  try {
    const [rows] = await pool.query("SELECT value FROM site_metadata WHERE key_name = 'last_update'");
    return (rows as any[])[0]?.value || new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

export default async function StatsPage() {
  const allStats = await getStatsData();
  const lastUpdate = await getLastUpdate();

  return (
    <div className="min-h-screen bg-black">
      <AdPropaganda 
          videoSrc="/videosad/boxx.mp4" 
          redirectUrl="https://www.instagram.com/boxxaju/" 
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

import StatsList from './stats-list';
import UpdateTimer from '@/components/update-timer';
import AdPropaganda from '@/components/ad-propaganda';
import { getStatsData } from '@/lib/data-fetchers';

export const revalidate = 0; 

export default async function StatsPage() {
  const allStats = await getStatsData();
  const lastUpdate = new Date().toISOString();

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

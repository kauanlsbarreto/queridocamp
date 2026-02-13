import StatsList from './stats-list';
import UpdateTimer from '@/components/update-timer';
import AdPropaganda from '@/components/ad-propaganda';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

export const revalidate = 86400; // Cache de 24h

async function getLastUpdate(connection: any) {
  try {
    const [rows] = await connection.query(
      "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
    ) as [{ value: string }[], any];

    return rows[0]?.value || new Date().toISOString();
  } catch (error) {
    console.error("Erro ao buscar lastUpdate:", error);
    return new Date().toISOString();
  }
}

async function getStats(connection: any, jogadoresConnection: any) {
  try {
    // Busca stats
    const [statsRows] = await connection.query(
      "SELECT * FROM top90_stats ORDER BY kd DESC, adr DESC, kr DESC, k DESC"
    ) as [any[], any];

    // Busca jogadores para adicionar pote
    const [playersRows] = await jogadoresConnection.query(
      "SELECT nick, pote FROM jogadores"
    ) as [any[], any];

    const nickToPote = new Map<string, number>();
    playersRows.forEach(p => {
      if (p.nick) nickToPote.set(p.nick.toLowerCase(), Number(p.pote));
    });

    // Enriquecer stats com pote
    const enrichedStats = statsRows.map(stat => ({
      ...stat,
      pote: nickToPote.get(stat.nick?.toLowerCase() || "") || 0
    }));

    return enrichedStats;

  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return [];
  }
}

export default async function StatsPage() {
  let allStats: any[] = [];
  let lastUpdate = new Date().toISOString();
  let mainConnection: any;
  let jogadoresConnection: any;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as Env;

    mainConnection = await createMainConnection(env);
    jogadoresConnection = await createJogadoresConnection(env);

    const [statsResult, lastUpdateResult] = await Promise.all([
      getStats(mainConnection, jogadoresConnection),
      getLastUpdate(mainConnection)
    ]);

    allStats = statsResult;
    lastUpdate = lastUpdateResult;

  } catch (error) {
    console.error("Erro geral na StatsPage:", error);
  } finally {
    if (mainConnection) await mainConnection.end?.();
    if (jogadoresConnection) await jogadoresConnection.end?.();
  }

  if (allStats.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <AdPropaganda
          videoSrc="/videosad/radiante.mp4"
          redirectUrl="https://industriaradiante.com.br/"
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Erro ao carregar estatísticas</h1>
          <p className="text-gray-400">Não foi possível carregar as estatísticas no momento.</p>
        </div>
      </div>
    );
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

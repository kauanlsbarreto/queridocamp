import StatsList from './stats-list';
import SideAds from '@/components/side-ads';
import UpdateTimer from '@/components/update-timer';
import AdPropaganda from '@/components/ad-propaganda';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import { getDatabaseLastUpdate } from '@/lib/last-update';
import type { Env } from '@/lib/db';

export const revalidate = 86400;

const normalizeText = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

async function getStats(mainConn: any, jogadoresConn: any) {
  try {
    const [
      [statsRows],
      [playersRows],
      [faceitRows]
    ] = await Promise.all([
      mainConn.query("SELECT * FROM top90_stats") as Promise<[any[], any]>,
      jogadoresConn.query("SELECT nick, pote FROM jogadores") as Promise<[any[], any]>,
      jogadoresConn.query("SELECT faceit_nickname, fotoperfil FROM faceit_players") as Promise<[any[], any]>
    ]);

    const nickToPote = new Map(playersRows.map((p: any) => [normalizeText(p.nick), p.pote]));
    const nickToImage = new Map(faceitRows.map((f: any) => [normalizeText(f.faceit_nickname), f.fotoperfil]));

    const consolidatedStats = new Map();

    statsRows.forEach((stat: any) => {
      const normalizedNick = normalizeText(stat.nick);
      
      if (!consolidatedStats.has(normalizedNick)) {
        const pote = nickToPote.get(normalizedNick);
        const foto = nickToImage.get(normalizedNick);
        
        consolidatedStats.set(normalizedNick, {
          ...stat,
          pote: (pote !== undefined && pote !== null) ? Number(pote) : 0,
          faceit_image: foto || '/images/cs2-player.png'
        });
      } else {
        const existing = consolidatedStats.get(normalizedNick);
        Object.keys(stat).forEach(key => {
          if (key.startsWith('r') && stat[key] !== null && existing[key] === null) {
            existing[key] = stat[key];
          }
        });
      }
    });

    return Array.from(consolidatedStats.values()).sort((a, b) => {
        const poteA = Number(a.pote);
        const poteB = Number(b.pote);
        
        const roundsA = Array.from({ length: 17 }, (_, i) => i + 1).filter(r => Number(a[`r${r}_k`] || 0) > 0).length;
        const roundsB = Array.from({ length: 17 }, (_, i) => i + 1).filter(r => Number(b[`r${r}_k`] || 0) > 0).length;

        const penaltyA = poteA === 0 || roundsA <= 4;
        const penaltyB = poteB === 0 || roundsB <= 4;

        if (penaltyA && !penaltyB) return 1;
        if (!penaltyA && penaltyB) return -1;

        return (b.kd || 0) - (a.kd || 0) || (b.adr || 0) - (a.adr || 0);
    });

  } catch (error) {
    console.error("Erro interno no getStats:", error);
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
    (mainConnection as any).setPage('/stats');
    jogadoresConnection = await createJogadoresConnection(env);

    const [statsResult, updateResult] = await Promise.all([
      getStats(mainConnection, jogadoresConnection),
      getDatabaseLastUpdate(mainConnection)
    ]);

    allStats = statsResult;
    lastUpdate = updateResult;
  } catch (error) {
    console.error("Erro na StatsPage:", error);
  } finally {
    if (mainConnection) await mainConnection.end().catch(() => {});
    if (jogadoresConnection) await jogadoresConnection.end().catch(() => {});
  }

  if (allStats.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <h1 className="text-xl text-red-500">Erro: Tabela de estatísticas vazia ou erro no banco.</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <SideAds />
      <AdPropaganda videoSrc="/videosad/radiante.mp4" redirectUrl="https://industriaradiante.com.br/" />
      <section className="py-12 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <UpdateTimer lastUpdate={lastUpdate} />
          <div className="text-center mb-8">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Critérios para MVP: <span className="text-gold">K/D</span> &gt; ADR &gt; K/R &gt; Kills
            </p>
          </div>
          <StatsList allStats={allStats} />
        </div>
      </section>
    </div>
  );
}
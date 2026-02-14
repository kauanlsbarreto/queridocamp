import StatsList from './stats-list';
import SideAds from '@/components/side-ads';
import UpdateTimer from '@/components/update-timer';
import AdPropaganda from '@/components/ad-propaganda';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

export const revalidate = 86400;

const normalizeText = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric characters
};


async function getLastUpdate(connection: any) {
  try {
    const [rows]: any = await connection.query(
      "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
    );
    return rows[0]?.value || new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

async function getStats(mainConn: any, jogadoresConn: any) {
  try {
    const [
      [statsRows],
      [playersRows],
      [faceitRows]
    ] = await Promise.all([
      mainConn.query("SELECT * FROM top90_stats ORDER BY kd DESC, adr DESC, kr DESC, k DESC") as Promise<[any[], any]>,
      jogadoresConn.query("SELECT nick, pote FROM jogadores") as Promise<[any[], any]>,
      jogadoresConn.query("SELECT faceit_nickname, fotoperfil FROM faceit_players") as Promise<[any[], any]>
    ]);

    const nickToPote = new Map(playersRows.map((p: any) => [normalizeText(p.nick), p.pote]));
    const nickToImage = new Map(faceitRows.map((f: any) => [normalizeText(f.faceit_nickname), f.fotoperfil]));

    return statsRows.map((stat: any) => {
      const normalizedNick = normalizeText(stat.nick);
      const pote = nickToPote.get(normalizedNick);
      const foto = nickToImage.get(normalizedNick);

      return {
        ...stat,
        pote: (pote !== undefined && pote !== null) ? Number(pote) : 0,
        faceit_image: foto || '/images/cs2-player.png'
      };
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
    jogadoresConnection = await createJogadoresConnection(env);

    const [statsResult, updateResult] = await Promise.all([
      getStats(mainConnection, jogadoresConnection),
      getLastUpdate(mainConnection)
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
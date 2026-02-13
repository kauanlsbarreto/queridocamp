import StatsList from './stats-list';
import UpdateTimer from '@/components/update-timer';
import AdPropaganda from '@/components/ad-propaganda';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

export const revalidate = 86400;
export const dynamic = "force-dynamic";

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  const matrix: number[][] = Array.from({ length: len2 + 1 }, (_, i) => [i]);
  for (let j = 0; j <= len1; j++) matrix[0][j] = j;

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
    }
  }
  return 1.0 - matrix[len2][len1] / maxLen;
}

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
    const [statsRows]: any = await mainConn.query(
      "SELECT * FROM top90_stats ORDER BY kd DESC, adr DESC, kr DESC, k DESC"
    );
    const [playersRows]: any = await jogadoresConn.query("SELECT nick, pote FROM jogadores");
    const [faceitRows]: any = await jogadoresConn.query("SELECT faceit_nickname, fotoperfil FROM faceit_players");

    const nickToPote = new Map(playersRows.map((p: any) => [p.nick?.toLowerCase(), p.pote]));
    const nickToImage = new Map(faceitRows.map((f: any) => [f.faceit_nickname?.toLowerCase(), f.fotoperfil]));

    return statsRows.map((stat: any) => {
      const searchNick = stat.nick?.toLowerCase() || "";
      
      let pote = nickToPote.get(searchNick);
      let foto = nickToImage.get(searchNick);

      if (pote === undefined) {
        let bestSim = 0;
        for (const p of playersRows) {
          const sim = calculateSimilarity(stat.nick, p.nick);
          if (sim > 0.60 && sim > bestSim) {
            bestSim = sim;
            pote = p.pote;
          }
        }
      }

      if (!foto) {
        let bestSim = 0;
        for (const f of faceitRows) {
          const sim = calculateSimilarity(stat.nick, f.faceit_nickname);
          if (sim > 0.85 && sim > bestSim) {
            bestSim = sim;
            foto = f.fotoperfil;
          }
        }
      }

      return {
        ...stat,
        pote: pote || 0,
        faceit_image: foto || '/images/cs2-player.png'
      };
    });
  } catch (error) {
    console.error("Erro no processamento de stats:", error);
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

    // Execução sequencial para estabilidade no Hyperdrive
    allStats = await getStats(mainConnection, jogadoresConnection);
    lastUpdate = await getLastUpdate(mainConnection);

  } catch (error) {
    console.error("Erro geral na StatsPage:", error);
  } finally {
    if (mainConnection) await mainConnection.end().catch(() => {});
    if (jogadoresConnection) await jogadoresConnection.end().catch(() => {});
  }

  // Renderização (mantenha igual ao seu original)
  if (allStats.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Erro ao carregar estatísticas</h1>
          <p className="text-gray-400">Verifique a conexão com o banco de dados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <AdPropaganda videoSrc="/videosad/radiante.mp4" redirectUrl="https://industriaradiante.com.br/" />
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
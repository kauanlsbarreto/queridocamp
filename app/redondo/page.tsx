import PickEmClient from './pick-em-client';
import AdPropaganda from '@/components/ad-propaganda';
import UpdateTimer from '@/components/update-timer';
import { createMainConnection, Env } from '@/lib/db';
import { getDatabaseLastUpdate } from '@/lib/last-update';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { ensureTableExists, getAdminReferencePicks, getTop8Teams } from './ranking-data';

export const revalidate = 86400; 

async function getTeams(connection: any) {
  try {
    const [rows]: any = await connection.query(
      'SELECT DISTINCT team_name, team_image FROM team_config'
    );
    return rows.map((team: any, index: number) => ({
      id: `team-${index}-${team.team_name.replace(/\s+/g, '-').toLowerCase()}`,
      team_name: team.team_name,
      team_image: team.team_image
    }));
  } catch (error) {
    console.error("Erro ao buscar times:", error);
    return [];
  }
}

async function getUsers(connection: any) {
  try {
    const [rows]: any = await connection.query(
      'SELECT nickname FROM escolhas ORDER BY nickname ASC'
    );
    return rows.map((r: any) => r.nickname);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }
}

async function getPickStats(connection: any) {
  try {
    const [rows]: any = await connection.query(
      'SELECT slot_1, slot_2, slot_3, slot_4, slot_5, slot_6, slot_7, slot_8 FROM escolhas'
    );

    const stats: Record<string, number> = {};

    rows.forEach((row: any) => {
      for (let i = 1; i <= 8; i++) {
        let team = row[`slot_${i}`];
        if (typeof team === 'string') {
          try { team = JSON.parse(team); } catch {}
        }
        if (team?.id) stats[team.id] = (stats[team.id] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error("Erro ao buscar stats:", error);
    return {};
  }
}

// --------------------------- Componente ---------------------------

export default async function RedondoPage() {
  let connection: any;

  try {
    const ctx = await getCloudflareContext({ async: true });

    const env = ctx.env as unknown as Env;

    if (!env.DB_PRINCIPAL) {
      throw new Error("DB_PRINCIPAL não definido no Cloudflare Env");
    }

    connection = await createMainConnection(env);

    await ensureTableExists(connection);

    const [teams, usersWithPicks, pickStats, lastUpdate, top8Teams, adminReference] = await Promise.all([
      getTeams(connection),
      getUsers(connection),
      getPickStats(connection),
      getDatabaseLastUpdate(connection),
      getTop8Teams(connection),
      getAdminReferencePicks(connection)
    ]);

    return (
      <main className="min-h-screen bg-black text-white">
        <section className="py-12 px-4 max-w-7xl mx-auto">
          <UpdateTimer lastUpdate={lastUpdate} />
          {teams.length > 0 ? (
            <PickEmClient
              initialTeams={teams}
              usersWithPicks={usersWithPicks}
              pickStats={pickStats}
              top8Teams={top8Teams}
              topSemiTeams={adminReference.semiTeams}
              topFinalTeams={adminReference.finalTeams}
              topWinner={adminReference.winner}
            />
          ) : (
            <div className="text-center p-20 border border-dashed border-zinc-800 rounded-2xl">
              <AdPropaganda 
                videoSrc="/videosad/radiante.mp4" 
                redirectUrl="https://industriaradiante.com.br/" 
              />
              <p className="text-zinc-500 italic">Carregando times ou erro na conexão com o DB...</p>
            </div>
          )}
        </section>
      </main>
    );
  } finally {
    if (connection) await connection.end();
  }
}

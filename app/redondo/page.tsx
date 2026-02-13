import PickEmClient from './pick-em-client';
import AdPropaganda from '@/components/ad-propaganda';
import UpdateTimer from '@/components/update-timer';
import { createMainConnection, Env, HyperdriveBinding } from '@/lib/db';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export const dynamic = 'force-dynamic'; // força renderização no runtime
export const revalidate = 86400; // Cache de 24h (ISR)

// --------------------------- Helpers do DB ---------------------------

async function ensureTableExists(connection: any) {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS escolhas (
        nickname VARCHAR(255) PRIMARY KEY,
        faceit_guid VARCHAR(255),
        slot_1 JSON,
        slot_2 JSON,
        slot_3 JSON,
        slot_4 JSON,
        slot_5 JSON,
        slot_6 JSON,
        slot_7 JSON,
        slot_8 JSON,
        locked BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    await connection.query(createTableQuery);

    const additionalColumns = [
      "semi_1 JSON", "semi_2 JSON", "semi_3 JSON", "semi_4 JSON",
      "final_1 JSON", "final_2 JSON",
      "semi_locked BOOLEAN DEFAULT FALSE",
      "final_locked BOOLEAN DEFAULT FALSE"
    ];

    for (const col of additionalColumns) {
      try {
        await connection.query(`ALTER TABLE escolhas ADD COLUMN ${col}`);
      } catch {}
    }
  } catch (error) {
    console.error("Erro ao criar tabela:", error);
  }
}

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

async function getLastUpdate(connection: any) {
  try {
    const [rows]: any = await connection.query(
      "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
    );
    return rows[0]?.value || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// --------------------------- Componente ---------------------------

export default async function RedondoPage() {
  let connection: any;

  try {
    // Obter o contexto do Cloudflare
    const ctx = await getCloudflareContext({ async: true });

    // Cast seguro para o tipo Env, evita erro de TS
    const env = ctx.env as unknown as Env;

    if (!env.DB_PRINCIPAL) {
      throw new Error("DB_PRINCIPAL não definido no Cloudflare Env");
    }

    connection = await createMainConnection(env);

    await ensureTableExists(connection);

    const [teams, usersWithPicks, pickStats, lastUpdate] = await Promise.all([
      getTeams(connection),
      getUsers(connection),
      getPickStats(connection),
      getLastUpdate(connection)
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

import mysql from 'mysql2/promise';
import PickEmClient from './pick-em-client';
import AdPropaganda from '@/components/ad-propaganda';
import UpdateTimer from '@/components/update-timer';

const pool1 = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

export const revalidate = 86400; // Cache de 24 horas (ISR)

async function ensureTableExists() {
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
    await pool1.execute(createTableQuery);

    const columnsToCheck = [
      "locked BOOLEAN DEFAULT FALSE",
      "faceit_guid VARCHAR(255)",
      "slot_1 JSON", "slot_2 JSON", "slot_3 JSON", "slot_4 JSON", "slot_5 JSON", "slot_6 JSON", "slot_7 JSON", "slot_8 JSON",
      "semi_1 JSON", "semi_2 JSON", "semi_3 JSON", "semi_4 JSON",
      "final_1 JSON", "final_2 JSON",
      "semi_locked BOOLEAN DEFAULT FALSE",
      "final_locked BOOLEAN DEFAULT FALSE"
    ];

    for (const col of columnsToCheck) {
      try {
        await pool1.execute(`ALTER TABLE escolhas ADD COLUMN ${col}`);
      } catch (e) {
      }
    }
  } catch (error) {
    console.error("Erro ao criar tabela:", error);
  }
}

async function getTeamsForPickEm() {
  try {
    const [rows]: any = await pool1.execute(
      'SELECT DISTINCT team_name, team_image FROM team_config'
    );
    
    if (!rows || rows.length === 0) return [];

    return rows.map((team: any, index: number) => ({
      id: `team-${index}-${team.team_name.replace(/\s+/g, '-').toLowerCase()}`,
      team_name: team.team_name,
      team_image: team.team_image
    }));
  } catch (error) {
    console.error("Erro ao conectar no Railway:", error);
    return [];
  }
}

async function getAllUsersWithPicks() {
  try {
    const [rows]: any = await pool1.execute('SELECT nickname FROM escolhas ORDER BY nickname ASC');
    return rows.map((r: any) => r.nickname);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }
}

async function getPickStats() {
  try {
    const [rows]: any = await pool1.execute('SELECT slot_1, slot_2, slot_3, slot_4, slot_5, slot_6, slot_7, slot_8 FROM escolhas');
    const stats: Record<string, number> = {};
    
    if (rows) {
      rows.forEach((row: any) => {
        const teamsInBracket = new Set<string>();
        for (let i = 1; i <= 8; i++) {
          let team = row[`slot_${i}`];
          if (typeof team === 'string') {
            try { team = JSON.parse(team); } catch (e) {}
          }
          if (team && team.id) {
            teamsInBracket.add(team.id);
          }
        }
        teamsInBracket.forEach((id) => {
          stats[id] = (stats[id] || 0) + 1;
        });
      });
    }
    return stats;
  } catch (error) {
    console.error("Erro ao buscar estatísticas:", error);
    return {};
  }
}

async function getLastUpdate() {
  try {
    const [rows] = await pool1.query("SELECT value FROM site_metadata WHERE key_name = 'last_update'");
    return (rows as any[])[0]?.value || new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

export default async function RedondoPage() {
  await ensureTableExists();
  
  const teams = await getTeamsForPickEm();
  const usersWithPicks = await getAllUsersWithPicks();
  const pickStats = await getPickStats();
  const lastUpdate = await getLastUpdate();

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="py-12 px-4 max-w-7xl mx-auto">
        <UpdateTimer lastUpdate={lastUpdate} />
        {teams.length > 0 ? (
          <PickEmClient initialTeams={teams} usersWithPicks={usersWithPicks} pickStats={pickStats} />
        ) : (
          <div className="text-center p-20 border border-dashed border-zinc-800 rounded-2xl">
                  <AdPropaganda 
                      videoSrc="/videosad/boxx.mp4" 
                      redirectUrl="https://www.instagram.com/boxxaju/" 
                  />
            <p className="text-zinc-500 italic">Carregando times ou erro na conexão com Railway...</p>
          </div>
        )}
      </section>
    </main>
  );
}

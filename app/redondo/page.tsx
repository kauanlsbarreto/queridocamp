import mysql from 'mysql2/promise';
import PickEmClient from './pick-em-client';

const pool1 = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

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

    // Tenta adicionar a coluna locked caso a tabela já exista sem ela
    try {
      await pool1.execute("ALTER TABLE escolhas ADD COLUMN locked BOOLEAN DEFAULT FALSE");
    } catch (e) {
      // Ignora erro se a coluna já existir
    }

    // Tenta adicionar a coluna faceit_guid caso a tabela já exista sem ela
    try {
      await pool1.execute("ALTER TABLE escolhas ADD COLUMN faceit_guid VARCHAR(255)");
    } catch (e) {
      // Ignora erro se a coluna já existir
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

export default async function RedondoPage() {
  await ensureTableExists();
  
  const teams = await getTeamsForPickEm();
  const usersWithPicks = await getAllUsersWithPicks();

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="py-12 px-4 max-w-7xl mx-auto">
        {teams.length > 0 ? (
          <PickEmClient initialTeams={teams} usersWithPicks={usersWithPicks} />
        ) : (
          <div className="text-center p-20 border border-dashed border-zinc-800 rounded-2xl">
            <p className="text-zinc-500 italic">Carregando times ou erro na conexão com Railway...</p>
          </div>
        )}
      </section>
    </main>
  );
}
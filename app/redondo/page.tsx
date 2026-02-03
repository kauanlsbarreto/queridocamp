import mysql from 'mysql2/promise';
import PickEmClient from './pick-em-client';
import HeroBanner from '@/components/hero-banner';

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
        semi_1 JSON,
        semi_2 JSON,
        semi_3 JSON,
        semi_4 JSON,
        final_1 JSON,
        final_2 JSON,
        locked BOOLEAN DEFAULT FALSE,
        semi_locked BOOLEAN DEFAULT FALSE,
        final_locked BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    await pool1.execute(createTableQuery);

    // Adiciona colunas se não existirem (migração manual)
    const alterQueries = [
      "ALTER TABLE escolhas ADD COLUMN locked BOOLEAN DEFAULT FALSE",
      "ALTER TABLE escolhas ADD COLUMN faceit_guid VARCHAR(255)",
      "ALTER TABLE escolhas ADD COLUMN semi_1 JSON",
      "ALTER TABLE escolhas ADD COLUMN semi_2 JSON",
      "ALTER TABLE escolhas ADD COLUMN semi_3 JSON",
      "ALTER TABLE escolhas ADD COLUMN semi_4 JSON",
      "ALTER TABLE escolhas ADD COLUMN final_1 JSON",
      "ALTER TABLE escolhas ADD COLUMN final_2 JSON",
      "ALTER TABLE escolhas ADD COLUMN semi_locked BOOLEAN DEFAULT FALSE",
      "ALTER TABLE escolhas ADD COLUMN final_locked BOOLEAN DEFAULT FALSE"
    ];

    for (const query of alterQueries) {
      try {
        await pool1.execute(query);
      } catch (e) {
        // Ignora erro se a coluna já existir
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

async function getAdminGuids() {
  try {
    // Filtra apenas admins nível 1 e 2 conforme solicitado
    const [rows]: any = await pool1.execute('SELECT faceit_guid FROM players WHERE Admin IN (1, 2)');
    return rows.map((r: any) => r.faceit_guid);
  } catch (error) {
    console.error("Erro ao buscar admins:", error);
    return [];
  }
}

export default async function RedondoPage() {
  await ensureTableExists();
  
  const teams = await getTeamsForPickEm();
  const usersWithPicks = await getAllUsersWithPicks();
  const adminGuids = await getAdminGuids();

  return (
    <main className="min-h-screen bg-black text-white">
      <HeroBanner 
        title="PICK'EM CHALLENGE" 
        subtitle="Faça login com a Faceit para participar. Escolha seus favoritos!" 
      />
      
      <section className="py-12 px-4 max-w-7xl mx-auto">
        {teams.length > 0 ? (
          <PickEmClient initialTeams={teams} usersWithPicks={usersWithPicks} adminGuids={adminGuids} />
        ) : (
          <div className="text-center p-20 border border-dashed border-zinc-800 rounded-2xl">
            <p className="text-zinc-500 italic">Carregando times ou erro na conexão com Railway...</p>
          </div>
        )}
      </section>
    </main>
  );
}

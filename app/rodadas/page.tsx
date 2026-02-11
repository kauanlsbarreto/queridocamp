import mysql from 'mysql2/promise';
import RodadasClient from "./rodadas-cliente"
import AdPropaganda from '@/components/ad-propaganda';

 const pool = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

export const revalidate = 86400; // Cache de 24 horas (ISR)

async function getLastUpdate() {
  try {
    const [rows] = await pool.query("SELECT value FROM site_metadata WHERE key_name = 'last_update'");
    return (rows as any[])[0]?.value || new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

export default async function Rodadas() {
  try {
    const [rows] = await pool.query("SELECT id, team_name AS name, team_image AS logo FROM team_config ORDER BY team_name ASC")
    const teams = rows as any[]

    const [matchRows] = await pool.query("SELECT * FROM jogos")
    const matchesData = matchRows as any[]

    const lastUpdate = await getLastUpdate();

    return <RodadasClient teams={teams} matchesData={matchesData} lastUpdate={lastUpdate} />
  } catch (error) {
    console.error("Erro ao buscar dados:", error)
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <AdPropaganda 
            videoSrc="/videosad/radiante.mp4" 
            redirectUrl="https://industriaradiante.com.br/" 
        />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Erro ao carregar rodadas</h1>
          <p className="text-gray-400">Não foi possível conectar ao banco de dados.</p>
        </div>
      </div>
    )
  }
}

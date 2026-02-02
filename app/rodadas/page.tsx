import mysql from 'mysql2/promise';
import RodadasClient from "./rodadas-cliente"

 const pool = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

export const revalidate = 0 

export default async function Rodadas() {
  try {
    const [rows] = await pool.query("SELECT id, team_name AS name, team_image AS logo FROM team_config ORDER BY team_name ASC")
    const teams = rows as any[]

    const [matchRows] = await pool.query("SELECT * FROM jogos")
    const matchesData = matchRows as any[]

    return <RodadasClient teams={teams} matchesData={matchesData} />
  } catch (error) {
    console.error("Erro ao buscar dados:", error)
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Erro ao carregar rodadas</h1>
          <p className="text-gray-400">Não foi possível conectar ao banco de dados.</p>
        </div>
      </div>
    )
  }
}

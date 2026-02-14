import RodadasClient from "./rodadas-cliente";
import SideAds from "@/components/side-ads";
import AdPropaganda from '@/components/ad-propaganda';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';

export const revalidate = 86400; 

async function getLastUpdate(connection: any) {
  try {
    const [rows] = await connection.query(
      "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
    ) as [{ value: string }[], any];

    return rows[0]?.value || new Date().toISOString();
  } catch (error) {
    console.error("Erro ao buscar lastUpdate:", error);
    return new Date().toISOString();
  }
}

export default async function Rodadas() {
  let connection: any;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    connection = await createMainConnection(env);

    const [
      [teamRows],
      [matchRows],
      lastUpdate
    ] = await Promise.all([
      connection.query("SELECT id, team_name AS name, team_image AS logo FROM team_config ORDER BY team_name ASC") as Promise<[any[], any]>,
      connection.query("SELECT * FROM jogos") as Promise<[any[], any]>,
      getLastUpdate(connection)
    ]);

    return (
      <>
        <SideAds />
        <RodadasClient teams={teamRows} matchesData={matchRows} lastUpdate={lastUpdate} />
      </>
    );
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
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
    );
  } finally {
    if (connection) await connection.end();
  }
}

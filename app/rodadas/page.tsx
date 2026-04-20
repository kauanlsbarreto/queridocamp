import RodadasClient from "./rodadas-cliente";
import SideAds from "@/components/side-ads";
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';
import { getDatabaseLastUpdate } from '@/lib/last-update';
import PageAccessGate from '@/components/page-access-gate';

export const revalidate = 86400; 

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
      getDatabaseLastUpdate(connection)
    ]);

    const excludedTeams = ["Alfajor Soluções", "NeshaStore"];
    const filteredMatches = matchRows.filter((m: any) => 
      !excludedTeams.includes(m.time1) && !excludedTeams.includes(m.time2)
    );

    return (
      <PageAccessGate level={2}>
        <>
          <SideAds />
          <RodadasClient teams={teamRows} matchesData={filteredMatches} lastUpdate={lastUpdate} />
        </>
      </PageAccessGate>
    );
  } catch (error) {
    console.error("Erro ao buscar dados:", error);
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
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

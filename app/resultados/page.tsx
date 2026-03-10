import { createMainConnection } from '@/lib/db';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import SideAds from "@/components/side-ads";
import ResultadosClient from './resultados-cliente';
import HeroBanner from '@/components/hero-banner';

export const revalidate = 3600; 

export default async function Resultados() {
  let connection: any;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    connection = await createMainConnection(env);

    const [
      [teamRows],
      [matchRows],
    ] = await Promise.all([
      connection.query("SELECT id, team_name AS name, team_image AS logo FROM team_config ORDER BY team_name ASC") as Promise<[any[], any]>,
      connection.query("SELECT * FROM jogos ORDER BY data DESC, id DESC LIMIT 200") as Promise<[any[], any]>,
    ]);

    const excludedTeams = ["Alfajor Soluções", "NeshaStore"];
    const filteredMatches = matchRows.filter((m: any) => 
      !excludedTeams.includes(m.time1) && !excludedTeams.includes(m.time2)
    );

    return (
      <>
        <SideAds />
        <ResultadosClient teams={teamRows} matchesData={filteredMatches} />
      </>
    );
  } catch (error) {
    console.error("Erro ao buscar dados para resultados:", error);
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <h1 className="text-2xl font-bold text-red-500 mb-4">Erro ao carregar resultados.</h1>
      </div>
    );
  } finally {
    if (connection) await connection.end();
  }
}
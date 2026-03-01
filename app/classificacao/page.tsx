import AdPropaganda from "@/components/ad-propaganda";
import SideAds from "@/components/side-ads";
import RankingTable from "./ranking-table";
import UpdateTimer from "@/components/update-timer";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const revalidate = 86400;

type TeamRow = RowDataPacket & {
  id: number;
  team_name: string;
  team_image: string;
  vitorias: number;
  derrotas: number;
  sp: number;
  df: number;
};

async function getTeams(connection: any) {
  const [rows] = await connection.query(
    "SELECT * FROM team_config ORDER BY sp DESC, df DESC"
  ) as [TeamRow[], any];

  return rows.map((row: TeamRow) => ({
    id: row.id,
    name: row.team_name,
    logo: row.team_image,
    wins: row.vitorias,
    losses: row.derrotas,
    points: row.sp,
    rounds: row.df > 0 ? `+${row.df}` : `${row.df}`,
  }));
}

async function getLastUpdate(connection: any) {
  const [rows] = await connection.query(
    "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
  ) as [({ value: string })[], any];

  return rows[0]?.value || new Date().toISOString();
}

export default async function Classificacao() {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true }); 
    const env = ctx.env as any;

    connection = await createMainConnection(env);

    const [teams, lastUpdate] = await Promise.all([
      getTeams(connection),
      getLastUpdate(connection)
    ]);

    return (
      <div>
        <SideAds />
        <AdPropaganda
          videoSrc="/videosad/radiante.mp4"
          redirectUrl="https://industriaradiante.com.br/"
        />
        <section className="py-16 bg-gradient-to-b from-black to-gray-900">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <UpdateTimer lastUpdate={lastUpdate} />
              <RankingTable teams={teams} />
            </div>
          </div>
        </section>
      </div>
    );
  } catch (error) {
    console.error("Erro ao renderizar classificação:", error);
    return (
      <div className="py-16 text-center text-white">
        Erro ao carregar classificação.
      </div>
    );
  } finally {
    if (connection) await connection.end();
  }
}
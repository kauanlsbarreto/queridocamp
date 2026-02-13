import PlayersList from './players-list';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

export const revalidate = 86400; 

const ITEMS_PER_PAGE = 20;

const normalizeText = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') 
    .replace(/[^a-z0-9]/g, '');
};

async function getLastUpdate(connection: any) {
  try {
    const [rows]: any = await connection.query(
      "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
    );
    return rows[0]?.value || new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

async function getPlayersData(mainConn: any, jogadoresConn: any, offset: number) {
  const [totalResult]: any = await mainConn.query('SELECT COUNT(*) as count FROM players');
  const totalPlayers = totalResult[0].count;
  const totalPages = Math.ceil(totalPlayers / ITEMS_PER_PAGE);

  const [playersRows]: any = await mainConn.query(
    'SELECT id, nickname, avatar, faceit_guid, adicionados FROM players ORDER BY nickname ASC LIMIT ? OFFSET ?',
    [ITEMS_PER_PAGE, offset]
  );

  const [teamsRows]: any = await mainConn.query('SELECT * FROM team_config');
  const [jogadoresRows]: any = await jogadoresConn.query('SELECT * FROM jogadores');
  const normalizedJogadoresMap = new Map<string, any>(jogadoresRows.map((j: any) => [normalizeText(j.nick), j]));

  const playersWithTeams = playersRows.map((player: any) => {
    if (player.id === 0) {
      player.nickname = "-1";
      player.avatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSELngQdOTsSQXmSv9j1ltZDiGKXvSB8NJIsQ&s";
    }
    
    let teamName = null;
    let teamLogo = null;

    const normalizedPlayerNick = normalizeText(player.nickname);
    const jogador = normalizedJogadoresMap.get(normalizedPlayerNick);

    if (jogador) {
      const captainId = jogador.captain_id || jogador.id;
      const captain = jogadoresRows.find((j: any) => String(j.id) === String(captainId));

      if (captain) {
        const team = teamsRows.find((t: any) => (t.player_nick || '').split(',').map((n:string) => n.trim()).includes(captain.nick));
        if (team) {
          teamName = team.team_name;
          teamLogo = team.team_image;
        }
      }
    }

    return { 
      ...player, 
      team_name: teamName, 
      team_logo: teamLogo
    };
  });

  return { playersWithTeams, totalPages };
}

export default async function PlayersPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const currentPage = Number(searchParams?.page) || 1;
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  let mainConnection: any;
  let jogadoresConnection: any;
  let playersData = { playersWithTeams: [], totalPages: 0 };
  let lastUpdate = new Date().toISOString();

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as Env;

    mainConnection = await createMainConnection(env);
    jogadoresConnection = await createJogadoresConnection(env);

    playersData = await getPlayersData(mainConnection, jogadoresConnection, offset);
    lastUpdate = await getLastUpdate(mainConnection);

  } catch (error: any) {
    console.error("Erro ao carregar dados:", error.message);
  } finally {
    if (mainConnection) await mainConnection.end().catch(() => {});
    if (jogadoresConnection) await jogadoresConnection.end().catch(() => {});
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PlayersList
        initialPlayers={playersData.playersWithTeams}
        totalPages={playersData.totalPages}
        currentPage={currentPage}
        lastUpdate={lastUpdate}
      />
    </div>
  );
}
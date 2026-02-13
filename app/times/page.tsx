import TeamsList from '@/app/times/teams-list';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import UpdateTimer from '@/components/update-timer';

export const revalidate = 86400;

export interface Player {
  id: number;
  nick: string;
  pote: number;
  captain_id: string;
  faceit_image?: string;
  faceit_url?: string;
  discord_id?: string;
}

export interface TeamData {
  team_name: string;
  team_nick: string;
  team_image: string;
  players: Player[];
}

const normalizeText = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9]/g, ''); // Remove non-alphanumeric characters
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

async function getTeamsData(mainConnection: any, jogadoresConnection: any): Promise<TeamData[]> {
  try {
    const [teamsResult] = await mainConnection.query('SELECT * FROM team_config') as [any[], any];
    const [playersResult] = await jogadoresConnection.query('SELECT * FROM jogadores') as [any[], any];
    const [faceitResult] = await jogadoresConnection.query('SELECT * FROM faceit_players') as [any[], any];

    const playersMap = new Map<string, Player>();
    const playersById = new Map<string, Player>();
    const normalizedPlayersMap = new Map<string, Player>();

    playersResult.forEach(p => {
      const player: Player = { ...p, pote: Number(p.pote) };
      if (player.nick) {
        playersMap.set(player.nick.toLowerCase().trim(), player);
        normalizedPlayersMap.set(normalizeText(player.nick), player);
      }
      playersById.set(String(player.id), player);
    });

    const faceitMap = new Map<string, any>();
    const normalizedFaceitMap = new Map<string, any>();
    faceitResult.forEach(fp => {
      if (fp.faceit_nickname) {
        faceitMap.set(fp.faceit_nickname.toLowerCase().trim(), fp);
        normalizedFaceitMap.set(normalizeText(fp.faceit_nickname), fp);
      }
    });

    return teamsResult.map(team => {
      const rawNick = (team.player_nick || "").split(',').pop()?.trim() || "";
      const normalizedRawNick = normalizeText(rawNick);
      let captain = playersMap.get(rawNick.toLowerCase()) || playersById.get(rawNick) || normalizedPlayersMap.get(normalizedRawNick);

      const rawTeamPlayers = captain
        ? playersResult.filter(p => p.id === captain.id || String(p.captain_id) === String(captain.id))
        : [];
      const uniquePlayers = Array.from(new Map(rawTeamPlayers.map(p => [p.id, p])).values());

      const enrichedPlayers = uniquePlayers.map(player => {
        const normalizedPlayerNick = normalizeText(player.nick);
        let faceitData = { faceit_image: '/images/cs2-player.png', faceit_url: '', discord_id: '' };
        let bestMatch = faceitMap.get(player.nick.toLowerCase().trim()) || normalizedFaceitMap.get(normalizedPlayerNick);
        if (bestMatch) {
          faceitData.discord_id = bestMatch.discord_id;
          if (bestMatch.fotoperfil) faceitData.faceit_image = bestMatch.fotoperfil;
          if (bestMatch.faceit_nickname) faceitData.faceit_url = `https://www.faceit.com/en/players/${bestMatch.faceit_nickname}`;
        }
        return { ...player, ...faceitData };
      });

      const poteOrder = [4, 5, 1, 2, 3];
      enrichedPlayers.sort((a,b) => (poteOrder.indexOf(a.pote) || 999) - (poteOrder.indexOf(b.pote) || 999));

      return {
        team_name: team.team_name || "Time sem nome",
        team_nick: rawNick,
        team_image: team.team_image || "",
        players: enrichedPlayers
      };
    });
  } catch (err) {
    console.error("Erro ao buscar dados dos times:", err);
    return [];
  }
}

export default async function TimesPage() {
  let mainConnection: any;
  let jogadoresConnection: any;
  let teams: TeamData[] = [];
  let lastUpdate = new Date().toISOString();

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any

    mainConnection = await createMainConnection(env);
    jogadoresConnection = await createJogadoresConnection(env);

    teams = await getTeamsData(mainConnection, jogadoresConnection);
    lastUpdate = await getLastUpdate(mainConnection);
  } catch (err) {
    console.error("Erro na página Times:", err);
  } finally {
    if (mainConnection) await mainConnection.end();
    if (jogadoresConnection) await jogadoresConnection.end();
  }

  return (
    <div>
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          <UpdateTimer lastUpdate={lastUpdate} />
          {teams.length > 0 ? (
            <TeamsList teams={teams} />
          ) : (
            <div className="text-center text-gray-400 py-12">
              <p>Nenhum time encontrado ou erro ao carregar dados do banco.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

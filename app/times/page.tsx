import TeamsList from '@/app/times/teams-list';
import SideAds from '@/components/side-ads';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import { getDatabaseLastUpdate } from '@/lib/last-update';
import UpdateTimer from '@/components/update-timer';
import { unstable_cache } from 'next/cache';
import PageAccessGate from '@/components/page-access-gate';

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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

const getTeamsData = unstable_cache(async (mainConnection: any, jogadoresConnection: any): Promise<TeamData[]> => {
  try {
    const [
      [teamsResult],
      [playersResult],
      [faceitResult]
    ] = await Promise.all([
      mainConnection.query('SELECT * FROM team_config') as Promise<[any[], any]>,
      jogadoresConnection.query('SELECT * FROM jogadores') as Promise<[any[], any]>,
      jogadoresConnection.query('SELECT * FROM faceit_players') as Promise<[any[], any]>
    ]);

    const playersMap = new Map<string, Player>();
    const playersById = new Map<string, Player>();
    const normalizedPlayersMap = new Map<string, Player>();
    const playersByCaptainId = new Map<string, Player[]>();
    const playerNormalizedNickMap = new Map<number, string>();

    playersResult.forEach(p => {
      const player: Player = { ...p, pote: Number(p.pote) };
      
      const normalizedNick = player.nick ? normalizeText(player.nick) : '';
      if (player.id) playerNormalizedNickMap.set(player.id, normalizedNick);

      if (player.nick) {
        playersMap.set(player.nick.toLowerCase().trim(), player);
        normalizedPlayersMap.set(normalizedNick, player);
      }
      playersById.set(String(player.id), player);

      if (player.captain_id) {
        const cId = String(player.captain_id);
        if (!playersByCaptainId.has(cId)) playersByCaptainId.set(cId, []);
        playersByCaptainId.get(cId)!.push(player);
      }
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
      const playerNicks = (team.player_nick || "").split(',').map((n: string) => n.trim());
      const rawNick = playerNicks[playerNicks.length - 1] || "";
      const normalizedRawNick = normalizeText(rawNick);
      const slug = team.team_nick || normalizeText(team.team_name) || rawNick;
      let captain = playersMap.get(rawNick.toLowerCase()) || playersById.get(rawNick) || normalizedPlayersMap.get(normalizedRawNick);

      let rawTeamPlayers: Player[] = [];
      if (captain) {
        if (playerNicks.length > 1) {
          captain = { ...captain, pote: 1 };
        }
        const members = playersByCaptainId.get(String(captain.id)) || [];
        rawTeamPlayers = [captain, ...members];
      }
      const uniquePlayers = Array.from(new Map(rawTeamPlayers.map(p => [p.id, p])).values());

      const enrichedPlayers = uniquePlayers.map(player => {
        const normalizedPlayerNick = playerNormalizedNickMap.get(player.id) || normalizeText(player.nick);
        let faceitData = { faceit_image: '/images/cs2-player.png', faceit_url: '', discord_id: '' };
        let bestMatch = faceitMap.get(player.nick.toLowerCase().trim()) || normalizedFaceitMap.get(normalizedPlayerNick);
        if (bestMatch) {
          faceitData.discord_id = bestMatch.discord_id;
          if (bestMatch.fotoperfil) faceitData.faceit_image = bestMatch.fotoperfil;
          if (bestMatch.faceit_nickname) faceitData.faceit_url = `https://www.faceit.com/en/players/${bestMatch.faceit_nickname}`;
        }
        return { ...player, ...faceitData, pote: Number(player.pote) };
      });

      const poteOrder = [4, 5, 1, 2, 3];
      enrichedPlayers.sort((a, b) => {
        const idxA = poteOrder.indexOf(a.pote);
        const idxB = poteOrder.indexOf(b.pote);
        return (idxA === -1 ? 999 : idxA) - (idxB === -1 ? 999 : idxB);
      });

      return {
        team_name: team.team_name || "Time sem nome",
        team_nick: slug,
        team_image: team.team_image || "",
        players: enrichedPlayers
      };
    });
  } catch (err) {
    console.error("Erro ao buscar dados dos times:", err);
    return [];
  }
}, ['teams-data'], { revalidate: 86400 });

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
    lastUpdate = await getDatabaseLastUpdate(mainConnection);
  } catch (err) {
    console.error("Erro na página Times:", err);
  } finally {
    if (mainConnection) await mainConnection.end();
    if (jogadoresConnection) await jogadoresConnection.end();
  }

  return (
    <PageAccessGate level={2}>
      <div>
        <SideAds />
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
    </PageAccessGate>
  );
}

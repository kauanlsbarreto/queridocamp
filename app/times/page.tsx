import TeamsList from '@/app/times/teams-list';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';

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

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || "").toLowerCase().trim();
  const s2 = (str2 || "").toLowerCase().trim();
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1.0;

  const matrix: number[][] = [];
  for (let i = 0; i <= len2; i++) matrix[i] = [i];
  for (let j = 0; j <= len1; j++) matrix[0][j] = j;

  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      matrix[i][j] = s2[i-1] === s1[j-1] ? matrix[i-1][j-1] 
        : Math.min(matrix[i-1][j-1]+1, matrix[i][j-1]+1, matrix[i-1][j]+1);
    }
  }
  return 1.0 - matrix[len2][len1] / maxLen;
}

async function getTeamsData(mainConnection: any, jogadoresConnection: any): Promise<TeamData[]> {
  try {
    // ⚠️ Usar query() no Hyperdrive
    const [teamsResult] = await mainConnection.query('SELECT * FROM team_config') as [any[], any];
    const [playersResult] = await jogadoresConnection.query('SELECT * FROM jogadores') as [any[], any];
    const [faceitResult] = await jogadoresConnection.query('SELECT * FROM faceit_players') as [any[], any];

    const playersMap = new Map<string, Player>();
    const playersById = new Map<string, Player>();

    playersResult.forEach(p => {
      const player: Player = { ...p, pote: Number(p.pote) };
      if (player.nick) playersMap.set(player.nick.toLowerCase().trim(), player);
      playersById.set(String(player.id), player);
    });

    const faceitMap = new Map<string, any>();
    faceitResult.forEach(fp => {
      if (fp.faceit_nickname) faceitMap.set(fp.faceit_nickname.toLowerCase().trim(), fp);
    });

    return teamsResult.map(team => {
      const rawNick = (team.player_nick || "").split(',').pop()?.trim() || "";
      let captain = playersMap.get(rawNick.toLowerCase()) || playersById.get(rawNick);

      // fallback por similaridade
      if (!captain && rawNick) {
        let bestSim = 0;
        for (const player of playersResult) {
          const sim = calculateSimilarity(player.nick, rawNick);
          if (sim > bestSim) {
            bestSim = sim;
            captain = player;
          }
        }
      }

      const rawTeamPlayers = captain
        ? playersResult.filter(p => p.id === captain.id || String(p.captain_id) === String(captain.id))
        : [];
      const uniquePlayers = Array.from(new Map(rawTeamPlayers.map(p => [p.id, p])).values());

      const enrichedPlayers = uniquePlayers.map(player => {
        let faceitData = { faceit_image: '/images/cs2-player.png', faceit_url: '', discord_id: '' };
        let bestMatch = faceitMap.get(player.nick.toLowerCase().trim());
        if (!bestMatch) {
          for (const fp of faceitResult) {
            const sim = calculateSimilarity(player.nick, fp.faceit_nickname || '');
            if (sim >= 0.6) {
              bestMatch = fp;
              break;
            }
          }
        }
        if (bestMatch) {
          faceitData.discord_id = bestMatch.discord_id;
          if (bestMatch.fotoperfil) faceitData.faceit_image = bestMatch.fotoperfil;
          if (bestMatch.faceit_nickname) faceitData.faceit_url = `https://www.faceit.com/en/players/${bestMatch.faceit_nickname}`;
        }
        return { ...player, ...faceitData };
      });

      const poteOrder = [4,5,1,3,2];
      enrichedPlayers.sort((a,b) => (poteOrder.indexOf(a.pote)||999) - (poteOrder.indexOf(b.pote)||999));

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

  try {
    // 🔹 async mode obrigatório
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any

    mainConnection = await createMainConnection(env);
    jogadoresConnection = await createJogadoresConnection(env);

    teams = await getTeamsData(mainConnection, jogadoresConnection);
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

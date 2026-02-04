import mysql from 'mysql2/promise';
import TeamsList from '@/app/times/teams-list';

export const revalidate = 600;

export interface Player {
  id: number;
  nick: string;
  pote: number;
  captain_id: string;
  faceit_image?: string;
  faceit_url?: string;
  discord_id?: string;
}

export interface TeamConfig {
  team_name: string;
  player_nick: string;
  team_image: string;
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
  
  for (let i = 0; i <= len2; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= len1; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  
  const distance = matrix[len2][len1];
  return 1.0 - distance / maxLen;
}

const pool1 = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');
const pool2 = mysql.createPool('mysql://root:fDCcXUwqZhgwPRXMUKDTtrKiRARETYOE@hopper.proxy.rlwy.net:53994/railway');

async function getTeamsData(): Promise<TeamData[]> {
  try {
    const [teamsResult, playersResult, faceitResult] = await Promise.all([
      pool1.execute('SELECT * FROM team_config'),
      pool2.execute('SELECT * FROM jogadores'),
      pool2.execute('SELECT * FROM faceit_players')
    ]);

    const teams = teamsResult[0] as any[];
    const rows = playersResult[0] as any[];
    const faceitPlayers = faceitResult[0] as any[];
    
    const players = (rows as any[]).map((p) => ({
      ...p,
      nick: p.nick,
      pote: Number(p.pote), 
    })) as Player[];

    // Otimização: Mapas para busca rápida
    const faceitMap = new Map<string, any>();
    faceitPlayers.forEach(fp => {
      if (fp.faceit_nickname) faceitMap.set(fp.faceit_nickname.toLowerCase().trim(), fp);
    });

    const playersMap = new Map<string, Player>();
    const playersIdMap = new Map<string, Player>();
    players.forEach(p => {
        if (p.nick) playersMap.set(p.nick.toLowerCase().trim(), p);
        playersIdMap.set(String(p.id), p);
    });

    // Processamento síncrono
    const teamsWithPlayers: TeamData[] = teams.map((team) => {
      const getProp = (obj: any, prop: string) => {
        const key = Object.keys(obj).find(k => k.toLowerCase() === prop.toLowerCase());
        return key ? obj[key] : null;
      };

      const rawNick = getProp(team, 'player_nick');
      const teamNick = (rawNick || "").split(',').pop()?.trim() || "";
      const teamName = getProp(team, 'team_name') || "Time sem nome";
      const teamImage = getProp(team, 'team_image') || "";
      
      // Busca otimizada de capitão
      let captain = playersMap.get(teamNick.toLowerCase());

      if (!captain && teamNick) {
        captain = playersIdMap.get(teamNick);
      }

      if (!captain && teamNick) {
        let bestSimilarity = 0;
        let bestCandidate: Player | undefined;

        for (const player of players) {
          if (!player.nick) continue;
          const similarity = calculateSimilarity(player.nick, teamNick);
          
          if (similarity > bestSimilarity) {
            bestSimilarity = similarity;
            bestCandidate = player;
          }
        }

        if (bestSimilarity >= 0.6) {
          captain = bestCandidate;
        }
      }

      const rawTeamPlayers = captain 
        ? players.filter(p => {
            if (p.id === captain!.id) return true;
            return p.captain_id && String(p.captain_id) === String(captain!.id);
          }) 
        : [];
      
      const teamPlayers = Array.from(new Map(rawTeamPlayers.map(p => [p.id, p])).values());

      const enrichedPlayers = teamPlayers.map((player) => {
        let bestMatch = faceitMap.get(player.nick.toLowerCase().trim());
        let maxSim = bestMatch ? 1.0 : 0;

        if (!bestMatch) {
          for (const fp of faceitPlayers) {
            if (!fp.faceit_nickname) continue;
            const sim = calculateSimilarity(player.nick, fp.faceit_nickname);
            if (sim > maxSim) {
              maxSim = sim;
              bestMatch = fp;
            }
            if (sim === 1.0) break; 
          }
        }

        let faceitData = { 
          faceit_image: '/images/cs2-player.png', 
          faceit_url: '', 
          discord_id: '' 
        };

        if (bestMatch && maxSim >= 0.6) {
          faceitData.discord_id = bestMatch.discord_id;
          
          if (bestMatch.fotoperfil) {
            faceitData.faceit_image = bestMatch.fotoperfil;
          }
          if (bestMatch.faceit_nickname) {
            faceitData.faceit_url = `https://www.faceit.com/en/players/${bestMatch.faceit_nickname}`;
          }
        }

        return { ...player, ...faceitData };
      });

      const poteOrder = [4, 5, 1, 3, 2];
      
      enrichedPlayers.sort((a, b) => {
        const indexA = poteOrder.indexOf(a.pote);
        const indexB = poteOrder.indexOf(b.pote);
        return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
      });

      return {
        team_name: teamName,
        team_nick: teamNick, 
        team_image: teamImage,
        players: enrichedPlayers
      };
    });

    return teamsWithPlayers;

  } catch (error) {
    console.error("Erro ao buscar dados dos times:", error);
    return [];
  }
}

export default async function TimesPage() {
  const teams = await getTeamsData();

  return (
    <div>
      <section className="py-16 bg-gradient-to-b from-black to-gray-900">
        <div className="container mx-auto px-4">
          {teams.length > 0 ? (
            <TeamsList teams={teams} />
          ) : (
            <div className="text-center text-gray-400 py-12">
              <p>Nenhum time encontrado ou erro ao carregar dados.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

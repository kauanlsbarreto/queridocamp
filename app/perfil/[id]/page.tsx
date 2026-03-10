import { notFound } from 'next/navigation';
import PerfilClient from './PerfilClient';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection, type Env } from '@/lib/db';

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || "").toLowerCase().trim();
  const s2 = (str2 || "").toLowerCase().trim();
  if (!s1 || !s2) return 0.0;
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  const matrix: number[][] = Array.from({ length: len2 + 1 }, (_, i) => [i]);
  for (let j = 0; j <= len1; j++) matrix[0][j] = j;
  for (let i = 1; i <= len2; i++) {
    for (let j = 1; j <= len1; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
    }
  }
  return 1.0 - matrix[len2][len1] / maxLen;
}

async function getPlayerData(id: string, mainConn: any) {
  const [rows] = await mainConn.query('SELECT * FROM players WHERE id = ?', [id]) as [any[], any];
  const player = rows[0];

  if (!player && id !== '0') return null;

  const updatedPlayer = player || { id: '0' };
  if (id === '0') {
    updatedPlayer.nickname = "Level -Todos -1";
    updatedPlayer.avatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSELngQdOTsSQXmSv9j1ltZDiGKXvSB8NJIsQ&s";
    updatedPlayer.faceit_level_image = '/faceitlevel/-1.png';
  }

  if (updatedPlayer.adicionados?.includes('QCS-CADEIRANTE')) {
    updatedPlayer.faceit_level_image = '/faceitlevel/cadeirante.png';
  }

  return updatedPlayer;
}

async function getConquistas(playerId: string, mainConn: any) {
  if (playerId === '0') {
    const [rows] = await mainConn.query(
      'SELECT id, codigo, tipo, nome, usado FROM codigos_sistema ORDER BY id DESC'
    ) as [any[], any];
    return rows;
  }
  try {
    const [rows] = await mainConn.query(
      'SELECT id, codigo, tipo, nome, resgatado_por, resgatado_em, created_at FROM codigos_conquistas WHERE resgatado_por = ? ORDER BY id DESC',
      [playerId]
    ) as [any[], any];
    return rows;
  } catch (e) {
    return [];
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let mainConnection: any;
  let jogadoresConnection: any;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as Env;

    mainConnection = await createMainConnection(env);
    jogadoresConnection = await createJogadoresConnection(env);

    const player = await getPlayerData(id, mainConnection);
    if (!player) notFound();

    const [conquistas, teamsResult, jogadoresResult, playedMatchesResult, statsResult] = await Promise.all([
      getConquistas(player.id, mainConnection),
      mainConnection.query('SELECT * FROM team_config ORDER BY team_name ASC'),
      jogadoresConnection.query('SELECT * FROM jogadores'),
      mainConnection.query('SELECT time1, time2 FROM jogos'),
      mainConnection.query('SELECT * FROM top90_stats WHERE nick = ?', [player.nickname])
    ]);

    const teamsConfig = teamsResult[0] as any[];
    const jogadores = jogadoresResult[0] as any[];
    const playedMatches = playedMatchesResult[0] as any[];
    const playerStats = statsResult[0]?.[0] || null;

    let playerTeamName = "";
    let upcomingMatches: any[] = [];

    for (const team of teamsConfig) {
      const teamNick = (team.player_nick || team.PLAYER_NICK || "").split(',').pop()?.trim() || "";
      let captain = jogadores.find((p: any) => p.nick?.trim().toLowerCase() === teamNick.toLowerCase());

      if (!captain && teamNick) {
        let bestSim = 0;
        let candidate: any;
        for (const p of jogadores) {
          const sim = calculateSimilarity(p.nick, teamNick);
          if (sim > bestSim) { bestSim = sim; candidate = p; }
        }
        if (bestSim >= 0.6) captain = candidate;
      }

      if (captain) {
        const isCaptain = captain.nick?.toLowerCase() === player.nickname?.toLowerCase();
        const profileInJogadores = jogadores.find((p: any) => p.nick?.toLowerCase() === player.nickname?.toLowerCase());
        const isMember = profileInJogadores && String(profileInJogadores.captain_id) === String(captain.id);

        if (isCaptain || isMember) {
          playerTeamName = team.team_name || team.TEAM_NAME;
          break;
        }
      }
    }

    if (playerTeamName && id !== '0') {
      const teams = teamsConfig.map((t: any) => ({ 
        id: t.id, 
        name: t.team_name || t.TEAM_NAME, 
        logo: t.team_image || t.TEAM_IMAGE 
      }));

      if (teams.length >= 2) {
        const numTeams = teams.length;
        const teamIds = teams.map(t => t.id);
        const rotating = teamIds.slice(1);

        for (let round = 0; round < numTeams - 1; round++) {
          const currentRotation = [...rotating];
          for (let i = 0; i < round; i++) {
            const last = currentRotation.pop();
            if (last) currentRotation.unshift(last);
          }
          const roundTeams = [teamIds[0], ...currentRotation];

          for (let match = 0; match < Math.floor(numTeams / 2); match++) {
            const tA = teams.find(t => t.id === roundTeams[match]);
            const tB = teams.find(t => t.id === roundTeams[numTeams - 1 - match]);

            if (tA && tB && (tA.name === playerTeamName || tB.name === playerTeamName)) {
              const played = playedMatches.some((m: any) => 
                (m.time1 === tA.name && m.time2 === tB.name) || (m.time1 === tB.name && m.time2 === tA.name)
              );
              if (!played) {
                upcomingMatches.push({
                  team1: tA.name, team1Logo: tA.logo,
                  team2: tB.name, team2Logo: tB.logo,
                  rodada: `Rodada ${round + 1}`,
                });
              }
            }
          }
        }
      }
    }

    return (
      <div className="min-h-screen bg-black">
        <PerfilClient 
          player={player} 
          initialConquistas={conquistas} 
          upcomingMatches={upcomingMatches} 
          teamName={playerTeamName} 
          playerStats={playerStats}
        />
      </div>
    );

  } catch (error) {
    console.error("Erro na PerfilPage:", error);
    throw error; 
  } finally {
    if (mainConnection) await mainConnection.end?.();
    if (jogadoresConnection) await jogadoresConnection.end?.();
  }
}
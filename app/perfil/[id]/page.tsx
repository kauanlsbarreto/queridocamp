import { notFound } from 'next/navigation';
import PerfilClient from './PerfilClient';
import mysql from 'mysql2/promise';

const dbPool = mysql.createPool("mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway");
const dbPoolJogadores = mysql.createPool("mysql://root:fDCcXUwqZhgwPRXMUKDTtrKiRARETYOE@hopper.proxy.rlwy.net:53994/railway");

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

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const [pRows]: any = await dbPool.execute('SELECT * FROM players WHERE id = ?', [id]);
    const player = pRows[0];
    if (!player) notFound();

    if (id === '0') {
        player.nickname = "Level -Todos -1"; 
        player.avatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSELngQdOTsSQXmSv9j1ltZDiGKXvSB8NJIsQ&s";
        player.faceit_level = 10; 
    }

    if (player.adicionados && player.adicionados.includes('QCS-CADEIRANTE')) {
        player.faceit_level_image = '/faceitlevel/cadeirante.png';
    }

    try {
        await dbPool.execute(`CREATE TABLE IF NOT EXISTS codigos_conquistas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            resgatado_por INT NOT NULL,
            codigo VARCHAR(50) NOT NULL,
            tipo ENUM('campeonato', 'MVP') NOT NULL,
            nome VARCHAR(255) NOT NULL,
            data_conquista TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await dbPool.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS adicionados VARCHAR(255)");
    } catch(e) {}

    let cRows: any[] = [];
    try {
        const [rows]: any = await dbPool.execute(
            'SELECT codigo, tipo, nome FROM codigos_conquistas WHERE resgatado_por = ? ORDER BY id DESC', 
            [player.id]
        );
        cRows = rows;
    } catch (e: any) {
        const [rows]: any = await dbPool.execute(
            'SELECT codigo, tipo, nome FROM codigos_conquistas WHERE player_id = ? ORDER BY id DESC', 
            [player.id]
        ).catch(() => []); 
        cRows = rows;
    }

    let upcomingMatches: any[] = [];
    let playerTeamName = "";
    let allTeams: any[] = [];

    try {
        const [teamsResult, playersResult] = await Promise.all([
            dbPool.execute('SELECT * FROM team_config ORDER BY team_name ASC'),
            dbPoolJogadores.execute('SELECT * FROM jogadores')
        ]);

        const teamsConfig = teamsResult[0] as any[];
        const jogadores = playersResult[0] as any[];
        allTeams = teamsConfig;

        for (const team of teamsConfig) {
            const getProp = (obj: any, prop: string) => {
                const key = Object.keys(obj).find(k => k.toLowerCase() === prop.toLowerCase());
                return key ? obj[key] : null;
            };

            const rawNick = getProp(team, 'player_nick');
            const teamNick = (rawNick || "").split(',').pop()?.trim() || "";
            
            let captain = jogadores.find((p: any) => p.nick && p.nick.trim().toLowerCase() === teamNick.toLowerCase());

            if (!captain && teamNick) {
                captain = jogadores.find((p: any) => String(p.id) === teamNick);
            }

            if (!captain && teamNick) {
                let bestSimilarity = 0;
                let bestCandidate: any | undefined;

                for (const p of jogadores) {
                    if (!p.nick) continue;
                    const similarity = calculateSimilarity(p.nick, teamNick);
                    
                    if (similarity > bestSimilarity) {
                        bestSimilarity = similarity;
                        bestCandidate = p;
                    }
                }

                if (bestSimilarity >= 0.6) {
                    captain = bestCandidate;
                }
            }

            if (captain) {
                // Verifica se o jogador do perfil é o capitão ou membro deste time
                const profileNickname = player.nickname;
                const profilePlayerInJogadores = jogadores.find((p: any) => p.nick.toLowerCase() === profileNickname.toLowerCase());

                const isCaptain = captain.nick.toLowerCase() === profileNickname.toLowerCase();
                const isMember = profilePlayerInJogadores && String(profilePlayerInJogadores.captain_id) === String(captain.id);

                if (isCaptain || isMember) {
                    playerTeamName = getProp(team, 'team_name');
                    break;
                }
            }
        }

        if (playerTeamName && id !== '0') {
            const [playedMatches]: any = await dbPool.execute('SELECT time1, time2 FROM jogos');

            const teams = allTeams.map((t: any) => ({ id: t.id, name: t.team_name, logo: t.team_image }));
            const numTeams = teams.length;

            if (numTeams >= 2) {
                const numRounds = numTeams - 1;
                const matchesPerRound = Math.floor(numTeams / 2);
                
                const teamIds = teams.map((t: any) => t.id);
                const fixedTeam = teamIds[0];
                const rotatingTeams = teamIds.slice(1);

                for (let round = 0; round < numRounds; round++) {
                    const currentRotation = [...rotatingTeams];
                    for (let i = 0; i < round; i++) {
                        const last = currentRotation.pop();
                        if (last) currentRotation.unshift(last);
                    }
                    
                    const roundTeams = [fixedTeam, ...currentRotation];

                    for (let match = 0; match < matchesPerRound; match++) {
                        const teamAId = roundTeams[match];
                        const teamBId = roundTeams[numTeams - 1 - match];
                        
                        const teamA = teams.find((t: any) => t.id === teamAId);
                        const teamB = teams.find((t: any) => t.id === teamBId);

                        if (teamA && teamB) {
                            if (teamA.name === playerTeamName || teamB.name === playerTeamName) {
                                const isPlayed = playedMatches.some((m: any) => 
                                    (m.time1 === teamA.name && m.time2 === teamB.name) || 
                                    (m.time1 === teamB.name && m.time2 === teamA.name)
                                );

                                if (!isPlayed) {
                                    upcomingMatches.push({
                                        team1: teamA.name,
                                        team1Logo: teamA.logo,
                                        team2: teamB.name,
                                        team2Logo: teamB.logo,
                                        rodada: `Rodada ${round + 1}`,
                                        data_jogo: null
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    } catch (e) {
        console.error("Error fetching team/matches:", e);
    }

    return <PerfilClient player={player} initialConquistas={cRows} upcomingMatches={upcomingMatches} teamName={playerTeamName} />;
}
import mysql from 'mysql2/promise';
import PlayersList from './players-list';

export const revalidate = 86400; // Cache de 24 horas (ISR)

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

const ITEMS_PER_PAGE = 20;

async function getLastUpdate() {
  try {
    const [rows] = await dbPool.query("SELECT value FROM site_metadata WHERE key_name = 'last_update'");
    return (rows as any[])[0]?.value || new Date().toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

export default async function PlayersPage(props: { searchParams: Promise<{ page?: string }> }) {
    const searchParams = await props.searchParams;
    const currentPage = Number(searchParams?.page) || 1;
    const offset = (currentPage - 1) * ITEMS_PER_PAGE;

    // Garante que a coluna 'adicionados' exista para evitar erro na query abaixo
    try {
        await dbPool.execute("ALTER TABLE players ADD COLUMN IF NOT EXISTS adicionados VARCHAR(255)");
    } catch (e) {}

    const [totalResult]: any = await dbPool.execute('SELECT COUNT(*) as count FROM players');
    const totalPlayers = totalResult[0].count;
    const totalPages = Math.ceil(totalPlayers / ITEMS_PER_PAGE);

    const [playersRows]: any = await dbPool.query(
        'SELECT id, nickname, avatar, faceit_guid, adicionados FROM players ORDER BY nickname ASC LIMIT ? OFFSET ?',
        [ITEMS_PER_PAGE, offset]
    );
    const players = playersRows;

    const [teamsRows]: any = await dbPool.execute('SELECT * FROM team_config');
    const [jogadoresRows]: any = await dbPoolJogadores.execute('SELECT * FROM jogadores');
    
    const teamsConfig = teamsRows;
    const jogadores = jogadoresRows;

    const jogadoresMap = new Map(jogadores.map((j: any) => [j.nick?.toLowerCase(), j]));

    const playersWithTeams = players.map((player: any) => {
        if (player.id === 0) {
            player.nickname = "-1";
            player.avatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSELngQdOTsSQXmSv9j1ltZDiGKXvSB8NJIsQ&s";
            player.faceit_level_image = '/faceitlevel/-1.png';
        }

        if (player.adicionados && player.adicionados.includes('QCS-CADEIRANTE')) {
            player.faceit_level_image = '/faceitlevel/cadeirante.png';
        }

        let teamName = null;
        let teamLogo = null;


        let jogador: any = jogadoresMap.get(player.nickname.toLowerCase());
        
        if (!jogador) {
             let bestSim = 0;
             let bestCand: any = null;
             for (const j of jogadores) {
                 if (!j.nick) continue;
                 const sim = calculateSimilarity(player.nickname, j.nick);
                 if (sim > 0.8 && sim > bestSim) {
                     bestSim = sim;
                     bestCand = j;
                 }
             }
             if (bestCand) jogador = bestCand;
        }

        if (jogador) {
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
                    const isCaptain = captain.id === jogador.id;
                    const isMember = String(jogador.captain_id) === String(captain.id);

                    if (isCaptain || isMember) {
                        teamName = getProp(team, 'team_name');
                        teamLogo = getProp(team, 'team_image');
                        break;
                    }
                }
            }
        }

        return {
            ...player,
            team_name: teamName,
            team_logo: teamLogo
        };
    });

    const lastUpdate = await getLastUpdate();

    return <PlayersList 
        initialPlayers={playersWithTeams} 
        totalPages={totalPages}
        currentPage={currentPage}
        lastUpdate={lastUpdate}
    />;
}

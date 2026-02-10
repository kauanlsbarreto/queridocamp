import mysql from 'mysql2/promise';

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
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
    }
  }
  return 1.0 - matrix[len2][len1] / maxLen;
}

const poolStats = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');
const poolPlayers = mysql.createPool('mysql://root:fDCcXUwqZhgwPRXMUKDTtrKiRARETYOE@hopper.proxy.rlwy.net:53994/railway');

export async function getStatsData() {
  try {
    const [statsResult, playersResult, faceitResult] = await Promise.all([
      poolStats.execute('SELECT * FROM top90_stats'),
      poolPlayers.execute('SELECT * FROM jogadores'),
      poolPlayers.execute('SELECT * FROM faceit_players')
    ]);

    const statsRows = statsResult[0] as any[];
    const playersRows = (playersResult[0] as any[]).map(p => ({ ...p, pote: Number(p.pote) }));
    const faceitPlayers = faceitResult[0] as any[];

    const faceitMap = new Map();
    faceitPlayers.forEach(fp => {
      if (fp.faceit_nickname) {
        faceitMap.set(fp.faceit_nickname.toLowerCase().trim(), fp);
      }
    });

    const playersMap = new Map();
    playersRows.forEach(p => {
      if (p.nick) {
        playersMap.set(p.nick.toLowerCase().trim(), p);
      }
    });

    const enrichedStats = statsRows.map((stat) => {
        const statNickLower = stat.nick.toLowerCase().trim();
        
        let playerInscrito = playersMap.get(statNickLower);

        if (!playerInscrito) {
          playerInscrito = playersRows.find(p => calculateSimilarity(p.nick, stat.nick) >= 0.6);
        }

        let bestMatch = faceitMap.get(statNickLower);
        let maxSim = bestMatch ? 1.0 : 0;

        if (!bestMatch) {
          for (const fp of faceitPlayers) {
            const sim = calculateSimilarity(stat.nick, fp.faceit_nickname);
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

        return {
          ...stat,
          pote: playerInscrito ? playerInscrito.pote : null,
          ...faceitData,
          kd: parseFloat(stat.kd) || 0,
          kr: parseFloat(stat.kr) || 0,
          adr: parseFloat(stat.adr) || 0,
          k: parseInt(stat.k) || 0,
          d: parseInt(stat.d) || 0,
          clt: parseInt(stat.clt) || 0
        };
      });

    const playersWithoutStats = playersRows.filter(p =>
      !statsRows.some(s => calculateSimilarity(s.nick, p.nick) >= 0.6)
    );

    const emptyStats = playersWithoutStats.map(p => ({
      nick: p.nick,
      pote: p.pote,
      kd: 0,
      kr: 0,
      adr: 0,
      k: 0,
      d: 0,
      clt: 0,
      faceit_image: '/images/cs2-player.png',
      faceit_url: '',
      discord_id: ''
    }));

    return [...enrichedStats, ...emptyStats];

  } catch (error) {
    console.error("Erro ao carregar stats:", error);
    return [];
  }
}

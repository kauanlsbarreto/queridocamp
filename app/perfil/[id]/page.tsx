import { notFound } from 'next/navigation';
import PerfilClient from './PerfilClient';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection, type Env } from '@/lib/db';

const faceitApiKey = '7b080715-fe0b-461d-a1f1-62cfd0c47e63';
const matchCache = new Map<string, any>();

async function getOpponentFromMatch(matchId: string, playerTeamName: string) {
  try {
    // Verificar cache
    if (matchCache.has(matchId)) {
      const cachedData = matchCache.get(matchId);
      if (cachedData.faction1 && cachedData.faction2) {
        const team1Name = cachedData.faction1.name;
        const team2Name = cachedData.faction2.name;
        if (team1Name.toLowerCase() === playerTeamName.toLowerCase()) return team2Name;
        if (team2Name.toLowerCase() === playerTeamName.toLowerCase()) return team1Name;
      }
      return null;
    }

    const res = await fetch(`https://open.faceit.com/data/v4/matches/${matchId}`, {
      headers: { Authorization: `Bearer ${faceitApiKey}` },
      signal: AbortSignal.timeout(5000) // Timeout de 5 segundos
    });

    if (!res.ok) return null;

    const data = await res.json();
    matchCache.set(matchId, data.teams || {});

    const faction1 = data.teams?.faction1;
    const faction2 = data.teams?.faction2;
    const team1Name = faction1?.name;
    const team2Name = faction2?.name;
    
    if (!team1Name || !team2Name) return null;
    if (team1Name.toLowerCase() === playerTeamName.toLowerCase()) return team2Name;
    if (team2Name.toLowerCase() === playerTeamName.toLowerCase()) return team1Name;
    return null;
  } catch (e) {
    console.error("Erro ao buscar adversário:", e);
    return null;
  }
}

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
  let player = rows[0];

  if (!player && id !== '0') return null;

  let updatedPlayer = player || { id: '0' };
  if (id === '0') {
    updatedPlayer.nickname = "Level -Todos -1";
    updatedPlayer.avatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSELngQdOTsSQXmSv9j1ltZDiGKXvSB8NJIsQ&s";
    updatedPlayer.faceit_level_image = '/faceitlevel/-1.png';
  }

  if (updatedPlayer.faceit_guid) {
    try {
      const faceitRes = await fetch(
        `https://open.faceit.com/data/v4/players/${updatedPlayer.faceit_guid}`,
        { headers: { Authorization: `Bearer ${faceitApiKey}` } }
      );
      if (faceitRes.ok) {
        const faceitData = await faceitRes.json();
        if (faceitData.avatar && faceitData.avatar !== updatedPlayer.avatar) {
          await mainConn.query('UPDATE players SET avatar = ? WHERE id = ?', [faceitData.avatar, id]);
          updatedPlayer.avatar = faceitData.avatar;
        }
      }
    } catch (e) {
      console.error('Erro ao atualizar avatar Faceit:', e);
    }
  }

  if (updatedPlayer.adicionados?.includes('QCS-CADEIRANTE')) {
    updatedPlayer.faceit_level_image = '/faceitlevel/cadeirante.png';
  }

  if (!updatedPlayer.nickname || String(updatedPlayer.nickname).trim() === '') {
    updatedPlayer.nickname = updatedPlayer.apelido || 'Jogador';
  }

  return updatedPlayer;
}

function parseAdicionadosCodes(raw: any): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getConquistas(player: any, mainConn: any) {
  const playerId = player?.id;
  if (String(playerId) === '0') {
    const [rows] = await mainConn.query(
      'SELECT id, codigo, tipo, nome, usado FROM codigos_sistema ORDER BY id DESC'
    ) as [any[], any];
    return rows;
  }

  // 1) Adicionados — independent of codigos_conquistas
  let adicionadosRows: any[] = [];
  try {
    const adicionadosCodes = parseAdicionadosCodes(player?.adicionados);
    if (adicionadosCodes.length > 0) {
      const placeholders = adicionadosCodes.map(() => '?').join(',');
      const [rowsAdicionados] = await mainConn.query(
        `SELECT codigo, imagem, label FROM adicionados WHERE codigo IN (${placeholders})`,
        adicionadosCodes
      ) as [any[], any];

      const byCode = new Map<string, any>(
        rowsAdicionados.map((row: any) => [String(row.codigo).trim(), row])
      );

      adicionadosRows = adicionadosCodes
        .map((code) => byCode.get(code))
        .filter(Boolean)
        .map((row: any) => ({
          id: `adicionado-${row.codigo}`,
          codigo: row.codigo,
          tipo: 'ADICIONADO',
          nome: row.label || row.codigo,
          imagem: row.imagem
        }));
    }
  } catch (e) {
    // adicionados table unavailable — silently ignore
  }

  // 2) Redeemed achievement codes — independent of adicionados
  let baseRows: any[] = [];
  try {
    const [rows] = await mainConn.query(
      'SELECT id, codigo, tipo, nome, resgatado_por, resgatado_em, created_at FROM codigos_conquistas WHERE resgatado_por = ? ORDER BY id DESC',
      [playerId]
    ) as [any[], any];
    if (rows.length === 0) {
      try {
        const [altRows] = await mainConn.query(
          'SELECT id, codigo, tipo, nome, resgatado_por, resgatado_em, created_at FROM codigos_conquistas WHERE player_id = ? ORDER BY id DESC',
          [playerId]
        ) as [any[], any];
        baseRows = altRows;
      } catch {
        // player_id column may not exist — ignore
      }
    } else {
      baseRows = rows;
    }
  } catch (e) {
    // codigos_conquistas unavailable — silently ignore
  }

  return [...adicionadosRows, ...baseRows];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let mainConnection: any;
  let jogadoresConnection: any;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as Env;

    mainConnection = await createMainConnection(env);
    (mainConnection as any).setPage(`/perfil/${id}`);
    jogadoresConnection = await createJogadoresConnection(env);

    const player = await getPlayerData(id, mainConnection);
    if (!player) notFound();

    const statsPromise = (async () => {
      if (player.faceit_guid) {
        try {
          const [rows]: any = await mainConnection.query(
            'SELECT * FROM top90_stats WHERE nick = ? OR faceit_guid = ?',
            [player.nickname, player.faceit_guid]
          );
          return rows;
        } catch (err) {
          // possible missing column; fall back to nick-only lookup
        }
      }
      const [rows]: any = await mainConnection.query(
        'SELECT * FROM top90_stats WHERE nick = ?',
        [player.nickname]
      );
      return rows;
    })();

    const [conquistas, teamsResult, jogadoresResult, playedMatchesResult, playerStatsRows] = await Promise.all([
      getConquistas(player, mainConnection),
      mainConnection.query('SELECT * FROM team_config ORDER BY team_name ASC'),
      jogadoresConnection.query('SELECT * FROM jogadores'),
      mainConnection.query('SELECT time1, time2 FROM jogos'),
      statsPromise
    ]);

    const teamsConfig = teamsResult[0] as any[];
    const jogadores = jogadoresResult[0] as any[];
    const playedMatches = playedMatchesResult[0] as any[];
    const STATS_CUTOFF = new Date('2026-01-01T00:00:00Z');
    let playerStatsList = playerStatsRows || [];
    playerStatsList = playerStatsList.filter((r: any) => {
      if (r.created_at) {
        const d = new Date(r.created_at);
        return d >= STATS_CUTOFF;
      }
      if (r.date) { // alternate name
        const d = new Date(r.date);
        return d >= STATS_CUTOFF;
      }
      return true;
    });

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

    if (playerStatsList.length > 0 && playerTeamName) {
      // Paralelizar fetches de opponent em batch de 5 por vez para não sobrecarregar
      const batchSize = 5;
      
      for (const ps of playerStatsList) {
        const matchRequests: { round: number; matchId: string }[] = [];
        
        for (let round = 1; round <= 17; round++) {
          const matchId = ps[`r${round}_m1_id`];
          if (matchId) {
            matchRequests.push({ round, matchId });
          }
        }

        // Processar em batches de 5
        for (let i = 0; i < matchRequests.length; i += batchSize) {
          const batch = matchRequests.slice(i, i + batchSize);
          const results = await Promise.allSettled(
            batch.map(req => 
              getOpponentFromMatch(req.matchId, playerTeamName).then(opponent => ({
                round: req.round,
                opponent
              }))
            )
          );

          results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.opponent) {
              ps[`r${result.value.round}_opponent`] = result.value.opponent;
            }
          });
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
          playerStatsList={playerStatsList}
          adminView={false}
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
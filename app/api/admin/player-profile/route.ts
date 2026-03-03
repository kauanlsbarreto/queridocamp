import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

const apiKey = '7b080715-fe0b-461d-a1f1-62cfd0c47e63';

async function getOpponentFromMatch(matchId: string, playerTeamName: string) {
  try {
    const res = await fetch(`https://open.faceit.com/data/v4/matches/${matchId}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });

    if (!res.ok) return null;

    const data = await res.json();

    const faction1 = data.teams?.faction1;
    const faction2 = data.teams?.faction2;

    const team1Name = faction1?.name;
    const team2Name = faction2?.name;

    if (!team1Name || !team2Name) return null;

    if (team1Name.toLowerCase() === playerTeamName.toLowerCase()) {
      return team2Name;
    }

    if (team2Name.toLowerCase() === playerTeamName.toLowerCase()) {
      return team1Name;
    }

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const q = searchParams.get('q');

  let mainConnection;
  let jogadoresConnection;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    mainConnection = await createMainConnection(env);
    jogadoresConnection = await createJogadoresConnection(env);

    // MODO 1: LISTA DE JOGADORES (Se não tiver ID)
    if (!id) {
        // Buscar todos os jogadores do campeonato (tabela jogadores)
        const [jogadoresRows]: any = await jogadoresConnection.query('SELECT id, nick FROM jogadores ORDER BY nick ASC');
        
        // Buscar dados do Faceit para avatares
        const [faceitRows]: any = await jogadoresConnection.query('SELECT faceit_nickname, fotoperfil FROM faceit_players');
        
        // Buscar jogadores registrados para vincular
        const [registeredRows]: any = await mainConnection.query('SELECT id, nickname, avatar FROM players');

        const faceitMap = new Map();
        faceitRows.forEach((f: any) => faceitMap.set(f.faceit_nickname.toLowerCase(), f));

        const registeredMap = new Map();
        registeredRows.forEach((r: any) => registeredMap.set(r.nickname.toLowerCase(), r));

        let players = jogadoresRows.map((j: any) => {
            const nickLower = j.nick.toLowerCase();
            const registered = registeredMap.get(nickLower);
            const faceit = faceitMap.get(nickLower);

            if (registered) {
                return {
                    id: `real_${registered.id}`, // ID único para o frontend saber que é registrado
                    nickname: registered.nickname,
                    avatar: registered.avatar,
                    is_registered: true
                };
            } else {
                return {
                    id: `sim_${j.id}`, // ID único para simulação
                    nickname: j.nick,
                    avatar: faceit?.fotoperfil || "/images/cs2-player.png",
                    is_registered: false
                };
            }
        });

        if (q) {
            players = players.filter((p: any) => p.nickname.toLowerCase().includes(q.toLowerCase()));
        }
        return NextResponse.json(players);
    }

    // MODO 2: DETALHES DO JOGADOR (Se tiver ID)
    let updatedPlayer: any = null;

    if (id.startsWith('real_')) {
        const realId = id.replace('real_', '');
        const [rows]: any = await mainConnection.query('SELECT * FROM players WHERE id = ?', [realId]);
        if (rows.length) {
            updatedPlayer = rows[0];
            // Tentar buscar foto atualizada do Faceit mesmo para player registrado
            try {
                const [fRows]: any = await jogadoresConnection.query('SELECT fotoperfil FROM faceit_players WHERE faceit_nickname = ?', [updatedPlayer.nickname]);
                if (fRows.length && fRows[0].fotoperfil) {
                    updatedPlayer.avatar = fRows[0].fotoperfil;
                }
            } catch (e) {}
        }
    } else if (id.startsWith('sim_')) {
        const simId = id.replace('sim_', '');
        const [rows]: any = await jogadoresConnection.query('SELECT * FROM jogadores WHERE id = ?', [simId]);
        if (rows.length) {
            const j = rows[0];
            const [fRows]: any = await jogadoresConnection.query('SELECT * FROM faceit_players WHERE faceit_nickname = ?', [j.nick]);
            const f = fRows[0] || {};
            
            updatedPlayer = {
                id: 0, 
                nickname: j.nick,
                avatar: f.fotoperfil || "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSELngQdOTsSQXmSv9j1ltZDiGKXvSB8NJIsQ&s",
                faceit_guid: f.faceit_guid,
                faceit_level_image: '/faceitlevel/-1.png',
                adicionados: ''
            };
        }
    }

    if (!updatedPlayer) {
        return NextResponse.json({ error: 'Jogador não encontrado' }, { status: 404 });
    }

    if (updatedPlayer.adicionados?.includes('QCS-CADEIRANTE')) {
        updatedPlayer.faceit_level_image = '/faceitlevel/cadeirante.png';
    }

    let conquistas = [];
    if (updatedPlayer.id !== 0) {
        try {
            const [cRows]: any = await mainConnection.query(
                'SELECT codigo, tipo, nome FROM codigos_conquistas WHERE resgatado_por = ? ORDER BY id DESC',
                [updatedPlayer.id]
            );
            conquistas = cRows;
        } catch (e) {
            const [cRows]: any = await mainConnection.query(
                'SELECT codigo, tipo, nome FROM codigos_conquistas WHERE player_id = ? ORDER BY id DESC',
                [updatedPlayer.id]
            ).catch(() => [[]]);
            conquistas = cRows;
        }
    }

    const [teamsResult]: any = await mainConnection.query('SELECT * FROM team_config ORDER BY team_name ASC');
    const [jogadoresResult]: any = await jogadoresConnection.query('SELECT * FROM jogadores');
    const [playedMatchesResult]: any = await mainConnection.query('SELECT time1, time2 FROM jogos');

    const teamsConfig = teamsResult;
    const jogadores = jogadoresResult;
    const playedMatches = playedMatchesResult;

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
            const isCaptain = captain.nick?.toLowerCase() === updatedPlayer.nickname?.toLowerCase();
            const profileInJogadores = jogadores.find((p: any) => p.nick?.toLowerCase() === updatedPlayer.nickname?.toLowerCase());
            const isMember = profileInJogadores && String(profileInJogadores.captain_id) === String(captain.id);

            if (isCaptain || isMember) {
                playerTeamName = team.team_name || team.TEAM_NAME;
                break;
            }
        }
    }

    if (playerTeamName) {
        const teams = teamsConfig.map((t: any) => ({ id: t.id, name: t.team_name || t.TEAM_NAME, logo: t.team_image || t.TEAM_IMAGE }));
        if (teams.length >= 2) {
            const numTeams = teams.length;
            const teamIds = teams.map((t: any) => t.id);
            const rotating = teamIds.slice(1);
            for (let round = 0; round < numTeams - 1; round++) {
                const currentRotation = [...rotating];
                for (let i = 0; i < round; i++) { const last = currentRotation.pop(); if (last) currentRotation.unshift(last); }
                const roundTeams = [teamIds[0], ...currentRotation];
                for (let match = 0; match < Math.floor(numTeams / 2); match++) {
                    const tA = teams.find((t: any) => t.id === roundTeams[match]);
                    const tB = teams.find((t: any) => t.id === roundTeams[numTeams - 1 - match]);
                    if (tA && tB && (tA.name === playerTeamName || tB.name === playerTeamName)) {
                        const played = playedMatches.some((m: any) => (m.time1 === tA.name && m.time2 === tB.name) || (m.time1 === tB.name && m.time2 === tA.name));
                        if (!played) {
                            upcomingMatches.push({ team1: tA.name, team1Logo: tA.logo, team2: tB.name, team2Logo: tB.logo, rodada: `Rodada ${round + 1}` });
                        }
                    }
                }
            }
        }
    }

    let playerStats = null;
    try {
        const [statsRows]: any = await mainConnection.query('SELECT * FROM top90_stats WHERE nick = ?', [updatedPlayer.nickname]);
        if (statsRows.length > 0) {
             playerStats = statsRows[0];
        }
    } catch (e) {
        console.error("Erro ao buscar stats:", e);
    }
    if (playerStats && playerTeamName) {
    for (let round = 1; round <= 17; round++) {
        const matchId = playerStats[`r${round}_m1_id`];
        if (matchId) {
        const opponent = await getOpponentFromMatch(matchId, playerTeamName);
        if (opponent) {
            playerStats[`r${round}_opponent`] = opponent;
        }
        }
    }
    }

    return NextResponse.json({ player: updatedPlayer, conquistas, upcomingMatches, teamName: playerTeamName, playerStats });

  } catch (error) {
    console.error("Erro API player-profile:", error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  } finally {
    if (mainConnection) await mainConnection.end().catch(() => {});
    if (jogadoresConnection) await jogadoresConnection.end().catch(() => {});
  }
}
import PlayersList from './players-list';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

export const revalidate = 86400; 
export const dynamic = "force-dynamic";

const ITEMS_PER_PAGE = 20;

// Função para calcular a semelhança entre dois nomes (0.0 a 1.0)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = (str1 || '').toLowerCase().trim();
  const s2 = (str2 || '').toLowerCase().trim();
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

async function getPlayersData(mainConn: any, jogadoresConn: any, offset: number) {
  // Busca total para paginação
  const [totalResult]: any = await mainConn.query('SELECT COUNT(*) as count FROM players');
  const totalPlayers = totalResult[0].count;
  const totalPages = Math.ceil(totalPlayers / ITEMS_PER_PAGE);

  // Busca jogadores da página atual
  const [playersRows]: any = await mainConn.query(
    'SELECT id, nickname, avatar, faceit_guid, adicionados FROM players ORDER BY nickname ASC LIMIT ? OFFSET ?',
    [ITEMS_PER_PAGE, offset]
  );

  // Busca configurações de times e lista de jogadores cadastrados
  const [teamsRows]: any = await mainConn.query('SELECT * FROM team_config');
  const [jogadoresRows]: any = await jogadoresConn.query('SELECT * FROM jogadores');

  // Mapa para busca exata (mais rápida)
  const jogadoresMap = new Map(jogadoresRows.map((j: any) => [j.nick?.toLowerCase(), j]));

  const playersWithTeams = playersRows.map((player: any) => {
    // Tratamento para ID especial
    if (player.id === 0) {
      player.nickname = "-1";
      player.avatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSELngQdOTsSQXmSv9j1ltZDiGKXvSB8NJIsQ&s";
    }

    let jogador: any = jogadoresMap.get(player.nickname?.toLowerCase());

    if (!jogador) {
      let bestSim = 0;
      for (const j of jogadoresRows) {
        if (!j.nick) continue;
        const sim = calculateSimilarity(player.nickname, j.nick);
        if (sim > 0.7 && sim > bestSim) {
          bestSim = sim;
          jogador = j;
        }
      }
    }

    let teamName = null;
    let teamLogo = null;

    // 3. Se o jogador foi identificado, buscar o time dele
    if (jogador) {
      for (const team of teamsRows) {
        const rawNick = team.player_nick || '';
        const teamNick = rawNick.split(',').pop()?.trim() || '';
        
        // Encontrar o capitão/referência do time
        const captain = jogadoresRows.find((p: any) =>
          (p.nick || '').trim().toLowerCase() === teamNick.toLowerCase() ||
          String(p.id) === teamNick
        );

        if (captain && (captain.id === jogador.id || String(jogador.captain_id) === String(captain.id))) {
          teamName = team.team_name;
          teamLogo = team.team_image;
          break;
        }
      }
    }

    return { ...player, team_name: teamName, team_logo: teamLogo };
  });

  return { playersWithTeams, totalPages };
}

export default async function PlayersPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const currentPage = Number(searchParams?.page) || 1;
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  let mainConnection: any;
  let jogadoresConnection: any;
  let playersData = { playersWithTeams: [], totalPages: 0 };
  let lastUpdate = new Date().toISOString();

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as Env;

    mainConnection = await createMainConnection(env);
    jogadoresConnection = await createJogadoresConnection(env);

    // Consultas sequenciais para evitar erros de pool no Hyperdrive
    playersData = await getPlayersData(mainConnection, jogadoresConnection, offset);
    lastUpdate = await getLastUpdate(mainConnection);

  } catch (error: any) {
    console.error("Erro ao carregar dados:", error.message);
  } finally {
    if (mainConnection) await mainConnection.end().catch(() => {});
    if (jogadoresConnection) await jogadoresConnection.end().catch(() => {});
  }

  // Fallback caso o banco falhe
  if (!playersData.playersWithTeams || playersData.playersWithTeams.length === 0) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-gold mb-2">Erro de Conexão</h1>
          <p className="text-zinc-500">Não foi possível carregar a lista de jogadores no momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <PlayersList
        initialPlayers={playersData.playersWithTeams}
        totalPages={playersData.totalPages}
        currentPage={currentPage}
        lastUpdate={lastUpdate}
      />
    </div>
  );
}
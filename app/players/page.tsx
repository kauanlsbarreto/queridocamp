import PlayersList from './players-list';
import { createMainConnection } from '@/lib/db';
import { getDatabaseLastUpdate } from '@/lib/last-update';
import type { Env } from '@/lib/db';
import { getRuntimeEnv } from '@/lib/runtime-env';

export const dynamic = 'force-dynamic';

const ITEMS_PER_PAGE = 20;
const SPECIAL_ROLE_GUIDS = [
  '0124bfce-db9e-4d4f-b3f4-b66084a8a484',
  'fcb1b15c-f3d4-47d1-bd27-b478b7ada9ee',
];

function parseAdicionadosCodes(raw: any): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw.split(/[,;|\n]/).map((s: string) => s.trim()).filter(Boolean);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, '\\$&');
}

async function getPlayersData(mainConn: any, offset: number, search: string) {
  const sanitizedSearch = search.trim();
  const searchPattern = sanitizedSearch ? `%${escapeLike(sanitizedSearch)}%` : null;
  const numericSearch = /^\d+$/.test(sanitizedSearch) ? Number(sanitizedSearch) : null;
  const displayNameExpr = "COALESCE(NULLIF(nickname, ''), apelido)";
  const specialOrderClause = `CASE
      WHEN faceit_guid = '${SPECIAL_ROLE_GUIDS[0]}' THEN 0
      WHEN faceit_guid = '${SPECIAL_ROLE_GUIDS[1]}' THEN 1
      ELSE 2
    END`;

  const whereClause = searchPattern
    ? `WHERE (
        ${displayNameExpr} COLLATE utf8mb4_general_ci LIKE ? ESCAPE '\\\\'
        OR faceit_guid COLLATE utf8mb4_general_ci LIKE ? ESCAPE '\\\\'
        OR CAST(id AS CHAR) LIKE ? ESCAPE '\\\\'
        ${numericSearch !== null ? 'OR id = ?' : ''}
      )`
    : '';
  const whereParams = searchPattern
    ? (numericSearch !== null ? [searchPattern, searchPattern, searchPattern, numericSearch] : [searchPattern, searchPattern, searchPattern])
    : [];

  const [[countResult], [conquistaCounts], [adicionadosDetails], [codigosSistemaRows]] = await Promise.all([
    mainConn.query(
      `SELECT COUNT(*) as count FROM players ${whereClause}`,
      whereParams
    ),
    mainConn.query(
      'SELECT resgatado_por, tipo, nome FROM codigos_conquistas'
    ),
    mainConn.query('SELECT codigo, imagem, label FROM adicionados'),
    mainConn.query('SELECT tipo, nome FROM codigos_sistema ORDER BY id DESC'),
  ]) as any;

  const totalPlayers = countResult[0].count;
  const totalPages = Math.ceil(totalPlayers / ITEMS_PER_PAGE);

  const [playersRows]: any = await mainConn.query(
    `SELECT id, ${displayNameExpr} AS nickname, avatar, faceit_guid, adicionados, punicao, fundoperfil
     FROM players
     ${whereClause}
     ORDER BY ${specialOrderClause}, ${displayNameExpr} ASC
     LIMIT ? OFFSET ?`,
    [...whereParams, ITEMS_PER_PAGE, offset]
  );

  const adicionadosMap = new Map<string, any>(
    adicionadosDetails.map((a: any) => [String(a.codigo).trim(), a])
  );

  const conquistasByPlayer = new Map<string, { tipo: string; count: number }[]>();
  for (const row of conquistaCounts) {
    const pid = String(row.resgatado_por);
    // Mirror the same logic PerfilClient uses: nome starting with VICE → vice
    const nome = String(row.nome || '').toUpperCase();
    const rawTipo = String(row.tipo || '').toUpperCase();
    let displayTipo: string;
    if (nome.startsWith('VICE') || rawTipo === 'VICE') {
      displayTipo = 'VICE CAMPEÃO';
    } else if (['CAMPEAO', 'CAMPEÃO', 'CAMPEONATO', 'CAMPEÃO'].includes(rawTipo) || (!nome.startsWith('VICE') && rawTipo.includes('CAMP'))) {
      displayTipo = 'CAMPEÃO';
    } else {
      displayTipo = rawTipo || 'CONQUISTA';
    }
    if (!conquistasByPlayer.has(pid)) conquistasByPlayer.set(pid, []);
    const existing = conquistasByPlayer.get(pid)!.find(e => e.tipo === displayTipo);
    if (existing) existing.count++;
    else conquistasByPlayer.get(pid)!.push({ tipo: displayTipo, count: 1 });
  }

  // Fetch FACEIT levels for all players with faceit_guid
  const faceitLevelMap = new Map<string, { faceit_level: number; is_challenger: boolean }>();
  const faceitApiKey = '7b080715-fe0b-461d-a1f1-62cfd0c47e63';
  
  for (const player of playersRows) {
    if (player.faceit_guid && String(player.id) !== '0') {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        
        const res = await fetch(`https://open.faceit.com/data/v4/players/${player.faceit_guid}`, {
          headers: { 'Authorization': `Bearer ${faceitApiKey}` },
          signal: controller.signal
        });
        clearTimeout(timeout);
        
        if (res.ok) {
          const data = await res.json();
          const level = data.games?.cs2?.skill_level || 1;
          let isChallenger = false;
          
          if (level === 10 && data.games?.cs2?.region) {
            try {
              const rankController = new AbortController();
              const rankTimeout = setTimeout(() => rankController.abort(), 2000);
              
              const rankRes = await fetch(
                `https://open.faceit.com/data/v4/rankings/games/cs2/regions/${data.games.cs2.region}/players/${player.faceit_guid}`,
                { headers: { 'Authorization': `Bearer ${faceitApiKey}` }, signal: rankController.signal }
              );
              clearTimeout(rankTimeout);
              
              if (rankRes.ok) {
                const rankData = await rankRes.json();
                isChallenger = rankData.position && rankData.position <= 1000;
              }
            } catch (e) {
              // Ignore rank fetch errors
            }
          }
          
          faceitLevelMap.set(String(player.faceit_guid), { faceit_level: level, is_challenger: isChallenger });
        }
      } catch (e) {
        // Ignore fetch errors
      }
    }
  }

  const playersWithTeams = playersRows.map((player: any) => {
    const isIdZero = String(player.id) === '0';
    const faceitData = faceitLevelMap.get(String(player.faceit_guid)) || { faceit_level: 1, is_challenger: false };

    if (isIdZero) {
      const specialAchievements = new Map<string, number>();
      for (const row of codigosSistemaRows as any[]) {
        const nome = String(row.nome || '').toUpperCase();
        const rawTipo = String(row.tipo || '').toUpperCase();
        let displayTipo: string;
        if (nome.startsWith('VICE') || rawTipo === 'VICE') {
          displayTipo = 'VICE CAMPEÃO';
        } else if (['CAMPEAO', 'CAMPEÃO', 'CAMPEONATO'].includes(rawTipo) || (!nome.startsWith('VICE') && rawTipo.includes('CAMP'))) {
          displayTipo = 'CAMPEÃO';
        } else {
          displayTipo = rawTipo || 'CONQUISTA';
        }
        specialAchievements.set(displayTipo, (specialAchievements.get(displayTipo) || 0) + 1);
      }

      return {
        id: player.id,
        nickname: player.nickname,
        avatar: player.avatar,
        faceit_guid: player.faceit_guid,
        fundoperfil: player.fundoperfil,
        achievements: Array.from(specialAchievements.entries()).map(([tipo, count]) => ({ tipo, count })),
        playerAdicionados: [],
        punicao: player.punicao ? Number(player.punicao) : 0,
        faceit_level: -1,
        is_challenger: false,
      };
    }

    const codes = parseAdicionadosCodes(player.adicionados);
    const playerAdicionados = codes
      .map((code: string) => adicionadosMap.get(code))
      .filter(Boolean)
      .map((a: any) => ({ codigo: a.codigo, label: a.label || a.codigo, imagem: a.imagem }));

    return {
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      faceit_guid: player.faceit_guid,
      fundoperfil: player.fundoperfil,
      achievements: conquistasByPlayer.get(String(player.id)) || [],
      playerAdicionados,
      punicao: player.punicao ? Number(player.punicao) : 0,
      faceit_level: faceitData.faceit_level,
      is_challenger: faceitData.is_challenger,
    };
  });

  return { playersWithTeams, totalPages };
}

export default async function PlayersPage(props: { searchParams: Promise<{ page?: string; search?: string }> }) {
  const searchParams = await props.searchParams;
  const search = (searchParams?.search || '').trim();
  const currentPage = search ? 1 : (Number(searchParams?.page) || 1);
  const offset = (currentPage - 1) * ITEMS_PER_PAGE;

  let mainConnection: any;
  let playersData = { playersWithTeams: [], totalPages: 0 };
  let lastUpdate = new Date().toISOString();

  try {
    const env = await getRuntimeEnv() as Env;

    mainConnection = await createMainConnection(env);
    (mainConnection as any).setPage('/players');

    playersData = await getPlayersData(mainConnection, offset, search);
    lastUpdate = await getDatabaseLastUpdate(mainConnection);

  } catch (error: any) {
    console.error("Erro ao carregar dados:", error.message);
  } finally {
    if (mainConnection) await mainConnection.end().catch(() => {});
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <PlayersList
        initialPlayers={playersData.playersWithTeams}
        totalPages={playersData.totalPages}
        currentPage={currentPage}
        lastUpdate={lastUpdate}
        search={search}
      />
    </div>
  );
}
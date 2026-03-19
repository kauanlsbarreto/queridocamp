import PlayersList from './players-list';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';
import { getDatabaseLastUpdate } from '@/lib/last-update';
import type { Env } from '@/lib/db';

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

async function getPlayersData(mainConn: any, offset: number, search: string) {
  const searchPattern = search ? `%${search}%` : null;
  const displayNameExpr = "COALESCE(NULLIF(nickname, ''), apelido)";
  const specialOrderClause = `CASE
      WHEN faceit_guid = '${SPECIAL_ROLE_GUIDS[0]}' THEN 0
      WHEN faceit_guid = '${SPECIAL_ROLE_GUIDS[1]}' THEN 1
      ELSE 2
    END`;

  const [[countResult], [conquistaCounts], [adicionadosDetails], [codigosSistemaRows]] = await Promise.all([
    mainConn.query(
      searchPattern
        ? `SELECT COUNT(*) as count FROM players WHERE ${displayNameExpr} LIKE ?`
        : 'SELECT COUNT(*) as count FROM players',
      searchPattern ? [searchPattern] : []
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
    searchPattern
      ? `SELECT id, ${displayNameExpr} AS nickname, avatar, faceit_guid, adicionados FROM players WHERE ${displayNameExpr} LIKE ? ORDER BY ${specialOrderClause}, ${displayNameExpr} ASC LIMIT ? OFFSET ?`
      : `SELECT id, ${displayNameExpr} AS nickname, avatar, faceit_guid, adicionados FROM players ORDER BY ${specialOrderClause}, ${displayNameExpr} ASC LIMIT ? OFFSET ?`,
    searchPattern ? [searchPattern, ITEMS_PER_PAGE, offset] : [ITEMS_PER_PAGE, offset]
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

  const playersWithTeams = playersRows.map((player: any) => {
    const isIdZero = String(player.id) === '0';

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
        achievements: Array.from(specialAchievements.entries()).map(([tipo, count]) => ({ tipo, count })),
        playerAdicionados: [],
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
      achievements: conquistasByPlayer.get(String(player.id)) || [],
      playerAdicionados,
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
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as Env;

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
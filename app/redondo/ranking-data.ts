import { createJogadoresConnection, Env } from '@/lib/db';

const WITHDRAWN_TEAMS = ["NeshaStore", "Alfajor Solucoes", "Alfajor Soluções"];
const EXCLUDED_RANKING_NICKNAMES = new Set(["0588KSh4y-_-", "ADMIN"]);

export type AdminReference = {
  semiTeams: string[];
  finalTeams: string[];
  winner: string;
};

export type RankingEntry = {
  rank: number;
  nickname: string;
  avatar: string;
  quarterHits: number;
  semiHits: number;
  finalHits: number;
  winnerHit: boolean;
  totalHits: number;
  isLeader: boolean;
};

export function normalizeTeamName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function parsePickValue(value: any) {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function countPhaseHits(row: any, prefix: string, size: number, validTeams: Set<string>) {
  let hits = 0;

  for (let index = 1; index <= size; index++) {
    const team = parsePickValue(row[`${prefix}_${index}`]);
    const teamName = normalizeTeamName(team?.team_name);
    if (teamName && validTeams.has(teamName)) hits++;
  }

  return hits;
}

function hasAllQuarterPicks(row: any) {
  for (let index = 1; index <= 8; index++) {
    const team = parsePickValue(row[`slot_${index}`]);
    if (!team?.team_name) return false;
  }

  return true;
}

export async function ensureTableExists(connection: any) {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS escolhas (
        nickname VARCHAR(255) PRIMARY KEY,
        faceit_guid VARCHAR(255),
        slot_1 JSON,
        slot_2 JSON,
        slot_3 JSON,
        slot_4 JSON,
        slot_5 JSON,
        slot_6 JSON,
        slot_7 JSON,
        slot_8 JSON,
        locked BOOLEAN DEFAULT FALSE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    await connection.query(createTableQuery);

    const additionalColumns = [
      "semi_1 JSON", "semi_2 JSON", "semi_3 JSON", "semi_4 JSON",
      "final_1 JSON", "final_2 JSON",
      "semi_locked BOOLEAN DEFAULT FALSE",
      "final_locked BOOLEAN DEFAULT FALSE",
      "winner_1 JSON",
      "winner_locked BOOLEAN DEFAULT FALSE"
    ];

    for (const col of additionalColumns) {
      try {
        await connection.query(`ALTER TABLE escolhas ADD COLUMN ${col}`);
      } catch {}
    }
  } catch (error) {
    console.error("Erro ao criar tabela:", error);
  }
}

export async function getTop8Teams(connection: any): Promise<string[]> {
  try {
    const [rows]: any = await connection.query(
      'SELECT team_name, sp, df FROM team_config'
    );

    const withdrawnSet = new Set(WITHDRAWN_TEAMS.map(normalizeTeamName));

    return rows
      .filter((row: any) => !withdrawnSet.has(normalizeTeamName(row.team_name)))
      .sort((a: any, b: any) => {
        const spDiff = Number(b.sp || 0) - Number(a.sp || 0);
        if (spDiff !== 0) return spDiff;
        return Number(b.df || 0) - Number(a.df || 0);
      })
      .slice(0, 8)
      .map((r: any) => r.team_name as string);
  } catch (error) {
    console.error("Erro ao buscar top 8:", error);
    return [];
  }
}

export async function getAdminReferencePicks(connection: any): Promise<AdminReference> {
  try {
    const [rows]: any = await connection.query(
      `SELECT semi_1, semi_2, semi_3, semi_4, final_1, final_2, winner_1
       FROM escolhas
       WHERE nickname = 'ADMIN'
       LIMIT 1`
    );

    const adminRow = rows[0] || {};
    const parseTeam = (value: any) => {
      if (!value) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return value;
    };

    const semiTeams = [adminRow.semi_1, adminRow.semi_2, adminRow.semi_3, adminRow.semi_4]
      .map(parseTeam)
      .filter(Boolean)
      .map((team: any) => team.team_name as string);

    const finalTeams = [adminRow.final_1, adminRow.final_2]
      .map(parseTeam)
      .filter(Boolean)
      .map((team: any) => team.team_name as string);

    const winnerTeam = parseTeam(adminRow.winner_1);

    return {
      semiTeams,
      finalTeams,
      winner: winnerTeam?.team_name || ''
    };
  } catch (error) {
    console.error("Erro ao buscar picks de referência do ADMIN:", error);
    return {
      semiTeams: [],
      finalTeams: [],
      winner: ''
    };
  }
}

export async function getAccuracyRanking(connection: any, env: Env, top8Teams: string[], adminReference: AdminReference): Promise<RankingEntry[]> {
  try {
    const [rows]: any = await connection.query(
      `SELECT nickname, faceit_guid, updated_at,
              slot_1, slot_2, slot_3, slot_4, slot_5, slot_6, slot_7, slot_8,
              semi_1, semi_2, semi_3, semi_4,
              final_1, final_2,
              winner_1
       FROM escolhas
       ORDER BY updated_at ASC`
    );

    const eligibleRows = rows.filter((row: any) => {
      const nickname = String(row.nickname || '');
      if (EXCLUDED_RANKING_NICKNAMES.has(nickname)) return false;
      return hasAllQuarterPicks(row);
    });
    if (eligibleRows.length === 0) return [];

    const nicknames = eligibleRows.map((row: any) => String(row.nickname || '')).filter(Boolean);
    const faceitGuids = eligibleRows.map((row: any) => String(row.faceit_guid || '')).filter(Boolean);

    const avatarByNickname = new Map<string, string>();
    const avatarByGuid = new Map<string, string>();

    if (nicknames.length > 0) {
      const [playerRows]: any = await connection.query(
        'SELECT nickname, faceit_guid, avatar FROM players WHERE nickname IN (?)',
        [nicknames]
      );

      for (const player of playerRows as any[]) {
        const avatar = String(player.avatar || '').trim();
        const nickname = String(player.nickname || '').trim();
        const guid = String(player.faceit_guid || '').trim();

        if (avatar && nickname) avatarByNickname.set(nickname.toLowerCase(), avatar);
        if (avatar && guid) avatarByGuid.set(guid, avatar);
      }
    }

    let jogadoresConnection: any = null;

    try {
      jogadoresConnection = await createJogadoresConnection(env);

      if (faceitGuids.length > 0) {
        const [faceitRowsByGuid]: any = await jogadoresConnection.query(
          'SELECT faceit_guid, faceit_nickname, fotoperfil FROM faceit_players WHERE faceit_guid IN (?)',
          [faceitGuids]
        );

        for (const player of faceitRowsByGuid as any[]) {
          const avatar = String(player.fotoperfil || '').trim();
          const nickname = String(player.faceit_nickname || '').trim();
          const guid = String(player.faceit_guid || '').trim();

          if (avatar && guid && !avatarByGuid.has(guid)) avatarByGuid.set(guid, avatar);
          if (avatar && nickname && !avatarByNickname.has(nickname.toLowerCase())) {
            avatarByNickname.set(nickname.toLowerCase(), avatar);
          }
        }
      }

      if (nicknames.length > 0) {
        const [faceitRowsByNickname]: any = await jogadoresConnection.query(
          'SELECT faceit_guid, faceit_nickname, fotoperfil FROM faceit_players WHERE faceit_nickname IN (?)',
          [nicknames]
        );

        for (const player of faceitRowsByNickname as any[]) {
          const avatar = String(player.fotoperfil || '').trim();
          const nickname = String(player.faceit_nickname || '').trim();
          const guid = String(player.faceit_guid || '').trim();

          if (avatar && nickname && !avatarByNickname.has(nickname.toLowerCase())) {
            avatarByNickname.set(nickname.toLowerCase(), avatar);
          }
          if (avatar && guid && !avatarByGuid.has(guid)) avatarByGuid.set(guid, avatar);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar avatares do ranking:', error);
    } finally {
      if (jogadoresConnection) await jogadoresConnection.end();
    }

    const top8Set = new Set(top8Teams.map(normalizeTeamName));
    const topSemiSet = new Set(adminReference.semiTeams.map(normalizeTeamName));
    const topFinalSet = new Set(adminReference.finalTeams.map(normalizeTeamName));
    const normalizedWinner = normalizeTeamName(adminReference.winner);

    return eligibleRows
      .map((row: any) => {
        const quarterHits = countPhaseHits(row, 'slot', 8, top8Set);
        const semiHits = countPhaseHits(row, 'semi', 4, topSemiSet);
        const finalHits = countPhaseHits(row, 'final', 2, topFinalSet);
        const winnerTeam = parsePickValue(row.winner_1);
        const winnerHit = Boolean(normalizedWinner && normalizeTeamName(winnerTeam?.team_name) === normalizedWinner);
        const totalHits = quarterHits + semiHits + finalHits + (winnerHit ? 1 : 0);
        const nickname = String(row.nickname || '');
        const guid = String(row.faceit_guid || '');

        return {
          nickname,
          avatar:
            avatarByGuid.get(guid) ||
            avatarByNickname.get(nickname.toLowerCase()) ||
            '/images/cs2-player.png',
          quarterHits,
          semiHits,
          finalHits,
          winnerHit,
          totalHits,
          updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Number.MAX_SAFE_INTEGER,
        };
      })
      .sort((left: any, right: any) => {
        if (right.totalHits !== left.totalHits) return right.totalHits - left.totalHits;
        if (Number(right.winnerHit) !== Number(left.winnerHit)) return Number(right.winnerHit) - Number(left.winnerHit);
        if (right.finalHits !== left.finalHits) return right.finalHits - left.finalHits;
        if (right.semiHits !== left.semiHits) return right.semiHits - left.semiHits;
        if (right.quarterHits !== left.quarterHits) return right.quarterHits - left.quarterHits;
        if (left.updatedAt !== right.updatedAt) return left.updatedAt - right.updatedAt;
        return left.nickname.localeCompare(right.nickname, 'pt-BR');
      })
      .map((entry: any, index: number) => ({
        rank: index + 1,
        nickname: entry.nickname,
        avatar: entry.avatar,
        quarterHits: entry.quarterHits,
        semiHits: entry.semiHits,
        finalHits: entry.finalHits,
        winnerHit: entry.winnerHit,
        totalHits: entry.totalHits,
        isLeader: index === 0,
      }));
  } catch (error) {
    console.error('Erro ao buscar ranking de acertos:', error);
    return [];
  }
}
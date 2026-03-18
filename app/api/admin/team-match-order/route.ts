import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

let ordemStatsSchemaReadyPromise: Promise<void> | null = null;

type PlayerInput = {
  nickname?: string;
  player_id?: string;
};

type TimelineMatchInput = {
  matchId?: string | number;
  players?: PlayerInput[];
};

function normalizeText(value: string | null | undefined) {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getPlayerKeys(player: PlayerInput) {
  const keys = new Set<string>();
  const guid = String(player?.player_id || '').trim();
  const nick = normalizeText(player?.nickname || '');

  if (guid) keys.add(`id:${guid}`);
  if (nick) keys.add(`nick:${nick}`);

  return keys;
}

function getParticipationByMatchId(matchesTimeline: TimelineMatchInput[], player: PlayerInput) {
  const result = new Map<string, number>();
  const playerKeys = getPlayerKeys(player);
  if (!playerKeys.size) return result;

  let participationIndex = 0;

  for (const match of matchesTimeline || []) {
    const currentMatchId = String(match?.matchId || '').trim();
    if (!currentMatchId) continue;

    const participants = match?.players || [];
    const hasPlayed = participants.some((p) => {
      const keys = getPlayerKeys(p || {});
      return Array.from(keys).some((k) => playerKeys.has(k));
    });

    if (!hasPlayed) continue;

    participationIndex += 1;
    result.set(currentMatchId, participationIndex);
  }

  return result;
}

function buildRoundSequenceFromPlayerRow(
  row: any,
  targetRound: number,
  targetMatchId: string,
  participationByMatchId?: Map<string, number>
) {
  const roundValues = Array.from({ length: 17 }, () => 0);
  const matchIdValues = Array.from({ length: 17 }, () => null as string | null);

  for (let i = 1; i <= 17; i++) {
    const idx = i - 1;
    const currentMatchId = String(row?.[`matchid${i}`] || '').trim();

    if (!currentMatchId) continue;
    if (currentMatchId === targetMatchId && i !== targetRound) continue;
    if (i === targetRound) continue;

    matchIdValues[idx] = currentMatchId;
  }

  matchIdValues[targetRound - 1] = targetMatchId;

  const occupiedRounds: number[] = [];
  for (let i = 1; i <= 17; i++) {
    if (matchIdValues[i - 1]) occupiedRounds.push(i);
  }

  occupiedRounds.sort((a, b) => a - b);
  let fallbackIndex = 1;

  for (const roundNumber of occupiedRounds) {
    const matchId = String(matchIdValues[roundNumber - 1] || '').trim();
    const mappedOrder = matchId ? Number(participationByMatchId?.get(matchId) || 0) : 0;

    if (mappedOrder > 0) {
      roundValues[roundNumber - 1] = mappedOrder;
    } else {
      roundValues[roundNumber - 1] = fallbackIndex;
    }

    fallbackIndex += 1;
  }

  return { roundValues, matchIdValues };
}

function removeMatchFromPlayerRow(
  row: any,
  targetMatchId: string,
  participationByMatchId?: Map<string, number>
) {
  const roundValues = Array.from({ length: 17 }, () => 0);
  const matchIdValues = Array.from({ length: 17 }, () => null as string | null);

  for (let i = 1; i <= 17; i++) {
    const idx = i - 1;
    const currentMatchId = String(row?.[`matchid${i}`] || '').trim();
    if (!currentMatchId) continue;
    if (currentMatchId === targetMatchId) continue;
    matchIdValues[idx] = currentMatchId;
  }

  const occupiedRounds: number[] = [];
  for (let i = 1; i <= 17; i++) {
    if (matchIdValues[i - 1]) occupiedRounds.push(i);
  }

  occupiedRounds.sort((a, b) => a - b);
  let fallbackIndex = 1;

  for (const roundNumber of occupiedRounds) {
    const matchId = String(matchIdValues[roundNumber - 1] || '').trim();
    const mappedOrder = matchId ? Number(participationByMatchId?.get(matchId) || 0) : 0;

    if (mappedOrder > 0) {
      roundValues[roundNumber - 1] = mappedOrder;
    } else {
      roundValues[roundNumber - 1] = fallbackIndex;
    }

    fallbackIndex += 1;
  }

  return { roundValues, matchIdValues };
}

async function ensureAdminAccess(connection: any, faceitGuid: string, authHeader: string | null) {
  const isLocalDev = authHeader === 'Bearer local-dev-token';
  if (isLocalDev) return true;

  const [adminRows]: any = await connection.query(
    'SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1',
    [faceitGuid]
  );

  if (!adminRows.length || (adminRows[0].admin !== 1 && adminRows[0].admin !== 2)) {
    return false;
  }

  return true;
}

async function ensureOrdemStatsSchema(connection: any) {
  if (!ordemStatsSchemaReadyPromise) {
    ordemStatsSchemaReadyPromise = (async () => {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS ordem_stats (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nickname VARCHAR(255) NOT NULL,
          nome_do_time VARCHAR(255) NOT NULL,
          matchid VARCHAR(255) NOT NULL,
          rodada1 INT DEFAULT 0,
          rodada2 INT DEFAULT 0,
          rodada3 INT DEFAULT 0,
          rodada4 INT DEFAULT 0,
          rodada5 INT DEFAULT 0,
          rodada6 INT DEFAULT 0,
          rodada7 INT DEFAULT 0,
          rodada8 INT DEFAULT 0,
          rodada9 INT DEFAULT 0,
          rodada10 INT DEFAULT 0,
          rodada11 INT DEFAULT 0,
          rodada12 INT DEFAULT 0,
          rodada13 INT DEFAULT 0,
          rodada14 INT DEFAULT 0,
          rodada15 INT DEFAULT 0,
          rodada16 INT DEFAULT 0,
          rodada17 INT DEFAULT 0,
          matchid1 VARCHAR(255) DEFAULT NULL,
          matchid2 VARCHAR(255) DEFAULT NULL,
          matchid3 VARCHAR(255) DEFAULT NULL,
          matchid4 VARCHAR(255) DEFAULT NULL,
          matchid5 VARCHAR(255) DEFAULT NULL,
          matchid6 VARCHAR(255) DEFAULT NULL,
          matchid7 VARCHAR(255) DEFAULT NULL,
          matchid8 VARCHAR(255) DEFAULT NULL,
          matchid9 VARCHAR(255) DEFAULT NULL,
          matchid10 VARCHAR(255) DEFAULT NULL,
          matchid11 VARCHAR(255) DEFAULT NULL,
          matchid12 VARCHAR(255) DEFAULT NULL,
          matchid13 VARCHAR(255) DEFAULT NULL,
          matchid14 VARCHAR(255) DEFAULT NULL,
          matchid15 VARCHAR(255) DEFAULT NULL,
          matchid16 VARCHAR(255) DEFAULT NULL,
          matchid17 VARCHAR(255) DEFAULT NULL,
          UNIQUE KEY uniq_nickname_time (nickname, nome_do_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Existing environments may already have INT columns; migrate to VARCHAR for Faceit IDs.
      await connection.query('ALTER TABLE ordem_stats MODIFY COLUMN matchid VARCHAR(255) NOT NULL');

      for (let i = 1; i <= 17; i++) {
        const col = `matchid${i}`;
        try {
          await connection.query(`ALTER TABLE ordem_stats ADD COLUMN ${col} VARCHAR(255) DEFAULT NULL`);
        } catch (_error) {
          // Ignore when column already exists.
        }
        await connection.query(`ALTER TABLE ordem_stats MODIFY COLUMN ${col} VARCHAR(255) DEFAULT NULL`);
      }
    })();
  }

  try {
    await ordemStatsSchemaReadyPromise;
  } catch (error) {
    ordemStatsSchemaReadyPromise = null;
    throw error;
  }
}

export async function GET(request: Request) {
  let connection: any;

  try {
    const url = new URL(request.url);
    const teamName = (url.searchParams.get('teamName') || '').trim();
    const faceitGuid = (url.searchParams.get('faceit_guid') || '').trim();
    const authHeader = request.headers.get('Authorization');

    if (!teamName) {
      return NextResponse.json({ message: 'teamName ausente.' }, { status: 400 });
    }

    if (!faceitGuid) {
      return NextResponse.json({ message: 'faceit_guid ausente.' }, { status: 400 });
    }

    const ctx = await getCloudflareContext({ async: true });
    connection = await createMainConnection(ctx.env as any);

    const allowed = await ensureAdminAccess(connection, faceitGuid, authHeader);
    if (!allowed) {
      return NextResponse.json({ message: 'Sem permissao.' }, { status: 403 });
    }

    await ensureOrdemStatsSchema(connection);

    const [rows]: any = await connection.query(
      'SELECT * FROM ordem_stats WHERE nome_do_time = ?',
      [teamName]
    );

    const usedRounds: Record<string, { matchOrder: number; matchId: string }> = {};

    for (const row of rows || []) {
      for (let i = 1; i <= 17; i++) {
        const rodadaValue = Number(row[`rodada${i}`] || 0);
        if (rodadaValue <= 0) continue;

        if (!usedRounds[String(i)]) {
          const mid = row[`matchid${i}`] || row.matchid || '';
          usedRounds[String(i)] = {
            matchOrder: rodadaValue,
            matchId: String(mid),
          };
        }
      }
    }

    return NextResponse.json({ success: true, usedRounds });
  } catch (error) {
    console.error('Erro ao buscar ordem de rodada:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  } finally {
    if (connection) await connection.end().catch(console.error);
  }
}

export async function POST(request: Request) {
  let connection: any;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      faceit_guid,
      teamName,
      matchId,
      matchOrder,
      roundNumber,
      players,
      matchesTimeline,
    } = body as {
      faceit_guid?: string;
      teamName?: string;
      matchId?: string | number;
      matchOrder?: number;
      roundNumber?: number;
      players?: PlayerInput[];
      matchesTimeline?: TimelineMatchInput[];
    };

    const round = Number(roundNumber);
    const order = Number(matchOrder);

    if (!faceit_guid) {
      return NextResponse.json({ message: 'faceit_guid ausente.' }, { status: 400 });
    }

    if (!teamName || typeof teamName !== 'string') {
      return NextResponse.json({ message: 'Nome do time ausente.' }, { status: 400 });
    }

    if (!matchId && matchId !== 0) {
      return NextResponse.json({ message: 'matchId ausente.' }, { status: 400 });
    }

    if (!Number.isInteger(order) || order <= 0) {
      return NextResponse.json({ message: 'matchOrder invalido.' }, { status: 400 });
    }

    if (!Number.isInteger(round) || round < 1 || round > 17) {
      return NextResponse.json({ message: 'Rodada invalida. Use 1 ate 17.' }, { status: 400 });
    }

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ message: 'Lista de jogadores vazia.' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');

    const ctx = await getCloudflareContext({ async: true });
    connection = await createMainConnection(ctx.env as any);

    const allowed = await ensureAdminAccess(connection, faceit_guid, authHeader);
    if (!allowed) {
      return NextResponse.json({ message: 'Sem permissao.' }, { status: 403 });
    }

    const rodadaColumn = `rodada${round}`;
    const matchIdColumn = `matchid${round}`;
    const safeMatchId = String(matchId);

    await ensureOrdemStatsSchema(connection);

    const updatedPlayers: string[] = [];
    const timeline = Array.isArray(matchesTimeline) ? matchesTimeline : [];

    for (let i = 0; i < players.length; i++) {
      const player = players[i] || {};
      const rawNickname = (player.nickname || '').trim();
      const nickname = rawNickname || String(player.player_id || `unknown_${i + 1}`);
      const participationByMatchId = getParticipationByMatchId(timeline, player);
      const currentPlayerOrder = Number(participationByMatchId.get(safeMatchId) || 0) || 1;

      const [existingRows]: any = await connection.query(
        `
          SELECT *
          FROM ordem_stats
          WHERE LOWER(TRIM(nickname)) = LOWER(TRIM(?))
            AND LOWER(TRIM(nome_do_time)) = LOWER(TRIM(?))
          ORDER BY id ASC
          LIMIT 1
        `,
        [nickname, teamName]
      );

      let canonicalId: number;

      if (existingRows.length > 0) {
        const currentRow = existingRows[0];
        const { roundValues, matchIdValues } = buildRoundSequenceFromPlayerRow(
          currentRow,
          round,
          safeMatchId,
          participationByMatchId
        );

        const rodadaAssignments: string[] = [];
        const matchIdAssignments: string[] = [];
        const updateParams: any[] = [nickname, teamName, safeMatchId];

        for (let r = 1; r <= 17; r++) {
          rodadaAssignments.push(`rodada${r} = ?`);
          updateParams.push(roundValues[r - 1]);
        }

        for (let r = 1; r <= 17; r++) {
          matchIdAssignments.push(`matchid${r} = ?`);
          updateParams.push(matchIdValues[r - 1]);
        }

        updateParams.push(currentRow.id);

        await connection.query(
          `
            UPDATE ordem_stats
            SET
              nickname = ?,
              nome_do_time = ?,
              matchid = ?,
              ${rodadaAssignments.join(', ')},
              ${matchIdAssignments.join(', ')}
            WHERE id = ?
          `,
          updateParams
        );
        canonicalId = Number(currentRow.id);
      } else {
        const [insertResult]: any = await connection.query(
          `
            INSERT INTO ordem_stats (
              nickname,
              nome_do_time,
              matchid,
              ${rodadaColumn},
              ${matchIdColumn}
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [nickname, teamName, safeMatchId, currentPlayerOrder, safeMatchId]
        );
        canonicalId = Number(insertResult.insertId);
      }

      await connection.query(
        `
          DELETE FROM ordem_stats
          WHERE LOWER(TRIM(nickname)) = LOWER(TRIM(?))
            AND LOWER(TRIM(nome_do_time)) = LOWER(TRIM(?))
            AND id <> ?
        `,
        [nickname, teamName, canonicalId]
      );

      updatedPlayers.push(nickname);
    }

    return NextResponse.json({
      success: true,
      round,
      matchOrder: order,
      matchId: safeMatchId,
      teamName,
      updatedPlayers,
    });
  } catch (error) {
    console.error('Erro ao salvar ordem de rodada:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  } finally {
    if (connection) await connection.end().catch(console.error);
  }
}

export async function DELETE(request: Request) {
  let connection: any;

  try {
    const body = await request.json().catch(() => ({}));
    const {
      faceit_guid,
      teamName,
      matchId,
      players,
      matchesTimeline,
    } = body as {
      faceit_guid?: string;
      teamName?: string;
      matchId?: string | number;
      players?: PlayerInput[];
      matchesTimeline?: TimelineMatchInput[];
    };

    if (!faceit_guid) {
      return NextResponse.json({ message: 'faceit_guid ausente.' }, { status: 400 });
    }

    if (!teamName || typeof teamName !== 'string') {
      return NextResponse.json({ message: 'Nome do time ausente.' }, { status: 400 });
    }

    if (!matchId && matchId !== 0) {
      return NextResponse.json({ message: 'matchId ausente.' }, { status: 400 });
    }

    if (!Array.isArray(players) || players.length === 0) {
      return NextResponse.json({ message: 'Lista de jogadores vazia.' }, { status: 400 });
    }

    const authHeader = request.headers.get('Authorization');

    const ctx = await getCloudflareContext({ async: true });
    connection = await createMainConnection(ctx.env as any);

    const allowed = await ensureAdminAccess(connection, faceit_guid, authHeader);
    if (!allowed) {
      return NextResponse.json({ message: 'Sem permissao.' }, { status: 403 });
    }

    await ensureOrdemStatsSchema(connection);

    const safeMatchId = String(matchId);
    const timeline = Array.isArray(matchesTimeline) ? matchesTimeline : [];
    const updatedPlayers: string[] = [];

    for (let i = 0; i < players.length; i++) {
      const player = players[i] || {};
      const rawNickname = (player.nickname || '').trim();
      const nickname = rawNickname || String(player.player_id || `unknown_${i + 1}`);
      const participationByMatchId = getParticipationByMatchId(timeline, player);

      const [existingRows]: any = await connection.query(
        `
          SELECT *
          FROM ordem_stats
          WHERE LOWER(TRIM(nickname)) = LOWER(TRIM(?))
            AND LOWER(TRIM(nome_do_time)) = LOWER(TRIM(?))
          ORDER BY id ASC
          LIMIT 1
        `,
        [nickname, teamName]
      );

      if (!existingRows.length) {
        continue;
      }

      const currentRow = existingRows[0];
      const { roundValues, matchIdValues } = removeMatchFromPlayerRow(
        currentRow,
        safeMatchId,
        participationByMatchId
      );

      const rodadaAssignments: string[] = [];
      const matchIdAssignments: string[] = [];
      const updateParams: any[] = [nickname, teamName, safeMatchId];

      for (let r = 1; r <= 17; r++) {
        rodadaAssignments.push(`rodada${r} = ?`);
        updateParams.push(roundValues[r - 1]);
      }

      for (let r = 1; r <= 17; r++) {
        matchIdAssignments.push(`matchid${r} = ?`);
        updateParams.push(matchIdValues[r - 1]);
      }

      updateParams.push(currentRow.id);

      await connection.query(
        `
          UPDATE ordem_stats
          SET
            nickname = ?,
            nome_do_time = ?,
            matchid = ?,
            ${rodadaAssignments.join(', ')},
            ${matchIdAssignments.join(', ')}
          WHERE id = ?
        `,
        updateParams
      );

      updatedPlayers.push(nickname);
    }

    return NextResponse.json({
      success: true,
      matchId: safeMatchId,
      teamName,
      updatedPlayers,
    });
  } catch (error) {
    console.error('Erro ao resetar ordem de rodada:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ message: errorMessage }, { status: 500 });
  } finally {
    if (connection) await connection.end().catch(console.error);
  }
}

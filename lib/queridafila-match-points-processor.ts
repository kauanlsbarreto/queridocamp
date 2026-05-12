import { createMainConnection } from "@/lib/db";
import {
  calculateQueridaFilaPoints,
  type QueridaFilaPointsProjection,
} from "@/lib/queridafila-points";

export const TARGET_QUEUE_ID = "c23c971b-677a-4046-8203-26023e283529";
const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FALLBACK_FACEIT_API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
export const POINTS_START_DATE_UNIX = Math.floor(new Date("2026-04-06T00:00:00-03:00").getTime() / 1000);
const DISCORD_POINTS_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1490235360607998002/REUAB4jB7nFAiu-M3yQKKyxzNUFWWEN5wdez4jpm0AoWRuXmYG7tuxq3bLhsbcaFpWny";

type MatchDetails = {
  match_id: string;
  competition_id?: string;
  status?: string;
  started_at?: number;
  finished_at?: number;
  faceit_url?: string;
  teams?: {
    faction1?: {
      faction_id?: string;
      roster?: Array<{ player_id: string; nickname: string }>;
    };
    faction2?: {
      faction_id?: string;
      roster?: Array<{ player_id: string; nickname: string }>;
    };
  };
  results?: {
    winner?: string;
    score?: {
      faction1?: number | string;
      faction2?: number | string;
    };
  };
};

type MatchStatsResponse = {
  rounds?: Array<{
    teams?: Array<{
      team_id?: string;
      players?: Array<{
        player_id: string;
        nickname: string;
        player_stats?: Record<string, string>;
      }>;
    }>;
  }>;
};

type WinnerPlayerScore = {
  playerId: string;
  nickname: string;
  points: number;
};

type PlayerDbRow = {
  id: number;
  faceit_guid: string;
  nickname: string;
  points: number | null;
};

type MatchPointsProcessParams = {
  matchId: string;
  queueIdHint?: string;
  source?: "webhook" | "match-page-auto" | "match-page-manual" | "cron";
};

export type MatchPointsProcessResult = {
  success: boolean;
  processed: boolean;
  message: string;
  matchId: string;
  queueId: string;
  queueCandidates: string[];
  updatedCount: number;
  missingCount: number;
  updatedPlayers: Array<{
    playerId: string;
    nickname: string;
    addedPoints: number;
    oldPoints: number;
    newPoints: number;
  }>;
  notRegistered: Array<{
    playerId: string;
    nickname: string;
    pointsWithFlag: string;
    warning: string;
  }>;
};

function toNumber(value: string | number | undefined | null): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const sanitized = value.trim().replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = Number(sanitized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

async function fetchFaceitMatchData(matchId: string): Promise<{ details: MatchDetails; stats: MatchStatsResponse } | null> {
  const apiKey = process.env.FACEIT_API_KEY || FALLBACK_FACEIT_API_KEY;
  const headers = { Authorization: `Bearer ${apiKey}` };

  const [detailsRes, statsRes] = await Promise.all([
    fetch(`${FACEIT_API_BASE}/matches/${matchId}`, { headers, cache: "no-store" }),
    fetch(`${FACEIT_API_BASE}/matches/${matchId}/stats`, { headers, cache: "no-store" }),
  ]);

  if (!detailsRes.ok || !statsRes.ok) {
    return null;
  }

  const details = (await detailsRes.json()) as MatchDetails;
  const stats = (await statsRes.json()) as MatchStatsResponse;

  return { details, stats };
}

type StatsProjection = {
  playerId: string;
  nickname: string;
  adr: number;
  kd: number;
  kr: number;
  assists: number;
  hsPercent: number;
  mvps: number;
  doubleKills: number;
  tripleKills: number;
  quadroKills: number;
  pentaKills: number;
};

function calculateWinnerPoints(details: MatchDetails, stats: MatchStatsResponse): WinnerPlayerScore[] {
  const round = stats.rounds?.[0];
  if (!round?.teams || round.teams.length === 0) {
    return [];
  }

  const winnerRaw = details.results?.winner || "";
  const faction1Id = details.teams?.faction1?.faction_id;
  const faction2Id = details.teams?.faction2?.faction_id;

  const winnerIdCandidates = new Set<string>();
  if (winnerRaw) winnerIdCandidates.add(winnerRaw);
  if (winnerRaw === "faction1") {
    winnerIdCandidates.add("faction1");
    if (faction1Id) winnerIdCandidates.add(faction1Id);
  }
  if (winnerRaw === "faction2") {
    winnerIdCandidates.add("faction2");
    if (faction2Id) winnerIdCandidates.add(faction2Id);
  }

  const allPlayers: StatsProjection[] = [];
  const winnerPlayers: StatsProjection[] = [];

  for (const team of round.teams) {
    for (const player of team.players || []) {
      const s = player.player_stats || {};
      const projection: StatsProjection = {
        playerId: player.player_id,
        nickname: player.nickname,
        adr: toNumber(s["ADR"]),
        kd: toNumber(s["K/D Ratio"]),
        kr: toNumber(s["K/R Ratio"]),
        assists: toNumber(s["Assists"]),
        hsPercent: toNumber(s["Headshots %"]),
        mvps: toNumber(s["MVPs"]),
        doubleKills: toNumber(s["Double Kills"]),
        tripleKills: toNumber(s["Triple Kills"]),
        quadroKills: toNumber(s["Quadro Kills"]),
        pentaKills: toNumber(s["Penta Kills"]),
      };

      allPlayers.push(projection);
      if (team.team_id && winnerIdCandidates.has(team.team_id)) {
        winnerPlayers.push(projection);
      }
    }
  }

  if (!winnerPlayers.length && (winnerRaw === "faction1" || winnerRaw === "faction2")) {
    const winnerRoster = winnerRaw === "faction1"
      ? details.teams?.faction1?.roster
      : details.teams?.faction2?.roster;

    const winnerRosterIds = new Set((winnerRoster || []).map((player) => player.player_id));
    if (winnerRosterIds.size > 0) {
      for (const player of allPlayers) {
        if (winnerRosterIds.has(player.playerId)) {
          winnerPlayers.push(player);
        }
      }
    }
  }

  if (!winnerPlayers.length) {
    return [];
  }

  const projections: QueridaFilaPointsProjection[] = allPlayers.map((player) => ({
    playerId: player.playerId,
    adr: player.adr,
    kd: player.kd,
    kr: player.kr,
    assists: player.assists,
    hsPercent: player.hsPercent,
    mvps: player.mvps,
    doubleKills: player.doubleKills,
    tripleKills: player.tripleKills,
    quadroKills: player.quadroKills,
    pentaKills: player.pentaKills,
  }));
  const pointsMap = calculateQueridaFilaPoints(projections);

  return winnerPlayers
    .map((player) => {
      return {
        playerId: player.playerId,
        nickname: player.nickname,
        points: pointsMap.get(player.playerId) ?? 5,
      } satisfies WinnerPlayerScore;
    })
    .sort((a, b) => b.points - a.points);
}

async function ensureProcessedTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS processed_faceit_matches (
      match_id VARCHAR(100) NOT NULL PRIMARY KEY,
      queue_id VARCHAR(100) NULL,
      processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function ensureSalvarJogoTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS salvarjogo (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      match_id VARCHAR(100) NOT NULL,
      queue_id VARCHAR(100) NULL,
      status VARCHAR(32) NULL,
      started_at INT NULL,
      finished_at INT NULL,
      winner_team_id VARCHAR(100) NULL,
      team1_id VARCHAR(100) NULL,
      team2_id VARCHAR(100) NULL,
      team1_score INT NULL,
      team2_score INT NULL,
      payload_json JSON NULL,
      points_processed TINYINT(1) NOT NULL DEFAULT 0,
      points_processed_at TIMESTAMP NULL,
      error_message TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_salvarjogo_match_id (match_id),
      KEY idx_salvarjogo_finished_at (finished_at),
      KEY idx_salvarjogo_points_processed (points_processed)
    )
  `);

  const migrations: Array<{ name: string; sql: string }> = [
    { name: "queue_id", sql: "ALTER TABLE salvarjogo ADD COLUMN queue_id VARCHAR(100) NULL" },
    { name: "status", sql: "ALTER TABLE salvarjogo ADD COLUMN status VARCHAR(32) NULL" },
    { name: "started_at", sql: "ALTER TABLE salvarjogo ADD COLUMN started_at INT NULL" },
    { name: "finished_at", sql: "ALTER TABLE salvarjogo ADD COLUMN finished_at INT NULL" },
    { name: "winner_team_id", sql: "ALTER TABLE salvarjogo ADD COLUMN winner_team_id VARCHAR(100) NULL" },
    { name: "team1_id", sql: "ALTER TABLE salvarjogo ADD COLUMN team1_id VARCHAR(100) NULL" },
    { name: "team2_id", sql: "ALTER TABLE salvarjogo ADD COLUMN team2_id VARCHAR(100) NULL" },
    { name: "team1_score", sql: "ALTER TABLE salvarjogo ADD COLUMN team1_score INT NULL" },
    { name: "team2_score", sql: "ALTER TABLE salvarjogo ADD COLUMN team2_score INT NULL" },
    { name: "payload_json", sql: "ALTER TABLE salvarjogo ADD COLUMN payload_json JSON NULL" },
    { name: "points_processed", sql: "ALTER TABLE salvarjogo ADD COLUMN points_processed TINYINT(1) NOT NULL DEFAULT 0" },
    { name: "points_processed_at", sql: "ALTER TABLE salvarjogo ADD COLUMN points_processed_at TIMESTAMP NULL" },
    { name: "error_message", sql: "ALTER TABLE salvarjogo ADD COLUMN error_message TEXT NULL" },
    { name: "created_at", sql: "ALTER TABLE salvarjogo ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" },
    {
      name: "updated_at",
      sql: "ALTER TABLE salvarjogo ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    },
  ];

  for (const migration of migrations) {
    try {
      const [existsRows] = await connection.query("SHOW COLUMNS FROM salvarjogo LIKE ?", [migration.name]);
      if (Array.isArray(existsRows) && existsRows.length > 0) continue;
      await connection.query(migration.sql);
    } catch {
      // Keep processor resilient if a column migration fails.
    }
  }
}

function truncateErrorMessage(input: string): string {
  return input.slice(0, 1800);
}

async function upsertSalvarJogoMatch(connection: any, details: MatchDetails, queueId: string) {
  const winner = String(details.results?.winner || "").trim() || null;
  const team1Id = details.teams?.faction1?.faction_id || null;
  const team2Id = details.teams?.faction2?.faction_id || null;
  const team1Score = toNumber(details.results?.score?.faction1 ?? null);
  const team2Score = toNumber(details.results?.score?.faction2 ?? null);

  await connection.query(
    `INSERT INTO salvarjogo (
       match_id, queue_id, status, started_at, finished_at,
       winner_team_id, team1_id, team2_id, team1_score, team2_score,
       payload_json, points_processed, error_message
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
     ON DUPLICATE KEY UPDATE
       queue_id = VALUES(queue_id),
       status = VALUES(status),
       started_at = VALUES(started_at),
       finished_at = VALUES(finished_at),
       winner_team_id = VALUES(winner_team_id),
       team1_id = VALUES(team1_id),
       team2_id = VALUES(team2_id),
       team1_score = VALUES(team1_score),
       team2_score = VALUES(team2_score),
       payload_json = VALUES(payload_json)`,
    [
      details.match_id,
      queueId || details.competition_id || null,
      details.status || null,
      toNumber(details.started_at || 0) || null,
      toNumber(details.finished_at || 0) || null,
      winner,
      team1Id,
      team2Id,
      team1Score || null,
      team2Score || null,
      JSON.stringify(details),
    ],
  );
}

async function markSalvarJogoNotComputed(connection: any, matchId: string, reason: string, queueId?: string) {
  await connection.query(
    `UPDATE salvarjogo
     SET points_processed = 0,
         points_processed_at = NULL,
         error_message = ?,
         queue_id = COALESCE(?, queue_id)
     WHERE match_id = ?`,
    [truncateErrorMessage(reason), queueId || null, matchId],
  );
}

async function sendDiscordPointsWebhook(payload: {
  matchId: string;
  faceitUrl: string;
  queueId: string;
  winners: WinnerPlayerScore[];
  updatedPlayers: Array<{
    playerId: string;
    nickname: string;
    addedPoints: number;
    oldPoints: number;
    newPoints: number;
  }>;
  notRegistered: Array<{
    playerId: string;
    nickname: string;
    pointsWithFlag: string;
    warning: string;
  }>;
}) {
  const winnersById = new Map(payload.winners.map((w) => [w.playerId, w]));

  const updatedLines = payload.updatedPlayers.map((player) => {
    const winner = winnersById.get(player.playerId);
    const points = winner?.points ?? player.addedPoints;
    return `- ${player.nickname}: +${points} points`;
  });

  const notRegisteredLines = payload.notRegistered.map(
    (player) => `- ${player.nickname}: +${player.pointsWithFlag} (nao cadastrado)`
  );

  const lines = [
    "**Partida finalizada - Pontos da Querida Fila**",
    `Fila: ${payload.queueId}`,
    `Partida: ${payload.matchId}`,
    `Link: ${payload.faceitUrl}`,
    "",
    "**Pontos atribuidos:**",
    ...(updatedLines.length ? updatedLines : ["- Nenhum jogador cadastrado recebeu pontos."]),
    ...(notRegisteredLines.length ? ["", "**Nao cadastrados:**", ...notRegisteredLines] : []),
  ];

  try {
    await fetch(DISCORD_POINTS_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: lines.join("\n").slice(0, 1900) }),
    });
  } catch (error) {
    console.error("[faceit-webhook] erro ao enviar webhook de points:", error);
  }
}

export async function getQueridaFilaMatchProcessingStatus(matchId: string): Promise<{ processed: boolean }> {
  let connection: any;

  try {
    const { getRuntimeEnv } = await import("@/lib/runtime-env");
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);
    await ensureSalvarJogoTable(connection);
    await ensureProcessedTable(connection);

    const [salvarRows] = await connection.query(
      "SELECT points_processed FROM salvarjogo WHERE match_id = ? LIMIT 1",
      [matchId],
    );

    if (Array.isArray(salvarRows) && salvarRows.length > 0) {
      const processed = Number((salvarRows as Array<{ points_processed?: number }>)[0]?.points_processed || 0) === 1;
      return { processed };
    }

    const [rows] = await connection.query(
      "SELECT match_id FROM processed_faceit_matches WHERE match_id = ? LIMIT 1",
      [matchId],
    );

    const found = Array.isArray(rows) && rows.length > 0;
    return { processed: found };
  } catch (error) {
    console.error("[faceit-webhook] erro ao consultar status de processamento:", error);
    return { processed: false };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

/**
 * Recebe uma lista de match_ids e retorna apenas os que ainda NAO foram processados.
 * Em caso de erro de DB, retorna todos como nao processados (o INSERT com PK vai proteger contra duplicata).
 */
export async function getUnprocessedMatchIds(matchIds: string[]): Promise<string[]> {
  if (matchIds.length === 0) return [];

  let connection: any;
  try {
    const { getRuntimeEnv } = await import("@/lib/runtime-env");
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);
    await ensureSalvarJogoTable(connection);
    await ensureProcessedTable(connection);

    const placeholders = matchIds.map(() => "?").join(",");
    const [salvarRows] = await connection.query(
      `SELECT match_id FROM salvarjogo WHERE match_id IN (${placeholders}) AND points_processed = 1`,
      matchIds,
    );

    const [legacyRows] = await connection.query(
      `SELECT match_id FROM processed_faceit_matches WHERE match_id IN (${placeholders})`,
      matchIds,
    );

    const processedSet = new Set<string>([
      ...(salvarRows as Array<{ match_id: string }>).map((r) => r.match_id),
      ...(legacyRows as Array<{ match_id: string }>).map((r) => r.match_id),
    ]);
    return matchIds.filter((id) => !processedSet.has(id));
  } catch (error) {
    console.error("[faceit-webhook] erro ao verificar partidas em lote:", error);
    return matchIds;
  } finally {
    if (connection) await connection.end();
  }
}

export async function processQueridaFilaMatchPoints(params: MatchPointsProcessParams): Promise<MatchPointsProcessResult> {
  let connection: any;

  const baseResult = {
    matchId: params.matchId,
    queueId: "",
    queueCandidates: [] as string[],
    updatedCount: 0,
    missingCount: 0,
    updatedPlayers: [] as MatchPointsProcessResult["updatedPlayers"],
    notRegistered: [] as MatchPointsProcessResult["notRegistered"],
  };

  try {
    const matchData = await fetchFaceitMatchData(params.matchId);
    if (!matchData) {
      return {
        ...baseResult,
        success: false,
        processed: false,
        message: "Nao foi possivel buscar dados da partida na FACEIT.",
      };
    }

    const { getRuntimeEnv } = await import("@/lib/runtime-env");
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);
    await ensureSalvarJogoTable(connection);
    await ensureProcessedTable(connection);

    const queueCandidates = [
      matchData.details.competition_id,
      params.queueIdHint,
    ].filter((candidate): candidate is string => Boolean(candidate));

    const queueId = queueCandidates.find((candidate) => candidate === TARGET_QUEUE_ID) || queueCandidates[0] || "";

    await upsertSalvarJogoMatch(connection, matchData.details, queueId);

    if (!queueCandidates.includes(TARGET_QUEUE_ID)) {
      await markSalvarJogoNotComputed(
        connection,
        params.matchId,
        "Partida ignorada por nao pertencer a fila alvo.",
        queueId,
      );
      return {
        ...baseResult,
        success: false,
        processed: false,
        message: "Partida ignorada por nao pertencer a fila alvo.",
        queueId,
        queueCandidates,
      };
    }

    const matchFinishedAt = toNumber(matchData.details.finished_at || matchData.details.started_at || 0);
    if (matchFinishedAt < POINTS_START_DATE_UNIX) {
      await markSalvarJogoNotComputed(
        connection,
        params.matchId,
        "Partida ignorada por ser anterior a data de inicio da pontuacao.",
        queueId,
      );
      return {
        ...baseResult,
        success: false,
        processed: false,
        message: "Partida ignorada por ser anterior a data de inicio da pontuacao.",
        queueId,
        queueCandidates,
      };
    }

    const winnerScores = calculateWinnerPoints(matchData.details, matchData.stats);
    if (winnerScores.length === 0) {
      await markSalvarJogoNotComputed(
        connection,
        params.matchId,
        "Nao foi possivel calcular pontos dos vencedores.",
        queueId,
      );
      return {
        ...baseResult,
        success: false,
        processed: false,
        message: "Nao foi possivel calcular pontos dos vencedores.",
        queueId,
        queueCandidates,
      };
    }

    await connection.beginTransaction();

      const [currentRows] = await connection.query(
        "SELECT points_processed FROM salvarjogo WHERE match_id = ? LIMIT 1 FOR UPDATE",
        [params.matchId],
      );
      const alreadyProcessed =
        Array.isArray(currentRows) &&
        currentRows.length > 0 &&
        Number((currentRows as Array<{ points_processed?: number }>)[0]?.points_processed || 0) === 1;

      if (alreadyProcessed) {
        await connection.rollback();
        return {
          ...baseResult,
          success: true,
          processed: true,
          message: "Partida ja processada anteriormente.",
          queueId,
          queueCandidates,
        };
      }

    const winnerIds = winnerScores.map((p) => p.playerId);
    const placeholders = winnerIds.map(() => "?").join(",");
    const [registeredRowsRaw] = await connection.query(
      `SELECT id, faceit_guid, nickname, points FROM players WHERE faceit_guid IN (${placeholders})`,
      winnerIds,
    );
    const registeredRows = (registeredRowsRaw || []) as PlayerDbRow[];

    const byGuid = new Map<string, PlayerDbRow>(registeredRows.map((row: PlayerDbRow) => [row.faceit_guid, row]));

    const updatedPlayers: MatchPointsProcessResult["updatedPlayers"] = [];
    const notRegistered: MatchPointsProcessResult["notRegistered"] = [];

    for (const winner of winnerScores) {
      const dbPlayer = byGuid.get(winner.playerId);

      if (!dbPlayer) {
        notRegistered.push({
          playerId: winner.playerId,
          nickname: winner.nickname,
          pointsWithFlag: `${winner.points}*`,
          warning: "* usuario nao esta cadastrado",
        });
        continue;
      }

      const oldPoints = toNumber(dbPlayer.points);
      const newPoints = oldPoints + winner.points;

      await connection.query(
        "UPDATE players SET points = ? WHERE id = ?",
        [newPoints, dbPlayer.id],
      );

      updatedPlayers.push({
        playerId: winner.playerId,
        nickname: dbPlayer.nickname || winner.nickname,
        addedPoints: winner.points,
        oldPoints,
        newPoints,
      });
    }

    await connection.query(
      `UPDATE salvarjogo
       SET points_processed = 1,
           points_processed_at = NOW(),
           error_message = NULL,
           queue_id = COALESCE(?, queue_id)
       WHERE match_id = ?`,
      [queueId, params.matchId],
    );

    // Compatibilidade com fluxos legados que ainda consultam esta tabela.
    await connection.query(
      "INSERT IGNORE INTO processed_faceit_matches (match_id, queue_id) VALUES (?, ?)",
      [params.matchId, queueId],
    );

    await connection.commit();

    const faceitUrl = (matchData.details.faceit_url || `https://www.faceit.com/en/cs2/room/${params.matchId}`).replace(
      "{lang}",
      "en"
    );

    await sendDiscordPointsWebhook({
      matchId: params.matchId,
      faceitUrl,
      queueId,
      winners: winnerScores,
      updatedPlayers,
      notRegistered,
    });

    return {
      success: true,
      processed: true,
      message: params.source === "match-page-auto"
        ? "Partida processada automaticamente ao abrir a pagina."
        : "Pontos computados com sucesso.",
      matchId: params.matchId,
      queueId,
      queueCandidates,
      updatedCount: updatedPlayers.length,
      missingCount: notRegistered.length,
      updatedPlayers,
      notRegistered,
    };
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}

      try {
        await connection.query(
          `UPDATE salvarjogo
           SET points_processed = 0,
               points_processed_at = NULL,
               error_message = ?
           WHERE match_id = ?`,
          [truncateErrorMessage(error instanceof Error ? error.message : String(error)), params.matchId],
        );
      } catch {
        // ignore secondary errors while persisting failure reason
      }
    }

    console.error("[faceit-webhook] erro ao processar partida:", error);
    return {
      ...baseResult,
      success: false,
      processed: false,
      message: "Erro interno ao processar pontos da partida.",
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

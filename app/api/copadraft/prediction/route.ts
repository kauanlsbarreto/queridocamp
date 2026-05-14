import { NextRequest, NextResponse } from "next/server";
import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QUERY_TIMEOUT_MS = 30000;
const PREDICTION_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1504358833999315064/FZ6oHJj_af-C0NJO-FP01RUK2DWvHTv2WRgVzjZ_LMn7aPzsqEYcV7ziYDWlrwGR0SeE";

type PredictionWebhookEventType =
  | "PREDICTION_CREATED"
  | "CASHOUT"
  | "BET_WON"
  | "BET_LOST";

type PredictionWebhookPayload = {
  predictionId?: number;
  playerId?: number;
  faceitGuid?: string;
  requesterGuid?: string;
  matchId?: string;
  team1?: string;
  team2?: string;
  chosen?: string;
  status?: string;
  pointsPredicted?: number;
  odds?: number;
  payout?: number;
  score?: string;
  playerPointsAfter?: number;
  notes?: string;
};

function getWebhookColor(eventType: PredictionWebhookEventType) {
  if (eventType === "PREDICTION_CREATED") return 0x3498db;
  if (eventType === "CASHOUT") return 0xf39c12;
  if (eventType === "BET_WON") return 0x2ecc71;
  return 0xe74c3c;
}

function getWebhookTitle(eventType: PredictionWebhookEventType) {
  if (eventType === "PREDICTION_CREATED") return "Prediction Criada";
  if (eventType === "CASHOUT") return "Cash Out Executado";
  if (eventType === "BET_WON") return "Aposta Ganha";
  return "Aposta Perdida";
}

async function sendPredictionWebhook(eventType: PredictionWebhookEventType, payload: PredictionWebhookPayload) {
  const fields = [
    payload.predictionId != null ? { name: "Prediction ID", value: String(payload.predictionId), inline: true } : null,
    payload.playerId != null ? { name: "Player ID", value: String(payload.playerId), inline: true } : null,
    payload.faceitGuid ? { name: "Faceit GUID", value: payload.faceitGuid, inline: false } : null,
    payload.requesterGuid ? { name: "Requester GUID", value: payload.requesterGuid, inline: false } : null,
    payload.matchId ? { name: "Match ID", value: payload.matchId, inline: true } : null,
    payload.status ? { name: "Status", value: payload.status, inline: true } : null,
    payload.team1 || payload.team2
      ? {
          name: "Times",
          value: `${payload.team1 || "-"} x ${payload.team2 || "-"}`,
          inline: false,
        }
      : null,
    payload.chosen ? { name: "Escolha", value: payload.chosen, inline: true } : null,
    payload.pointsPredicted != null ? { name: "Pontos Apostados", value: String(payload.pointsPredicted), inline: true } : null,
    payload.odds != null ? { name: "Odds", value: `${Number(payload.odds).toFixed(2)}x`, inline: true } : null,
    payload.score ? { name: "Placar Final", value: payload.score, inline: true } : null,
    payload.payout != null ? { name: "Retorno", value: String(payload.payout), inline: true } : null,
    payload.playerPointsAfter != null ? { name: "Pontos do Player (apos)", value: String(payload.playerPointsAfter), inline: true } : null,
    payload.notes ? { name: "Notas", value: payload.notes, inline: false } : null,
  ].filter(Boolean) as { name: string; value: string; inline?: boolean }[];

  const body = {
    username: "Prediction Copa Draft",
    embeds: [
      {
        title: getWebhookTitle(eventType),
        color: getWebhookColor(eventType),
        timestamp: new Date().toISOString(),
        fields,
      },
    ],
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(PREDICTION_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[copadraft/prediction] webhook failed:", response.status, errorText);
    }
  } catch (error) {
    console.error("[copadraft/prediction] webhook error:", error);
  }
}

type JogoResultRow = {
  time1: string;
  time2: string;
  placar: string | null;
};

function normalizeText(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildTeamsOnlyKey(team1: unknown, team2: unknown) {
  const names = [normalizeText(team1), normalizeText(team2)].filter(Boolean).sort();
  if (names.length !== 2) return "";
  return `${names[0]}::${names[1]}`;
}

function normalizeSerie(value: unknown) {
  const raw = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[–—-]/g, "x")
    .replace(/:/g, "x");
  const match = raw.match(/^(\d{1,2})x(\d{1,2})$/);
  if (!match) return null;
  return `${Number(match[1])}x${Number(match[2])}`;
}

function parseSerie(value: unknown): { score1: number; score2: number } | null {
  const normalized = normalizeSerie(value);
  if (!normalized) return null;
  const [s1, s2] = normalized.split("x").map((n) => Number(n));
  if (!Number.isFinite(s1) || !Number.isFinite(s2)) return null;
  return { score1: s1, score2: s2 };
}

async function settleFinishedPredictions(mainConn: any) {
  const webhookEvents: Array<{ eventType: PredictionWebhookEventType; payload: PredictionWebhookPayload }> = [];

  const [openRows]: any = await mainConn.query({
    sql: `SELECT
            p.id,
            p.faceit_guid,
            p.player_id,
            p.match_id,
            p.team_chosen,
            p.points_predicted,
            p.odds,
            COALESCE(p.time1, pj.time1) AS time1,
            COALESCE(p.time2, pj.time2) AS time2
          FROM copadraft_predictions p
          LEFT JOIN palpites_jogos pj
            ON pj.jogo_id = CASE
              WHEN p.match_id REGEXP '^[0-9]+$' THEN CAST(p.match_id AS UNSIGNED)
              ELSE CAST(SUBSTRING_INDEX(p.match_id, '::', -1) AS UNSIGNED)
            END
          WHERE p.status = 'OPEN'
            AND p.is_cashed_out = 0`,
    timeout: QUERY_TIMEOUT_MS,
  });

  const openPredictions = Array.isArray(openRows) ? (openRows as any[]) : [];
  if (openPredictions.length === 0) return;

  const [jogosRows]: any = await mainConn.query({
    sql: `SELECT time1, time2, placar
          FROM jogos
          WHERE placar IS NOT NULL
            AND TRIM(placar) <> ''`,
    timeout: QUERY_TIMEOUT_MS,
  });

  const scoreByTeamsOnlyKey = new Map<string, { score1: number; score2: number }>();
  if (Array.isArray(jogosRows)) {
    for (const row of jogosRows as JogoResultRow[]) {
      const key = buildTeamsOnlyKey(row?.time1, row?.time2);
      const parsed = parseSerie(row?.placar);
      if (key && parsed) {
        scoreByTeamsOnlyKey.set(key, parsed);
      }
    }
  }

  if (scoreByTeamsOnlyKey.size === 0) return;

  await mainConn.beginTransaction();
  try {
    for (const prediction of openPredictions) {
      const time1 = String(prediction?.time1 || "").trim();
      const time2 = String(prediction?.time2 || "").trim();
      const teamsKey = buildTeamsOnlyKey(time1, time2);
      if (!teamsKey) continue;

      const result = scoreByTeamsOnlyKey.get(teamsKey);
      if (!result) continue;

      const predictedChoice = normalizeText(prediction?.team_chosen);
      const winnerChoice =
        result.score1 === result.score2
          ? "empate"
          : result.score1 > result.score2
          ? normalizeText(time1)
          : normalizeText(time2);

      const won = Boolean(predictedChoice && predictedChoice === winnerChoice);
      const points = Number(prediction?.points_predicted || 0);
      const odds = Number(prediction?.odds || 0);
      const payout = won ? Math.max(0, Math.round(points * odds)) : 0;
      const nextStatus = won ? "WON" : "LOST";
      const scoreLabel = `${result.score1}x${result.score2}`;

      const [updateResult]: any = await mainConn.query({
        sql: `UPDATE copadraft_predictions
              SET status = ?, result_points = ?
              WHERE id = ? AND status = 'OPEN' AND is_cashed_out = 0`,
        timeout: QUERY_TIMEOUT_MS,
      }, [nextStatus, payout, Number(prediction?.id || 0)]);

      if (Number(updateResult?.affectedRows || 0) > 0 && payout > 0) {
        await mainConn.query({
          sql: "UPDATE players SET points = points + ? WHERE faceit_guid = ?",
          timeout: QUERY_TIMEOUT_MS,
        }, [payout, normalizeText(prediction?.faceit_guid)]);
      }

      if (Number(updateResult?.affectedRows || 0) > 0) {
        const [pointsRows]: any = await mainConn.query({
          sql: "SELECT points FROM players WHERE faceit_guid = ? LIMIT 1",
          timeout: QUERY_TIMEOUT_MS,
        }, [normalizeText(prediction?.faceit_guid)]);
        const playerPointsAfter = Number(Array.isArray(pointsRows) ? pointsRows[0]?.points : 0);

        webhookEvents.push({
          eventType: won ? "BET_WON" : "BET_LOST",
          payload: {
            predictionId: Number(prediction?.id || 0),
            playerId: Number(prediction?.player_id || 0),
            faceitGuid: String(prediction?.faceit_guid || ""),
            matchId: String(prediction?.match_id || ""),
            team1: time1,
            team2: time2,
            chosen: String(prediction?.team_chosen || ""),
            status: nextStatus,
            pointsPredicted: points,
            odds,
            payout,
            score: scoreLabel,
            playerPointsAfter,
          },
        });
      }
    }

    await mainConn.commit();
  } catch (error) {
    await mainConn.rollback();
    throw error;
  }

  for (const evt of webhookEvents) {
    await sendPredictionWebhook(evt.eventType, evt.payload);
  }
}

async function ensurePredictionTable(mainConn: any) {
  await mainConn.query({
    sql: `CREATE TABLE IF NOT EXISTS copadraft_predictions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      faceit_guid VARCHAR(255) NOT NULL,
      player_id INT NOT NULL,
      match_id VARCHAR(255) NOT NULL,
      time1 VARCHAR(120) NULL,
      time2 VARCHAR(120) NULL,
      team_chosen VARCHAR(120) NOT NULL,
      points_predicted INT NOT NULL,
      odds DECIMAL(5,2) NOT NULL DEFAULT 1.00,
      status ENUM('OPEN', 'WON', 'LOST', 'DRAW') NOT NULL DEFAULT 'OPEN',
      result_points INT DEFAULT NULL,
      is_cashed_out TINYINT(1) NOT NULL DEFAULT 0,
      cashout_at TIMESTAMP NULL DEFAULT NULL,
      cashout_by VARCHAR(255) NULL,
      data DATE DEFAULT NULL,
      hora TIME DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_faceit (faceit_guid),
      KEY idx_status (status),
      KEY idx_match_id (match_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    timeout: QUERY_TIMEOUT_MS,
  });

  // Backward-compatible migration for existing environments.
  const [time1Cols]: any = await mainConn.query({
    sql: "SHOW COLUMNS FROM copadraft_predictions LIKE 'time1'",
    timeout: QUERY_TIMEOUT_MS,
  });
  if (!Array.isArray(time1Cols) || time1Cols.length === 0) {
    await mainConn.query({
      sql: "ALTER TABLE copadraft_predictions ADD COLUMN time1 VARCHAR(120) NULL AFTER match_id",
      timeout: QUERY_TIMEOUT_MS,
    });
  }

  const [time2Cols]: any = await mainConn.query({
    sql: "SHOW COLUMNS FROM copadraft_predictions LIKE 'time2'",
    timeout: QUERY_TIMEOUT_MS,
  });
  if (!Array.isArray(time2Cols) || time2Cols.length === 0) {
    await mainConn.query({
      sql: "ALTER TABLE copadraft_predictions ADD COLUMN time2 VARCHAR(120) NULL AFTER time1",
      timeout: QUERY_TIMEOUT_MS,
    });
  }

  const [isCashedOutCols]: any = await mainConn.query({
    sql: "SHOW COLUMNS FROM copadraft_predictions LIKE 'is_cashed_out'",
    timeout: QUERY_TIMEOUT_MS,
  });
  if (!Array.isArray(isCashedOutCols) || isCashedOutCols.length === 0) {
    await mainConn.query({
      sql: "ALTER TABLE copadraft_predictions ADD COLUMN is_cashed_out TINYINT(1) NOT NULL DEFAULT 0 AFTER result_points",
      timeout: QUERY_TIMEOUT_MS,
    });
  }

  const [cashoutAtCols]: any = await mainConn.query({
    sql: "SHOW COLUMNS FROM copadraft_predictions LIKE 'cashout_at'",
    timeout: QUERY_TIMEOUT_MS,
  });
  if (!Array.isArray(cashoutAtCols) || cashoutAtCols.length === 0) {
    await mainConn.query({
      sql: "ALTER TABLE copadraft_predictions ADD COLUMN cashout_at TIMESTAMP NULL DEFAULT NULL AFTER is_cashed_out",
      timeout: QUERY_TIMEOUT_MS,
    });
  }

  const [cashoutByCols]: any = await mainConn.query({
    sql: "SHOW COLUMNS FROM copadraft_predictions LIKE 'cashout_by'",
    timeout: QUERY_TIMEOUT_MS,
  });
  if (!Array.isArray(cashoutByCols) || cashoutByCols.length === 0) {
    await mainConn.query({
      sql: "ALTER TABLE copadraft_predictions ADD COLUMN cashout_by VARCHAR(255) NULL AFTER cashout_at",
      timeout: QUERY_TIMEOUT_MS,
    });
  }

  const [dataCols]: any = await mainConn.query({
    sql: "SHOW COLUMNS FROM copadraft_predictions LIKE 'data'",
    timeout: QUERY_TIMEOUT_MS,
  });
  if (!Array.isArray(dataCols) || dataCols.length === 0) {
    await mainConn.query({
      sql: "ALTER TABLE copadraft_predictions ADD COLUMN data DATE DEFAULT NULL AFTER cashout_by",
      timeout: QUERY_TIMEOUT_MS,
    });
  }

  const [horaCols]: any = await mainConn.query({
    sql: "SHOW COLUMNS FROM copadraft_predictions LIKE 'hora'",
    timeout: QUERY_TIMEOUT_MS,
  });
  if (!Array.isArray(horaCols) || horaCols.length === 0) {
    await mainConn.query({
      sql: "ALTER TABLE copadraft_predictions ADD COLUMN hora TIME DEFAULT NULL AFTER data",
      timeout: QUERY_TIMEOUT_MS,
    });
  }

  // Allow multiple predictions per user per match.
  const [uniqIndexRows]: any = await mainConn.query({
    sql: "SHOW INDEX FROM copadraft_predictions WHERE Key_name = 'uniq_faceit_match'",
    timeout: QUERY_TIMEOUT_MS,
  });
  if (Array.isArray(uniqIndexRows) && uniqIndexRows.length > 0) {
    await mainConn.query({
      sql: "ALTER TABLE copadraft_predictions DROP INDEX uniq_faceit_match",
      timeout: QUERY_TIMEOUT_MS,
    });
  }
}

function normalizeGuid(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resolveChoiceBucket(chosen: unknown, time1: unknown, time2: unknown): "time1" | "draw" | "time2" | null {
  const c = normalizeText(chosen);
  const t1 = normalizeText(time1);
  const t2 = normalizeText(time2);

  if (!c) return null;
  if (c === t1) return "time1";
  if (c === t2) return "time2";

  const drawAliases = new Set(["empate", "draw", "x"]);
  if (drawAliases.has(c)) return "draw";

  return null;
}

function buildChoiceCounts(
  rows: any[],
  time1: string | null,
  time2: string | null,
  valueField: string
) {
  const counts = {
    time1: 0,
    draw: 0,
    time2: 0,
    other: 0,
    total: 0,
  };

  for (const row of rows) {
    const bucket = resolveChoiceBucket(row?.team_chosen, time1, time2);
    const amount = Number(row?.[valueField] || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (bucket === "time1") counts.time1 += amount;
    else if (bucket === "time2") counts.time2 += amount;
    else if (bucket === "draw") counts.draw += amount;
    else counts.other += amount;
  }

  counts.total = counts.time1 + counts.draw + counts.time2;
  return counts;
}

function parseMatchIdToGameId(matchId: unknown) {
  const raw = String(matchId || "").trim();
  if (!raw) return 0;

  if (/^[0-9]+$/.test(raw)) {
    const id = Number(raw);
    return Number.isFinite(id) ? id : 0;
  }

  if (raw.includes("::")) {
    const tail = Number(raw.split("::").pop() || 0);
    return Number.isFinite(tail) ? tail : 0;
  }

  return 0;
}

function computeMarketOdds(params: {
  time1: string | null;
  time2: string | null;
  volumeByChoice: Record<string, number>;
}) {
  const time1Key = normalizeText(params.time1 || "");
  const time2Key = normalizeText(params.time2 || "");
  const drawKey = "empate";

  const defaultOdds = {
    [time1Key]: 2.0,
    [drawKey]: 1.5,
    [time2Key]: 2.0,
  };

  if (!time1Key || !time2Key) {
    return {
      oddsByChoice: defaultOdds,
      labels: { time1Key, drawKey, time2Key },
    };
  }

  const totalRealVolume =
    (params.volumeByChoice[time1Key] || 0) +
    (params.volumeByChoice[drawKey] || 0) +
    (params.volumeByChoice[time2Key] || 0);

  // Before first bet on this match, keep fixed opening odds.
  if (totalRealVolume <= 0) {
    return {
      oddsByChoice: defaultOdds,
      labels: { time1Key, drawKey, time2Key },
    };
  }

  // Keep opening odds as anchor and apply a smooth variation by pick share.
  const c1 = Number(params.volumeByChoice[time1Key] || 0);
  const cd = Number(params.volumeByChoice[drawKey] || 0);
  const c2 = Number(params.volumeByChoice[time2Key] || 0);
  const total = c1 + cd + c2;

  const shares: Record<string, number> = {
    [time1Key]: total > 0 ? c1 / total : 1 / 3,
    [drawKey]: total > 0 ? cd / total : 1 / 3,
    [time2Key]: total > 0 ? c2 / total : 1 / 3,
  };

  const expectedShare = 1 / 3;
  const maxMovePct = 0.45; // cap movement to +-45% from opening line.
  const marketMaturity = clamp(total / 30, 0.15, 1); // few bets => smaller movement.

  const adjustOdd = (openingOdd: number, share: number, minOdd: number) => {
    const deviation = share - expectedShare;
    const normalized = clamp(deviation / (2 / 3), -1, 1);

    // More picked => lower odd; less picked => higher odd.
    const movePct = clamp(-normalized * maxMovePct * marketMaturity, -maxMovePct, maxMovePct);
    const moved = openingOdd * (1 + movePct);
    return Number(clamp(moved, minOdd, 8).toFixed(2));
  };

  const oddsByChoice: Record<string, number> = {
    [time1Key]: adjustOdd(defaultOdds[time1Key], shares[time1Key], 2.0),
    [drawKey]: adjustOdd(defaultOdds[drawKey], shares[drawKey], 1.5),
    [time2Key]: adjustOdd(defaultOdds[time2Key], shares[time2Key], 2.0),
  };

  return {
    oddsByChoice,
    labels: { time1Key, drawKey, time2Key },
  };
}

export async function GET(request: NextRequest) {
  let mainConn: any = null;

  try {
    const env = (await getRuntimeEnv()) as Env;
    mainConn = await createMainConnection(env);
    await ensurePredictionTable(mainConn);
    await settleFinishedPredictions(mainConn);

    const action = String(request.nextUrl.searchParams.get("action") || "").trim().toLowerCase();
    if (action === "market_odds") {
      const matchId = String(request.nextUrl.searchParams.get("match_id") || "").trim();
      const gameId = Number(matchId);
      const time1 = String(request.nextUrl.searchParams.get("time1") || "").trim() || null;
      const time2 = String(request.nextUrl.searchParams.get("time2") || "").trim() || null;

      if (!matchId || !Number.isFinite(gameId) || gameId <= 0) {
        return NextResponse.json({ ok: false, message: "match_id inválido." }, { status: 400 });
      }

      const [distributionRows]: any = await mainConn.query(
        {
          sql: `SELECT team_chosen, COUNT(*) AS volume
                FROM copadraft_predictions
                WHERE status = 'OPEN'
                  AND is_cashed_out = 0
                  AND (
                    match_id = ?
                    OR (match_id REGEXP '^[0-9]+$' AND CAST(match_id AS UNSIGNED) = ?)
                    OR (match_id LIKE '%::%' AND CAST(SUBSTRING_INDEX(match_id, '::', -1) AS UNSIGNED) = ?)
                  )
                GROUP BY team_chosen`,
          timeout: QUERY_TIMEOUT_MS,
        },
        [matchId, gameId, gameId]
      );

      const groupedRows = Array.isArray(distributionRows) ? (distributionRows as any[]) : [];
      const counts = buildChoiceCounts(groupedRows, time1, time2, "volume");
      const volumeByChoice: Record<string, number> = {
        [normalizeText(time1 || "")]: counts.time1,
        ["empate"]: counts.draw,
        [normalizeText(time2 || "")]: counts.time2,
      };

      const market = computeMarketOdds({ time1, time2, volumeByChoice });

      return NextResponse.json({
        ok: true,
        odds: {
          [time1 || "time1"]: market.oddsByChoice[market.labels.time1Key] ?? 2.0,
          Empate: market.oddsByChoice[market.labels.drawKey] ?? 1.5,
          [time2 || "time2"]: market.oddsByChoice[market.labels.time2Key] ?? 2.0,
        },
        counts: {
          [time1 || "time1"]: counts.time1,
          Empate: counts.draw,
          [time2 || "time2"]: counts.time2,
          total: counts.total,
        },
      });
    }

    if (action === "admin_board") {
      const requesterGuid = normalizeGuid(request.nextUrl.searchParams.get("faceit_guid"));
      if (!requesterGuid) {
        return NextResponse.json({ ok: false, message: "faceit_guid obrigatório." }, { status: 400 });
      }

      const [adminRows]: any = await mainConn.query(
        {
          sql: "SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1",
          timeout: QUERY_TIMEOUT_MS,
        },
        [requesterGuid]
      );
      const adminLevel = Number(Array.isArray(adminRows) ? adminRows[0]?.admin : 0);
      if (!(adminLevel >= 1 && adminLevel <= 5)) {
        return NextResponse.json({ ok: false, message: "Acesso negado." }, { status: 403 });
      }

      const [rows]: any = await mainConn.query(
        {
          sql: `SELECT
                  p.match_id,
                  p.time1,
                  p.time2,
                  p.team_chosen,
                  p.faceit_guid,
                  COALESCE(pl.nickname, p.faceit_guid) AS player_name
                FROM copadraft_predictions p
                LEFT JOIN players pl
                  ON pl.faceit_guid = p.faceit_guid
                WHERE p.is_cashed_out = 0`,
          timeout: QUERY_TIMEOUT_MS,
        }
      );

      const list = Array.isArray(rows) ? (rows as any[]) : [];
      const byMatch = new Map<number, {
        match_id: number;
        time1: string;
        time2: string;
        counts: { time1: number; draw: number; time2: number; total: number };
        bettors: { time1: string[]; draw: string[]; time2: string[] };
      }>();

      for (const row of list) {
        const matchNumericId = parseMatchIdToGameId(row?.match_id);
        if (!Number.isFinite(matchNumericId) || matchNumericId <= 0) continue;

        const time1 = String(row?.time1 || "").trim();
        const time2 = String(row?.time2 || "").trim();
        const bucket = resolveChoiceBucket(row?.team_chosen, time1, time2);
        if (!bucket) continue;

        if (!byMatch.has(matchNumericId)) {
          byMatch.set(matchNumericId, {
            match_id: matchNumericId,
            time1,
            time2,
            counts: { time1: 0, draw: 0, time2: 0, total: 0 },
            bettors: { time1: [], draw: [], time2: [] },
          });
        }

        const target = byMatch.get(matchNumericId)!;
        if (bucket === "time1") target.counts.time1 += 1;
        if (bucket === "time2") target.counts.time2 += 1;
        if (bucket === "draw") target.counts.draw += 1;
        target.counts.total += 1;

        if (adminLevel === 1) {
          const name = String(row?.player_name || row?.faceit_guid || "Desconhecido").trim();
          if (bucket === "time1") target.bettors.time1.push(name);
          if (bucket === "time2") target.bettors.time2.push(name);
          if (bucket === "draw") target.bettors.draw.push(name);
        }
      }

      const matches = Array.from(byMatch.values()).map((item) => ({
        match_id: item.match_id,
        time1: item.time1,
        time2: item.time2,
        counts: item.counts,
        bettors: adminLevel === 1 ? item.bettors : undefined,
      }));

      return NextResponse.json({ ok: true, adminLevel, matches });
    }

    const faceitGuid = normalizeGuid(request.nextUrl.searchParams.get("faceit_guid"));
    
    if (!faceitGuid) {
      return NextResponse.json({
        ok: false,
        hasAccess: false,
        myPredictions: [],
      });
    }

    const [adminRows]: any = await mainConn.query({
      sql: "SELECT admin, points FROM players WHERE faceit_guid = ? LIMIT 1",
      timeout: QUERY_TIMEOUT_MS,
    }, [faceitGuid]);
    const adminLevel = Number(Array.isArray(adminRows) && adminRows[0]?.admin != null ? adminRows[0].admin : 0);
    const currentPoints = Number(Array.isArray(adminRows) && adminRows[0]?.points != null ? adminRows[0].points : 0);
    const isAdmin1 = adminLevel === 1;

    // Get player's predictions
    const [rows]: any = await mainConn.query({
      sql: `SELECT
              p.id,
              p.match_id,
              p.team_chosen,
              p.points_predicted,
              p.odds,
              p.status,
              p.result_points,
              p.is_cashed_out,
              p.cashout_at,
              p.created_at,
              p.data AS game_date,
              p.hora AS game_time,
              p.time1,
              p.time2
            FROM copadraft_predictions p
            WHERE p.faceit_guid = ?
            ORDER BY p.created_at DESC`,
      timeout: QUERY_TIMEOUT_MS,
    }, [faceitGuid]);

    const myPredictions = Array.isArray(rows) ? rows : [];

    return NextResponse.json({
      ok: true,
      hasAccess: true,
      isAdmin1,
      adminLevel,
      currentPoints,
      myPredictions,
    });
  } catch (error) {
    console.error("[copadraft/prediction GET]", error);
    return NextResponse.json({ ok: false, message: "Erro ao carregar previsões." }, { status: 500 });
  } finally {
    if (mainConn) mainConn.end();
  }
}

export async function POST(request: NextRequest) {
  let mainConn: any = null;

  try {
    const env = (await getRuntimeEnv()) as Env;
    mainConn = await createMainConnection(env);
    await ensurePredictionTable(mainConn);

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").trim().toLowerCase();

    if (action === "cashout") {
      const requesterGuid = normalizeGuid(body?.requester_faceit_guid || body?.faceit_guid);
      const predictionId = Number(body?.prediction_id || 0);

      if (!requesterGuid) {
        return NextResponse.json({ ok: false, message: "requester_faceit_guid obrigatório." }, { status: 400 });
      }
      if (!Number.isFinite(predictionId) || predictionId <= 0) {
        return NextResponse.json({ ok: false, message: "prediction_id inválido." }, { status: 400 });
      }

      const [adminRows]: any = await mainConn.query({
        sql: "SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1",
        timeout: QUERY_TIMEOUT_MS,
      }, [requesterGuid]);

      const adminLevel = Number(Array.isArray(adminRows) && adminRows[0]?.admin != null ? adminRows[0].admin : 0);
      if (adminLevel !== 1) {
        return NextResponse.json({ ok: false, message: "Somente admin nível 1 pode usar cash out." }, { status: 403 });
      }

      await mainConn.beginTransaction();
      try {
        const [predictionRows]: any = await mainConn.query({
          sql: `SELECT id, faceit_guid, player_id, match_id, time1, time2, team_chosen, points_predicted, odds, status, is_cashed_out, cashout_at
                FROM copadraft_predictions
                WHERE id = ?
                LIMIT 1
                FOR UPDATE`,
          timeout: QUERY_TIMEOUT_MS,
        }, [predictionId]);

        const prediction = Array.isArray(predictionRows) ? predictionRows[0] : null;
        if (!prediction) {
          await mainConn.rollback();
          return NextResponse.json({ ok: false, message: "Previsão não encontrada." }, { status: 404 });
        }

        if (Number(prediction.is_cashed_out || 0) === 1 || prediction.cashout_at) {
          await mainConn.rollback();
          return NextResponse.json({ ok: false, message: "Cash out já realizado para essa previsão." }, { status: 409 });
        }

        if (String(prediction.status || "").toUpperCase() !== "OPEN") {
          await mainConn.rollback();
          return NextResponse.json({ ok: false, message: "Só é possível cash out em previsão aberta." }, { status: 409 });
        }

        const refundPoints = Number(prediction.points_predicted || 0);
        if (!Number.isFinite(refundPoints) || refundPoints <= 0) {
          await mainConn.rollback();
          return NextResponse.json({ ok: false, message: "Pontos da previsão inválidos para estorno." }, { status: 400 });
        }

        await mainConn.query({
          sql: "UPDATE players SET points = points + ? WHERE faceit_guid = ?",
          timeout: QUERY_TIMEOUT_MS,
        }, [refundPoints, String(prediction.faceit_guid || "").trim().toLowerCase()]);

        const [pointsRows]: any = await mainConn.query({
          sql: "SELECT points FROM players WHERE faceit_guid = ? LIMIT 1",
          timeout: QUERY_TIMEOUT_MS,
        }, [String(prediction.faceit_guid || "").trim().toLowerCase()]);
        const playerPointsAfter = Number(Array.isArray(pointsRows) ? pointsRows[0]?.points : 0);

        await mainConn.query({
          sql: `UPDATE copadraft_predictions
                SET is_cashed_out = 1,
                    cashout_at = NOW(),
                    cashout_by = ?
                WHERE id = ?`,
          timeout: QUERY_TIMEOUT_MS,
        }, [requesterGuid, predictionId]);

        await mainConn.commit();

        await sendPredictionWebhook("CASHOUT", {
          predictionId: Number(prediction.id || 0),
          playerId: Number(prediction.player_id || 0),
          faceitGuid: String(prediction.faceit_guid || ""),
          requesterGuid,
          matchId: String(prediction.match_id || ""),
          team1: String(prediction.time1 || ""),
          team2: String(prediction.time2 || ""),
          chosen: String(prediction.team_chosen || ""),
          status: "CASHED_OUT",
          pointsPredicted: refundPoints,
          odds: Number(prediction.odds || 0),
          payout: refundPoints,
          playerPointsAfter,
        });

        return NextResponse.json({ ok: true, message: "Cash out realizado com sucesso." });
      } catch (error) {
        await mainConn.rollback();
        throw error;
      }
    }

    const faceitGuid = normalizeGuid(body?.faceit_guid);
    const matchId = String(body?.match_id || "").trim();
    const time1 = String(body?.time1 || "").trim() || null;
    const time2 = String(body?.time2 || "").trim() || null;
    const teamChosen = String(body?.team_chosen || "").trim();
    const pointsPredicted = Number(body?.points_predicted || 0);
    const playerId = Number(body?.player_id || 0);
    const gameId = Number(matchId);

    if (!faceitGuid) return NextResponse.json({ ok: false, message: "faceit_guid obrigatório." }, { status: 400 });
    if (!matchId) return NextResponse.json({ ok: false, message: "match_id obrigatório." }, { status: 400 });
    if (!teamChosen) return NextResponse.json({ ok: false, message: "time obrigatório." }, { status: 400 });
    if (!playerId) return NextResponse.json({ ok: false, message: "player_id obrigatório." }, { status: 400 });
    // Buscar data e hora do jogo
    const [gameRows]: any = await mainConn.query({
      sql: "SELECT data, hora FROM palpites_jogos WHERE jogo_id = ? LIMIT 1",
      timeout: QUERY_TIMEOUT_MS,
    }, [gameId]);

    const gameData = Array.isArray(gameRows) && gameRows.length > 0 ? gameRows[0] : null;
    const gameDate = gameData?.data || null;
    const gameTime = gameData?.hora || null;

    if (!Number.isFinite(pointsPredicted) || pointsPredicted < 10) {
      return NextResponse.json({ ok: false, message: "A previsão mínima é de 10 moedas." }, { status: 400 });
    }
    if (!Number.isFinite(gameId) || gameId <= 0) {
      return NextResponse.json({ ok: false, message: "match_id inválido." }, { status: 400 });
    }

    await mainConn.beginTransaction();
    try {
      // Deduct points
      const [deductResult]: any = await mainConn.query({
        sql: "UPDATE players SET points = points - ? WHERE faceit_guid = ? AND points >= ?",
        timeout: QUERY_TIMEOUT_MS,
      }, [pointsPredicted, faceitGuid, pointsPredicted]);

      if (!deductResult || Number(deductResult.affectedRows || 0) === 0) {
        await mainConn.rollback();
        return NextResponse.json({ ok: false, message: "Pontos insuficientes." }, { status: 400 });
      }

      const [distributionRows]: any = await mainConn.query(
        {
          sql: `SELECT team_chosen, COUNT(*) AS volume
                FROM copadraft_predictions
                WHERE status = 'OPEN'
                  AND is_cashed_out = 0
                  AND (
                    match_id = ?
                    OR (match_id REGEXP '^[0-9]+$' AND CAST(match_id AS UNSIGNED) = ?)
                    OR (match_id LIKE '%::%' AND CAST(SUBSTRING_INDEX(match_id, '::', -1) AS UNSIGNED) = ?)
                  )
                GROUP BY team_chosen`,
          timeout: QUERY_TIMEOUT_MS,
        },
        [matchId, gameId, gameId]
      );

      const groupedRows = Array.isArray(distributionRows) ? (distributionRows as any[]) : [];
      const counts = buildChoiceCounts(groupedRows, time1, time2, "volume");
      const distribution: Record<string, number> = {
        [normalizeText(time1 || "")]: counts.time1,
        ["empate"]: counts.draw,
        [normalizeText(time2 || "")]: counts.time2,
      };

      const market = computeMarketOdds({
        time1,
        time2,
        volumeByChoice: distribution,
      });
      const chosenBucket = resolveChoiceBucket(teamChosen, time1, time2);
      if (!chosenBucket) {
        await mainConn.rollback();
        return NextResponse.json({ ok: false, message: "Escolha inválida para este jogo." }, { status: 400 });
      }
      const chosenKey =
        chosenBucket === "time1" ? market.labels.time1Key : chosenBucket === "time2" ? market.labels.time2Key : market.labels.drawKey;
      const odds = Number(
        market.oddsByChoice[chosenKey] ?? (chosenBucket === "draw" ? 1.5 : 2.0)
      );

      // Create prediction (multiple entries per user/game are allowed).
      const [insertResult]: any = await mainConn.query({
        sql: `INSERT INTO copadraft_predictions 
              (faceit_guid, player_id, match_id, time1, time2, team_chosen, points_predicted, odds, data, hora, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN')`,
        timeout: QUERY_TIMEOUT_MS,
      }, [faceitGuid, playerId, matchId, time1, time2, teamChosen, pointsPredicted, odds, gameDate, gameTime]);
      const predictionIdForWebhook = Number(insertResult?.insertId || 0);

      const [pointsRows]: any = await mainConn.query({
        sql: "SELECT points FROM players WHERE faceit_guid = ? LIMIT 1",
        timeout: QUERY_TIMEOUT_MS,
      }, [faceitGuid]);
      const playerPointsAfter = Number(Array.isArray(pointsRows) ? pointsRows[0]?.points : 0);

      await mainConn.commit();

      await sendPredictionWebhook("PREDICTION_CREATED", {
        predictionId: predictionIdForWebhook,
        playerId,
        faceitGuid,
        matchId,
        team1: time1 || undefined,
        team2: time2 || undefined,
        chosen: teamChosen,
        status: "OPEN",
        pointsPredicted,
        odds,
        playerPointsAfter,
        notes: "Nova previsao",
      });

      return NextResponse.json({ ok: true, message: "Previsão realizada!" });
    } catch (error) {
      await mainConn.rollback();
      throw error;
    }
  } catch (error) {
    console.error("[copadraft/prediction POST]", error);
    return NextResponse.json({ ok: false, message: "Erro ao processar previsão." }, { status: 500 });
  } finally {
    if (mainConn) mainConn.end();
  }
}

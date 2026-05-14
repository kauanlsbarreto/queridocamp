import { NextRequest, NextResponse } from "next/server";

import { createJogadoresConnection, createMainConnection, type Env } from "@/lib/db";
import { getTeamNameByCaptainGuidMap } from "@/lib/copadraft-times";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PalpiteGame = {
  jogo_id: number;
  data: string;
  hora: string;
  time1: string;
  time2: string;
};

type StoredPalpite = {
  id: number;
  faceit_guid: string;
  data: string;
  jogo_id: number;
  palpite_mapa1: string | null;
  palpite_mapa2: string | null;
  palpite_mapa3: string | null;
};

type MyPalpiteStatus = "AGUARDANDO" | "CERTO" | "ERRADO";

type MyPalpiteItem = {
  id: number;
  jogo_id: number;
  data: string;
  hora: string;
  time1: string;
  time2: string;
  palpite: string | null;
  resultado: string | null;
  status: MyPalpiteStatus;
};

type JogoResultRow = {
  time1: string;
  time2: string;
  placar: string | null;
};

type PlayerAccessRow = {
  faceit_guid: string | null;
  palpitar: number | null;
};

type PlayerAdminRow = {
  admin: number | null;
};

type PaidPaymentAccessRow = {
  id: number;
};

type AdminPalpiteItem = {
  id: number;
  jogo_id: number;
  data: string;
  hora: string;
  time1: string;
  time2: string;
  palpite: string | null;
  faceit_guid: string;
  nickname: string;
  admin: number;
};

type MatchesFallbackRow = {
  id: number;
  challenger_team_id: number;
  challenged_team_id: number;
  proposed_date: unknown;
  proposed_time: unknown;
};

type TableColumnRow = {
  Field?: string;
  field?: string;
};

const QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_PALPITES_QUERY_TIMEOUT_MS || 5000);
const PALPITES_SUBMIT_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1503905747187142666/y6EmZWlwMEAgcgEiwyp0NxHXLkmhHmw-D9JgAWTagfWWqMLBg-4Ez0qCNYdshrnDZNHG";

type SubmittedPalpite = {
  jogo_id: number;
  palpite_serie: string | null;
};

async function sendPalpiteSubmissionWebhook(payload: {
  faceitGuid: string;
  playerId: number;
  nickname: string;
  email: string;
  totalSubmitted: number;
  submittedPalpites: SubmittedPalpite[];
  gameDetailsById: Map<number, { jogo_id: number; data: string; hora: string; time1: string; time2: string }>;
}) {
  const lines = payload.submittedPalpites.map((item, index) => {
    const game = payload.gameDetailsById.get(item.jogo_id);
    const teamsLabel = game ? `${game.time1} x ${game.time2}` : `Jogo ${item.jogo_id}`;
    const scheduleLabel = game ? `${game.data} ${game.hora}` : "Data/Hora nao encontrada";
    return `${index + 1}. ${teamsLabel} | ${scheduleLabel} | Palpite: ${item.palpite_serie || "-"}`;
  });

  const body = {
    username: "Palpites Copa Draft",
    embeds: [
      {
        title: "Novo Palpite Enviado",
        color: 0x00bcd4,
        timestamp: new Date().toISOString(),
        fields: [
          { name: "Faceit GUID", value: payload.faceitGuid || "-", inline: false },
          { name: "Player ID", value: String(payload.playerId || "-"), inline: true },
          { name: "Nickname", value: payload.nickname || "-", inline: true },
          { name: "Email", value: payload.email || "-", inline: true },
          { name: "Total de palpites enviados", value: String(payload.totalSubmitted), inline: true },
          {
            name: "Detalhes",
            value: lines.length > 0 ? lines.join("\n").slice(0, 1024) : "Sem detalhes.",
            inline: false,
          },
        ],
      },
    ],
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(PALPITES_SUBMIT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[copadraft/palpites] webhook falhou:", response.status, errorText);
    }
  } catch (error) {
    console.error("[copadraft/palpites] erro ao enviar webhook:", error);
  }
}

function toIsoDate(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value || "").trim();
  const isoLike = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoLike) return isoLike[1];
  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw.slice(0, 10);
}

function toHourMinute(value: unknown) {
  if (!value) return "";
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(11, 16);
  }
  const raw = String(value || "").trim();
  const hhmm = raw.match(/^(\d{2}:\d{2})/);
  if (hhmm) return hhmm[1];
  const parsed = new Date(raw);
  if (Number.isFinite(parsed.getTime())) {
    return parsed.toISOString().slice(11, 16);
  }
  return raw.slice(0, 5);
}

function normalizeGuid(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

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
  const raw = String(value || "").trim();
  const parsed = parseSerieToScores(raw);
  if (!parsed) return null;
  return `${parsed.score1}x${parsed.score2}`;
}

function parseSerieToScores(value: string) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{1,2})\s*x\s*(\d{1,2})$/i);
  if (!match) return null;

  const score1 = Number(match[1]);
  const score2 = Number(match[2]);
  if (!Number.isInteger(score1) || !Number.isInteger(score2)) return null;

  return { score1, score2 };
}

async function getTableColumns(mainConn: any, tableName: string) {
  const [rows]: any = await mainConn.query(
    {
      sql: `SHOW COLUMNS FROM ${tableName}`,
      timeout: QUERY_TIMEOUT_MS,
    }
  );

  const set = new Set<string>();
  if (Array.isArray(rows)) {
    for (const row of rows as TableColumnRow[]) {
      const field = String(row?.Field || row?.field || "").trim().toLowerCase();
      if (field) set.add(field);
    }
  }
  return set;
}

async function ensurePlayersPalpitarColumn(mainConn: any) {
  const [columnsRows] = await mainConn.query(
    {
      sql: "SHOW COLUMNS FROM players LIKE 'palpitar'",
      timeout: QUERY_TIMEOUT_MS,
    }
  );

  if (Array.isArray(columnsRows) && columnsRows.length > 0) {
    return;
  }

  try {
    await mainConn.query({
      sql: "ALTER TABLE players ADD COLUMN palpitar TINYINT(1) NULL DEFAULT NULL",
      timeout: QUERY_TIMEOUT_MS,
    });
  } catch {
    // Ignore race condition when column was created concurrently.
  }
}

async function ensurePalpitesPaymentsTable(mainConn: any) {
  await mainConn.query({
    sql: `CREATE TABLE IF NOT EXISTS copadraft_palpites_pagamentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      payment_ref VARCHAR(120) NOT NULL UNIQUE,
      provider_type VARCHAR(20) NOT NULL,
      provider_id VARCHAR(120) DEFAULT NULL,
      provider_checkout_url TEXT,
      provider_qr_code_url TEXT,
      provider_qr_code_text TEXT,
      faceit_guid VARCHAR(255) NOT NULL,
      player_id INT NOT NULL,
      metodo VARCHAR(20) NOT NULL,
      amount_cents INT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      expires_at DATETIME DEFAULT NULL,
      paid_at DATETIME DEFAULT NULL,
      failure_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_faceit_status (faceit_guid, status),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    timeout: QUERY_TIMEOUT_MS,
  });
}

async function restorePalpiteAccessFromPaid(mainConn: any, faceitGuid: string) {
  if (!faceitGuid) return false;

  const [paidRows] = await mainConn.query(
    {
      sql: `SELECT id
            FROM copadraft_palpites_pagamentos
            WHERE faceit_guid = ?
              AND status = 'PAID'
            ORDER BY paid_at DESC, id DESC
            LIMIT 1`,
      timeout: QUERY_TIMEOUT_MS,
    },
    [faceitGuid]
  );

  const rows = (Array.isArray(paidRows) ? paidRows : []) as PaidPaymentAccessRow[];
  if (!rows.length) return false;

  await mainConn.query(
    {
      sql: "UPDATE players SET palpitar = 1 WHERE faceit_guid = ? AND COALESCE(palpitar, 0) <> 1",
      timeout: QUERY_TIMEOUT_MS,
    },
    [faceitGuid]
  );

  return true;
}

async function resolvePalpiteAccess(mainConn: any, faceitGuid: string) {
  if (!faceitGuid) {
    return {
      hasAccess: false,
      reason: "LOGIN_REQUIRED",
    };
  }

  const [playerRows] = await mainConn.query(
    {
      sql: "SELECT faceit_guid, palpitar FROM players WHERE faceit_guid = ? LIMIT 1",
      timeout: QUERY_TIMEOUT_MS,
    },
    [faceitGuid]
  );

  const rows = (Array.isArray(playerRows) ? playerRows : []) as PlayerAccessRow[];
  if (!rows.length) {
    return {
      hasAccess: false,
      reason: "PLAYER_NOT_FOUND",
    };
  }

  const alreadyUnlocked = Number(rows[0]?.palpitar || 0) === 1;
  if (alreadyUnlocked) {
    return {
      hasAccess: true,
      reason: "OK",
    };
  }

  const restored = await restorePalpiteAccessFromPaid(mainConn, faceitGuid);
  if (restored) {
    return {
      hasAccess: true,
      reason: "RESTORED_FROM_PAID",
    };
  }

  return {
    hasAccess: false,
    reason: "PAYMENT_REQUIRED",
  };
}

async function resolveAdminLevel(mainConn: any, faceitGuid: string) {
  if (!faceitGuid) return 0;

  const [rows] = await mainConn.query(
    {
      sql: "SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1",
      timeout: QUERY_TIMEOUT_MS,
    },
    [faceitGuid]
  );

  const adminRows = (Array.isArray(rows) ? rows : []) as PlayerAdminRow[];
  if (!adminRows.length) return 0;

  const level = Number(adminRows[0]?.admin || 0);
  return Number.isFinite(level) ? level : 0;
}

async function ensureTables(mainConn: any) {
  await mainConn.query({
    sql: `CREATE TABLE IF NOT EXISTS palpites_jogos (
      jogo_id INT NOT NULL AUTO_INCREMENT,
      data DATE NOT NULL,
      hora TIME NOT NULL,
      time1 VARCHAR(120) NOT NULL,
      time2 VARCHAR(120) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (jogo_id),
      KEY idx_data (data)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    timeout: QUERY_TIMEOUT_MS,
  });

  await mainConn.query({
    sql: `CREATE TABLE IF NOT EXISTS palpites (
      id INT NOT NULL AUTO_INCREMENT,
      faceit_guid VARCHAR(120) NOT NULL,
      jogo_id INT NOT NULL,
      score_time1 TINYINT UNSIGNED NOT NULL,
      score_time2 TINYINT UNSIGNED NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_faceit_jogo (faceit_guid, jogo_id),
      KEY idx_faceit_guid (faceit_guid),
      KEY idx_jogo_id (jogo_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    timeout: QUERY_TIMEOUT_MS,
  });
}

async function loadFallbackGames(env: Env, mainConn: any): Promise<PalpiteGame[]> {
  let jogadoresConn: any = null;

  try {
    const [rows]: any = await mainConn.query({
      sql: `SELECT id, challenger_team_id, challenged_team_id, proposed_date, proposed_time
            FROM matches
            WHERE status = 'accepted'
              AND proposed_date IS NOT NULL
              AND proposed_time IS NOT NULL
            ORDER BY proposed_date ASC, proposed_time ASC, id ASC`,
      timeout: QUERY_TIMEOUT_MS,
    });

    const matches = (Array.isArray(rows) ? rows : []) as MatchesFallbackRow[];
    if (matches.length === 0) return [];

    const teamIds = Array.from(
      new Set(
        matches
          .flatMap((match) => [Number(match.challenger_team_id || 0), Number(match.challenged_team_id || 0)])
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    const teamIdToName = new Map<number, string>();
    if (teamIds.length > 0) {
      jogadoresConn = await createJogadoresConnection(env);
      const placeholders = teamIds.map(() => "?").join(",");
      const [captains]: any = await jogadoresConn.query(
        {
          sql: `SELECT id, faceit_guid FROM jogadores WHERE pote = 1 AND id IN (${placeholders})`,
          timeout: QUERY_TIMEOUT_MS,
        },
        teamIds
      );

      const byGuid = getTeamNameByCaptainGuidMap();
      if (Array.isArray(captains)) {
        for (const row of captains as any[]) {
          const id = Number(row?.id || 0);
          const guid = normalizeGuid(row?.faceit_guid);
          if (id > 0) {
            teamIdToName.set(id, byGuid.get(guid) || `Time ${id}`);
          }
        }
      }
    }

    return matches.map((match) => {
      const time1Id = Number(match.challenger_team_id || 0);
      const time2Id = Number(match.challenged_team_id || 0);
      return {
        jogo_id: Number(match.id || 0),
        data: toIsoDate(match.proposed_date),
        hora: toHourMinute(match.proposed_time),
        time1: teamIdToName.get(time1Id) || `Time ${time1Id}`,
        time2: teamIdToName.get(time2Id) || `Time ${time2Id}`,
      } satisfies PalpiteGame;
    });
  } finally {
    await jogadoresConn?.end?.();
  }
}

async function loadGames(env: Env, mainConn: any): Promise<PalpiteGame[]> {
  const [rows]: any = await mainConn.query({
    sql: `SELECT jogo_id, data, hora, time1, time2
          FROM palpites_jogos
          ORDER BY data ASC, hora ASC, jogo_id ASC`,
    timeout: QUERY_TIMEOUT_MS,
  });

  const gamesFromTable = Array.isArray(rows)
    ? (rows as any[])
        .map((row) => ({
          jogo_id: Number(row?.jogo_id || 0),
          data: toIsoDate(row?.data),
          hora: toHourMinute(row?.hora),
          time1: String(row?.time1 || "").trim(),
          time2: String(row?.time2 || "").trim(),
        }))
        .filter((game) => game.jogo_id > 0 && game.data && game.time1 && game.time2)
    : [];

  if (gamesFromTable.length > 0) return gamesFromTable;

  return loadFallbackGames(env, mainConn);
}

export async function GET(request: NextRequest) {
  let mainConn: any = null;

  try {
    const env = (await getRuntimeEnv()) as Env;
    mainConn = await createMainConnection(env);

    await ensureTables(mainConn);
    await ensurePlayersPalpitarColumn(mainConn);
    await ensurePalpitesPaymentsTable(mainConn);

    const faceitGuid = normalizeGuid(request.nextUrl.searchParams.get("faceit_guid"));
    const gamesOnly = request.nextUrl.searchParams.get("games_only") === "1";
    const access = await resolvePalpiteAccess(mainConn, faceitGuid);
    const adminLevel = await resolveAdminLevel(mainConn, faceitGuid);
    const canViewAllPalpites = adminLevel >= 1 && adminLevel <= 5;
    const palpitesColumns = await getTableColumns(mainConn, "palpites");
    const hasDataCol = palpitesColumns.has("data");
    const hasPalpiteMapa1 = palpitesColumns.has("palpite_mapa1");
    const hasPalpiteMapa2 = palpitesColumns.has("palpite_mapa2");
    const hasPalpiteMapa3 = palpitesColumns.has("palpite_mapa3");
    const hasScoreCols = palpitesColumns.has("score_time1") && palpitesColumns.has("score_time2");
    const gameById = new Map<number, PalpiteGame>();

    if (gamesOnly) {
      const games = await loadGames(env, mainConn);
      return NextResponse.json({
        ok: true,
        games,
      });
    }

    if (!access.hasAccess && !canViewAllPalpites) {
      return NextResponse.json({
        ok: true,
        hasAccess: false,
        accessReason: access.reason,
        adminLevel,
        canViewAllPalpites,
        games: [],
        lockedDates: [],
        existingPalpites: [],
        myPalpites: [],
        adminPalpites: [],
      });
    }

    const games = await loadGames(env, mainConn);

    let existingPalpites: StoredPalpite[] = [];
    let myPalpites: MyPalpiteItem[] = [];

    if (faceitGuid) {
      const selectFields = [
        "p.id",
        "p.faceit_guid",
        "p.jogo_id",
        hasDataCol ? "p.data AS p_data" : "NULL AS p_data",
        hasPalpiteMapa1 ? "p.palpite_mapa1" : "NULL AS palpite_mapa1",
        hasPalpiteMapa2 ? "p.palpite_mapa2" : "NULL AS palpite_mapa2",
        hasPalpiteMapa3 ? "p.palpite_mapa3" : "NULL AS palpite_mapa3",
        hasScoreCols ? "p.score_time1" : "NULL AS score_time1",
        hasScoreCols ? "p.score_time2" : "NULL AS score_time2",
      ].join(", ");

      const [palpitesRows]: any = await mainConn.query(
        {
          sql: `SELECT ${selectFields}
                FROM palpites p
                WHERE p.faceit_guid = ?`,
          timeout: QUERY_TIMEOUT_MS,
        },
        [faceitGuid]
      );

      for (const game of games) {
        gameById.set(Number(game.jogo_id || 0), game);
      }

      existingPalpites = Array.isArray(palpitesRows)
        ? (palpitesRows as any[]).map((row) => {
            const jogoId = Number(row?.jogo_id || 0);
            const game = gameById.get(jogoId);
            const serieFromScores =
              row?.score_time1 != null && row?.score_time2 != null
                ? `${Number(row.score_time1)}x${Number(row.score_time2)}`
                : null;

            return {
              id: Number(row?.id || 0),
              faceit_guid: normalizeGuid(row?.faceit_guid),
              data: toIsoDate(row?.p_data || game?.data || ""),
              jogo_id: jogoId,
              palpite_mapa1:
                row?.palpite_mapa1 != null
                  ? String(row.palpite_mapa1)
                  : serieFromScores,
              palpite_mapa2: row?.palpite_mapa2 != null ? String(row.palpite_mapa2) : null,
              palpite_mapa3: row?.palpite_mapa3 != null ? String(row.palpite_mapa3) : null,
            };
          })
        : [];

      const [jogosRows]: any = await mainConn.query({
        sql: `SELECT time1, time2, placar
              FROM jogos
              WHERE placar IS NOT NULL
                AND TRIM(placar) <> ''`,
        timeout: QUERY_TIMEOUT_MS,
      });

      const scoreByTeamsOnlyKey = new Map<string, string>();
      if (Array.isArray(jogosRows)) {
        for (const row of jogosRows as JogoResultRow[]) {
          const key = buildTeamsOnlyKey(row?.time1, row?.time2);
          const score = normalizeSerie(row?.placar);
          if (key && score) {
            scoreByTeamsOnlyKey.set(key, score);
          }
        }
      }

      myPalpites = existingPalpites
        .map((palpite) => {
          const game = gameById.get(Number(palpite.jogo_id || 0));
          const teamsKey = buildTeamsOnlyKey(game?.time1 || "", game?.time2 || "");
          const predictedScore = normalizeSerie(palpite.palpite_mapa1);
          const actualScore = teamsKey ? scoreByTeamsOnlyKey.get(teamsKey) || null : null;

          let status: MyPalpiteStatus = "AGUARDANDO";
          if (predictedScore && actualScore) {
            status = predictedScore === actualScore ? "CERTO" : "ERRADO";
          }

          return {
            id: Number(palpite.id || 0),
            jogo_id: Number(palpite.jogo_id || 0),
            data: toIsoDate(palpite.data || game?.data || ""),
            hora: toHourMinute(game?.hora || ""),
            time1: String(game?.time1 || "Time A").trim(),
            time2: String(game?.time2 || "Time B").trim(),
            palpite: predictedScore,
            resultado: actualScore,
            status,
          } satisfies MyPalpiteItem;
        })
        .sort((a, b) => {
          const dateCmp = String(b.data || "").localeCompare(String(a.data || ""));
          if (dateCmp !== 0) return dateCmp;
          return Number(b.jogo_id || 0) - Number(a.jogo_id || 0);
        });

    }

    let adminPalpites: AdminPalpiteItem[] = [];

    if (canViewAllPalpites) {
      const adminSelectFields = [
        "p.id",
        "p.faceit_guid",
        "p.jogo_id",
        hasDataCol ? "p.data AS p_data" : "NULL AS p_data",
        hasPalpiteMapa1 ? "p.palpite_mapa1" : "NULL AS palpite_mapa1",
        hasPalpiteMapa2 ? "p.palpite_mapa2" : "NULL AS palpite_mapa2",
        hasPalpiteMapa3 ? "p.palpite_mapa3" : "NULL AS palpite_mapa3",
        hasScoreCols ? "p.score_time1" : "NULL AS score_time1",
        hasScoreCols ? "p.score_time2" : "NULL AS score_time2",
        "pl.nickname AS player_nickname",
        "pl.admin AS player_admin",
      ].join(", ");

      const [adminRows]: any = await mainConn.query(
        {
          sql: `SELECT ${adminSelectFields}
                FROM palpites p
                LEFT JOIN players pl ON pl.faceit_guid = p.faceit_guid
                ORDER BY p.created_at DESC, p.id DESC`,
          timeout: QUERY_TIMEOUT_MS,
        }
      );

      adminPalpites = Array.isArray(adminRows)
        ? (adminRows as any[])
            .map((row) => {
              const jogoId = Number(row?.jogo_id || 0);
              const game = gameById.get(jogoId);
              const serieFromScores =
                row?.score_time1 != null && row?.score_time2 != null
                  ? `${Number(row.score_time1)}x${Number(row.score_time2)}`
                  : null;

              return {
                id: Number(row?.id || 0),
                jogo_id: jogoId,
                data: toIsoDate(row?.p_data || game?.data || ""),
                hora: toHourMinute(game?.hora || ""),
                time1: String(game?.time1 || "Time A").trim(),
                time2: String(game?.time2 || "Time B").trim(),
                palpite:
                  row?.palpite_mapa1 != null
                    ? String(row.palpite_mapa1)
                    : serieFromScores,
                faceit_guid: normalizeGuid(row?.faceit_guid),
                nickname: String(row?.player_nickname || row?.faceit_guid || "Desconhecido").trim(),
                admin: Number(row?.player_admin || 0),
              } satisfies AdminPalpiteItem;
            })
            .filter((item) => item.jogo_id > 0)
            .sort((a, b) => {
              const dateCmp = String(b.data || "").localeCompare(String(a.data || ""));
              if (dateCmp !== 0) return dateCmp;
              const gameCmp = Number(b.jogo_id || 0) - Number(a.jogo_id || 0);
              if (gameCmp !== 0) return gameCmp;
              return String(a.nickname || "").localeCompare(String(b.nickname || ""));
            })
        : [];
    }

    return NextResponse.json({
      ok: true,
      hasAccess: access.hasAccess || canViewAllPalpites,
      accessReason: access.hasAccess ? "OK" : canViewAllPalpites ? "ADMIN_VIEW" : access.reason,
      adminLevel,
      canViewAllPalpites,
      games,
      lockedDates: [],
      existingPalpites,
      myPalpites,
      adminPalpites,
    });
  } catch (error) {
    console.error("[copadraft/palpites][GET] erro:", error);
    return NextResponse.json({ ok: false, message: "Falha ao carregar palpites." }, { status: 500 });
  } finally {
    await mainConn?.end?.();
  }
}

export async function POST(request: NextRequest) {
  let mainConn: any = null;

  try {
    const env = (await getRuntimeEnv()) as Env;
    mainConn = await createMainConnection(env);

    await ensureTables(mainConn);
    await ensurePlayersPalpitarColumn(mainConn);
    await ensurePalpitesPaymentsTable(mainConn);

    const body = await request.json().catch(() => ({}));
    const faceitGuid = normalizeGuid(body?.faceit_guid);
    const palpites = Array.isArray(body?.palpites) ? body.palpites : [];

    const palpitesColumns = await getTableColumns(mainConn, "palpites");
    const hasDataCol = palpitesColumns.has("data");
    const hasPalpiteMapa1 = palpitesColumns.has("palpite_mapa1");
    const hasPalpiteMapa2 = palpitesColumns.has("palpite_mapa2");
    const hasPalpiteMapa3 = palpitesColumns.has("palpite_mapa3");
    const hasScoreCols = palpitesColumns.has("score_time1") && palpitesColumns.has("score_time2");

    if (!hasPalpiteMapa1 && !hasScoreCols) {
      return NextResponse.json(
        {
          ok: false,
          message: "Tabela palpites sem colunas de placar esperadas (palpite_mapa1 ou score_time1/score_time2).",
        },
        { status: 500 }
      );
    }

    if (!faceitGuid) {
      return NextResponse.json({ ok: false, message: "faceit_guid e obrigatorio." }, { status: 400 });
    }

    const access = await resolvePalpiteAccess(mainConn, faceitGuid);
    if (!access.hasAccess) {
      return NextResponse.json(
        {
          ok: false,
          message: "Acesso bloqueado. Pagamento necessario para liberar palpites.",
          code: "PAYMENT_REQUIRED",
        },
        { status: 403 }
      );
    }

    if (palpites.length === 0) {
      return NextResponse.json({ ok: false, message: "Nenhum palpite informado." }, { status: 400 });
    }

    const availableGames = await loadGames(env, mainConn);
    const gameById = new Map<number, PalpiteGame>();
    for (const game of availableGames) {
      const jogoId = Number(game.jogo_id || 0);
      if (jogoId > 0) {
        gameById.set(jogoId, game);
      }
    }

    await mainConn.beginTransaction();

    let insertedCount = 0;
    let duplicatedCount = 0;
    const submittedPalpites: SubmittedPalpite[] = [];

    for (const item of palpites) {
      const jogoId = Number(item?.jogo_id || 0);
      if (!Number.isInteger(jogoId) || jogoId <= 0) continue;

      const game = gameById.get(jogoId);
      if (!game) {
        await mainConn.rollback();
        return NextResponse.json(
          {
            ok: false,
            message: `Jogo invalido para palpite (ID ${jogoId}).`,
          },
          { status: 400 }
        );
      }

      const [existingRows]: any = await mainConn.query(
        {
          sql: `SELECT id FROM palpites WHERE faceit_guid = ? AND jogo_id = ? LIMIT 1`,
          timeout: QUERY_TIMEOUT_MS,
        },
        [faceitGuid, jogoId]
      );

      if (Array.isArray(existingRows) && existingRows.length > 0) {
        duplicatedCount += 1;
        continue;
      }

      const palpiteSerie = String(item?.palpite_serie ?? item?.palpite_mapa1 ?? "").trim() || null;
      const palpiteMapa2 = String(item?.palpite_mapa2 || "").trim() || null;
      const palpiteMapa3 = String(item?.palpite_mapa3 || "").trim() || null;

      if (!palpiteSerie) {
        continue;
      }

      const parsedScores = parseSerieToScores(palpiteSerie);
      if (hasScoreCols && !parsedScores) {
        await mainConn.rollback();
        return NextResponse.json(
          {
            ok: false,
            message: "Formato de palpite invalido. Use por exemplo 2x1.",
          },
          { status: 400 }
        );
      }

      const insertColumns: string[] = ["faceit_guid", "jogo_id"];
      const insertValues: any[] = [faceitGuid, jogoId];

      if (hasDataCol) {
        const canonicalData = toIsoDate(game.data);
        if (!canonicalData) {
          await mainConn.rollback();
          return NextResponse.json(
            {
              ok: false,
              message: `Jogo ${jogoId} sem data valida para registrar palpite.`,
            },
            { status: 400 }
          );
        }
        insertColumns.push("data");
        insertValues.push(canonicalData);
      }

      if (hasPalpiteMapa1) {
        insertColumns.push("palpite_mapa1");
        insertValues.push(palpiteSerie);
      }

      if (hasPalpiteMapa2) {
        insertColumns.push("palpite_mapa2");
        insertValues.push(palpiteMapa2);
      }

      if (hasPalpiteMapa3) {
        insertColumns.push("palpite_mapa3");
        insertValues.push(palpiteMapa3);
      }

      if (hasScoreCols && parsedScores) {
        insertColumns.push("score_time1", "score_time2");
        insertValues.push(parsedScores.score1, parsedScores.score2);
      }

      const placeholders = insertColumns.map(() => "?").join(", ");

      await mainConn.query(
        {
          sql: `INSERT INTO palpites (${insertColumns.join(", ")})
                VALUES (${placeholders})`,
          timeout: QUERY_TIMEOUT_MS,
        },
        insertValues
      );

      submittedPalpites.push({
        jogo_id: jogoId,
        palpite_serie: palpiteSerie,
      });
      insertedCount += 1;
    }

    if (insertedCount === 0 && duplicatedCount > 0) {
      await mainConn.rollback();
      return NextResponse.json(
        { ok: false, message: "Voce ja enviou palpite para este jogo.", locked: true },
        { status: 409 }
      );
    }

    await mainConn.commit();

    if (insertedCount > 0) {
      try {
        const [playerRows]: any = await mainConn.query(
          {
            sql: "SELECT id, nickname, email FROM players WHERE faceit_guid = ? LIMIT 1",
            timeout: QUERY_TIMEOUT_MS,
          },
          [faceitGuid]
        );

        const player = Array.isArray(playerRows) && playerRows.length > 0 ? playerRows[0] : null;

        const uniqueGameIds = Array.from(new Set(submittedPalpites.map((item) => item.jogo_id).filter((id) => id > 0)));
        const gameDetailsById = new Map<number, { jogo_id: number; data: string; hora: string; time1: string; time2: string }>();

        for (const jogoId of uniqueGameIds) {
          const game = gameById.get(jogoId);
          if (!game) continue;
          gameDetailsById.set(jogoId, {
            jogo_id: jogoId,
            data: toIsoDate(game.data),
            hora: toHourMinute(game.hora),
            time1: String(game.time1 || "").trim() || `Time A (${jogoId})`,
            time2: String(game.time2 || "").trim() || `Time B (${jogoId})`,
          });
        }

        await sendPalpiteSubmissionWebhook({
          faceitGuid,
          playerId: Number(player?.id || 0),
          nickname: String(player?.nickname || ""),
          email: String(player?.email || ""),
          totalSubmitted: insertedCount,
          submittedPalpites,
          gameDetailsById,
        });
      } catch (webhookError) {
        console.error("[copadraft/palpites] erro ao preparar webhook de palpite:", webhookError);
      }
    }

    return NextResponse.json({
      ok: true,
      message: insertedCount > 0 ? "Palpite enviado com sucesso!" : "Nenhum novo palpite enviado.",
      insertedCount,
      duplicatedCount,
    });
  } catch (error) {
    await mainConn?.rollback?.();
    console.error("[copadraft/palpites][POST] erro:", error);
    return NextResponse.json({ ok: false, message: "Falha ao enviar palpites." }, { status: 500 });
  } finally {
    await mainConn?.end?.();
  }
}

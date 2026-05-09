import { NextRequest, NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { createMainConnection, createJogadoresConnection } from "@/lib/db";
import type { Env } from "@/lib/db";
import { getTeamNameByCaptainGuidMap } from "@/lib/copadraft-times";
import { sendDesafiarDiscordWebhook } from "@/lib/copadraft-desafiar-discord-webhooks";
import { sendDesafiarErrorBrevoEmail } from "@/lib/copadraft-desafiar-brevo-error";

const API_QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_DESAFIAR_API_QUERY_TIMEOUT_MS || 5000);
const API_GET_CACHE_TTL_MS = Number(process.env.COPADRAFT_DESAFIAR_GET_CACHE_TTL_MS || 15000);

let cachedMatchesResponse: { expiresAt: number; matches: any[] } | null = null;

function invalidateMatchesGetCache() {
  cachedMatchesResponse = null;
}

async function queryWithTimeout(conn: any, sql: string, values?: any[]) {
  if (Array.isArray(values)) {
    return conn.query({ sql, timeout: API_QUERY_TIMEOUT_MS }, values);
  }
  return conn.query({ sql, timeout: API_QUERY_TIMEOUT_MS });
}

// Adds missing columns to matches table (compatible with old MySQL versions)
const MIGRATION_COLUMNS: Array<{ name: string; sql: string }> = [
  { name: "rodada", sql: "ALTER TABLE matches ADD COLUMN rodada INT DEFAULT NULL" },
  { name: "counter_date", sql: "ALTER TABLE matches ADD COLUMN counter_date DATE DEFAULT NULL" },
  { name: "counter_time", sql: "ALTER TABLE matches ADD COLUMN counter_time TIME DEFAULT NULL" },
  { name: "counter_message", sql: "ALTER TABLE matches ADD COLUMN counter_message TEXT DEFAULT NULL" },
];

async function runMigrations(conn: any) {
  for (const migration of MIGRATION_COLUMNS) {
    try {
      const [existsRows]: any = await queryWithTimeout(conn, "SHOW COLUMNS FROM matches LIKE ?", [migration.name]);
      if (Array.isArray(existsRows) && existsRows.length > 0) continue;
      await queryWithTimeout(conn, migration.sql);
    } catch {
      // Keep page/API resilient even if migration fails.
    }
  }
}

async function getUserTeamId(
  jogadoresConn: any,
  faceit_guid: string
): Promise<number | null> {
  if (!faceit_guid) return null;
  const [rows]: any = await queryWithTimeout(
    jogadoresConn,
    "SELECT id, pote, timeid FROM jogadores WHERE faceit_guid = ? LIMIT 1",
    [faceit_guid.trim().toLowerCase()]
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const row = rows[0] as any;
  const pote = Number(row.pote || 0);
  const userId = Number(row.id || 0);
  const timeid = Number(row.timeid || 0);
  if (pote === 1 && userId > 0) return userId;
  if (timeid > 0) return timeid;
  return null;
}

async function isAdminOne(mainConn: any, faceit_guid: string): Promise<boolean> {
  if (!faceit_guid) return false;
  try {
    const [rows]: any = await queryWithTimeout(
      mainConn,
      "SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1",
      [faceit_guid.trim().toLowerCase()]
    );
    if (!Array.isArray(rows) || rows.length === 0) return false;
    return Number(rows[0]?.admin || 0) === 1;
  } catch {
    return false;
  }
}

async function isValidTeamId(jogadoresConn: any, teamId: number): Promise<boolean> {
  if (!Number.isInteger(teamId) || teamId <= 0) return false;
  try {
    const [rows]: any = await queryWithTimeout(
      jogadoresConn,
      "SELECT id FROM jogadores WHERE id = ? AND pote = 1 LIMIT 1",
      [teamId]
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function getActorNickname(mainConn: any, faceit_guid: string): Promise<string> {
  if (!faceit_guid) return "Desconhecido";
  try {
    const [rows]: any = await queryWithTimeout(
      mainConn,
      "SELECT nickname FROM players WHERE faceit_guid = ? LIMIT 1",
      [faceit_guid.trim().toLowerCase()]
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const nick = String(rows[0]?.nickname || "").trim();
      if (nick) return nick;
    }
  } catch {
    // fallback below
  }
  return faceit_guid;
}

async function loadTeamNameMapByCaptainGuid() {
  return getTeamNameByCaptainGuidMap();
}

async function getTeamNamesByIds(jogadoresConn: any, teamIds: number[]) {
  const result = new Map<number, string>();
  const uniqueIds = Array.from(new Set(teamIds.filter((v) => Number.isInteger(v) && v > 0)));
  if (uniqueIds.length === 0) return result;

  const teamByCaptainGuid = await loadTeamNameMapByCaptainGuid();
  const placeholders = uniqueIds.map(() => "?").join(",");

  try {
    const [rows]: any = await queryWithTimeout(
      jogadoresConn,
      `SELECT id, faceit_guid FROM jogadores WHERE pote = 1 AND id IN (${placeholders})`,
      uniqueIds
    );

    if (Array.isArray(rows)) {
      for (const row of rows as any[]) {
        const teamId = Number(row?.id || 0);
        const guid = String(row?.faceit_guid || "").trim().toLowerCase();
        const teamName = teamByCaptainGuid.get(guid) || `Time ${teamId}`;
        if (teamId > 0) result.set(teamId, teamName);
      }
    }
  } catch {
    for (const id of uniqueIds) result.set(id, `Time ${id}`);
  }

  return result;
}

function rowToMatch(r: any) {
  function fmtDate(v: any) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const raw = String(v).trim();
    const isoLike = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoLike) return isoLike[1];
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return raw.slice(0, 10);
  }
  function fmtTime(v: any) {
    if (!v) return null;
    if (v instanceof Date && Number.isFinite(v.getTime())) return v.toISOString().slice(11, 16);
    const raw = String(v).trim();
    const hhmm = raw.match(/^(\d{2}:\d{2})/);
    if (hhmm) return hhmm[1];
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString().slice(11, 16);
    return raw.slice(0, 5);
  }
  function fmtTs(v: any) {
    if (!v) return null;
    if (v instanceof Date) return v.toISOString().slice(0, 16).replace("T", " ");
    return String(v).slice(0, 16);
  }
  return {
    id: Number(r.id),
    challenger_team_id: Number(r.challenger_team_id),
    challenged_team_id: Number(r.challenged_team_id),
    rodada: r.rodada != null ? Number(r.rodada) : null,
    proposed_date: fmtDate(r.proposed_date),
    proposed_time: fmtTime(r.proposed_time),
    message: r.message ? String(r.message) : null,
    status: String(r.status || "pending"),
    counter_date: fmtDate(r.counter_date),
    counter_time: fmtTime(r.counter_time),
    counter_message: r.counter_message ? String(r.counter_message) : null,
    accepted_at: fmtTs(r.accepted_at),
    created_at: fmtTs(r.created_at),
  };
}

// GET — fetch all matches for real-time polling
export async function GET(req: NextRequest) {
  const now = Date.now();
  if (cachedMatchesResponse && cachedMatchesResponse.expiresAt > now) {
    return NextResponse.json(
      { matches: cachedMatchesResponse.matches, cached: true },
      {
        headers: {
          "Cache-Control": "public, max-age=5, s-maxage=15, stale-while-revalidate=30",
        },
      }
    );
  }

  try {
    const env = await getRuntimeEnv();
    const mainConn = await createMainConnection(env);

    try {
      const [matchRows]: any = await queryWithTimeout(
        mainConn,
        `SELECT id, challenger_team_id, challenged_team_id, rodada,
                proposed_date, proposed_time, message, status,
                counter_date, counter_time, counter_message,
                accepted_at, created_at
         FROM matches
         ORDER BY created_at DESC`
      );

      const matches = Array.isArray(matchRows)
        ? (matchRows as any[]).map(rowToMatch)
        : [];

      cachedMatchesResponse = {
        expiresAt: now + API_GET_CACHE_TTL_MS,
        matches,
      };

      return NextResponse.json(
        { matches, cached: false },
        {
          headers: {
            "Cache-Control": "public, max-age=5, s-maxage=15, stale-while-revalidate=30",
          },
        }
      );
    } finally {
      await mainConn?.end?.();
    }
  } catch (error) {
    console.error("[desafiar/api GET]", error);
    return NextResponse.json({ matches: [], error: "Erro ao carregar matches" }, { status: 500 });
  }
}

// POST — create a new match proposal
export async function POST(req: NextRequest) {
  let faceitGuidForError = "";
  let requestUrlForError = "";
  try {
    const body = await req.json();
    requestUrlForError = String(req.url || "");
    const { faceit_guid, challenged_team_id, acting_team_id, rodada, proposed_date, proposed_time, message } = body;
    faceitGuidForError = String(faceit_guid || "").trim().toLowerCase();

    if (!faceit_guid || !challenged_team_id || !proposed_date || !proposed_time) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const env = await getRuntimeEnv();

    const [jogadoresConn, mainConn] = await Promise.all([
      createJogadoresConnection(env),
      createMainConnection(env),
    ]);

    try {
      await runMigrations(mainConn);

      const admin1 = await isAdminOne(mainConn, faceit_guid);
      const userTeamId = await getUserTeamId(jogadoresConn, faceit_guid);
      if (!userTeamId && !admin1) {
        return NextResponse.json({ error: "Você precisa estar em um time para desafiar" }, { status: 403 });
      }

      const teamChallenger =
        admin1 && Number(acting_team_id) > 0
          ? Number(acting_team_id)
          : Number(userTeamId);

      if (!teamChallenger) {
        return NextResponse.json({ error: "Time desafiante inválido" }, { status: 400 });
      }

      const challengerValid = await isValidTeamId(jogadoresConn, teamChallenger);
      const challengedValid = await isValidTeamId(jogadoresConn, Number(challenged_team_id));
      if (!challengerValid || !challengedValid) {
        return NextResponse.json({ error: "Time(s) inválido(s)" }, { status: 400 });
      }

      if (teamChallenger === Number(challenged_team_id)) {
        return NextResponse.json({ error: "Você não pode desafiar seu próprio time" }, { status: 400 });
      }

      // Check for existing active proposal between these teams for this rodada
      const [existing]: any = await queryWithTimeout(
        mainConn,
        `SELECT id FROM matches
         WHERE ((challenger_team_id = ? AND challenged_team_id = ?)
             OR (challenger_team_id = ? AND challenged_team_id = ?))
           AND (rodada = ? OR (rodada IS NULL AND ? IS NULL))
           AND status NOT IN ('cancelled','declined','finished')
         LIMIT 1`,
        [teamChallenger, challenged_team_id, challenged_team_id, teamChallenger, rodada ?? null, rodada ?? null]
      );

      if (Array.isArray(existing) && existing.length > 0) {
        return NextResponse.json({ error: "Já existe uma proposta ativa para esta rodada entre estes times" }, { status: 409 });
      }

      const [result]: any = await queryWithTimeout(
        mainConn,
        `INSERT INTO matches (challenger_team_id, challenged_team_id, rodada, proposed_date, proposed_time, message, status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [teamChallenger, Number(challenged_team_id), rodada ?? null, proposed_date, proposed_time, message ?? null]
      );

      const newId = result.insertId;
      const [newRows]: any = await queryWithTimeout(mainConn, "SELECT * FROM matches WHERE id = ? LIMIT 1", [newId]);
      const match = Array.isArray(newRows) && newRows.length > 0 ? rowToMatch(newRows[0]) : null;

      if (match) {
        try {
          const actorNickname = await getActorNickname(mainConn, faceit_guid);
          const teamNames = await getTeamNamesByIds(jogadoresConn, [
            Number(match.challenger_team_id),
            Number(match.challenged_team_id),
          ]);

          await sendDesafiarDiscordWebhook({
            event: "sent",
            matchId: Number(match.id),
            rodada: match.rodada,
            challengerTeam: teamNames.get(Number(match.challenger_team_id)) || `Time ${match.challenger_team_id}`,
            challengedTeam: teamNames.get(Number(match.challenged_team_id)) || `Time ${match.challenged_team_id}`,
            actorNickname,
            actorGuid: String(faceit_guid || "").trim().toLowerCase(),
            date: match.proposed_date,
            time: match.proposed_time,
            message: match.message,
          });
        } catch (notifyError) {
          console.error("[desafiar/api POST webhook]", notifyError);
        }
      }

      invalidateMatchesGetCache();
      return NextResponse.json({ ok: true, match });
    } finally {
      await Promise.allSettled([jogadoresConn.end?.(), mainConn.end?.()]);
    }
  } catch (e) {
    console.error("[desafiar/api POST]", e);
    try {
      const env = await getRuntimeEnv();
      let actorNickname = faceitGuidForError || "Desconhecido";
      try {
        const conn = await createMainConnection(env);
        const [rows]: any = await queryWithTimeout(
          conn,
          "SELECT nickname FROM players WHERE faceit_guid = ? LIMIT 1",
          [faceitGuidForError]
        );
        if (Array.isArray(rows) && rows.length > 0) {
          actorNickname = String(rows[0]?.nickname || actorNickname);
        }
        await conn.end?.();
      } catch {
        // ignore nickname fallback
      }
      await sendDesafiarErrorBrevoEmail(
        {
          source: "api-post",
          errorMessage: e instanceof Error ? e.message : String(e),
          errorStack: e instanceof Error ? e.stack || null : null,
          actorGuid: faceitGuidForError,
          actorNickname,
          requestUrl: requestUrlForError,
        },
        env,
      );
    } catch {
      // avoid failing original response due to alerting
    }
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

// PUT — respond to a proposal (accept | decline | cancel | counter)
export async function PUT(req: NextRequest) {
  let faceitGuidForError = "";
  let requestUrlForError = "";
  try {
    const body = await req.json();
    requestUrlForError = String(req.url || "");
    const { faceit_guid, match_id, action, counter_date, counter_time, counter_message } = body;
    faceitGuidForError = String(faceit_guid || "").trim().toLowerCase();

    if (!faceit_guid || !match_id || !action) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    if (!["accept", "decline", "cancel", "counter"].includes(action)) {
      return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
    }

    const env = await getRuntimeEnv();

    const [jogadoresConn, mainConn] = await Promise.all([
      createJogadoresConnection(env),
      createMainConnection(env),
    ]);

    try {
      const admin1 = await isAdminOne(mainConn, faceit_guid);
      const userTeamId = await getUserTeamId(jogadoresConn, faceit_guid);
      if (!userTeamId && !admin1) {
        return NextResponse.json({ error: "Você precisa estar em um time para responder propostas" }, { status: 403 });
      }

      const [matchRows]: any = await queryWithTimeout(
        mainConn,
        "SELECT * FROM matches WHERE id = ? LIMIT 1",
        [Number(match_id)]
      );

      if (!Array.isArray(matchRows) || matchRows.length === 0) {
        return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
      }

      const match = matchRows[0] as any;
      const isChallenger = Number(match.challenger_team_id) === Number(userTeamId);
      const isChallenged = Number(match.challenged_team_id) === Number(userTeamId);

      if (admin1) {
        if (match.status === "accepted") {
          if (action !== "counter") {
            return NextResponse.json(
              { error: "Partida confirmada não pode ser alterada. Apenas ajuste de data é permitido para Admin 1." },
              { status: 400 }
            );
          }
          if (!counter_date || !counter_time) {
            return NextResponse.json({ error: "Data e hora são obrigatórios para alterar data" }, { status: 400 });
          }

          // Admin 1 can only adjust confirmed date/time, preserving accepted status.
          await queryWithTimeout(
            mainConn,
            `UPDATE matches SET
               proposed_date = ?,
               proposed_time = ?,
               message = COALESCE(?, message),
               status = 'accepted',
               accepted_at = NOW(),
               counter_date = NULL,
               counter_time = NULL,
               counter_message = NULL
             WHERE id = ?`,
            [counter_date, counter_time, counter_message ?? null, match.id]
          );

          const [updAccepted]: any = await queryWithTimeout(mainConn, "SELECT * FROM matches WHERE id = ? LIMIT 1", [match.id]);
          try {
            const finalMatch = rowToMatch(updAccepted[0]);
            const actorNickname = await getActorNickname(mainConn, faceit_guid);
            const teamNames = await getTeamNamesByIds(jogadoresConn, [
              Number(finalMatch.challenger_team_id),
              Number(finalMatch.challenged_team_id),
            ]);
            await sendDesafiarDiscordWebhook({
              event: "counter",
              matchId: Number(finalMatch.id),
              rodada: finalMatch.rodada,
              challengerTeam: teamNames.get(Number(finalMatch.challenger_team_id)) || `Time ${finalMatch.challenger_team_id}`,
              challengedTeam: teamNames.get(Number(finalMatch.challenged_team_id)) || `Time ${finalMatch.challenged_team_id}`,
              actorNickname,
              actorGuid: String(faceit_guid || "").trim().toLowerCase(),
              date: finalMatch.proposed_date,
              time: finalMatch.proposed_time,
              message: counter_message ?? "Admin 1 alterou data/horario",
            });
          } catch (notifyError) {
            console.error("[desafiar/api PUT webhook accepted-counter]", notifyError);
          }
          invalidateMatchesGetCache();
          return NextResponse.json({ ok: true, match: rowToMatch(updAccepted[0]) });
        }

        if (action === "accept") {
          await queryWithTimeout(
            mainConn,
            "UPDATE matches SET status = 'accepted', accepted_at = NOW() WHERE id = ?",
            [match.id]
          );
        } else if (action === "decline") {
          await queryWithTimeout(mainConn, "UPDATE matches SET status = 'declined' WHERE id = ?", [match.id]);
        } else if (action === "cancel") {
          await queryWithTimeout(mainConn, "UPDATE matches SET status = 'cancelled' WHERE id = ?", [match.id]);
        } else if (action === "counter") {
          if (!counter_date || !counter_time) {
            return NextResponse.json({ error: "Data e hora são obrigatórios na contraproposta" }, { status: 400 });
          }
          await queryWithTimeout(
            mainConn,
            `UPDATE matches SET
               status = 'counter_proposal',
               counter_date = ?,
               counter_time = ?,
               counter_message = ?
             WHERE id = ?`,
            [counter_date, counter_time, counter_message ?? null, match.id]
          );
        }
        const [upd]: any = await queryWithTimeout(mainConn, "SELECT * FROM matches WHERE id = ? LIMIT 1", [match.id]);
        try {
          const finalMatch = rowToMatch(upd[0]);
          const actorNickname = await getActorNickname(mainConn, faceit_guid);
          const teamNames = await getTeamNamesByIds(jogadoresConn, [
            Number(finalMatch.challenger_team_id),
            Number(finalMatch.challenged_team_id),
          ]);

          if (action === "accept" || action === "decline") {
            await sendDesafiarDiscordWebhook({
              event: "decision",
              decision: action === "accept" ? "accepted" : "declined",
              matchId: Number(finalMatch.id),
              rodada: finalMatch.rodada,
              challengerTeam: teamNames.get(Number(finalMatch.challenger_team_id)) || `Time ${finalMatch.challenger_team_id}`,
              challengedTeam: teamNames.get(Number(finalMatch.challenged_team_id)) || `Time ${finalMatch.challenged_team_id}`,
              actorNickname,
              actorGuid: String(faceit_guid || "").trim().toLowerCase(),
              date: finalMatch.proposed_date,
              time: finalMatch.proposed_time,
              message: finalMatch.message,
            });
          } else if (action === "counter") {
            await sendDesafiarDiscordWebhook({
              event: "counter",
              matchId: Number(finalMatch.id),
              rodada: finalMatch.rodada,
              challengerTeam: teamNames.get(Number(finalMatch.challenger_team_id)) || `Time ${finalMatch.challenger_team_id}`,
              challengedTeam: teamNames.get(Number(finalMatch.challenged_team_id)) || `Time ${finalMatch.challenged_team_id}`,
              actorNickname,
              actorGuid: String(faceit_guid || "").trim().toLowerCase(),
              date: finalMatch.counter_date || finalMatch.proposed_date,
              time: finalMatch.counter_time || finalMatch.proposed_time,
              message: finalMatch.counter_message || finalMatch.message,
            });
          }
        } catch (notifyError) {
          console.error("[desafiar/api PUT webhook admin]", notifyError);
        }
        invalidateMatchesGetCache();
        return NextResponse.json({ ok: true, match: rowToMatch(upd[0]) });
      }

      if (!isChallenger && !isChallenged) {
        return NextResponse.json({ error: "Você não faz parte desta partida" }, { status: 403 });
      }

      // cancel — only challenger can cancel a pending proposal
      if (action === "cancel") {
        if (!isChallenger || match.status !== "pending") {
          return NextResponse.json({ error: "Não é possível cancelar esta proposta agora" }, { status: 400 });
        }
        await queryWithTimeout(mainConn, "UPDATE matches SET status = 'cancelled' WHERE id = ?", [match.id]);
        const [upd]: any = await queryWithTimeout(mainConn, "SELECT * FROM matches WHERE id = ? LIMIT 1", [match.id]);
        invalidateMatchesGetCache();
        return NextResponse.json({ ok: true, match: rowToMatch(upd[0]) });
      }

      // Allowed statuses for accept/decline/counter
      if (!["pending", "counter_proposal"].includes(match.status)) {
        return NextResponse.json({ error: "Esta proposta não pode ser respondida no estado atual" }, { status: 400 });
      }

      // Determine who should respond:
      // pending → challenged responds; counter_proposal → challenger responds
      const iAmTheResponder =
        match.status === "pending" ? isChallenged : isChallenger;

      if (!iAmTheResponder) {
        return NextResponse.json({ error: "Não é a sua vez de responder" }, { status: 403 });
      }

      if (action === "accept") {
        await queryWithTimeout(
          mainConn,
          "UPDATE matches SET status = 'accepted', accepted_at = NOW() WHERE id = ?",
          [match.id]
        );
      } else if (action === "decline") {
        await queryWithTimeout(mainConn, "UPDATE matches SET status = 'declined' WHERE id = ?", [match.id]);
      } else if (action === "counter") {
        if (!counter_date || !counter_time) {
          return NextResponse.json({ error: "Data e hora são obrigatórios na contraproposta" }, { status: 400 });
        }
        await queryWithTimeout(
          mainConn,
          `UPDATE matches SET
             status = 'counter_proposal',
             counter_date = ?,
             counter_time = ?,
             counter_message = ?
           WHERE id = ?`,
          [counter_date, counter_time, counter_message ?? null, match.id]
        );
      }

      const [upd]: any = await queryWithTimeout(mainConn, "SELECT * FROM matches WHERE id = ? LIMIT 1", [match.id]);
      try {
        const finalMatch = rowToMatch(upd[0]);
        const actorNickname = await getActorNickname(mainConn, faceit_guid);
        const teamNames = await getTeamNamesByIds(jogadoresConn, [
          Number(finalMatch.challenger_team_id),
          Number(finalMatch.challenged_team_id),
        ]);

        if (action === "accept" || action === "decline") {
          await sendDesafiarDiscordWebhook({
            event: "decision",
            decision: action === "accept" ? "accepted" : "declined",
            matchId: Number(finalMatch.id),
            rodada: finalMatch.rodada,
            challengerTeam: teamNames.get(Number(finalMatch.challenger_team_id)) || `Time ${finalMatch.challenger_team_id}`,
            challengedTeam: teamNames.get(Number(finalMatch.challenged_team_id)) || `Time ${finalMatch.challenged_team_id}`,
            actorNickname,
            actorGuid: String(faceit_guid || "").trim().toLowerCase(),
            date: finalMatch.proposed_date,
            time: finalMatch.proposed_time,
            message: finalMatch.message,
          });
        } else if (action === "counter") {
          await sendDesafiarDiscordWebhook({
            event: "counter",
            matchId: Number(finalMatch.id),
            rodada: finalMatch.rodada,
            challengerTeam: teamNames.get(Number(finalMatch.challenger_team_id)) || `Time ${finalMatch.challenger_team_id}`,
            challengedTeam: teamNames.get(Number(finalMatch.challenged_team_id)) || `Time ${finalMatch.challenged_team_id}`,
            actorNickname,
            actorGuid: String(faceit_guid || "").trim().toLowerCase(),
            date: finalMatch.counter_date || finalMatch.proposed_date,
            time: finalMatch.counter_time || finalMatch.proposed_time,
            message: finalMatch.counter_message || finalMatch.message,
          });
        }
      } catch (notifyError) {
        console.error("[desafiar/api PUT webhook user]", notifyError);
      }
      invalidateMatchesGetCache();
      return NextResponse.json({ ok: true, match: rowToMatch(upd[0]) });
    } finally {
      await Promise.allSettled([jogadoresConn.end?.(), mainConn.end?.()]);
    }
  } catch (e) {
    console.error("[desafiar/api PUT]", e);
    try {
      const env = await getRuntimeEnv();
      let actorNickname = faceitGuidForError || "Desconhecido";
      try {
        const conn = await createMainConnection(env);
        const [rows]: any = await queryWithTimeout(
          conn,
          "SELECT nickname FROM players WHERE faceit_guid = ? LIMIT 1",
          [faceitGuidForError]
        );
        if (Array.isArray(rows) && rows.length > 0) {
          actorNickname = String(rows[0]?.nickname || actorNickname);
        }
        await conn.end?.();
      } catch {
        // ignore nickname fallback
      }
      await sendDesafiarErrorBrevoEmail(
        {
          source: "api-put",
          errorMessage: e instanceof Error ? e.message : String(e),
          errorStack: e instanceof Error ? e.stack || null : null,
          actorGuid: faceitGuidForError,
          actorNickname,
          requestUrl: requestUrlForError,
        },
        env,
      );
    } catch {
      // avoid failing original response due to alerting
    }
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

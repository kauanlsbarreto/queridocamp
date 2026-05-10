import { createMainConnection, createJogadoresConnection } from "@/lib/db";
import type { Env } from "@/lib/db";
import { getCopaDraftTimes } from "@/lib/copadraft-times";
import { getRuntimeEnv } from "@/lib/runtime-env";
import DesafiarPageClient, {
  type TeamCapitao,
  type TeamMember,
  type JogoRow,
  type MatchRow,
} from "./DesafiarPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const PAGE_QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_DESAFIAR_QUERY_TIMEOUT_MS || 5000);
const PAGE_CONNECT_TIMEOUT_MS = Number(process.env.COPADRAFT_DESAFIAR_CONNECT_TIMEOUT_MS || 4000);
const PAGE_LOAD_TIMEOUT_MS = Number(process.env.COPADRAFT_DESAFIAR_LOAD_TIMEOUT_MS || 3500);

const MIGRATION_COLUMNS: Array<{ name: string; sql: string }> = [
  { name: "rodada", sql: "ALTER TABLE matches ADD COLUMN rodada INT DEFAULT NULL" },
  { name: "counter_date", sql: "ALTER TABLE matches ADD COLUMN counter_date DATE DEFAULT NULL" },
  { name: "counter_time", sql: "ALTER TABLE matches ADD COLUMN counter_time TIME DEFAULT NULL" },
  { name: "counter_message", sql: "ALTER TABLE matches ADD COLUMN counter_message TEXT DEFAULT NULL" },
];

async function runMigrations(conn: any) {
  for (const migration of MIGRATION_COLUMNS) {
    try {
      const [existsRows]: any = await conn.query(
        { sql: "SHOW COLUMNS FROM matches LIKE ?", timeout: PAGE_QUERY_TIMEOUT_MS },
        [migration.name]
      );
      if (Array.isArray(existsRows) && existsRows.length > 0) continue;
      await conn.query({ sql: migration.sql, timeout: PAGE_QUERY_TIMEOUT_MS });
    } catch {}
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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

async function loadTimesJsonCached() {
  return getCopaDraftTimes();
}

async function loadData(env: Env): Promise<{
  teamsCapitaes: TeamCapitao[];
  teamMembers: TeamMember[];
  jogos: JogoRow[];
  matches: MatchRow[];
}> {
  // 1. Load JSON -> team name to first-player guid (pote 1 = capitao)
  const jsonTeams = await loadTimesJsonCached();

  // Map: guid (lowercase) → nome_time
  const guidToTime = new Map<string, string>();
  for (const team of jsonTeams) {
    const firstGuid = String(team.jogadores?.[0]?.faceit_guid || "")
      .trim()
      .toLowerCase();
    if (firstGuid) guidToTime.set(firstGuid, team.nome_time);
  }

  const guids = Array.from(guidToTime.keys());

  const [jogadoresConn, mainConn] = await Promise.all([
    withTimeout(createJogadoresConnection(env), PAGE_CONNECT_TIMEOUT_MS, "DB_JOGADORES connect"),
    withTimeout(createMainConnection(env), PAGE_CONNECT_TIMEOUT_MS, "DB_PRINCIPAL connect"),
  ]);

  let teamsCapitaes: TeamCapitao[] = [];
  let teamMembers: TeamMember[] = [];
  let jogos: JogoRow[] = [];
  let matches: MatchRow[] = [];

  try {
    await runMigrations(mainConn);

    // 2. Resolve capitaes IDs from jogadores (pote = 1)
    try {
      if (guids.length > 0) {
        const placeholders = guids.map(() => "?").join(",");
        const [capRows]: any = await jogadoresConn.query(
          {
            sql: `SELECT id, faceit_guid FROM jogadores WHERE pote = 1 AND faceit_guid IN (${placeholders})`,
            timeout: PAGE_QUERY_TIMEOUT_MS,
          },
          guids
        );
        if (Array.isArray(capRows)) {
          for (const row of capRows as any[]) {
            const guid = String(row.faceit_guid || "").trim().toLowerCase();
            const nome_time = guidToTime.get(guid);
            if (nome_time) {
              teamsCapitaes.push({
                nome_time,
                capitao_guid: guid,
                capitao_id: Number(row.id),
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("[desafiar page] erro carregando capitaes:", err);
    }

    // 2.1 Resolve team membership for any player in a team
    try {
      const [membersRows]: any = await jogadoresConn.query(
        { sql: "SELECT id, faceit_guid, pote, timeid FROM jogadores", timeout: PAGE_QUERY_TIMEOUT_MS }
      );
      if (Array.isArray(membersRows)) {
        const validTeamIds = new Set<number>(teamsCapitaes.map((t) => Number(t.capitao_id)));
        teamMembers = (membersRows as any[])
          .map((row) => {
            const pote = Number(row?.pote || 0);
            const id = Number(row?.id || 0);
            const timeid = Number(row?.timeid || 0);
            const team_id = pote === 1 ? id : timeid;
            return {
              faceit_guid: String(row?.faceit_guid || "").trim().toLowerCase(),
              team_id,
            };
          })
          .filter((m) => m.faceit_guid && m.team_id > 0 && validTeamIds.has(m.team_id));
      }
    } catch (err) {
      console.error("[desafiar page] erro carregando membros:", err);
    }

    // 3. Load round schedule
    try {
      const [jogosRows]: any = await mainConn.query(
        {
          sql: "SELECT rodada, time1, time2, placar FROM jogos ORDER BY rodada ASC, time1 ASC",
          timeout: PAGE_QUERY_TIMEOUT_MS,
        }
      );
      if (Array.isArray(jogosRows)) {
        jogos = (jogosRows as any[]).map((r) => ({
          rodada: Number(r.rodada),
          time1: String(r.time1 || ""),
          time2: String(r.time2 || ""),
          placar: r.placar != null ? String(r.placar) : null,
        }));
      }
    } catch (err) {
      console.error("[desafiar page] erro carregando jogos:", err);
    }

    // 4. Load all matches for the view
    try {
      const [matchRows]: any = await mainConn.query(
        {
          sql: `SELECT id, challenger_team_id, challenged_team_id, rodada,
                      proposed_date, proposed_time, message, status,
                      counter_date, counter_time, counter_message,
                      accepted_at, created_at
                FROM matches
                ORDER BY created_at DESC`,
          timeout: PAGE_QUERY_TIMEOUT_MS,
        }
      );
      if (Array.isArray(matchRows)) {
        matches = (matchRows as any[]).map((r) => ({
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
        }));
      }
    } catch (err) {
      console.error("[desafiar page] erro carregando matches:", err);
    }
  } catch (e) {
    console.error("[desafiar page loadData]", e);
  } finally {
    await Promise.allSettled([jogadoresConn.end?.(), mainConn.end?.()]);
  }

  return { teamsCapitaes, teamMembers, jogos, matches };
}

async function refreshPageData(env: Env) {
  return withTimeout(
    loadData(env),
    PAGE_LOAD_TIMEOUT_MS,
    "desafiar page load"
  );
}

export default async function DesafiarPage() {
  let data = {
    teamsCapitaes: [] as TeamCapitao[],
    teamMembers: [] as TeamMember[],
    jogos: [] as JogoRow[],
    matches: [] as MatchRow[],
  };
  try {
    const env = await getRuntimeEnv() as Env;
    data = await refreshPageData(env);
  } catch (err) {
    console.error("[copadraft/desafiar] erro na página:", err);
  }

  return <DesafiarPageClient {...data} />;
}

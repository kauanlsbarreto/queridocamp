import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection, createJogadoresConnection } from "@/lib/db";
import type { Env } from "@/lib/db";
import { promises as fs } from "node:fs";
import path from "node:path";
import DesafiarPageClient, {
  type TeamCapitao,
  type TeamMember,
  type JogoRow,
  type MatchRow,
} from "./DesafiarPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
const PAGE_QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_DESAFIAR_QUERY_TIMEOUT_MS || 5000);
const TIMES_JSON_CACHE_TTL_MS = Number(process.env.COPADRAFT_TIMES_CACHE_TTL_MS || 60000);

const MIGRATION_COLUMNS: Array<{ name: string; sql: string }> = [
  { name: "rodada", sql: "ALTER TABLE matches ADD COLUMN rodada INT DEFAULT NULL" },
  { name: "counter_date", sql: "ALTER TABLE matches ADD COLUMN counter_date DATE DEFAULT NULL" },
  { name: "counter_time", sql: "ALTER TABLE matches ADD COLUMN counter_time TIME DEFAULT NULL" },
  { name: "counter_message", sql: "ALTER TABLE matches ADD COLUMN counter_message TEXT DEFAULT NULL" },
];

async function runMigrations(conn: any) {
  for (const migration of MIGRATION_COLUMNS) {
    try {
      const [existsRows]: any = await conn.query("SHOW COLUMNS FROM matches LIKE ?", [migration.name]);
      if (Array.isArray(existsRows) && existsRows.length > 0) continue;
      await conn.query(migration.sql);
    } catch {}
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

let cachedTimesJson: {
  expiresAt: number;
  data: Array<{ nome_time: string; jogadores: Array<{ nickname: string; faceit_guid: string }> }>;
} | null = null;

async function loadTimesJsonCached() {
  const now = Date.now();
  if (cachedTimesJson && cachedTimesJson.expiresAt > now) {
    return cachedTimesJson.data;
  }

  try {
    const raw = await fs.readFile(path.join(process.cwd(), "copadraft-times.json"), "utf8");
    const parsed = JSON.parse(raw);
    const data = Array.isArray(parsed) ? parsed : [];
    cachedTimesJson = {
      expiresAt: now + TIMES_JSON_CACHE_TTL_MS,
      data,
    };
    return data;
  } catch {
    return cachedTimesJson?.data || [];
  }
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
    createJogadoresConnection(env),
    createMainConnection(env),
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

export default async function DesafiarPage() {
  let data = {
    teamsCapitaes: [] as TeamCapitao[],
    teamMembers: [] as TeamMember[],
    jogos: [] as JogoRow[],
    matches: [] as MatchRow[],
  };
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    data = await loadData(env);
  } catch {}

  return <DesafiarPageClient {...data} />;
}

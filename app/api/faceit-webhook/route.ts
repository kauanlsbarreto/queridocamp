import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { RowDataPacket } from "mysql2";
import { createMainConnection } from "@/lib/db";
import {
  calculateQueridaFilaPoints,
  type QueridaFilaPointsProjection,
} from "@/lib/queridafila-points";

export const dynamic = "force-dynamic";

const TARGET_QUEUE_ID = "c23c971b-677a-4046-8203-26023e283529";
const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FALLBACK_FACEIT_API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
const POINTS_START_DATE_UNIX = Math.floor(new Date("2026-04-06T00:00:00-03:00").getTime() / 1000);
const DISCORD_POINTS_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1490235360607998002/REUAB4jB7nFAiu-M3yQKKyxzNUFWWEN5wdez4jpm0AoWRuXmYG7tuxq3bLhsbcaFpWny";

type WebhookBody = {
  event?: string;
  payload?: {
    id?: string;
    match_id?: string;
    competition_id?: string;
  };
};

type MatchDetails = {
  match_id: string;
  competition_id?: string;
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

type PlayerDbRow = RowDataPacket & {
  id: number;
  faceit_guid: string;
  nickname: string;
  points: number | null;
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

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const len = Math.max(aBytes.length, bBytes.length);

  let mismatch = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    const av = i < aBytes.length ? aBytes[i] : 0;
    const bv = i < bBytes.length ? bBytes[i] : 0;
    mismatch |= av ^ bv;
  }

  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(signature);

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyFaceitSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = process.env.FACEIT_WEBHOOK_SECRET;
  const header = req.headers.get("x-faceit-signature") || "";

  if (!secret) {
    console.error("[faceit-webhook] FACEIT_WEBHOOK_SECRET nao configurado.");
    return false;
  }

  if (!header.trim()) {
    return false;
  }

  const receivedSignatures = header
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      if (part.startsWith("sha256=")) return part.slice("sha256=".length).trim();
      return part;
    })
    .filter(Boolean);

  if (receivedSignatures.length === 0) {
    return false;
  }

  const computed = await hmacSha256Hex(secret, rawBody);
  return receivedSignatures.some((sig) => constantTimeEqual(sig, computed));
}

async function fetchFaceitMatchData(matchId: string): Promise<{ details: MatchDetails; stats: MatchStatsResponse } | null> {
  const apiKey = process.env.FACEIT_API_KEY || FALLBACK_FACEIT_API_KEY;
  const headers = { Authorization: `Bearer ${apiKey}` };

  const [detailsRes, statsRes] = await Promise.all([
    fetch(`${FACEIT_API_BASE}/matches/${matchId}`, { headers }),
    fetch(`${FACEIT_API_BASE}/matches/${matchId}/stats`, { headers }),
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

  let winnerTeamId = winnerRaw;
  if (winnerRaw === "faction1") winnerTeamId = faction1Id || "";
  if (winnerRaw === "faction2") winnerTeamId = faction2Id || "";

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
      if (team.team_id && winnerTeamId && team.team_id === winnerTeamId) {
        winnerPlayers.push(projection);
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

export async function POST(req: Request) {
  let connection: any;

  try {
    const rawBody = await req.text();
    const signatureOk = await verifyFaceitSignature(req, rawBody);

    if (!signatureOk) {
      return NextResponse.json({ message: "Assinatura invalida." }, { status: 403 });
    }

    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody) as WebhookBody;
    } catch {
      return NextResponse.json({ message: "Payload JSON invalido." }, { status: 400 });
    }

    const event = body.event;
    if (event !== "match_status_finished") {
      return NextResponse.json({ message: "Evento ignorado.", event }, { status: 200 });
    }

    const matchId = body.payload?.id || body.payload?.match_id;
    if (!matchId) {
      return NextResponse.json({ message: "match_id nao encontrado no payload." }, { status: 400 });
    }

    const matchData = await fetchFaceitMatchData(matchId);
    if (!matchData) {
      return NextResponse.json({ message: "Nao foi possivel buscar dados da partida na FACEIT." }, { status: 502 });
    }

    const queueId = matchData.details.competition_id || body.payload?.competition_id || "";
    if (queueId !== TARGET_QUEUE_ID) {
      return NextResponse.json({
        message: "Partida ignorada por nao pertencer a fila alvo.",
        queueId,
        targetQueueId: TARGET_QUEUE_ID,
      });
    }

    const matchFinishedAt = toNumber(matchData.details.finished_at || matchData.details.started_at || 0);
    if (matchFinishedAt < POINTS_START_DATE_UNIX) {
      return NextResponse.json({
        message: "Partida ignorada por ser anterior a data de inicio da pontuacao.",
        matchId,
        queueId,
        pointsStartDate: "2026-04-06",
      });
    }

    const winnerScores = calculateWinnerPoints(matchData.details, matchData.stats);
    if (winnerScores.length === 0) {
      return NextResponse.json({ message: "Nao foi possivel calcular pontos dos vencedores.", matchId }, { status: 422 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);
    await ensureProcessedTable(connection);

    await connection.beginTransaction();

    try {
      await connection.query(
        "INSERT INTO processed_faceit_matches (match_id, queue_id) VALUES (?, ?)",
        [matchId, queueId],
      );
    } catch (e: any) {
      if (e?.code === "ER_DUP_ENTRY") {
        await connection.rollback();
        return NextResponse.json({
          message: "Partida ja processada anteriormente.",
          matchId,
          queueId,
        });
      }

      throw e;
    }

    const winnerIds = winnerScores.map((p) => p.playerId);
    const placeholders = winnerIds.map(() => "?").join(",");
    const [registeredRowsRaw] = await connection.query(
      `SELECT id, faceit_guid, nickname, points FROM players WHERE faceit_guid IN (${placeholders})`,
      winnerIds,
    );
    const registeredRows = registeredRowsRaw as PlayerDbRow[];

    const byGuid = new Map<string, PlayerDbRow>(registeredRows.map((row: PlayerDbRow) => [row.faceit_guid, row]));

    const updatedPlayers: Array<{
      playerId: string;
      nickname: string;
      addedPoints: number;
      oldPoints: number;
      newPoints: number;
    }> = [];

    const notRegistered: Array<{
      playerId: string;
      nickname: string;
      pointsWithFlag: string;
      warning: string;
    }> = [];

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

    await connection.commit();

    const faceitUrl = (matchData.details.faceit_url || `https://www.faceit.com/en/cs2/room/${matchId}`).replace(
      "{lang}",
      "en"
    );

    await sendDiscordPointsWebhook({
      matchId,
      faceitUrl,
      queueId,
      winners: winnerScores,
      updatedPlayers,
      notRegistered,
    });

    revalidateTag("queridafila-partidas", "max");
    revalidatePath("/queridafila/partidas", "page");
    revalidatePath(`/queridafila/partidas/${matchId}`);

    return NextResponse.json({
      success: true,
      event,
      matchId,
      queueId,
      updatedCount: updatedPlayers.length,
      missingCount: notRegistered.length,
      updatedPlayers,
      notRegistered,
      note: "Jogador nao cadastrado retorna points com * para sinalizar pendencia.",
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {}
    }

    console.error("[faceit-webhook] erro ao processar webhook:", error);
    return NextResponse.json({ message: "Erro interno ao processar webhook." }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  processQueridaFilaMatchPoints,
  getUnprocessedMatchIds,
  POINTS_START_DATE_UNIX,
  TARGET_QUEUE_ID,
} from "@/lib/queridafila-match-points-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_KEY_FACEIT = process.env.FACEIT_API_KEY || "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

// Máximo de partidas processadas por invocação (cada uma faz 2 chamadas Faceit + DB).
const MAX_PROCESS_PER_RUN = 8;
// Máximo de páginas para paginar partidas (100 itens cada).
const MAX_PAGES = 15;

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const botHeaderToken = request.headers.get("x-bot-sync-token");
  const cronSecret = process.env.CRON_SECRET;
  const botSecret = process.env.DISCORD_BOT_SYNC_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true;
  if (botSecret && authHeader === `Bearer ${botSecret}`) return true;
  if (botSecret && botHeaderToken === botSecret) return true;
  return authHeader === "Bearer local-dev-token";
}

type FaceitQueueMatch = {
  match_id: string;
  competition_id?: string;
  status?: string;
  finished_at?: number;
};

/**
 * Pagina todas as partidas FINISHED da fila desde POINTS_START_DATE_UNIX.
 * Para de paginar assim que encontra partidas mais antigas que a data de início.
 * Retorna em ordem cronológica (mais antigas primeiro).
 */
async function getAllFinishedMatchesSinceStart(): Promise<FaceitQueueMatch[]> {
  const PAGE_SIZE = 100;
  const result: FaceitQueueMatch[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `https://open.faceit.com/data/v4/hubs/${TARGET_QUEUE_ID}/matches?type=past&offset=${offset}&limit=${PAGE_SIZE}`,
      { headers: { Authorization: `Bearer ${API_KEY_FACEIT}` }, cache: "no-store" },
    );

    if (!res.ok) {
      throw new Error(`Erro ao buscar partidas da fila FACEIT: ${res.status}`);
    }

    const data = await res.json();
    const items: Array<Record<string, any>> = Array.isArray(data?.items) ? data.items : [];

    if (items.length === 0) break;

    let hitOlderThanStart = false;
    for (const item of items) {
      const finishedAt: number = item.finished_at || item.started_at || 0;
      const status: string = String(item.status || "").toUpperCase();

      // A API retorna do mais recente para o mais antigo; assim que passarmos
      // da data de início podemos parar de paginar.
      if (finishedAt > 0 && finishedAt < POINTS_START_DATE_UNIX) {
        hitOlderThanStart = true;
        break;
      }

      if (status === "FINISHED" && item.match_id) {
        result.push({
          match_id: item.match_id as string,
          competition_id: item.competition_id,
          status: item.status,
          finished_at: finishedAt,
        });
      }
    }

    if (hitOlderThanStart || items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  // Processa da partida mais antiga para a mais recente.
  return result.sort((a, b) => (a.finished_at || 0) - (b.finished_at || 0));
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
    }

    // 1. Busca todas as partidas finalizadas desde o início da pontuação.
    const allFinished = await getAllFinishedMatchesSinceStart();
    const allMatchIds = allFinished.map((m) => m.match_id);

    // 2. Consulta o banco de uma vez para saber quais AINDA não foram processadas.
    const unprocessedIds = new Set(await getUnprocessedMatchIds(allMatchIds));
    const toProcess = allFinished
      .filter((m) => unprocessedIds.has(m.match_id))
      .slice(0, MAX_PROCESS_PER_RUN);

    let processedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const details: Array<{ matchId: string; success: boolean; processed: boolean; message: string }> = [];

    // 3. Processa somente as partidas não computadas.
    for (const match of toProcess) {
      try {
        const result = await processQueridaFilaMatchPoints({
          matchId: match.match_id,
          queueIdHint: match.competition_id || TARGET_QUEUE_ID,
          source: "cron",
        });

        if (result.processed) {
          processedCount += 1;
        } else {
          skippedCount += 1;
        }

        details.push({
          matchId: match.match_id,
          success: result.success,
          processed: result.processed,
          message: result.message,
        });
      } catch (error) {
        failedCount += 1;
        details.push({
          matchId: match.match_id,
          success: false,
          processed: false,
          message: error instanceof Error ? error.message : "Erro ao processar partida.",
        });
      }
    }

    if (processedCount > 0) {
      revalidateTag("queridafila-partidas", "max");
      revalidatePath("/queridafila/partidas", "page");
    }

    return NextResponse.json({
      success: true,
      queueId: TARGET_QUEUE_ID,
      totalFinishedSinceStart: allFinished.length,
      pendingBeforeRun: unprocessedIds.size,
      processedThisRun: processedCount,
      skippedCount,
      failedCount,
      remainingAfterRun: Math.max(0, unprocessedIds.size - processedCount),
      details,
    });
  } catch (error) {
    console.error("[queridafila-cron] erro ao processar partidas finalizadas:", error);
    return NextResponse.json(
      { success: false, message: "Erro interno ao processar partidas finalizadas." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}

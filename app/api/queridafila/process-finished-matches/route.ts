import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { processQueridaFilaMatchPoints } from "@/lib/queridafila-match-points-processor";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const API_KEY_FACEIT = process.env.FACEIT_API_KEY || "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
const QUEUE_ID = process.env.QUERIDAFILA_QUEUE_ID || "c23c971b-677a-4046-8203-26023e283529";

function isAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  return authHeader === "Bearer local-dev-token";
}

type FaceitQueueMatch = {
  match_id?: string;
  competition_id?: string;
  status?: string;
  finished_at?: number;
};

async function getRecentFinishedMatches(limit: number): Promise<FaceitQueueMatch[]> {
  const response = await fetch(
    `https://open.faceit.com/data/v4/hubs/${QUEUE_ID}/matches?type=past&offset=0&limit=${Math.min(Math.max(limit, 1), 100)}`,
    {
      headers: { Authorization: `Bearer ${API_KEY_FACEIT}` },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar partidas da fila: ${response.status}`);
  }

  const data = await response.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  return items
    .filter((match: FaceitQueueMatch) => String(match.status || "").toUpperCase() === "FINISHED")
    .sort((a: FaceitQueueMatch, b: FaceitQueueMatch) => (b.finished_at || 0) - (a.finished_at || 0));
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });
    }

    const url = new URL(request.url);
    const scanLimit = Number(url.searchParams.get("scan") || "25");
    const processLimit = Number(url.searchParams.get("limit") || "10");

    const finishedMatches = await getRecentFinishedMatches(scanLimit);
    const selected = finishedMatches.slice(0, Math.min(Math.max(processLimit, 1), 25));

    let processedCount = 0;
    let alreadyProcessedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    const details: Array<{ matchId: string; success: boolean; processed: boolean; message: string }> = [];

    for (const match of selected) {
      const matchId = match.match_id;
      if (!matchId) {
        skippedCount += 1;
        continue;
      }

      try {
        const result = await processQueridaFilaMatchPoints({
          matchId,
          queueIdHint: match.competition_id || QUEUE_ID,
          source: "cron",
        });

        if (result.processed) {
          processedCount += 1;
        } else if (result.message.toLowerCase().includes("ja processada")) {
          alreadyProcessedCount += 1;
        } else {
          skippedCount += 1;
        }

        details.push({
          matchId,
          success: result.success,
          processed: result.processed,
          message: result.message,
        });
      } catch (error) {
        failedCount += 1;
        details.push({
          matchId,
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
      queueId: QUEUE_ID,
      scanned: finishedMatches.length,
      selected: selected.length,
      processedCount,
      alreadyProcessedCount,
      skippedCount,
      failedCount,
      details,
    });
  } catch (error) {
    console.error("[queridafila-cron] erro ao processar partidas finalizadas:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Erro interno ao processar partidas finalizadas da Querida Fila.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}

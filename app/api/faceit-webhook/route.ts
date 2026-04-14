import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import {
  processQueridaFilaMatchPoints,
} from "@/lib/queridafila-match-points-processor";

export const dynamic = "force-dynamic";

type WebhookBody = {
  event?: string;
  payload?: {
    id?: string;
    match_id?: string;
    competition_id?: string;
  };
};

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

function verifyFaceitToken(req: Request): boolean {
  const token = process.env.FACEIT_WEBHOOK_TOKEN;
  if (!token) {
    return false;
  }

  const tokenHeaderName = (process.env.FACEIT_WEBHOOK_TOKEN_HEADER || "x-webhook-token").toLowerCase();
  const tokenQueryName = process.env.FACEIT_WEBHOOK_TOKEN_QUERY || "token";

  const headerToken = req.headers.get(tokenHeaderName) || "";
  const queryToken = new URL(req.url).searchParams.get(tokenQueryName) || "";

  if (headerToken && constantTimeEqual(headerToken, token)) {
    return true;
  }

  if (queryToken && constantTimeEqual(queryToken, token)) {
    return true;
  }

  return false;
}

async function verifyFaceitWebhookAuth(req: Request, rawBody: string): Promise<boolean> {
  const hasSecret = Boolean(process.env.FACEIT_WEBHOOK_SECRET);
  const hasToken = Boolean(process.env.FACEIT_WEBHOOK_TOKEN);

  if (hasSecret) {
    const signatureOk = await verifyFaceitSignature(req, rawBody);
    if (signatureOk) {
      return true;
    }
  }

  if (hasToken) {
    const tokenOk = verifyFaceitToken(req);
    if (tokenOk) {
      return true;
    }
  }

  if (!hasSecret && !hasToken) {
    console.error("[faceit-webhook] configure FACEIT_WEBHOOK_SECRET ou FACEIT_WEBHOOK_TOKEN para autenticar o webhook.");
  }

  return false;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const authOk = await verifyFaceitWebhookAuth(req, rawBody);

    if (!authOk) {
      return NextResponse.json({ message: "Autenticacao do webhook invalida." }, { status: 403 });
    }

    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody) as WebhookBody;
    } catch {
      return NextResponse.json({ message: "Payload JSON invalido." }, { status: 400 });
    }

    const event = body.event || "";
    if (!event.toLowerCase().includes("finished")) {
      return NextResponse.json({ message: "Evento ignorado.", event }, { status: 200 });
    }

    const matchId = body.payload?.id || body.payload?.match_id;
    if (!matchId) {
      return NextResponse.json({ message: "match_id nao encontrado no payload." }, { status: 400 });
    }

    const result = await processQueridaFilaMatchPoints({
      matchId,
      queueIdHint: body.payload?.competition_id,
      source: "webhook",
    });

    if (result.processed) {
      revalidateTag("queridafila-partidas", "max");
      revalidatePath("/queridafila/partidas", "page");
      revalidatePath(`/queridafila/partidas/${matchId}`);
    }

    return NextResponse.json({
      success: result.success,
      event,
      matchId,
      queueId: result.queueId,
      queueCandidates: result.queueCandidates,
      updatedCount: result.updatedCount,
      missingCount: result.missingCount,
      processed: result.processed,
      updatedPlayers: result.updatedPlayers,
      notRegistered: result.notRegistered,
      message: result.message,
    });
  } catch (error) {
    console.error("[faceit-webhook] erro ao processar webhook:", error);
    return NextResponse.json({ message: "Erro interno ao processar webhook." }, { status: 500 });
  }
}

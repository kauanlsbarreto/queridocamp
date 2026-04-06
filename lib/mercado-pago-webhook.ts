import { createHmac, timingSafeEqual } from "crypto";

export type MercadoPagoWebhookMeta = {
  topic: string;
  action: string;
  id: string;
  rawQuery: string;
};

function normalizeString(value: unknown) {
  return String(value || "").trim();
}

export function parseMercadoPagoWebhookMeta(request: Request, body: any): MercadoPagoWebhookMeta {
  const { searchParams } = new URL(request.url);

  const topic =
    normalizeString(searchParams.get("topic")) ||
    normalizeString(searchParams.get("type")) ||
    normalizeString(body?.topic) ||
    normalizeString(body?.type);

  const action = normalizeString(searchParams.get("action")) || normalizeString(body?.action);

  const dataId =
    searchParams.get("data.id") ||
    searchParams.get("id") ||
    searchParams.get("payment_id") ||
    searchParams.get("resource") ||
    body?.data?.id ||
    body?.id ||
    body?.resource;

  const idRaw = normalizeString(dataId);
  const idMatch = idRaw.match(/\d+/);

  return {
    topic,
    action,
    id: idMatch ? idMatch[0] : idRaw,
    rawQuery: searchParams.toString(),
  };
}

function parseSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  let ts = "";
  let v1 = "";

  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (!key || !value) continue;

    const normalizedKey = key.trim().toLowerCase();
    const normalizedValue = value.trim();

    if (normalizedKey === "ts") ts = normalizedValue;
    if (normalizedKey === "v1") v1 = normalizedValue;
  }

  return { ts, v1 };
}

export type SignatureCheckResult = {
  valid: boolean;
  reason: string;
  ts: string;
  receivedV1: string;
  expectedHash: string;
  requestId: string;
};

export function verifyMercadoPagoWebhookSignature(request: Request, id: string): SignatureCheckResult {
  const blank: Omit<SignatureCheckResult, "valid" | "reason"> = { ts: "", receivedV1: "", expectedHash: "", requestId: "" };

  const secret = normalizeString(process.env.MERCADO_PAGO_WEBHOOK_SECRET);
  if (!secret) {
    // Se não houver segredo configurado, não bloqueia para manter compatibilidade.
    return { valid: true, reason: "secret-not-configured", ...blank };
  }

  const signatureHeader = normalizeString(request.headers.get("x-signature"));
  const requestId = normalizeString(request.headers.get("x-request-id"));

  if (!signatureHeader || !requestId || !id) {
    return { valid: false, reason: "missing-signature-data", ...blank, requestId };
  }

  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1) {
    return { valid: false, reason: "invalid-signature-header", ts, receivedV1: v1, expectedHash: "", requestId };
  }

  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const expectedHash = createHmac("sha256", secret).update(manifest).digest("hex");

  // Normaliza para minúsculas — MercadoPago pode enviar hex em maiúsculas.
  const normalizedV1 = v1.toLowerCase().trim();

  try {
    const left = Buffer.from(expectedHash, "utf8");
    const right = Buffer.from(normalizedV1, "utf8");
    const valid = left.length === right.length && timingSafeEqual(left, right);
    return {
      valid,
      reason: valid ? "ok" : "signature-mismatch",
      ts,
      receivedV1: normalizedV1,
      // Exibe o hash esperado apenas em caso de falha, para diagnóstico no Discord.
      expectedHash: valid ? "" : expectedHash,
      requestId,
    };
  } catch {
    return { valid: false, reason: "signature-compare-failed", ts, receivedV1: normalizedV1, expectedHash: "", requestId };
  }
}

export async function sendMercadoPagoEventToDiscord(payload: {
  meta: MercadoPagoWebhookMeta;
  operationCode?: string;
  operationStatus?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string;
  checkoutUrl?: string;
  signatureDiag?: {
    ts?: string;
    receivedV1?: string;
    expectedHash?: string;
    requestId?: string;
  };
}) {
  const webhookUrl = normalizeString(process.env.MERCADO_PAGO_DISCORD_WEBHOOK_URL);
  if (!webhookUrl) {
    return;
  }

  const fields = [
    { name: "Topic", value: payload.meta.topic || "-", inline: true },
    { name: "Action", value: payload.meta.action || "-", inline: true },
    { name: "Data ID", value: payload.meta.id || "-", inline: true },
    { name: "Operation", value: payload.operationCode || "-", inline: true },
    { name: "Operation Status", value: payload.operationStatus || "-", inline: true },
    { name: "Payment Status", value: payload.paymentStatus || "-", inline: true },
    { name: "Status Detail", value: payload.paymentStatusDetail || "-", inline: false },
    { name: "Query", value: payload.meta.rawQuery || "-", inline: false },
  ];

  if (payload.checkoutUrl) {
    fields.push({ name: "Checkout URL", value: payload.checkoutUrl, inline: false });
  }

  if (payload.signatureDiag) {
    const d = payload.signatureDiag;
    if (d.requestId) fields.push({ name: "X-Request-Id", value: d.requestId, inline: false });
    if (d.ts) fields.push({ name: "Sig TS", value: d.ts, inline: true });
    if (d.receivedV1) fields.push({ name: "Recebido (v1)", value: `\`${d.receivedV1}\``, inline: false });
    if (d.expectedHash) fields.push({ name: "Esperado (servidor)", value: `\`${d.expectedHash}\``, inline: false });
  }

  const body = {
    username: "Mercado Pago Webhooks",
    embeds: [
      {
        title: "Novo evento Mercado Pago",
        color: 3447003,
        timestamp: new Date().toISOString(),
        fields,
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    // Evita falhar o webhook do Mercado Pago por erro no Discord.
  }
}

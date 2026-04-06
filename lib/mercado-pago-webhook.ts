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

export function verifyMercadoPagoWebhookSignature(request: Request, id: string) {
  const secret = normalizeString(process.env.MERCADO_PAGO_WEBHOOK_SECRET);
  if (!secret) {
    // Se não houver segredo configurado, não bloqueia para manter compatibilidade.
    return { valid: true, reason: "secret-not-configured" };
  }

  const signatureHeader = normalizeString(request.headers.get("x-signature"));
  const requestId = normalizeString(request.headers.get("x-request-id"));

  if (!signatureHeader || !requestId || !id) {
    return { valid: false, reason: "missing-signature-data" };
  }

  const { ts, v1 } = parseSignatureHeader(signatureHeader);
  if (!ts || !v1) {
    return { valid: false, reason: "invalid-signature-header" };
  }

  const manifest = `id:${id};request-id:${requestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const left = Buffer.from(expected, "utf8");
    const right = Buffer.from(v1, "utf8");
    const valid = left.length === right.length && timingSafeEqual(left, right);
    return { valid, reason: valid ? "ok" : "signature-mismatch" };
  } catch {
    return { valid: false, reason: "signature-compare-failed" };
  }
}

export async function sendMercadoPagoEventToDiscord(payload: {
  meta: MercadoPagoWebhookMeta;
  operationCode?: string;
  operationStatus?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string;
  checkoutUrl?: string;
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

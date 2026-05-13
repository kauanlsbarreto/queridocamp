const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const RECIPIENT_EMAIL = "kauanlsbarreto@gmail.com";
const SENDER_NAME = "Querido Camp";
const SENDER_EMAIL = "kauan@queridocamp.com.br";

export type DesafiarEventType = "challenge_sent" | "counter_proposal" | "declined" | "rescheduled";

export type DesafiarEventBrevoPayload = {
  eventType: DesafiarEventType;
  matchId: number;
  rodada?: number | null;
  challengerTeam: string;
  challengedTeam: string;
  actorNickname: string;
  actorGuid: string;
  date?: string | null;
  time?: string | null;
  message?: string | null;
  beforeDate?: string | null;
  beforeTime?: string | null;
};

type DesafiarEventBrevoResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  statusCode?: number;
  error?: string;
};

function resolveBrevoApiKey(env?: any) {
  return String(
    process.env.API_BREVO || process.env.BREVO_API_KEY || env?.API_BREVO || env?.BREVO_API_KEY || "",
  ).trim();
}

function safe(value: unknown, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function eventLabel(eventType: DesafiarEventType) {
  if (eventType === "challenge_sent") return "Desafio enviado";
  if (eventType === "counter_proposal") return "Contraproposta enviada";
  if (eventType === "declined") return "Proposta recusada";
  return "Data alterada";
}

function buildSubject(payload: DesafiarEventBrevoPayload) {
  return `[CopaDraft/Desafiar] ${eventLabel(payload.eventType)} - Match #${payload.matchId}`;
}

function buildTextContent(payload: DesafiarEventBrevoPayload, timestamp: string) {
  const lines = [
    `Evento: ${eventLabel(payload.eventType)}`,
    `Quando: ${timestamp}`,
    `Match ID: ${safe(payload.matchId)}`,
    `Rodada: ${safe(payload.rodada)}`,
    `Time desafiante: ${safe(payload.challengerTeam)}`,
    `Time desafiado: ${safe(payload.challengedTeam)}`,
    `Ator: ${safe(payload.actorNickname)}`,
    `Faceit GUID: ${safe(payload.actorGuid)}`,
    `Data proposta: ${safe(payload.date)}`,
    `Hora proposta: ${safe(payload.time)}`,
    `Mensagem: ${safe(payload.message)}`,
  ];

  if (payload.eventType === "rescheduled") {
    lines.push(`Data anterior: ${safe(payload.beforeDate)}`);
    lines.push(`Hora anterior: ${safe(payload.beforeTime)}`);
  }

  return lines.join("\n");
}

function buildHtmlContent(payload: DesafiarEventBrevoPayload, timestamp: string) {
  const baseRows = [
    ["Evento", eventLabel(payload.eventType)],
    ["Quando", timestamp],
    ["Match ID", safe(payload.matchId)],
    ["Rodada", safe(payload.rodada)],
    ["Time desafiante", safe(payload.challengerTeam)],
    ["Time desafiado", safe(payload.challengedTeam)],
    ["Ator", safe(payload.actorNickname)],
    ["Faceit GUID", safe(payload.actorGuid)],
    ["Data proposta", safe(payload.date)],
    ["Hora proposta", safe(payload.time)],
    ["Mensagem", safe(payload.message)],
  ];

  if (payload.eventType === "rescheduled") {
    baseRows.push(["Data anterior", safe(payload.beforeDate)]);
    baseRows.push(["Hora anterior", safe(payload.beforeTime)]);
  }

  const rowsHtml = baseRows
    .map(([label, value]) => {
      return `<tr><td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);color:#93c5fd;font-weight:700;">${escapeHtml(label)}</td><td style="padding:8px 10px;border-bottom:1px solid rgba(255,255,255,0.08);color:#e5e7eb;">${escapeHtml(value)}</td></tr>`;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;background:#0b1220;color:#e5e7eb;padding:16px;">
      <div style="max-width:760px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
        <h2 style="margin:0 0 12px;color:#fff;">${escapeHtml(eventLabel(payload.eventType))}</h2>
        <table style="width:100%;border-collapse:collapse;background:#0b1220;border:1px solid rgba(255,255,255,0.08);border-radius:8px;overflow:hidden;">
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
  `;
}

export async function sendDesafiarEventBrevoEmail(
  payload: DesafiarEventBrevoPayload,
  env?: any,
): Promise<DesafiarEventBrevoResult> {
  const apiKey = resolveBrevoApiKey(env);
  if (!apiKey) {
    return { sent: false, skipped: true, reason: "BREVO_API_KEY_NAO_CONFIGURADA" };
  }

  const timestamp = new Date().toISOString();
  const subject = buildSubject(payload);
  const textContent = buildTextContent(payload, timestamp);
  const htmlContent = buildHtmlContent(payload, timestamp);

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [{ email: RECIPIENT_EMAIL }],
        subject,
        textContent,
        htmlContent,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[desafiar-brevo-events] resposta Brevo nao-OK:", response.status, errorText);
      return { sent: false, statusCode: response.status, error: errorText || "Resposta nao-OK da Brevo." };
    }

    return { sent: true, statusCode: response.status };
  } catch (error) {
    console.error("[desafiar-brevo-events] erro ao enviar email:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar email Brevo.",
    };
  }
}

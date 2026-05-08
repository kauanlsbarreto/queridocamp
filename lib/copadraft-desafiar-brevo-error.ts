const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const RECIPIENT_EMAIL = "kauanlsbarreto@gmail.com";
const SENDER_NAME = "Querido Camp";
const SENDER_EMAIL = "kauan@queridocamp.com.br";

export type DesafiarErrorEmailPayload = {
  source: string;
  errorMessage: string;
  errorStack?: string | null;
  actorGuid?: string | null;
  actorNickname?: string | null;
  requestUrl?: string | null;
  extra?: Record<string, unknown> | null;
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

function serializeExtra(extra?: Record<string, unknown> | null) {
  try {
    return extra ? JSON.stringify(extra, null, 2) : "-";
  } catch {
    return "-";
  }
}

export async function sendDesafiarErrorBrevoEmail(payload: DesafiarErrorEmailPayload, env?: any) {
  const apiKey = resolveBrevoApiKey(env);
  if (!apiKey) {
    return { sent: false, skipped: true, reason: "BREVO_API_KEY_NAO_CONFIGURADA" };
  }

  const subject = `[CopaDraft/Desafiar] Erro - ${safe(payload.source)}`;
  const timestamp = new Date().toISOString();
  const extraText = serializeExtra(payload.extra);

  const textContent = [
    "Erro na pagina Desafiar",
    `Fonte: ${safe(payload.source)}`,
    `Quando: ${timestamp}`,
    `Nickname: ${safe(payload.actorNickname)}`,
    `Faceit GUID: ${safe(payload.actorGuid)}`,
    `URL: ${safe(payload.requestUrl)}`,
    `Erro: ${safe(payload.errorMessage)}`,
    `Stack: ${safe(payload.errorStack)}`,
    `Extra: ${extraText}`,
  ].join("\n");

  const htmlContent = `
    <div style="font-family:Arial,sans-serif;background:#0b1220;color:#e5e7eb;padding:16px;">
      <div style="max-width:760px;margin:0 auto;background:#111827;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;">
        <h2 style="margin:0 0 10px;color:#fff;">Erro na pagina Desafiar</h2>
        <p style="margin:0 0 8px;color:#9ca3af;">Fonte: ${escapeHtml(safe(payload.source))}</p>
        <p style="margin:0 0 8px;color:#9ca3af;">Quando: ${escapeHtml(timestamp)}</p>
        <p style="margin:0 0 8px;color:#e5e7eb;"><b>Nickname:</b> ${escapeHtml(safe(payload.actorNickname))}</p>
        <p style="margin:0 0 8px;color:#e5e7eb;"><b>Faceit GUID:</b> ${escapeHtml(safe(payload.actorGuid))}</p>
        <p style="margin:0 0 8px;color:#e5e7eb;"><b>URL:</b> ${escapeHtml(safe(payload.requestUrl))}</p>
        <p style="margin:12px 0 6px;color:#fca5a5;"><b>Erro</b></p>
        <pre style="white-space:pre-wrap;background:#0b1220;border:1px solid rgba(255,255,255,0.08);padding:10px;border-radius:8px;">${escapeHtml(safe(payload.errorMessage))}</pre>
        <p style="margin:12px 0 6px;color:#93c5fd;"><b>Stack</b></p>
        <pre style="white-space:pre-wrap;background:#0b1220;border:1px solid rgba(255,255,255,0.08);padding:10px;border-radius:8px;">${escapeHtml(safe(payload.errorStack))}</pre>
        <p style="margin:12px 0 6px;color:#a7f3d0;"><b>Extra</b></p>
        <pre style="white-space:pre-wrap;background:#0b1220;border:1px solid rgba(255,255,255,0.08);padding:10px;border-radius:8px;">${escapeHtml(extraText)}</pre>
      </div>
    </div>
  `;

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
      console.error("[desafiar-brevo-error] resposta Brevo nao-OK:", response.status, errorText);
      return { sent: false, statusCode: response.status, error: errorText || "Resposta nao-OK da Brevo." };
    }

    return { sent: true, statusCode: response.status };
  } catch (error) {
    console.error("[desafiar-brevo-error] erro ao enviar email:", error);
    return { sent: false, error: error instanceof Error ? error.message : "Erro desconhecido ao enviar email Brevo." };
  }
}

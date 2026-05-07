const BREVO_SMS_API_URL = "https://api.brevo.com/v3/transactionalSMS/send";

export type BrevoSmsPayload = {
  recipient: string;
  content: string;
  sender?: string;
  type?: "transactional" | "marketing";
  webhookUrl?: string;
  tag?: string;
};

export type BrevoSmsResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  statusCode?: number;
  messageId?: string;
  error?: string;
};

function resolveBrevoApiKey(env?: any) {
  return String(
    process.env.API_BREVO || process.env.BREVO_API_KEY || env?.API_BREVO || env?.BREVO_API_KEY || "",
  ).trim();
}

function resolveSender(payloadSender?: string) {
  return String(payloadSender || process.env.BREVO_SMS_SENDER || "QueridoCamp").trim();
}

export async function sendBrevoSms(payload: BrevoSmsPayload, env?: any): Promise<BrevoSmsResult> {
  const apiKey = resolveBrevoApiKey(env);
  if (!apiKey) {
    return { sent: false, skipped: true, reason: "BREVO_API_KEY_NAO_CONFIGURADA" };
  }

  const sender = resolveSender(payload.sender);
  if (!sender) {
    return { sent: false, skipped: true, reason: "BREVO_SMS_SENDER_NAO_CONFIGURADO" };
  }

  try {
    const response = await fetch(BREVO_SMS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender,
        recipient: payload.recipient,
        content: payload.content,
        type: payload.type || "transactional",
        webhookUrl: payload.webhookUrl,
        tag: payload.tag,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[brevo-sms] resposta Brevo nao-OK:", response.status, errorText);
      return {
        sent: false,
        statusCode: response.status,
        error: errorText || "Resposta nao-OK da Brevo.",
      };
    }

    const data = await response.json().catch(() => null as any);
    return {
      sent: true,
      statusCode: response.status,
      messageId: String(data?.messageId || "").trim() || undefined,
    };
  } catch (error) {
    console.error("[brevo-sms] erro ao enviar SMS:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar SMS Brevo.",
    };
  }
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BREVO_EMAIL_API_URL = "https://api.brevo.com/v3/smtp/email";
const WEBHOOK_EMAIL_RECIPIENT = "kauanlsbarreto@gmail.com";
const EMAIL_SENDER_NAME = "Querido Camp";
const EMAIL_SENDER_ADDRESS = "kauan@queridocamp.com.br";

type RailwayWebhookBody = {
  event?: string;
  service?: string;
  status?: string;
  environment?: string;
  [key: string]: unknown;
};

type BrevoEmailResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  statusCode?: number;
  error?: string;
};

type RestartAttemptResult = {
  attempted: boolean;
  restarted: boolean;
  reason?: string;
  deploymentId?: string;
  statusCode?: number;
  error?: string;
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

function isAuthorized(req: Request): boolean {
  const configuredToken = String(process.env.RAILWAY_WEBHOOK_TOKEN || "").trim();
  if (!configuredToken) {
    return true;
  }

  const headerToken = String(req.headers.get("x-railway-token") || "").trim();
  const bearerToken = String(req.headers.get("authorization") || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const queryToken = new URL(req.url).searchParams.get("token") || "";

  if (headerToken && constantTimeEqual(headerToken, configuredToken)) return true;
  if (bearerToken && constantTimeEqual(bearerToken, configuredToken)) return true;
  if (queryToken && constantTimeEqual(queryToken, configuredToken)) return true;

  return false;
}

function resolveBrevoApiKey() {
  return String(process.env.API_BREVO || process.env.BREVO_API_KEY || "").trim();
}

function resolveProjectAccessToken() {
  return String(process.env.RAILWAY_PROJECT_ACCESS_TOKEN || process.env.RAILWAY_PROJECT_TOKEN || "").trim();
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function extractDeploymentId(payload: RailwayWebhookBody) {
  const root = payload as Record<string, any>;
  return pickFirstString(
    root.deploymentId,
    root.deployment_id,
    root.id,
    root?.deployment?.id,
    root?.deployment?.deploymentId,
    root?.deployment?.deployment_id,
    root?.payload?.deploymentId,
    root?.payload?.deployment_id,
    root?.payload?.id,
    root?.payload?.deployment?.id,
    root?.data?.deploymentId,
    root?.data?.deployment_id,
    root?.data?.deployment?.id,
  );
}

function shouldTryRestart(payload: RailwayWebhookBody) {
  const enabled = String(process.env.RAILWAY_AUTO_RESTART_ON_CRASH || "").trim() === "1";
  if (!enabled) return false;

  const event = pickFirstString(payload.event).toUpperCase();
  const status = pickFirstString(payload.status, (payload as any)?.deployment?.status, (payload as any)?.payload?.status)
    .toUpperCase();

  if (status === "CRASHED" || status === "FAILED") return true;
  if (event.includes("CRASHED") || event.includes("FAILED")) return true;
  return false;
}

async function restartRailwayDeployment(deploymentId: string): Promise<RestartAttemptResult> {
  const projectToken = resolveProjectAccessToken();
  if (!projectToken) {
    return {
      attempted: false,
      restarted: false,
      reason: "RAILWAY_PROJECT_ACCESS_TOKEN_NAO_CONFIGURADO",
      deploymentId,
    };
  }

  try {
    const response = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Project-Access-Token": projectToken,
      },
      body: JSON.stringify({
        query: "mutation RestartDeployment($id: String!) { deploymentRestart(id: $id) }",
        variables: { id: deploymentId },
      }),
      cache: "no-store",
    });

    const raw = await response.text().catch(() => "");

    if (!response.ok) {
      return {
        attempted: true,
        restarted: false,
        deploymentId,
        statusCode: response.status,
        error: raw || "Resposta nao-OK da API Railway.",
      };
    }

    const parsed = raw ? (JSON.parse(raw) as { data?: { deploymentRestart?: boolean }; errors?: Array<{ message?: string }> }) : null;
    const hasErrors = Array.isArray(parsed?.errors) && parsed!.errors!.length > 0;

    if (hasErrors) {
      return {
        attempted: true,
        restarted: false,
        deploymentId,
        statusCode: response.status,
        error: parsed?.errors?.map((item) => item?.message || "erro-desconhecido").join(" | "),
      };
    }

    return {
      attempted: true,
      restarted: Boolean(parsed?.data?.deploymentRestart),
      deploymentId,
      statusCode: response.status,
      reason: parsed?.data?.deploymentRestart ? "DEPLOYMENT_RESTART_ENVIADO" : "DEPLOYMENT_RESTART_SEM_CONFIRMACAO",
    };
  } catch (error) {
    return {
      attempted: true,
      restarted: false,
      deploymentId,
      error: error instanceof Error ? error.message : "Erro desconhecido ao chamar Railway API.",
    };
  }
}

function buildEmailText(payload: RailwayWebhookBody, rawBody: string, restartResult: RestartAttemptResult) {
  const event = String(payload.event || "evento-desconhecido");
  const service = String(payload.service || "servico-desconhecido");
  const status = String(payload.status || "status-desconhecido");
  const environment = String(payload.environment || "prod");

  return [
    "Railway webhook recebido.",
    `Evento: ${event}`,
    `Servico: ${service}`,
    `Status: ${status}`,
    `Ambiente: ${environment}`,
    `Auto-restart tentado: ${restartResult.attempted ? "sim" : "nao"}`,
    `Auto-restart executado: ${restartResult.restarted ? "sim" : "nao"}`,
    `Deployment ID: ${restartResult.deploymentId || "nao informado"}`,
    `Motivo: ${restartResult.reason || restartResult.error || "-"}`,
    "",
    "Payload bruto:",
    rawBody,
  ].join("\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(payload: RailwayWebhookBody, rawBody: string, restartResult: RestartAttemptResult) {
  const event = String(payload.event || "evento-desconhecido");
  const service = String(payload.service || "servico-desconhecido");
  const status = String(payload.status || "status-desconhecido");
  const environment = String(payload.environment || "prod");

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111111;">
      <h2 style="margin:0 0 12px;">Railway webhook recebido</h2>
      <p style="margin:0 0 8px;"><strong>Evento:</strong> ${escapeHtml(event)}</p>
      <p style="margin:0 0 8px;"><strong>Servico:</strong> ${escapeHtml(service)}</p>
      <p style="margin:0 0 8px;"><strong>Status:</strong> ${escapeHtml(status)}</p>
      <p style="margin:0 0 12px;"><strong>Ambiente:</strong> ${escapeHtml(environment)}</p>
      <p style="margin:0 0 8px;"><strong>Auto-restart tentado:</strong> ${restartResult.attempted ? "sim" : "nao"}</p>
      <p style="margin:0 0 8px;"><strong>Auto-restart executado:</strong> ${restartResult.restarted ? "sim" : "nao"}</p>
      <p style="margin:0 0 8px;"><strong>Deployment ID:</strong> ${escapeHtml(restartResult.deploymentId || "nao informado")}</p>
      <p style="margin:0 0 12px;"><strong>Motivo:</strong> ${escapeHtml(restartResult.reason || restartResult.error || "-")}</p>
      <p style="margin:0 0 6px;"><strong>Payload bruto:</strong></p>
      <pre style="white-space:pre-wrap;background:#f5f5f5;border:1px solid #dddddd;padding:10px;border-radius:8px;">${escapeHtml(rawBody)}</pre>
    </div>
  `;
}

async function sendWebhookBrevoEmail(
  payload: RailwayWebhookBody,
  rawBody: string,
  restartResult: RestartAttemptResult,
): Promise<BrevoEmailResult> {
  const apiKey = resolveBrevoApiKey();
  if (!apiKey) {
    return { sent: false, skipped: true, reason: "BREVO_API_KEY_NAO_CONFIGURADA" };
  }

  try {
    const response = await fetch(BREVO_EMAIL_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: EMAIL_SENDER_NAME,
          email: EMAIL_SENDER_ADDRESS,
        },
        to: [{ email: WEBHOOK_EMAIL_RECIPIENT }],
        subject: `Railway webhook: ${String(payload.event || "evento-desconhecido")}`,
        textContent: buildEmailText(payload, rawBody, restartResult),
        htmlContent: buildEmailHtml(payload, rawBody, restartResult),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[railway-webhook] resposta Brevo nao-OK:", response.status, errorText);
      return {
        sent: false,
        statusCode: response.status,
        error: errorText || "Resposta nao-OK da Brevo.",
      };
    }

    return { sent: true, statusCode: response.status };
  } catch (error) {
    console.error("[railway-webhook] erro ao enviar email Brevo:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar email Brevo.",
    };
  }
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ message: "Webhook nao autorizado." }, { status: 403 });
    }

    const rawBody = await req.text();

    let body: RailwayWebhookBody;
    try {
      body = JSON.parse(rawBody) as RailwayWebhookBody;
    } catch {
      return NextResponse.json({ message: "Payload JSON invalido." }, { status: 400 });
    }

    let restartResult: RestartAttemptResult = {
      attempted: false,
      restarted: false,
      reason: "EVENTO_NAO_ELEGIVEL_PARA_RESTART",
    };

    if (shouldTryRestart(body)) {
      const deploymentId = extractDeploymentId(body);
      if (!deploymentId) {
        restartResult = {
          attempted: false,
          restarted: false,
          reason: "DEPLOYMENT_ID_NAO_ENCONTRADO_NO_PAYLOAD",
        };
      } else {
        restartResult = await restartRailwayDeployment(deploymentId);
      }
    }

    const emailResult = await sendWebhookBrevoEmail(body, rawBody, restartResult);

    if (!emailResult.sent) {
      const status = emailResult.statusCode && emailResult.statusCode >= 400 ? emailResult.statusCode : 500;
      return NextResponse.json(
        {
          success: false,
          message: "Falha ao enviar email via Brevo.",
          emailResult,
          restartResult,
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Webhook recebido e email enviado.",
      emailResult,
      restartResult,
    });
  } catch (error) {
    console.error("[railway-webhook] erro ao processar webhook:", error);
    return NextResponse.json({ message: "Erro interno ao processar webhook." }, { status: 500 });
  }
}

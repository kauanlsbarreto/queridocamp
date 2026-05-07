import { NextResponse } from "next/server";
import { sendBrevoSms } from "@/lib/brevo-sms";

export const dynamic = "force-dynamic";

type RailwayWebhookBody = {
  event?: string;
  service?: string;
  status?: string;
  environment?: string;
  [key: string]: unknown;
};

type RailwayProjectTokenResponse = {
  data?: {
    projectToken?: {
      projectId?: string;
      environmentId?: string;
    };
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

async function fetchRailwayProjectContext() {
  const projectToken = String(
    process.env.RAILWAY_PROJECT_ACCESS_TOKEN || process.env.RAILWAY_PROJECT_TOKEN || "",
  ).trim();

  if (!projectToken) {
    return null;
  }

  try {
    const response = await fetch("https://backboard.railway.com/graphql/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Project-Access-Token": projectToken,
      },
      body: JSON.stringify({
        query: "query { projectToken { projectId environmentId } }",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[railway-webhook] falha ao consultar API Railway:", response.status, errorText);
      return null;
    }

    const data = (await response.json().catch(() => null)) as RailwayProjectTokenResponse | null;
    const projectId = String(data?.data?.projectToken?.projectId || "").trim();
    const environmentId = String(data?.data?.projectToken?.environmentId || "").trim();

    if (!projectId && !environmentId) {
      return null;
    }

    return { projectId, environmentId };
  } catch (error) {
    console.error("[railway-webhook] erro ao consultar contexto Railway:", error);
    return null;
  }
}

function buildSmsMessage(payload: RailwayWebhookBody, projectContext?: { projectId?: string; environmentId?: string } | null) {
  const event = String(payload.event || "evento-desconhecido");
  const service = String(payload.service || "servico-desconhecido");
  const status = String(payload.status || "status-desconhecido");
  const environment = String(payload.environment || "prod");
  const projectId = String(projectContext?.projectId || "").trim();
  const environmentId = String(projectContext?.environmentId || "").trim();

  const parts = [
    "Railway webhook recebido.",
    `Evento: ${event}`,
    `Servico: ${service}`,
    `Status: ${status}`,
    `Ambiente: ${environment}`,
  ];

  if (projectId) {
    parts.push(`Projeto: ${projectId}`);
  }

  if (environmentId) {
    parts.push(`EnvId: ${environmentId}`);
  }

  return parts.join(" | ");
}

export async function POST(req: Request) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ message: "Webhook nao autorizado." }, { status: 403 });
    }

    let body: RailwayWebhookBody;
    try {
      body = (await req.json()) as RailwayWebhookBody;
    } catch {
      return NextResponse.json({ message: "Payload JSON invalido." }, { status: 400 });
    }

    const projectContext = await fetchRailwayProjectContext();

    const smsResult = await sendBrevoSms({
      recipient: "+5579981333930",
      content: buildSmsMessage(body, projectContext),
      type: "transactional",
      tag: "railway-webhook",
    });

    if (!smsResult.sent) {
      const status = smsResult.statusCode && smsResult.statusCode >= 400 ? smsResult.statusCode : 500;
      return NextResponse.json(
        {
          success: false,
          message: "Falha ao enviar SMS via Brevo.",
          smsResult,
        },
        { status },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Webhook recebido e SMS enviado.",
      smsResult,
    });
  } catch (error) {
    console.error("[railway-webhook] erro ao processar webhook:", error);
    return NextResponse.json({ message: "Erro interno ao processar webhook." }, { status: 500 });
  }
}

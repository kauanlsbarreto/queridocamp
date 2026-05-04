import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import { mapProviderStatusToLocal } from "@/lib/pagbank-loja";
import {
  loadLojaPaymentDiscordContext,
  sendLojaPaymentDiscordWebhook,
} from "@/lib/loja-payment-discord-webhook";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: number;
  payment_ref: string;
  provider_id?: string | null;
  estoque_id: number;
  status: string;
};

async function ensurePaymentsTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS loja_pagamentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      payment_ref VARCHAR(120) NOT NULL UNIQUE,
      provider_type VARCHAR(20) NOT NULL,
      provider_id VARCHAR(120) DEFAULT NULL,
      provider_checkout_url TEXT,
      provider_qr_code_url TEXT,
      provider_qr_code_text TEXT,
      faceit_guid VARCHAR(255) NOT NULL,
      player_id INT NOT NULL,
      estoque_id INT NOT NULL,
      item_nome VARCHAR(255) NOT NULL,
      metodo VARCHAR(20) NOT NULL,
      amount_cents INT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      expires_at DATETIME DEFAULT NULL,
      paid_at DATETIME DEFAULT NULL,
      failure_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function ensurePaymentsLogsTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS loja_pagamentos_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      payment_id INT NULL,
      payment_ref VARCHAR(120) NULL,
      event_name VARCHAR(80) NOT NULL,
      status_before VARCHAR(30) NULL,
      status_after VARCHAR(30) NULL,
      source VARCHAR(30) NOT NULL DEFAULT 'api',
      message TEXT,
      details_json JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_loja_pag_logs_payment_id (payment_id),
      INDEX idx_loja_pag_logs_payment_ref (payment_ref),
      INDEX idx_loja_pag_logs_event_name (event_name),
      INDEX idx_loja_pag_logs_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function createPaymentLog(
  connection: any,
  payload: {
    paymentId?: number | null;
    paymentRef?: string | null;
    eventName: string;
    statusBefore?: string | null;
    statusAfter?: string | null;
    source?: string;
    message?: string;
    details?: unknown;
  },
) {
  await connection.query(
    `INSERT INTO loja_pagamentos_logs
     (payment_id, payment_ref, event_name, status_before, status_after, source, message, details_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.paymentId ?? null,
      payload.paymentRef ?? null,
      payload.eventName,
      payload.statusBefore ?? null,
      payload.statusAfter ?? null,
      payload.source || "api",
      payload.message ?? null,
      payload.details ? JSON.stringify(payload.details) : null,
    ],
  );
}

function isFinal(status: string) {
  const value = String(status || "").toUpperCase();
  return ["PAID", "DECLINED", "CANCELED", "EXPIRED", "FAILED"].includes(value);
}

async function markPaidAndDecrementStock(connection: any, paymentId: number) {
  await connection.beginTransaction();
  try {
    const [paymentRows] = await connection.query(
      "SELECT id, estoque_id, status FROM loja_pagamentos WHERE id = ? FOR UPDATE",
      [paymentId],
    );
    const rows = paymentRows as Array<{ id: number; estoque_id: number; status: string }>;

    if (!rows.length) {
      throw new Error("Pagamento nao encontrado.");
    }

    const payment = rows[0];
    const currentStatus = String(payment.status || "").toUpperCase();
    if (currentStatus === "PAID") {
      await createPaymentLog(connection, {
        paymentId,
        eventName: "PAYMENT_ALREADY_PAID",
        statusBefore: currentStatus,
        statusAfter: currentStatus,
        source: "api-webhook",
      });
      await connection.commit();
      return { finalStatus: currentStatus };
    }

    const [stockRows] = await connection.query("SELECT estoque FROM estoque WHERE id = ? FOR UPDATE", [payment.estoque_id]);
    const items = stockRows as Array<{ estoque: number }>;

    if (!items.length || Number(items[0].estoque || 0) <= 0) {
      await connection.query(
        "UPDATE loja_pagamentos SET status = 'FAILED', failure_reason = ? WHERE id = ?",
        ["Sem estoque na confirmacao via webhook.", paymentId],
      );
      await createPaymentLog(connection, {
        paymentId,
        eventName: "PAYMENT_FAILED_STOCK_EMPTY",
        statusBefore: currentStatus,
        statusAfter: "FAILED",
        source: "api-webhook",
      });
      await connection.commit();
      return { finalStatus: "FAILED" };
    }

    await connection.query("UPDATE estoque SET estoque = estoque - 1 WHERE id = ? AND estoque > 0", [payment.estoque_id]);
    await connection.query("UPDATE loja_pagamentos SET status = 'PAID', paid_at = NOW(), failure_reason = NULL WHERE id = ?", [
      paymentId,
    ]);
    await createPaymentLog(connection, {
      paymentId,
      eventName: "PAYMENT_CONFIRMED_AND_STOCK_DECREMENTED",
      statusBefore: currentStatus,
      statusAfter: "PAID",
      source: "api-webhook",
    });

    await connection.commit();
    return { finalStatus: "PAID" };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

function pickStatusFromBody(body: any) {
  const root = body?.data ?? body;

  const transactionalStatus =
    (Array.isArray(root?.charges) ? root.charges[0]?.status : "") ||
    (Array.isArray(root?.payments) && Array.isArray(root.payments[0]?.charges)
      ? root.payments[0].charges[0]?.status
      : "") ||
    (Array.isArray(root?.payments) ? root.payments[0]?.status : "") ||
    root?.status ||
    root?.payment_status ||
    root?.payment?.status;

  return String(transactionalStatus || "").toUpperCase();
}

function pickReferenceIdFromBody(body: any) {
  const root = body?.data ?? body;
  return String(root?.reference_id || root?.payment_reference || "").trim();
}

function pickProviderIdFromBody(body: any) {
  const root = body?.data ?? body;

  return String(
    root?.id ||
      root?.checkout?.id ||
      root?.payment?.id ||
      root?.charge?.id ||
      (Array.isArray(root?.payments) ? root.payments[0]?.id : "") ||
      (Array.isArray(root?.charges) ? root.charges[0]?.id : "") ||
      "",
  ).trim();
}

function resolveWebhookSignature(request: Request) {
  const candidates = [
    request.headers.get("x-signature"),
    request.headers.get("x-pagbank-signature"),
    request.headers.get("x-pagseguro-signature"),
  ];

  for (const raw of candidates) {
    const value = String(raw || "").trim();
    if (!value) continue;
    if (value.toLowerCase().startsWith("sha256=")) {
      return value.slice("sha256=".length);
    }
    return value;
  }

  return "";
}

function verifyWebhookHmac(rawBody: string, signature: string, secret: string) {
  if (!signature || !secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const signatureBuffer = Buffer.from(signature, "hex");

  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function POST(request: Request) {

  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    const configuredToken = String(process.env.PAGBANK_WEBHOOK_TOKEN || env?.PAGBANK_WEBHOOK_TOKEN || "").trim();
    const hmacSecret = String(
      process.env.PAGBANK_WEBHOOK_HMAC_SECRET || env?.PAGBANK_WEBHOOK_HMAC_SECRET || "",
    ).trim();

    if (!process.env.LOJA_PAGAMENTO_DISCORD_WEBHOOK_URL && env?.LOJA_PAGAMENTO_DISCORD_WEBHOOK_URL) {
      process.env.LOJA_PAGAMENTO_DISCORD_WEBHOOK_URL = String(env.LOJA_PAGAMENTO_DISCORD_WEBHOOK_URL);
    }
    if (!process.env.LOJA_WEBHOOK_URL && env?.LOJA_WEBHOOK_URL) {
      process.env.LOJA_WEBHOOK_URL = String(env.LOJA_WEBHOOK_URL);
    }

    const url = new URL(request.url);
    const queryToken = String(url.searchParams.get("token") || "").trim();
    const headerToken = String(request.headers.get("x-webhook-token") || "").trim();
    const tokenIsValid = Boolean(configuredToken) && (queryToken === configuredToken || headerToken === configuredToken);

    try {
      const fs = await import("fs");
      const path = require("path");
      const logPath = path.resolve(process.cwd(), "pagbank-logs.txt");
      const now = new Date().toISOString();
      const rawBody = await request.text();
      fs.appendFileSync(
        logPath,
        `\n[PAGBANK][WEBHOOK] ${now}\n${rawBody}\n`
      );
      // Precisa reparsear o body depois de ler o texto
      var body = JSON.parse(rawBody || "{}");
    } catch (e) {
      // fallback: tenta ler o body normalmente
      var rawBody = await request.text();
      var body = JSON.parse(rawBody || "{}");
    }
    // --- FIM LOG PAGBANK ---

    const signature = resolveWebhookSignature(request);
    const hasSignature = Boolean(signature);
    if (hasSignature && hmacSecret) {
      const valid = verifyWebhookHmac(rawBody, signature, hmacSecret);
      if (!valid && !tokenIsValid) {
        return NextResponse.json({ ok: false, message: "Assinatura HMAC invalida." }, { status: 401 });
      }
    }

    if (configuredToken && !tokenIsValid && !(hasSignature && hmacSecret)) {
      return NextResponse.json({ ok: false, message: "Webhook nao autorizado." }, { status: 401 });
    }

    const referenceId = pickReferenceIdFromBody(body);
    const providerId = pickProviderIdFromBody(body);
    const providerStatus = pickStatusFromBody(body);

    connection = await createMainConnection(env);
    await ensurePaymentsTable(connection);
    await ensurePaymentsLogsTable(connection);

    let rows: any[] = [];
    let matchedBy: "payment_ref" | "provider_id" | null = null;

    if (referenceId) {
      const [refRows] = await connection.query(
        "SELECT id, payment_ref, provider_id, estoque_id, status FROM loja_pagamentos WHERE payment_ref = ? LIMIT 1",
        [referenceId],
      );
      rows = refRows as any[];
      if (rows.length) matchedBy = "payment_ref";
    }

    if (!rows.length && providerId) {
      const [providerRows] = await connection.query(
        "SELECT id, payment_ref, provider_id, estoque_id, status FROM loja_pagamentos WHERE provider_id = ? ORDER BY id DESC LIMIT 1",
        [providerId],
      );
      rows = providerRows as any[];
      if (rows.length) matchedBy = "provider_id";
    }

    if (!rows.length) {
      await createPaymentLog(connection, {
        eventName: "WEBHOOK_PAYMENT_NOT_FOUND",
        source: "api-webhook",
        message: "Nao foi possivel localizar pagamento por reference_id/provider_id.",
        details: {
          event: body?.event ?? null,
          referenceId,
          providerId,
          bodyKeys: Object.keys(body ?? {}),
          dataKeys: body?.data ? Object.keys(body.data) : null,
          rawSnippet: JSON.stringify(body).slice(0, 800),
        },
      });
      return NextResponse.json({ ok: true, ignored: true, reason: "pagamento nao localizado" }, { status: 200 });
    }

    const payments = rows as PaymentRow[];
    const payment = payments[0];

    if (matchedBy === "provider_id") {
      await createPaymentLog(connection, {
        paymentId: payment.id,
        paymentRef: payment.payment_ref,
        eventName: "WEBHOOK_MATCHED_BY_PROVIDER_ID",
        source: "api-webhook",
        details: {
          providerId,
          providerStatus,
        },
      });
    }

    const currentStatus = String(payment.status || "").toUpperCase();
    if (isFinal(currentStatus)) {
      await createPaymentLog(connection, {
        paymentId: payment.id,
        paymentRef: payment.payment_ref,
        eventName: "WEBHOOK_IGNORED_FINAL_STATUS",
        statusBefore: currentStatus,
        statusAfter: currentStatus,
        source: "api-webhook",
        details: {
          providerStatus,
        },
      });
      const notificationPayment = await loadLojaPaymentDiscordContext(connection, payment.id);
      if (notificationPayment) {
        const dispatch = await sendLojaPaymentDiscordWebhook({
          eventName: "WEBHOOK_IGNORED_FINAL_STATUS",
          source: "api-webhook",
          statusBefore: currentStatus,
          statusAfter: currentStatus,
          providerStatus,
          providerData: body,
          webhookBody: body,
          payment: notificationPayment,
        });
        await createPaymentLog(connection, {
          paymentId: payment.id,
          paymentRef: payment.payment_ref,
          eventName: dispatch.sent ? "DISCORD_WEBHOOK_SENT" : "DISCORD_WEBHOOK_FAILED",
          statusBefore: currentStatus,
          statusAfter: currentStatus,
          source: "api-webhook",
          message: dispatch.sent
            ? "Webhook Discord enviado com sucesso."
            : dispatch.reason || dispatch.error || "Falha ao enviar webhook Discord.",
          details: dispatch,
        });
      }
      return NextResponse.json({ ok: true, ignored: true, reason: "status final" }, { status: 200 });
    }

    const mappedStatus = mapProviderStatusToLocal(providerStatus);

    if (mappedStatus === "PAID") {
      await createPaymentLog(connection, {
        paymentId: payment.id,
        paymentRef: payment.payment_ref,
        eventName: "WEBHOOK_STATUS_RECEIVED",
        statusBefore: currentStatus,
        statusAfter: mappedStatus,
        source: "api-webhook",
        details: {
          providerStatus,
        },
      });
      const result = await markPaidAndDecrementStock(connection, payment.id);
      const notificationPayment = await loadLojaPaymentDiscordContext(connection, payment.id);
      if (notificationPayment) {
        const dispatch = await sendLojaPaymentDiscordWebhook({
          eventName: "WEBHOOK_STATUS_RECEIVED",
          source: "api-webhook",
          statusBefore: currentStatus,
          statusAfter: result.finalStatus,
          providerStatus,
          providerData: body,
          webhookBody: body,
          payment: notificationPayment,
        });
        await createPaymentLog(connection, {
          paymentId: payment.id,
          paymentRef: payment.payment_ref,
          eventName: dispatch.sent ? "DISCORD_WEBHOOK_SENT" : "DISCORD_WEBHOOK_FAILED",
          statusBefore: currentStatus,
          statusAfter: result.finalStatus,
          source: "api-webhook",
          message: dispatch.sent
            ? "Webhook Discord enviado com sucesso."
            : dispatch.reason || dispatch.error || "Falha ao enviar webhook Discord.",
          details: dispatch,
        });
      }
      return NextResponse.json({ ok: true, status: result.finalStatus }, { status: 200 });
    }

    await connection.query("UPDATE loja_pagamentos SET status = ? WHERE id = ?", [mappedStatus, payment.id]);
    await createPaymentLog(connection, {
      paymentId: payment.id,
      paymentRef: payment.payment_ref,
      eventName: "WEBHOOK_STATUS_UPDATED",
      statusBefore: currentStatus,
      statusAfter: mappedStatus,
      source: "api-webhook",
      details: {
        providerStatus,
      },
    });
    const notificationPayment = await loadLojaPaymentDiscordContext(connection, payment.id);
    if (notificationPayment) {
      const dispatch = await sendLojaPaymentDiscordWebhook({
        eventName: "WEBHOOK_STATUS_UPDATED",
        source: "api-webhook",
        statusBefore: currentStatus,
        statusAfter: mappedStatus,
        providerStatus,
        providerData: body,
        webhookBody: body,
        payment: notificationPayment,
      });
      await createPaymentLog(connection, {
        paymentId: payment.id,
        paymentRef: payment.payment_ref,
        eventName: dispatch.sent ? "DISCORD_WEBHOOK_SENT" : "DISCORD_WEBHOOK_FAILED",
        statusBefore: currentStatus,
        statusAfter: mappedStatus,
        source: "api-webhook",
        message: dispatch.sent
          ? "Webhook Discord enviado com sucesso."
          : dispatch.reason || dispatch.error || "Falha ao enviar webhook Discord.",
        details: dispatch,
      });
      // LOG PAGBANK: salva evento detalhado no TXT
      try {
        const fs = await import("fs");
        const path = require("path");
        const logPath = path.resolve(process.cwd(), "pagbank-logs.txt");
        const now = new Date().toISOString();
        const eventLabel = `Pagamento Loja: ${mappedStatus === "PAID" ? "Pago" : mappedStatus}`;
        const statusLabel = mappedStatus === "PAID" ? "Pago" : mappedStatus;
        let logMsg = `\n[PAGBANK][EVENTO] ${now}\n`;
        logMsg += `Evento: WEBHOOK_STATUS_UPDATED\n`;
        logMsg += `Origem: api-webhook\n`;
        logMsg += `Status PagBank: ${providerStatus}\n`;
        logMsg += `Pagamento\n#${payment.id} | ${payment.payment_ref} | ${payment.metodo} | R$ ${(payment.amount_cents/100).toFixed(2)}\n`;
        logMsg += `Status\nAnterior: ${currentStatus}\nAtual: ${statusLabel}\nPagBank: ${providerStatus}\n`;
        logMsg += `Jogador / Item\nJogador: ${notificationPayment.player_nickname}\nFaceit GUID: ${notificationPayment.faceit_guid}\nPlayer ID: ${notificationPayment.player_id}\nItem: ${notificationPayment.item_nome}\nItem ID: ${notificationPayment.estoque_id}\n`;
        logMsg += `Cliente\nNome: ${notificationPayment.billing_full_name}\nEmail: ${notificationPayment.player_email}\nDocumento: ${notificationPayment.billing_cpf_cnpj}\nTelefone: ${notificationPayment.billing_phone}\n`;
        logMsg += `Endereco\n${notificationPayment.billing_street}, ${notificationPayment.billing_number}\n${notificationPayment.billing_complement}, ${notificationPayment.billing_neighborhood}\n${notificationPayment.billing_city} - ${notificationPayment.billing_state}\nCEP ${notificationPayment.billing_postal_code} | ${notificationPayment.billing_country}\n`;
        logMsg += `PagBank\nOrder ID: ${body?.id || "-"}\nOrder Ref: ${body?.reference_id || "-"}\nCharge ID: ${body?.charges?.[0]?.id || "-"}\nCharge Ref: ${body?.charges?.[0]?.reference_id || "-"}\nCharge Status: ${body?.charges?.[0]?.status || providerStatus}\n`;
        if (body?.charges?.[0]?.payment_method) {
          const pm = body.charges[0].payment_method;
          logMsg += `Cartao / Metodo\n${pm.type || "-"} | ${pm.card?.brand || "-"} | ${pm.card?.first_digits || ""}${pm.card?.last_digits ? "**"+pm.card.last_digits : ""} | ${pm.installments || ""}x | capture=${pm.capture ? "true" : "false"} | exp ${pm.card?.exp_month || ""}/${pm.card?.exp_year || ""}\n`;
        }
        if (body?.charges?.[0]?.payment_response) {
          const pr = body.charges[0].payment_response;
          logMsg += `Resposta PagBank\ncode=${pr.code || "-"} | ${pr.message || "-"} | ref=${pr.reference || "-"}\n`;
        }
        logMsg += `Datas\nCriado PagBank: ${body?.created_at || "-"}\nPago PagBank: ${body?.charges?.[0]?.paid_at || "-"}\nCriado local: ${notificationPayment.created_at}\nExpira local: ${notificationPayment.expires_at}\nPago local: ${notificationPayment.paid_at}\n`;
        logMsg += `Falha / motivo\n${notificationPayment.failure_reason || "-"}\n`;
        fs.appendFileSync(logPath, logMsg);
      } catch {}
    }
    return NextResponse.json({ ok: true, status: mappedStatus }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

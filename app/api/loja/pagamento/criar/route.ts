import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import {
  ensureBillingColumns,
  isBillingProfileComplete,
  normalizeBillingProfile,
} from "@/lib/loja-billing";
import {
  LojaPaymentMethod,
  LojaProviderType,
  buildIsoFromNow,
  createCheckout,
  createOrder,
  extractPayLink,
  extractPixData,
  generatePaymentRef,
  hasPagBankToken,
  mapProviderStatusToLocal,
  toCents,
} from "@/lib/pagbank-loja";

export const dynamic = "force-dynamic";

type CreateBody = {
  item_id?: number;
  faceit_guid?: string;
  payment_method?: LojaPaymentMethod;
};

type PendingPaymentRow = {
  id: number;
  status: string;
  expires_at: string | null;
  provider_checkout_url: string | null;
  provider_qr_code_url: string | null;
  provider_qr_code_text: string | null;
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
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_loja_pag_status (status),
      INDEX idx_loja_pag_player (player_id),
      INDEX idx_loja_pag_estoque (estoque_id)
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
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

function normalizeMethod(method: unknown): LojaPaymentMethod | null {
  const value = String(method || "").toUpperCase();
  if (value === "PIX") return "PIX";
  if (value === "CREDIT_CARD") return "CREDIT_CARD";
  if (value === "DEBIT_CARD") return "DEBIT_CARD";
  if (value === "BOLETO") return "BOLETO";
  return null;
}

function getSiteUrl(request: Request) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

function getProviderErrorMessage(data: any) {
  return (
    data?.message ||
    data?.error_description ||
    data?.error ||
    data?.error_messages?.[0]?.description ||
    data?.error_messages?.[0]?.message ||
    data?.errors?.[0]?.description ||
    data?.errors?.[0]?.message ||
    "Erro desconhecido no PagBank."
  );
}

export async function POST(request: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    if (!process.env.TOKEN_PAGSEGURO && env?.TOKEN_PAGSEGURO) {
      process.env.TOKEN_PAGSEGURO = String(env.TOKEN_PAGSEGURO);
    }

    if (!process.env.NEXT_PUBLIC_SITE_URL && env?.NEXT_PUBLIC_SITE_URL) {
      process.env.NEXT_PUBLIC_SITE_URL = String(env.NEXT_PUBLIC_SITE_URL);
    }

    if (!hasPagBankToken()) {
      return NextResponse.json(
        { message: "TOKEN_PAGSEGURO nao configurado no ambiente." },
        { status: 500 },
      );
    }

    connection = await createMainConnection(env);
    await ensureBillingColumns(connection);
    await ensurePaymentsTable(connection);
    await ensurePaymentsLogsTable(connection);

    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const itemId = Number(body.item_id || 0);
    const faceitGuid = String(body.faceit_guid || "").trim();
    const method = normalizeMethod(body.payment_method);

    if (!faceitGuid) {
      return NextResponse.json({ message: "Voce precisa estar logado com Faceit." }, { status: 401 });
    }

    await createPaymentLog(connection, {
      eventName: "CREATE_REQUEST_RECEIVED",
      source: "api-criar",
      details: {
        itemId,
        faceitGuid,
        method,
      },
    });

    if (!Number.isFinite(itemId) || itemId <= 0) {
      return NextResponse.json({ message: "Item invalido." }, { status: 400 });
    }

    if (!method) {
      return NextResponse.json({ message: "Metodo de pagamento invalido." }, { status: 400 });
    }

    const [playerRows] = await connection.query(
      `SELECT id, nickname, email,
              billing_full_name, billing_company_name, billing_cpf_cnpj, billing_street, billing_number,
              billing_complement, billing_neighborhood, billing_city, billing_state, billing_postal_code,
              billing_country, billing_phone
       FROM players
       WHERE faceit_guid = ?
       LIMIT 1`,
      [faceitGuid],
    );
    const players = playerRows as Array<{
      id: number;
      nickname: string | null;
      email: string | null;
      billing_full_name?: string | null;
      billing_company_name?: string | null;
      billing_cpf_cnpj?: string | null;
      billing_street?: string | null;
      billing_number?: string | null;
      billing_complement?: string | null;
      billing_neighborhood?: string | null;
      billing_city?: string | null;
      billing_state?: string | null;
      billing_postal_code?: string | null;
      billing_country?: string | null;
      billing_phone?: string | null;
    }>;

    if (!players.length) {
      return NextResponse.json({ message: "Jogador nao encontrado." }, { status: 404 });
    }

    const player = players[0];
    const billingProfile = normalizeBillingProfile(player);
    if (!isBillingProfileComplete(billingProfile)) {
      await createPaymentLog(connection, {
        eventName: "CREATE_BLOCKED_BILLING_INCOMPLETE",
        source: "api-criar",
        message: "Pagamento bloqueado por cadastro de cobranca incompleto.",
        details: {
          itemId,
          faceitGuid,
          method,
          billingProfile,
        },
      });

      return NextResponse.json(
        {
          message: "Preencha seus dados de cobranca antes de iniciar o pagamento.",
          code: "BILLING_INCOMPLETE",
          billingProfile,
        },
        { status: 400 },
      );
    }

    const [itemRows] = await connection.query(
      "SELECT id, nome, preco, estoque, ativo FROM estoque WHERE id = ? LIMIT 1",
      [itemId],
    );
    const items = itemRows as Array<{
      id: number;
      nome: string;
      preco: number;
      estoque: number;
      ativo: number;
    }>;

    if (!items.length || items[0].ativo !== 1) {
      return NextResponse.json({ message: "Item nao disponivel para pagamento." }, { status: 404 });
    }

    const item = items[0];
    if (Number(item.estoque || 0) <= 0) {
      return NextResponse.json({ message: "Item sem estoque." }, { status: 400 });
    }

    const [pendingRows] = await connection.query(
      `SELECT id, status, expires_at, provider_checkout_url, provider_qr_code_url, provider_qr_code_text
       FROM loja_pagamentos
       WHERE faceit_guid = ?
         AND estoque_id = ?
         AND status IN ('PENDING', 'WAITING', 'IN_ANALYSIS')
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY id DESC
       LIMIT 1`,
      [faceitGuid, item.id],
    );
    const pendingPayments = pendingRows as PendingPaymentRow[];
    if (pendingPayments.length) {
      const existing = pendingPayments[0];
      await createPaymentLog(connection, {
        paymentId: existing.id,
        eventName: "CREATE_BLOCKED_DUPLICATE_PENDING",
        statusBefore: existing.status,
        statusAfter: existing.status,
        source: "api-criar",
        message: "Novo pagamento bloqueado por pendencia existente para item/usuario.",
        details: {
          itemId: item.id,
          faceitGuid,
          method,
          existingPaymentId: existing.id,
        },
      });

      return NextResponse.json(
        {
          message: "Voce ja possui um pagamento pendente para este item. Finalize ou aguarde expirar.",
          existingPaymentId: existing.id,
          existingStatus: existing.status,
          checkoutUrl: String(existing.provider_checkout_url || ""),
          pix: {
            qrCodeImageUrl: String(existing.provider_qr_code_url || ""),
            qrCodeText: String(existing.provider_qr_code_text || ""),
          },
          expiresAt: existing.expires_at,
        },
        { status: 409 },
      );
    }

    const amountCents = toCents(Number(item.preco || 0));
    if (amountCents <= 0) {
      return NextResponse.json(
        { message: "Esse item nao possui preco em dinheiro configurado." },
        { status: 400 },
      );
    }

    const expiresIso = buildIsoFromNow(30);
    const expiresDate = new Date(expiresIso);

    const insertResultRaw = await connection.query(
      `INSERT INTO loja_pagamentos
       (payment_ref, provider_type, faceit_guid, player_id, estoque_id, item_nome, metodo, amount_cents, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        `PENDING_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        method === "PIX" ? "ORDER" : "CHECKOUT",
        faceitGuid,
        player.id,
        item.id,
        item.nome,
        method,
        amountCents,
        expiresDate,
      ],
    );

    const insertResult = insertResultRaw as any;
    const paymentId = Number(insertResult?.[0]?.insertId || 0);
    if (!paymentId) {
      return NextResponse.json({ message: "Falha ao criar pagamento." }, { status: 500 });
    }

    const paymentRef = generatePaymentRef(paymentId);
    const siteUrl = getSiteUrl(request);
    const webhookToken = String(process.env.PAGBANK_WEBHOOK_TOKEN || "").trim();
    const webhookUrlBase = `${siteUrl}/api/loja/pagamento/webhook`;
    const webhookUrl = webhookToken
      ? `${webhookUrlBase}?token=${encodeURIComponent(webhookToken)}`
      : webhookUrlBase;
    const returnUrl = `${siteUrl}/loja/pagamento?paymentId=${paymentId}`;

    let providerType: LojaProviderType = method === "PIX" ? "ORDER" : "CHECKOUT";
    let providerId = "";
    let checkoutUrl = "";
    let qrCodeUrl = "";
    let qrCodeText = "";
    let localStatus = "PENDING";

    if (method === "PIX") {
      const pixPayload: Record<string, unknown> = {
        reference_id: paymentRef,
        customer: {
          name: String(billingProfile.billing_full_name || player.nickname || "Cliente Querido Camp"),
          email: String(player.email || `player${player.id}@queridocamp.com.br`),
          tax_id: String(billingProfile.billing_cpf_cnpj || process.env.PAGBANK_DEFAULT_TAX_ID || "12345678909"),
        },
        items: [
          {
            reference_id: String(item.id),
            name: item.nome,
            quantity: 1,
            unit_amount: amountCents,
          },
        ],
        qr_codes: [
          {
            amount: { value: amountCents },
            expiration_date: expiresIso,
          },
        ],
        notification_urls: [webhookUrl],
      };

      const { response, data } = await createOrder(pixPayload);
      // LOG PAGBANK: salva request/response PIX
      try {
        const fs = await import("fs");
        const path = require("path");
        const logPath = path.resolve(process.cwd(), "pagbank-logs.txt");
        const now = new Date().toISOString();
        fs.appendFileSync(
          logPath,
          `\n[PAGBANK][REQUEST] /orders\n${JSON.stringify(pixPayload, null, 2)}\n` +
          `[PAGBANK][RESPONSE] /orders\n${JSON.stringify(data, null, 2)}\n`
        );
      } catch {}
      if (!response.ok) {
        const providerError = getProviderErrorMessage(data);
        await createPaymentLog(connection, {
          paymentId,
          eventName: "PROVIDER_CREATE_ERROR",
          statusBefore: "PENDING",
          statusAfter: "FAILED",
          source: "api-criar",
          message: "Falha ao criar PIX no PagBank.",
          details: {
            method,
            providerStatus: response.status,
            providerResponse: data,
          },
        });
        return NextResponse.json(
          { message: `Erro ao criar PIX no PagBank (${response.status}): ${providerError}` },
          { status: 400 },
        );
      }

      providerId = String(data?.id || "");
      const pixData = extractPixData(data);
      qrCodeText = pixData.qrCodeText;
      qrCodeUrl = pixData.qrCodeImageUrl;
      localStatus = mapProviderStatusToLocal(data?.charges?.[0]?.status || data?.status);
    } else {
      const checkoutPayload: Record<string, unknown> = {
        reference_id: paymentRef,
        expiration_date: expiresIso,
        items: [
          {
            reference_id: String(item.id),
            name: item.nome,
            quantity: 1,
            unit_amount: amountCents,
          },
        ],
        payment_methods: [{ type: method }],
        redirect_url: returnUrl,
        return_url: returnUrl,
        notification_urls: [webhookUrl],
        payment_notification_urls: [webhookUrl],
      };

      const { response, data } = await createCheckout(checkoutPayload);
      // LOG PAGBANK: salva request/response CHECKOUT (cartão de crédito)
      try {
        const fs = await import("fs");
        const path = require("path");
        const logPath = path.resolve(process.cwd(), "pagbank-logs.txt");
        fs.appendFileSync(
          logPath,
          `\n[PAGBANK][REQUEST] /checkouts\n${JSON.stringify(checkoutPayload, null, 2)}\n` +
          `[PAGBANK][RESPONSE] /checkouts\n${JSON.stringify(data, null, 2)}\n`
        );
      } catch {}
      if (!response.ok) {
        const providerError = getProviderErrorMessage(data);
        await createPaymentLog(connection, {
          paymentId,
          eventName: "PROVIDER_CREATE_ERROR",
          statusBefore: "PENDING",
          statusAfter: "FAILED",
          source: "api-criar",
          message: "Falha ao criar checkout no PagBank.",
          details: {
            method,
            providerStatus: response.status,
            providerResponse: data,
          },
        });
        return NextResponse.json(
          {
            message: `Erro ao criar checkout no PagBank (${response.status}): ${providerError}`,
          },
          { status: 400 },
        );
      }

      if (method === "DEBIT_CARD") {
        await createPaymentLog(connection, {
          paymentId,
          paymentRef,
          eventName: "CHECKOUT_DEBIT_DEBUG",
          statusBefore: "PENDING",
          statusAfter: "PENDING",
          source: "api-criar",
          message: "Diagnostico de checkout debito (payload/resposta).",
          details: {
            providerStatus: response.status,
            requestPayload: checkoutPayload,
            responseSummary: {
              id: data?.id,
              status: data?.status,
              paymentMethods: data?.payment_methods,
              links: data?.links,
            },
            providerResponse: data,
          },
        });
      }

      providerType = "CHECKOUT";
      providerId = String(data?.id || "");
      checkoutUrl = extractPayLink(data?.links);
      localStatus = mapProviderStatusToLocal(data?.status);
    }

    await connection.query(
      `UPDATE loja_pagamentos
       SET payment_ref = ?, provider_type = ?, provider_id = ?, provider_checkout_url = ?, provider_qr_code_url = ?,
           provider_qr_code_text = ?, status = ?
       WHERE id = ?`,
      [paymentRef, providerType, providerId, checkoutUrl, qrCodeUrl, qrCodeText, localStatus, paymentId],
    );

    await createPaymentLog(connection, {
      paymentId,
      paymentRef,
      eventName: "PAYMENT_CREATED",
      statusBefore: "PENDING",
      statusAfter: localStatus,
      source: "api-criar",
      message: "Pagamento criado com sucesso no provedor.",
      details: {
        method,
        providerType,
        providerId,
        checkoutUrl,
        hasPixQr: Boolean(qrCodeUrl || qrCodeText),
      },
    });

    return NextResponse.json(
      {
        success: true,
        paymentId,
        status: localStatus,
        method,
        expiresAt: expiresIso,
        checkoutUrl,
        pix: {
          qrCodeImageUrl: qrCodeUrl,
          qrCodeText,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

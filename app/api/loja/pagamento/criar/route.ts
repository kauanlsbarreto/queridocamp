import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
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
  extractCheckoutStatus,
  extractCheckoutPaymentUrl,
  extractPayLink,
  extractPixData,
  generatePaymentRef,
  getCheckout,
  hasPagBankToken,
  mapProviderStatusToLocal,
  toCents,
} from "@/lib/pagbank-loja";
import { deleteStalePendingPayments } from "@/lib/loja-payment-cleanup";

export const dynamic = "force-dynamic";

type CreateBody = {
  item_id?: number;
  faceit_guid?: string;
  payment_method?: LojaPaymentMethod;
};

type PendingPaymentRow = {
  id: number;
  payment_ref: string | null;
  status: string;
  expires_at: string | null;
  provider_type: string | null;
  provider_id: string | null;
  provider_checkout_url: string | null;
  provider_qr_code_url: string | null;
  provider_qr_code_text: string | null;
};

async function deleteUserPendingPayments(connection: any, faceitGuid: string) {
  const [rows] = await connection.query(
    `SELECT id
     FROM loja_pagamentos
     WHERE faceit_guid = ?
       AND status IN ('PENDING', 'WAITING', 'IN_ANALYSIS')`,
    [faceitGuid],
  );

  const paymentIds = Array.isArray(rows)
    ? rows
        .map((row: any) => Number(row?.id || 0))
        .filter((id: number) => Number.isFinite(id) && id > 0)
    : [];

  if (!paymentIds.length) {
    return { deletedPayments: 0, deletedLogs: 0 };
  }

  const placeholders = paymentIds.map(() => "?").join(",");
  const [deleteLogsResult] = await connection.query(
    `DELETE FROM loja_pagamentos_logs WHERE payment_id IN (${placeholders})`,
    paymentIds,
  );
  const [deletePaymentsResult] = await connection.query(
    `DELETE FROM loja_pagamentos WHERE id IN (${placeholders})`,
    paymentIds,
  );

  return {
    deletedPayments: Number((deletePaymentsResult as any)?.affectedRows || 0),
    deletedLogs: Number((deleteLogsResult as any)?.affectedRows || 0),
  };
}

function toUtcSqlDateTime(isoString: string) {
  return isoString.slice(0, 19).replace("T", " ");
}

async function invalidatePendingPayment(
  connection: any,
  payment: PendingPaymentRow,
  nextStatus: string,
  message: string,
  details?: unknown,
) {
  await connection.query(
    "UPDATE loja_pagamentos SET status = ?, failure_reason = ? WHERE id = ?",
    [nextStatus, message, payment.id],
  );

  await createPaymentLog(connection, {
    paymentId: payment.id,
    paymentRef: payment.payment_ref,
    eventName: "CREATE_DUPLICATE_PENDING_INVALIDATED",
    statusBefore: payment.status,
    statusAfter: nextStatus,
    source: "api-criar",
    message,
    details,
  });
}

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

function onlyDigits(value: string) {
  return String(value || "").replace(/\D+/g, "");
}

function isValidCpf(cpfRaw: string) {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i);
  let first = (sum * 10) % 11;
  if (first === 10) first = 0;
  if (first !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i);
  let second = (sum * 10) % 11;
  if (second === 10) second = 0;
  return second === Number(cpf[10]);
}

function isValidCnpj(cnpjRaw: string) {
  const cnpj = onlyDigits(cnpjRaw);
  if (cnpj.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cnpj)) return false;

  const calcDigit = (base: string, factors: number[]) => {
    const total = base
      .split("")
      .reduce((acc, digit, idx) => acc + Number(digit) * factors[idx], 0);
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  const d1 = calcDigit(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calcDigit(cnpj.slice(0, 12) + String(d1), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function resolveValidTaxId(billingTaxId: string, defaultTaxId: string) {
  const candidates = [billingTaxId, defaultTaxId].map(onlyDigits).filter(Boolean);
  for (const candidate of candidates) {
    if (candidate.length === 11 && isValidCpf(candidate)) return candidate;
    if (candidate.length === 14 && isValidCnpj(candidate)) return candidate;
  }
  return "";
}

function getSiteUrl(request: Request) {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/^['\"]|['\"]$/g, "");
  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

function buildPagBankNotificationUrl(siteUrl: string) {
  const override = String(process.env.PAGBANK_NOTIFICATION_URL || "")
    .trim()
    .replace(/^['\"]|['\"]$/g, "");
  const base = override || `${siteUrl}/api/loja/pagamento/webhook`;

  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error("PAGBANK_NOTIFICATION_URL invalida. Use uma URL HTTPS publica.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("notification_url do PagBank precisa usar HTTPS.");
  }

  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") {
    throw new Error("notification_url do PagBank nao pode apontar para localhost.");
  }

  // PagBank costuma rejeitar URLs com querystring para notificacao.
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString().replace(/\/$/, "");
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

function isInternalReturnUrl(candidateUrl: string, siteUrl: string) {
  const value = String(candidateUrl || "").trim();
  if (!value) return false;

  try {
    const candidate = new URL(value);
    const site = new URL(siteUrl);
    if (candidate.origin !== site.origin) return false;

    // This route is our post-checkout landing page, not the provider checkout page.
    return candidate.pathname === "/loja/pagamento";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let connection: any;
  let createdPaymentId: number | null = null;

  const markPaymentFailed = async (paymentId: number, reason: string) => {
    if (!connection || !paymentId) return;
    await connection.query(
      `UPDATE loja_pagamentos
       SET status = 'FAILED', failure_reason = ?
       WHERE id = ? AND status IN ('PENDING', 'WAITING', 'IN_ANALYSIS')`,
      [reason.slice(0, 1000), paymentId],
    );
  };

  try {
    const env = await getRuntimeEnv();

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
    await deleteStalePendingPayments(connection, 30);

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
          message: "Preencha email e seus dados de cobranca antes de iniciar o pagamento.",
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

    if (method === "PIX") {
      const cleanup = await deleteUserPendingPayments(connection, faceitGuid);
      if (cleanup.deletedPayments > 0 || cleanup.deletedLogs > 0) {
        await createPaymentLog(connection, {
          eventName: "CREATE_PIX_PURGED_USER_PENDING",
          source: "api-criar",
          message: "Pendencias anteriores do usuario removidas antes de criar novo PIX.",
          details: {
            itemId: item.id,
            faceitGuid,
            deletedPayments: cleanup.deletedPayments,
            deletedLogs: cleanup.deletedLogs,
          },
        });
      }
    }

    const [pendingRows] = await connection.query(
      `SELECT id, payment_ref, status, expires_at, provider_type, provider_id,
              provider_checkout_url, provider_qr_code_url, provider_qr_code_text
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

      if (method === "CREDIT_CARD") {
        const providerType = String(existing.provider_type || "").toUpperCase();
        const providerId = String(existing.provider_id || "");

        if (providerType === "CHECKOUT") {
          if (!providerId) {
            await invalidatePendingPayment(
              connection,
              existing,
              "FAILED",
              "Pendencia de checkout sem provider_id valido. Novo checkout liberado.",
            );
          } else {
            const { response, data } = await getCheckout(providerId);

            if (!response.ok) {
              await invalidatePendingPayment(
                connection,
                existing,
                response.status === 404 ? "EXPIRED" : "FAILED",
                `Checkout pendente invalido no PagBank (${response.status}). Novo checkout liberado.`,
                {
                  providerStatus: response.status,
                  providerResponse: data,
                },
              );
            } else {
              const checkoutPageStatus = String(data?.status || "").toUpperCase();
              const providerStatus = extractCheckoutStatus(data);
              const localProviderStatus = mapProviderStatusToLocal(providerStatus || checkoutPageStatus);
              const refreshedCheckoutUrl = extractCheckoutPaymentUrl(data);

              if (refreshedCheckoutUrl && refreshedCheckoutUrl !== String(existing.provider_checkout_url || "")) {
                await connection.query(
                  "UPDATE loja_pagamentos SET provider_checkout_url = ? WHERE id = ?",
                  [refreshedCheckoutUrl, existing.id],
                );
                existing.provider_checkout_url = refreshedCheckoutUrl;
              }

              // Verifica se o checkout vai expirar em menos de 10 minutos
              const expiresAtMs = existing.expires_at
                ? new Date(String(existing.expires_at)).getTime()
                : 0;
              const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
              const isNearExpiry = expiresAtMs > 0 && expiresAtMs < tenMinutesFromNow;

              if (
                isNearExpiry ||
                checkoutPageStatus === "EXPIRED" ||
                checkoutPageStatus === "INACTIVE" ||
                ["EXPIRED", "CANCELED", "DECLINED", "FAILED"].includes(localProviderStatus) ||
                !String(existing.provider_checkout_url || "").trim()
              ) {
                await invalidatePendingPayment(
                  connection,
                  existing,
                  localProviderStatus === "PENDING" ? "EXPIRED" : localProviderStatus,
                  isNearExpiry
                    ? "Checkout pendente proximo do vencimento. Novo checkout sera criado."
                    : "Checkout pendente invalido ou indisponivel no PagBank. Novo checkout liberado.",
                  {
                    checkoutPageStatus,
                    providerStatus,
                    refreshedCheckoutUrl,
                    isNearExpiry,
                    expiresAt: existing.expires_at,
                  },
                );
              }
            }
          }
        }
      }

      const [refreshedPendingRows] = await connection.query(
        `SELECT id, payment_ref, status, expires_at, provider_type, provider_id,
                provider_checkout_url, provider_qr_code_url, provider_qr_code_text
         FROM loja_pagamentos
         WHERE id = ?
           AND status IN ('PENDING', 'WAITING', 'IN_ANALYSIS')
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1`,
        [existing.id],
      );
      const refreshedPendingPayments = refreshedPendingRows as PendingPaymentRow[];

      if (!refreshedPendingPayments.length) {
        // Existing pending payment was invalidated, so continue and create a new one.
      } else {
        const activePending = refreshedPendingPayments[0];
      await createPaymentLog(connection, {
        paymentId: activePending.id,
        eventName: "CREATE_BLOCKED_DUPLICATE_PENDING",
        statusBefore: activePending.status,
        statusAfter: activePending.status,
        source: "api-criar",
        message: "Novo pagamento bloqueado por pendencia existente para item/usuario.",
        details: {
          itemId: item.id,
          faceitGuid,
          method,
          existingPaymentId: activePending.id,
        },
      });

      return NextResponse.json(
        {
          success: true,
          reusedExistingPayment: true,
          message: "Voce ja possui um pagamento pendente para este item. Finalize ou aguarde expirar.",
          paymentId: activePending.id,
          existingPaymentId: activePending.id,
          existingStatus: activePending.status,
          checkoutUrl: String(activePending.provider_checkout_url || ""),
          pix: {
            qrCodeImageUrl: String(activePending.provider_qr_code_url || ""),
            qrCodeText: String(activePending.provider_qr_code_text || ""),
          },
          expiresAt: activePending.expires_at,
        },
        { status: 200 },
      );
      }
    }

    const amountCents = toCents(Number(item.preco || 0));
    if (amountCents <= 0) {
      return NextResponse.json(
        { message: "Esse item nao possui preco em dinheiro configurado." },
        { status: 400 },
      );
    }

    const expiresIso = buildIsoFromNow(45);
    const expiresAtSql = toUtcSqlDateTime(expiresIso);

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
        expiresAtSql,
      ],
    );

    const insertResult = insertResultRaw as any;
    const paymentId = Number(insertResult?.[0]?.insertId || 0);
    if (!paymentId) {
      return NextResponse.json({ message: "Falha ao criar pagamento." }, { status: 500 });
    }
    createdPaymentId = paymentId;

    const paymentRef = generatePaymentRef(paymentId);
    const siteUrl = getSiteUrl(request);
    const webhookUrl = buildPagBankNotificationUrl(siteUrl);
    const returnUrl = `${siteUrl}/loja/pagamento?paymentId=${paymentId}`;
    const validTaxId = resolveValidTaxId(
      String(billingProfile.billing_cpf_cnpj || ""),
      String(process.env.PAGBANK_DEFAULT_TAX_ID || ""),
    );

    if (!validTaxId) {
      await markPaymentFailed(paymentId, "CPF/CNPJ invalido para emissao do pagamento.");
      await createPaymentLog(connection, {
        paymentId,
        paymentRef,
        eventName: "CREATE_BLOCKED_INVALID_TAX_ID",
        statusBefore: "PENDING",
        statusAfter: "FAILED",
        source: "api-criar",
        message: "Pagamento bloqueado por CPF/CNPJ invalido.",
        details: {
          billingTaxId: billingProfile.billing_cpf_cnpj,
          fallbackTaxId: process.env.PAGBANK_DEFAULT_TAX_ID || null,
        },
      });

      return NextResponse.json(
        {
          message: "CPF/CNPJ invalido. Atualize seus dados de cobranca para continuar.",
          code: "BILLING_DOCUMENT_INVALID",
        },
        { status: 400 },
      );
    }

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
          tax_id: validTaxId,
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
        const path = await import("path");
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
        await markPaymentFailed(paymentId, `PIX provider create error (${response.status}): ${providerError}`);
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
      };

      const { response, data } = await createCheckout(checkoutPayload);
      // LOG PAGBANK: salva request/response CHECKOUT (cartão de crédito)
      try {
        const fs = await import("fs");
        const path = await import("path");
        const logPath = path.resolve(process.cwd(), "pagbank-logs.txt");
        fs.appendFileSync(
          logPath,
          `\n[PAGBANK][REQUEST] /checkouts\n${JSON.stringify(checkoutPayload, null, 2)}\n` +
          `[PAGBANK][RESPONSE] /checkouts\n${JSON.stringify(data, null, 2)}\n`
        );
      } catch {}
      if (!response.ok) {
        const providerError = getProviderErrorMessage(data);
        await markPaymentFailed(paymentId, `Checkout provider create error (${response.status}): ${providerError}`);
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
      checkoutUrl = extractCheckoutPaymentUrl(data);
      if (isInternalReturnUrl(checkoutUrl, siteUrl)) {
        checkoutUrl = "";
      }
      localStatus = mapProviderStatusToLocal(data?.status);

      // DEBUG: Log detailed checkout response structure
      if (!checkoutUrl) {
        const debugInfo = {
          hasLinks: Array.isArray(data?.links),
          linksCount: Array.isArray(data?.links) ? data.links.length : 0,
          firstLink: Array.isArray(data?.links) ? data.links[0] : null,
          directFields: {
            checkout_url: data?.checkout_url,
            payment_url: data?.payment_url,
            redirect_url: data?.redirect_url,
            url: data?.url,
          },
          dataKeys: Object.keys(data || {}).slice(0, 20),
        };
        await createPaymentLog(connection, {
          paymentId,
          paymentRef,
          eventName: "CHECKOUT_URL_EXTRACTION_DEBUG",
          statusBefore: "PENDING",
          statusAfter: "PENDING",
          source: "api-criar",
          message: "Falha ao extrair URL de checkout - verificar estrutura da resposta",
          details: debugInfo,
        });
      }

      if (method === "CREDIT_CARD" && providerId && !checkoutUrl) {
        for (let attempt = 1; attempt <= 3; attempt++) {
          const { response: checkoutResp, data: checkoutData } = await getCheckout(providerId);

          if (checkoutResp.ok) {
            const recoveredUrl = extractCheckoutPaymentUrl(checkoutData);
            if (recoveredUrl && !isInternalReturnUrl(recoveredUrl, siteUrl)) {
              checkoutUrl = recoveredUrl;
              localStatus = mapProviderStatusToLocal(
                extractCheckoutStatus(checkoutData) || checkoutData?.status,
              );

              await createPaymentLog(connection, {
                paymentId,
                paymentRef,
                eventName: "CHECKOUT_URL_RECOVERED",
                statusBefore: "PENDING",
                statusAfter: localStatus,
                source: "api-criar",
                message: `URL do checkout recuperada por GET /checkouts na tentativa ${attempt}.`,
                details: {
                  attempt,
                  providerId,
                  providerStatus: checkoutResp.status,
                },
              });
              break;
            }
          }

          await new Promise((resolve) => setTimeout(resolve, attempt * 300));
        }
      }

      if (method === "CREDIT_CARD" && !checkoutUrl) {
        const providerError = getProviderErrorMessage(data);
        await markPaymentFailed(
          paymentId,
          `Checkout sem URL de pagamento (${response.status}): ${providerError}`,
        );
        await createPaymentLog(connection, {
          paymentId,
          paymentRef,
          eventName: "CHECKOUT_MISSING_PAYMENT_URL",
          statusBefore: "PENDING",
          statusAfter: "FAILED",
          source: "api-criar",
          message: "PagBank nao retornou URL de pagamento para checkout de credito.",
          details: {
            providerStatus: response.status,
            providerResponse: data,
          },
        });

        return NextResponse.json(
          {
            message: "PagBank nao retornou URL de pagamento para cartao de credito. Tente novamente.",
          },
          { status: 502 },
        );
      }
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

    if (createdPaymentId && connection) {
      try {
        await markPaymentFailed(createdPaymentId, `Unhandled create error: ${message}`);
      } catch {
        // noop: preserve original error response.
      }
    }

    return NextResponse.json({ message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

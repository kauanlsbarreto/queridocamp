import { NextRequest, NextResponse } from "next/server";

import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  buildIsoFromNow,
  createCheckout,
  createOrder,
  extractCheckoutPaymentUrl,
  extractPixData,
  extractOrderChargeStatus,
  extractCheckoutStatus,
  generatePaymentRef,
  hasPagBankToken,
  mapProviderStatusToLocal,
} from "@/lib/pagbank-loja";

export const dynamic = "force-dynamic";

const QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_PALPITES_QUERY_TIMEOUT_MS || 5000);
const PALPITE_ACCESS_PRICE_CENTS = 1500;

type PaymentMethod = "PIX" | "CREDIT_CARD";

type PendingPaymentRow = {
  id: number;
  payment_ref: string;
  status: string;
  provider_type: "ORDER" | "CHECKOUT";
  provider_id: string | null;
  provider_checkout_url: string | null;
  provider_qr_code_url: string | null;
  provider_qr_code_text: string | null;
  expires_at: string | null;
};

type PaidPaymentRow = {
  id: number;
};

function normalizeGuid(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeMethod(value: unknown): PaymentMethod | null {
  const method = String(value || "").trim().toUpperCase();
  if (method === "PIX") return "PIX";
  if (method === "CREDIT_CARD") return "CREDIT_CARD";
  return null;
}

function digitsOnly(value: unknown) {
  return String(value || "").replace(/\D+/g, "");
}

function toUtcSqlDateTime(isoDate: string) {
  const parsed = new Date(isoDate);
  if (!Number.isFinite(parsed.getTime())) return null;
  const yyyy = parsed.getUTCFullYear();
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getUTCDate()).padStart(2, "0");
  const hh = String(parsed.getUTCHours()).padStart(2, "0");
  const mi = String(parsed.getUTCMinutes()).padStart(2, "0");
  const ss = String(parsed.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

async function ensurePlayersPalpitarColumn(connection: any) {
  const [columnsRows] = await connection.query(
    {
      sql: "SHOW COLUMNS FROM players LIKE 'palpitar'",
      timeout: QUERY_TIMEOUT_MS,
    }
  );

  if (Array.isArray(columnsRows) && columnsRows.length > 0) return;

  try {
    await connection.query({
      sql: "ALTER TABLE players ADD COLUMN palpitar TINYINT(1) NULL DEFAULT NULL",
      timeout: QUERY_TIMEOUT_MS,
    });
  } catch {
    // ignore concurrent migration race
  }
}

async function ensurePalpitesPaymentsTable(connection: any) {
  await connection.query({
    sql: `CREATE TABLE IF NOT EXISTS copadraft_palpites_pagamentos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      payment_ref VARCHAR(120) NOT NULL UNIQUE,
      provider_type VARCHAR(20) NOT NULL,
      provider_id VARCHAR(120) DEFAULT NULL,
      provider_checkout_url TEXT,
      provider_qr_code_url TEXT,
      provider_qr_code_text TEXT,
      faceit_guid VARCHAR(255) NOT NULL,
      player_id INT NOT NULL,
      metodo VARCHAR(20) NOT NULL,
      amount_cents INT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
      expires_at DATETIME DEFAULT NULL,
      paid_at DATETIME DEFAULT NULL,
      failure_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_faceit_status (faceit_guid, status),
      KEY idx_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    timeout: QUERY_TIMEOUT_MS,
  });
}

export async function POST(request: NextRequest) {
  let connection: any = null;

  try {
    if (!hasPagBankToken()) {
      return NextResponse.json({ ok: false, message: "TOKEN_PAGSEGURO nao configurado no ambiente." }, { status: 500 });
    }

    const env = (await getRuntimeEnv()) as Env;
    connection = await createMainConnection(env);

    await ensurePlayersPalpitarColumn(connection);
    await ensurePalpitesPaymentsTable(connection);

    const body = (await request.json().catch(() => ({}))) as {
      faceit_guid?: string;
      payment_method?: string;
    };

    const faceitGuid = normalizeGuid(body?.faceit_guid);
    const method = normalizeMethod(body?.payment_method);

    if (!faceitGuid) {
      return NextResponse.json({ ok: false, message: "faceit_guid e obrigatorio." }, { status: 400 });
    }

    if (!method) {
      return NextResponse.json({ ok: false, message: "Metodo de pagamento invalido." }, { status: 400 });
    }

    const [playerRows] = await connection.query(
      {
        sql: `SELECT id, nickname, email, palpitar, billing_cpf_cnpj
              FROM players
              WHERE faceit_guid = ?
              LIMIT 1`,
        timeout: QUERY_TIMEOUT_MS,
      },
      [faceitGuid]
    );

    const players = Array.isArray(playerRows) ? (playerRows as any[]) : [];
    if (!players.length) {
      return NextResponse.json({ ok: false, message: "Jogador nao encontrado." }, { status: 404 });
    }

    const player = players[0];
    if (Number(player?.palpitar || 0) === 1) {
      return NextResponse.json({ ok: true, alreadyUnlocked: true, message: "Palpites ja liberados." });
    }

    const [paidRows] = await connection.query(
      {
        sql: `SELECT id
              FROM copadraft_palpites_pagamentos
              WHERE faceit_guid = ?
                AND status = 'PAID'
              ORDER BY paid_at DESC, id DESC
              LIMIT 1`,
        timeout: QUERY_TIMEOUT_MS,
      },
      [faceitGuid]
    );

    const paidPayments = (Array.isArray(paidRows) ? paidRows : []) as PaidPaymentRow[];
    if (paidPayments.length > 0) {
      await connection.query(
        {
          sql: "UPDATE players SET palpitar = 1 WHERE faceit_guid = ? AND COALESCE(palpitar, 0) <> 1",
          timeout: QUERY_TIMEOUT_MS,
        },
        [faceitGuid]
      );

      return NextResponse.json({
        ok: true,
        alreadyUnlocked: true,
        message: "Pagamento ja confirmado. Acesso aos palpites restaurado.",
      });
    }

    const [pendingRows] = await connection.query(
      {
        sql: `SELECT id, payment_ref, status, provider_type, provider_id, provider_checkout_url, provider_qr_code_url, provider_qr_code_text, expires_at
              FROM copadraft_palpites_pagamentos
              WHERE faceit_guid = ?
                AND metodo = ?
                AND status IN ('PENDING', 'WAITING', 'IN_ANALYSIS')
                AND (expires_at IS NULL OR expires_at > NOW())
              ORDER BY id DESC
              LIMIT 1`,
        timeout: QUERY_TIMEOUT_MS,
      },
      [faceitGuid, method]
    );

    const pending = (Array.isArray(pendingRows) ? pendingRows : []) as PendingPaymentRow[];
    if (pending.length > 0) {
      const existing = pending[0];
      return NextResponse.json({
        ok: true,
        reusedExistingPayment: true,
        paymentId: existing.id,
        status: String(existing.status || "PENDING").toUpperCase(),
        checkoutUrl: String(existing.provider_checkout_url || ""),
        pix: {
          qrCodeImageUrl: String(existing.provider_qr_code_url || ""),
          qrCodeText: String(existing.provider_qr_code_text || ""),
        },
        expiresAt: existing.expires_at,
      });
    }

    const expiresIso = buildIsoFromNow(45);
    const expiresAtSql = toUtcSqlDateTime(expiresIso);

    const [insertResult] = await connection.query(
      `INSERT INTO copadraft_palpites_pagamentos
       (payment_ref, provider_type, faceit_guid, player_id, metodo, amount_cents, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        `PALPITE_PENDING_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        method === "PIX" ? "ORDER" : "CHECKOUT",
        faceitGuid,
        Number(player.id || 0),
        method,
        PALPITE_ACCESS_PRICE_CENTS,
        expiresAtSql,
      ]
    );

    const paymentId = Number((insertResult as any)?.insertId || 0);
    if (!paymentId) {
      return NextResponse.json({ ok: false, message: "Falha ao iniciar pagamento." }, { status: 500 });
    }

    const paymentRef = generatePaymentRef(paymentId);
    let providerType = method === "PIX" ? "ORDER" : "CHECKOUT";
    let providerId = "";
    let checkoutUrl = "";
    let qrCodeUrl = "";
    let qrCodeText = "";
    let localStatus = "PENDING";

    if (method === "PIX") {
      const customerTaxId = digitsOnly(player?.billing_cpf_cnpj || process.env.PAGBANK_DEFAULT_TAX_ID || "");
      if (!customerTaxId) {
        return NextResponse.json(
          {
            ok: false,
            message: "CPF/CNPJ nao configurado para pagamento PIX. Defina billing_cpf_cnpj ou PAGBANK_DEFAULT_TAX_ID.",
          },
          { status: 400 }
        );
      }

      const pixPayload: Record<string, unknown> = {
        reference_id: paymentRef,
        customer: {
          name: String(player?.nickname || "Cliente Querido Camp"),
          email: String(player?.email || `player${player.id}@queridocamp.com.br`),
          tax_id: customerTaxId,
        },
        items: [
          {
            reference_id: "PALPITE_LIBERACAO",
            name: "Liberacao de Palpites Copa Draft",
            quantity: 1,
            unit_amount: PALPITE_ACCESS_PRICE_CENTS,
          },
        ],
        qr_codes: [
          {
            amount: { value: PALPITE_ACCESS_PRICE_CENTS },
            expiration_date: expiresIso,
          },
        ],
      };

      const { response, data } = await createOrder(pixPayload);
      if (!response.ok) {
        await connection.query(
          "UPDATE copadraft_palpites_pagamentos SET status = 'FAILED', failure_reason = ? WHERE id = ?",
          [`PIX provider create error (${response.status})`, paymentId]
        );
        return NextResponse.json({ ok: false, message: "Falha ao criar PIX." }, { status: 400 });
      }

      providerId = String(data?.id || "");
      const pixData = extractPixData(data);
      qrCodeText = pixData.qrCodeText;
      qrCodeUrl = pixData.qrCodeImageUrl;
      localStatus = mapProviderStatusToLocal(extractOrderChargeStatus(data));
    } else {
      const checkoutPayload: Record<string, unknown> = {
        reference_id: paymentRef,
        expiration_date: expiresIso,
        items: [
          {
            reference_id: "PALPITE_LIBERACAO",
            name: "Liberacao de Palpites Copa Draft",
            quantity: 1,
            unit_amount: PALPITE_ACCESS_PRICE_CENTS,
          },
        ],
        payment_methods: [{ type: "CREDIT_CARD" }],
      };

      const { response, data } = await createCheckout(checkoutPayload);
      if (!response.ok) {
        await connection.query(
          "UPDATE copadraft_palpites_pagamentos SET status = 'FAILED', failure_reason = ? WHERE id = ?",
          [`Checkout provider create error (${response.status})`, paymentId]
        );
        return NextResponse.json({ ok: false, message: "Falha ao criar pagamento no cartao." }, { status: 400 });
      }

      providerType = "CHECKOUT";
      providerId = String(data?.id || "");
      checkoutUrl = extractCheckoutPaymentUrl(data);
      localStatus = mapProviderStatusToLocal(extractCheckoutStatus(data));
    }

    await connection.query(
      `UPDATE copadraft_palpites_pagamentos
       SET payment_ref = ?, provider_type = ?, provider_id = ?, provider_checkout_url = ?, provider_qr_code_url = ?, provider_qr_code_text = ?, status = ?, failure_reason = NULL
       WHERE id = ?`,
      [paymentRef, providerType, providerId, checkoutUrl, qrCodeUrl, qrCodeText, localStatus, paymentId]
    );

    return NextResponse.json({
      ok: true,
      paymentId,
      status: localStatus,
      checkoutUrl,
      pix: {
        qrCodeImageUrl: qrCodeUrl,
        qrCodeText,
      },
      expiresAt: expiresAtSql,
      amountCents: PALPITE_ACCESS_PRICE_CENTS,
    });
  } catch (error) {
    console.error("[copadraft/palpites/pagamento/criar] erro:", error);
    return NextResponse.json({ ok: false, message: "Erro interno ao criar pagamento." }, { status: 500 });
  } finally {
    await connection?.end?.();
  }
}

import { NextRequest, NextResponse } from "next/server";

import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  extractCheckoutStatus,
  extractOrderChargeStatus,
  getCheckout,
  getOrder,
  mapProviderStatusToLocal,
} from "@/lib/pagbank-loja";

export const dynamic = "force-dynamic";

const QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_PALPITES_QUERY_TIMEOUT_MS || 5000);
const PALPITES_PAYMENT_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1503903504798843042/k1qfBtMoFgLZpdermdCqojFk1ioLVPHlHqDI5PdBoUtlheAekGx0pBwyYaCKrCpeVFMq";

type PaymentRow = {
  id: number;
  payment_ref: string | null;
  faceit_guid: string;
  player_id: number;
  metodo: string;
  amount_cents: number;
  status: string;
  provider_type: "CHECKOUT" | "ORDER";
  provider_id: string | null;
  provider_checkout_url: string | null;
  provider_qr_code_url: string | null;
  provider_qr_code_text: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  webhook_sent: number | null;
  webhook_sent_at: string | null;
};

type PlayerRow = {
  id: number;
  nickname: string | null;
  email: string | null;
  faceit_guid: string | null;
};

function normalizeGuid(value: unknown) {
  return String(value || "").trim().toLowerCase();
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

  const [webhookSentColumns] = await connection.query(
    {
      sql: "SHOW COLUMNS FROM copadraft_palpites_pagamentos LIKE 'webhook_sent'",
      timeout: QUERY_TIMEOUT_MS,
    }
  );

  if (!Array.isArray(webhookSentColumns) || webhookSentColumns.length === 0) {
    try {
      await connection.query({
        sql: "ALTER TABLE copadraft_palpites_pagamentos ADD COLUMN webhook_sent TINYINT(1) NOT NULL DEFAULT 0",
        timeout: QUERY_TIMEOUT_MS,
      });
    } catch {
      // ignore concurrent migration race
    }
  }

  const [webhookSentAtColumns] = await connection.query(
    {
      sql: "SHOW COLUMNS FROM copadraft_palpites_pagamentos LIKE 'webhook_sent_at'",
      timeout: QUERY_TIMEOUT_MS,
    }
  );

  if (!Array.isArray(webhookSentAtColumns) || webhookSentAtColumns.length === 0) {
    try {
      await connection.query({
        sql: "ALTER TABLE copadraft_palpites_pagamentos ADD COLUMN webhook_sent_at DATETIME DEFAULT NULL",
        timeout: QUERY_TIMEOUT_MS,
      });
    } catch {
      // ignore concurrent migration race
    }
  }
}

function isFinalStatus(status: string) {
  const current = String(status || "").toUpperCase();
  return ["PAID", "DECLINED", "CANCELED", "EXPIRED", "FAILED"].includes(current);
}

async function sendPaidWebhook(payment: PaymentRow, player: PlayerRow | null) {
  const body = {
    username: "Palpites - Pagamento",
    embeds: [
      {
        title: "Pagamento Confirmado - Liberacao de Palpites",
        color: 0x2ecc71,
        timestamp: new Date().toISOString(),
        fields: [
          { name: "Status", value: "PAID", inline: true },
          { name: "Metodo", value: String(payment.metodo || "-").toUpperCase(), inline: true },
          { name: "Valor", value: `R$ ${(Number(payment.amount_cents || 0) / 100).toFixed(2)}`, inline: true },

          { name: "Pagamento ID", value: String(payment.id || "-"), inline: true },
          { name: "Payment Ref", value: String(payment.payment_ref || "-"), inline: true },
          { name: "Provider Type", value: String(payment.provider_type || "-"), inline: true },

          { name: "Provider ID", value: String(payment.provider_id || "-"), inline: false },
          { name: "Faceit GUID", value: String(payment.faceit_guid || "-"), inline: false },

          { name: "Player ID", value: String(player?.id || payment.player_id || "-"), inline: true },
          { name: "Nickname", value: String(player?.nickname || "-"), inline: true },
          { name: "Email", value: String(player?.email || "-"), inline: true },

          { name: "Criado em", value: String(payment.created_at || "-"), inline: true },
          { name: "Pago em", value: String(payment.paid_at || "-") , inline: true },
          { name: "Liberacao", value: "players.palpitar = 1", inline: true },
        ],
      },
    ],
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch(PALPITES_PAYMENT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        sent: false,
        error: `Discord webhook retornou ${response.status}: ${errorText}`,
      };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function GET(request: NextRequest) {
  let connection: any = null;

  try {
    const env = (await getRuntimeEnv()) as Env;
    connection = await createMainConnection(env);

    await ensurePlayersPalpitarColumn(connection);
    await ensurePalpitesPaymentsTable(connection);

    const paymentId = Number(request.nextUrl.searchParams.get("paymentId") || 0);
    const faceitGuid = normalizeGuid(request.nextUrl.searchParams.get("faceit_guid"));

    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return NextResponse.json({ ok: false, message: "paymentId invalido." }, { status: 400 });
    }

    if (!faceitGuid) {
      return NextResponse.json({ ok: false, message: "faceit_guid e obrigatorio." }, { status: 400 });
    }

    const [rows] = await connection.query(
      {
        sql: `SELECT id, payment_ref, faceit_guid, player_id, metodo, amount_cents, status, provider_type, provider_id,
                     provider_checkout_url, provider_qr_code_url, provider_qr_code_text, expires_at, paid_at, created_at,
                     webhook_sent, webhook_sent_at
              FROM copadraft_palpites_pagamentos
              WHERE id = ? AND faceit_guid = ?
              LIMIT 1`,
        timeout: QUERY_TIMEOUT_MS,
      },
      [paymentId, faceitGuid]
    );

    const payments = (Array.isArray(rows) ? rows : []) as PaymentRow[];
    if (!payments.length) {
      return NextResponse.json({ ok: false, message: "Pagamento nao encontrado." }, { status: 404 });
    }

    const payment = payments[0];
    let status = String(payment.status || "PENDING").toUpperCase();

    if (!isFinalStatus(status) && payment.provider_id) {
      if (payment.provider_type === "CHECKOUT") {
        const { response, data } = await getCheckout(payment.provider_id);
        if (response.ok) {
          status = mapProviderStatusToLocal(extractCheckoutStatus(data));
        }
      } else {
        const { response, data } = await getOrder(payment.provider_id);
        if (response.ok) {
          status = mapProviderStatusToLocal(extractOrderChargeStatus(data));
        }
      }

      if (status !== String(payment.status || "").toUpperCase()) {
        if (status === "PAID") {
          await connection.query(
            "UPDATE copadraft_palpites_pagamentos SET status = 'PAID', paid_at = NOW(), failure_reason = NULL WHERE id = ?",
            [payment.id]
          );
          await connection.query(
            "UPDATE players SET palpitar = 1 WHERE faceit_guid = ?",
            [faceitGuid]
          );

          payment.status = "PAID";
        } else {
          await connection.query(
            "UPDATE copadraft_palpites_pagamentos SET status = ? WHERE id = ?",
            [status, payment.id]
          );
        }
      }
    }

    if (String(status).toUpperCase() === "PAID") {
      await connection.query(
        {
          sql: "UPDATE players SET palpitar = 1 WHERE faceit_guid = ? AND COALESCE(palpitar, 0) <> 1",
          timeout: QUERY_TIMEOUT_MS,
        },
        [faceitGuid]
      );

      const [refreshRows] = await connection.query(
        {
          sql: `SELECT id, payment_ref, faceit_guid, player_id, metodo, amount_cents, status, provider_type, provider_id,
                       provider_checkout_url, provider_qr_code_url, provider_qr_code_text, expires_at, paid_at, created_at,
                       webhook_sent, webhook_sent_at
                FROM copadraft_palpites_pagamentos
                WHERE id = ?
                LIMIT 1`,
          timeout: QUERY_TIMEOUT_MS,
        },
        [payment.id]
      );

      const refreshedPaymentRows = (Array.isArray(refreshRows) ? refreshRows : []) as PaymentRow[];
      const refreshedPayment = refreshedPaymentRows[0] || payment;

      if (Number(refreshedPayment.webhook_sent || 0) !== 1) {
        const [playerRows] = await connection.query(
          {
            sql: "SELECT id, nickname, email, faceit_guid FROM players WHERE faceit_guid = ? LIMIT 1",
            timeout: QUERY_TIMEOUT_MS,
          },
          [faceitGuid]
        );

        const players = (Array.isArray(playerRows) ? playerRows : []) as PlayerRow[];
        const player = players[0] || null;

        const webhookDispatch = await sendPaidWebhook(refreshedPayment, player);
        if (webhookDispatch.sent) {
          await connection.query(
            "UPDATE copadraft_palpites_pagamentos SET webhook_sent = 1, webhook_sent_at = NOW() WHERE id = ?",
            [payment.id]
          );
        } else {
          console.error("[copadraft/palpites/pagamento/status] falha ao enviar webhook:", webhookDispatch.error);
        }
      }
    }

    const [playerRows] = await connection.query(
      {
        sql: "SELECT palpitar FROM players WHERE faceit_guid = ? LIMIT 1",
        timeout: QUERY_TIMEOUT_MS,
      },
      [faceitGuid]
    );

    const hasAccess = Array.isArray(playerRows) && playerRows.length > 0 && Number((playerRows as any[])[0]?.palpitar || 0) === 1;

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      status,
      hasAccess,
      checkoutUrl: String(payment.provider_checkout_url || ""),
      pix: {
        qrCodeImageUrl: String(payment.provider_qr_code_url || ""),
        qrCodeText: String(payment.provider_qr_code_text || ""),
      },
      expiresAt: payment.expires_at,
      paidAt: payment.paid_at,
    });
  } catch (error) {
    console.error("[copadraft/palpites/pagamento/status] erro:", error);
    return NextResponse.json({ ok: false, message: "Erro interno ao consultar pagamento." }, { status: 500 });
  } finally {
    await connection?.end?.();
  }
}

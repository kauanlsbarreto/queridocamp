import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import { deleteStalePendingPayments } from "@/lib/loja-payment-cleanup";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: number;
  payment_ref: string;
  item_nome: string;
  metodo: string;
  amount_cents: number;
  status: string;
  provider_checkout_url: string | null;
  provider_qr_code_url: string | null;
  provider_qr_code_text: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type LogRow = {
  id: number;
  payment_id: number | null;
  event_name: string;
  status_before: string | null;
  status_after: string | null;
  source: string;
  message: string | null;
  details_json: unknown;
  created_at: string;
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

function parseJsonIfNeeded(value: unknown) {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  let connection: any;
  try {
    const url = new URL(request.url);
    const faceitGuid = String(
      url.searchParams.get("faceit_guid") || request.headers.get("x-faceit-guid") || "",
    ).trim();

    if (!faceitGuid) {
      return NextResponse.json({ message: "faceit_guid obrigatorio." }, { status: 400 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensurePaymentsTable(connection);
    await ensurePaymentsLogsTable(connection);
    await deleteStalePendingPayments(connection, 30);

    const [paymentRows] = await connection.query(
      `SELECT id, payment_ref, item_nome, metodo, amount_cents, status,
              provider_checkout_url, provider_qr_code_url, provider_qr_code_text,
              expires_at, paid_at, created_at
       FROM loja_pagamentos
       WHERE faceit_guid = ?
       ORDER BY id DESC
       LIMIT 20`,
      [faceitGuid],
    );

    const payments = paymentRows as PaymentRow[];
    const paymentIds = payments.map((payment) => payment.id);

    let logs: LogRow[] = [];
    if (paymentIds.length) {
      const placeholders = paymentIds.map(() => "?").join(",");
      const [logRows] = await connection.query(
        `SELECT id, payment_id, event_name, status_before, status_after, source, message, details_json, created_at
         FROM loja_pagamentos_logs
         WHERE payment_id IN (${placeholders})
         ORDER BY id DESC
         LIMIT 400`,
        paymentIds,
      );
      logs = logRows as LogRow[];
    }

    const logsByPaymentId = new Map<number, LogRow[]>();
    for (const log of logs) {
      if (!log.payment_id) continue;
      const current = logsByPaymentId.get(log.payment_id) || [];
      current.push(log);
      logsByPaymentId.set(log.payment_id, current);
    }

    const data = payments.map((payment) => {
      const paymentLogs = (logsByPaymentId.get(payment.id) || []).slice(0, 12).map((log) => ({
        id: log.id,
        eventName: log.event_name,
        statusBefore: log.status_before,
        statusAfter: log.status_after,
        source: log.source,
        message: log.message,
        details: parseJsonIfNeeded(log.details_json),
        createdAt: log.created_at,
      }));

      const status = String(payment.status || "").toUpperCase();
      const isPending = ["PENDING", "WAITING", "IN_ANALYSIS"].includes(status);
      const isFinal = ["PAID", "DECLINED", "CANCELED", "EXPIRED", "FAILED"].includes(status);

      return {
        id: payment.id,
        paymentRef: payment.payment_ref,
        itemName: payment.item_nome,
        method: String(payment.metodo || "").toUpperCase(),
        amountCents: Number(payment.amount_cents || 0),
        status,
        isPending,
        isFinal,
        checkoutUrl: String(payment.provider_checkout_url || ""),
        pix: {
          qrCodeImageUrl: String(payment.provider_qr_code_url || ""),
          qrCodeText: String(payment.provider_qr_code_text || ""),
        },
        expiresAt: payment.expires_at,
        paidAt: payment.paid_at,
        createdAt: payment.created_at,
        logs: paymentLogs,
      };
    });

    return NextResponse.json({ success: true, payments: data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

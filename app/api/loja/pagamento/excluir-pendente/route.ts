import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

type DeletePendingBody = {
  payment_id?: number;
  faceit_guid?: string;
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

export async function POST(request: Request) {
  let connection: any;
  try {
    const body = (await request.json().catch(() => ({}))) as DeletePendingBody;
    const paymentId = Number(body.payment_id || 0);
    const faceitGuid = String(body.faceit_guid || "").trim();

    if (!faceitGuid) {
      return NextResponse.json({ message: "faceit_guid obrigatorio." }, { status: 400 });
    }

    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return NextResponse.json({ message: "payment_id invalido." }, { status: 400 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensurePaymentsTable(connection);
    await ensurePaymentsLogsTable(connection);

    const [deleteLogsResult] = await connection.query("DELETE FROM loja_pagamentos_logs WHERE payment_id = ?", [
      paymentId,
    ]);
    const [deletePaymentResult] = await connection.query(
      `DELETE FROM loja_pagamentos
       WHERE id = ?
         AND faceit_guid = ?
         AND UPPER(status) IN ('PENDING', 'WAITING', 'IN_ANALYSIS')`,
      [paymentId, faceitGuid],
    );

    const affectedRows = Number((deletePaymentResult as any)?.affectedRows || 0);
    if (affectedRows > 0) {
      return NextResponse.json(
        {
          success: true,
          deletedPaymentId: paymentId,
          deletedLogs: Number((deleteLogsResult as any)?.affectedRows || 0),
        },
        { status: 200 },
      );
    }

    const [existingRows] = await connection.query(
      `SELECT id, status
       FROM loja_pagamentos
       WHERE id = ? AND faceit_guid = ?
       LIMIT 1`,
      [paymentId, faceitGuid],
    );

    const paymentRows = existingRows as Array<{ id: number; status: string }>;
    if (!paymentRows.length) {
      return NextResponse.json({ message: "Pagamento nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({ message: "Apenas pagamentos pendentes podem ser excluidos." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

import { randomUUID } from "crypto";
import { MercadoPagoConfig } from "mercadopago";

export type OperationStatus = "pending" | "approved" | "cancelled" | "expired" | "failed";

export type PaymentOperationRow = {
  id: number;
  operation_code: string;
  faceit_guid: string;
  player_id: number;
  estoque_id: number;
  item_nome: string;
  amount: number;
  status: OperationStatus;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  checkout_url: string | null;
  expires_at: string;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export const OPERATION_TIMEOUT_MS = 5 * 60 * 1000;

function toIsoDateTime(value: Date) {
  return value.toISOString();
}

export function generateOperationCode() {
  return randomUUID().replace(/-/g, "");
}

export function computeExpiresAt(now = Date.now()) {
  return new Date(now + OPERATION_TIMEOUT_MS);
}

export function resolveRequestOrigin(request: Request) {
  const explicit = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function getMercadoPagoToken() {
  const token =
    (process.env.MERCADO_PAGO_ACCESS_TOKEN || process.env.MP_ACCESS_TOKEN || "").trim();

  if (!token) {
    throw new Error("Configure MERCADO_PAGO_ACCESS_TOKEN (ou MP_ACCESS_TOKEN) nas variáveis de ambiente.");
  }

  return token;
}

export function getMercadoPagoClient() {
  return new MercadoPagoConfig({
    accessToken: getMercadoPagoToken(),
  });
}

export async function ensurePricePaymentsTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS loja_pagamentos_preco (
      id INT AUTO_INCREMENT PRIMARY KEY,
      operation_code VARCHAR(80) NOT NULL,
      faceit_guid VARCHAR(255) NOT NULL,
      player_id INT NOT NULL,
      estoque_id INT NOT NULL,
      item_nome VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'pending',
      mp_preference_id VARCHAR(120) NULL,
      mp_payment_id VARCHAR(120) NULL,
      checkout_url TEXT NULL,
      expires_at DATETIME NOT NULL,
      cancel_reason VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      finished_at DATETIME NULL,
      UNIQUE KEY uk_operation_code (operation_code),
      INDEX idx_loja_pagamentos_faceit (faceit_guid),
      INDEX idx_loja_pagamentos_status (status),
      INDEX idx_loja_pagamentos_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

export async function readOperationByCode(connection: any, operationCode: string) {
  const [rows] = await connection.query(
    `SELECT id, operation_code, faceit_guid, player_id, estoque_id, item_nome, amount, status,
            mp_preference_id, mp_payment_id, checkout_url, expires_at, cancel_reason,
            created_at, updated_at, finished_at
     FROM loja_pagamentos_preco
     WHERE operation_code = ?
     LIMIT 1`,
    [operationCode],
  );

  const data = rows as PaymentOperationRow[];
  return data[0] || null;
}

export function mapMercadoPagoStatus(statusRaw: string | null | undefined): OperationStatus {
  const status = String(statusRaw || "").toLowerCase();

  if (status === "approved") return "approved";
  if (
    status === "pending" ||
    status === "in_process" ||
    status === "authorized" ||
    status === "in_mediation"
  ) {
    return "pending";
  }
  if (
    status === "cancelled" ||
    status === "rejected" ||
    status === "refunded" ||
    status === "charged_back"
  ) {
    return "cancelled";
  }
  return "failed";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function sanitizeMercadoPagoText(value: string | null | undefined) {
  const text = normalizeWhitespace(String(value || ""));
  if (!text) {
    return "";
  }

  const lower = text.toLowerCase();
  const blockedHints = [
    "developers.mercadopago.com",
    "sitio de desarrolladores",
    "mercadolibre",
    "si quieres conocer",
    "recursos de la api",
    "checkout",
    "api.mercadopago.com",
  ];

  if (blockedHints.some((hint) => lower.includes(hint))) {
    return "";
  }

  return text;
}

export function mapClientPaymentFailureMessage(rawReason: string | null | undefined, status?: OperationStatus) {
  const reason = sanitizeMercadoPagoText(rawReason);

  if (reason) {
    return reason;
  }

  if (status === "expired") {
    return "Tempo limite de pagamento expirado.";
  }

  if (status === "cancelled") {
    return "Pagamento cancelado.";
  }

  return "Não foi possível confirmar o pagamento.";
}


export async function touchPendingOperation(
  connection: any,
  operationCode: string,
  fields: {
    mpPaymentId?: string | null;
    mpPreferenceId?: string | null;
    checkoutUrl?: string | null;
  },
) {
  await connection.query(
    `UPDATE loja_pagamentos_preco
     SET mp_payment_id = COALESCE(?, mp_payment_id),
         mp_preference_id = COALESCE(?, mp_preference_id),
         checkout_url = COALESCE(?, checkout_url)
     WHERE operation_code = ? AND status = 'pending'`,
    [
      fields.mpPaymentId || null,
      fields.mpPreferenceId || null,
      fields.checkoutUrl || null,
      operationCode,
    ],
  );
}

export async function finalizeOperationWithStockPolicy(
  connection: any,
  operationCode: string,
  status: Exclude<OperationStatus, "pending">,
  options?: {
    cancelReason?: string;
    mpPaymentId?: string | null;
    mpPreferenceId?: string | null;
  },
) {
  await connection.beginTransaction();

  try {
    const [rows] = await connection.query(
      `SELECT id, estoque_id, status
       FROM loja_pagamentos_preco
       WHERE operation_code = ?
       LIMIT 1
       FOR UPDATE`,
      [operationCode],
    );

    const records = rows as Array<{ id: number; estoque_id: number; status: OperationStatus }>;
    if (!records.length) {
      await connection.rollback();
      return false;
    }

    const current = records[0];
    if (current.status !== "pending") {
      await connection.rollback();
      return false;
    }

    const shouldRestoreStock = status !== "approved";

    await connection.query(
      `UPDATE loja_pagamentos_preco
       SET status = ?,
           cancel_reason = ?,
           mp_payment_id = COALESCE(?, mp_payment_id),
           mp_preference_id = COALESCE(?, mp_preference_id),
           finished_at = NOW()
       WHERE id = ?`,
      [
        status,
        options?.cancelReason || null,
        options?.mpPaymentId || null,
        options?.mpPreferenceId || null,
        current.id,
      ],
    );

    if (shouldRestoreStock) {
      await connection.query("UPDATE estoque SET estoque = estoque + 1 WHERE id = ?", [current.estoque_id]);
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

export function isExpired(operation: PaymentOperationRow, now = Date.now()) {
  const expiresAt = new Date(operation.expires_at).getTime();
  return Number.isFinite(expiresAt) && now > expiresAt;
}

export function formatDateForMercadoPago(date: Date) {
  return toIsoDateTime(date);
}

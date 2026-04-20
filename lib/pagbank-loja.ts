import { randomUUID } from "crypto";

export type LojaPaymentMethod = "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "BOLETO";
export type LojaPaymentStatus =
  | "PENDING"
  | "WAITING"
  | "IN_ANALYSIS"
  | "PAID"
  | "DECLINED"
  | "CANCELED"
  | "EXPIRED"
  | "FAILED";

export type LojaProviderType = "CHECKOUT" | "ORDER";

const PAGBANK_API_BASE_URL =
  (process.env.PAGBANK_API_BASE_URL?.trim() || "https://api.pagseguro.com/").replace(/\/+$/, "");

function getPagBankToken() {
  return process.env.TOKEN_PAGSEGURO?.trim() || "";
}

export function hasPagBankToken() {
  return Boolean(getPagBankToken());
}

export function buildIsoFromNow(minutes: number) {
  const expires = new Date(Date.now() + minutes * 60 * 1000);
  return expires.toISOString();
}

export function toCents(value: number) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed * 100);
}

export function generatePaymentRef(localId: number) {
  return `LOJA_PAY_${localId}_${randomUUID().slice(0, 8)}`;
}

export function extractPayLink(links: unknown) {
  if (!Array.isArray(links)) return "";
  for (const link of links as Array<Record<string, unknown>>) {
    if (String(link?.rel || "").toUpperCase() === "PAY") {
      return String(link?.href || "");
    }
  }
  return "";
}

export function mapProviderStatusToLocal(statusRaw: unknown): LojaPaymentStatus {
  const status = String(statusRaw || "").toUpperCase();

  if (status === "AUTHORIZED") return "PAID";
  if (status === "PAID") return "PAID";
  if (status === "IN_ANALYSIS") return "IN_ANALYSIS";
  if (status === "WAITING") return "WAITING";
  if (status === "DECLINED") return "DECLINED";
  if (status === "CANCELED") return "CANCELED";
  if (status === "EXPIRED" || status === "INACTIVE") return "EXPIRED";

  return "PENDING";
}

export function isFinalStatus(statusRaw: unknown) {
  const status = String(statusRaw || "").toUpperCase();
  return ["PAID", "DECLINED", "CANCELED", "EXPIRED", "FAILED"].includes(status);
}

async function pagBankFetch(path: string, init?: RequestInit) {
  const token = getPagBankToken();
  if (!token) {
    throw new Error("TOKEN_PAGSEGURO nao configurado no ambiente.");
  }

  const headers = new Headers(init?.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  // Log de request para crédito e PIX em arquivo
  const fs = await import('fs');
  const logFile = 'pagbank-logs.txt';
  if (
    (path === "/orders" && init?.method === "POST") ||
    (path === "/checkouts" && init?.method === "POST")
  ) {
    try {
      const parsedBody = init?.body ? JSON.parse(init.body as string) : undefined;
      fs.appendFileSync(logFile, `\n[PAGBANK][REQUEST] ${path}\n${JSON.stringify(parsedBody, null, 2)}\n`);
    } catch (e) {
      fs.appendFileSync(logFile, `\n[PAGBANK][REQUEST] ${path}\n${init?.body}\n`);
    }
  }

  const response = await fetch(`${PAGBANK_API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  // Log de response para crédito e PIX em arquivo
  if (
    (path === "/orders" && init?.method === "POST") ||
    (path === "/checkouts" && init?.method === "POST")
  ) {
    fs.appendFileSync(logFile, `\n[PAGBANK][RESPONSE] ${path}\n${JSON.stringify(data, null, 2)}\n`);
  }

  return { response, data };
}

export async function createCheckout(payload: Record<string, unknown>) {
  const idempotencyKey = randomUUID();
  return pagBankFetch("/checkouts", {
    method: "POST",
    headers: {
      "x-idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function getCheckout(checkoutId: string) {
  return pagBankFetch(`/checkouts/${encodeURIComponent(checkoutId)}`, {
    method: "GET",
  });
}

export async function createOrder(payload: Record<string, unknown>) {
  const idempotencyKey = randomUUID();
  return pagBankFetch("/orders", {
    method: "POST",
    headers: {
      "x-idempotency-key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
}

export async function getOrder(orderId: string) {
  return pagBankFetch(`/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });
}

export function extractPixData(orderData: any) {
  const qrCode = Array.isArray(orderData?.qr_codes) ? orderData.qr_codes[0] : null;
  const links = Array.isArray(qrCode?.links) ? qrCode.links : [];

  let qrCodeImageUrl = "";
  let qrCodeText = "";

  for (const link of links) {
    const media = String(link?.media || "").toLowerCase();
    const href = String(link?.href || "");
    if (!href) continue;

    if (media === "image/png") qrCodeImageUrl = href;
    if (media === "text/plain") qrCodeText = href;
  }

  return {
    qrCodeImageUrl,
    qrCodeText,
  };
}

export function extractOrderChargeStatus(orderData: any) {
  const charge = Array.isArray(orderData?.charges) ? orderData.charges[0] : null;
  return String(charge?.status || orderData?.status || "").toUpperCase();
}

export function extractCheckoutOrderIds(checkoutData: any) {
  const orders = Array.isArray(checkoutData?.orders) ? checkoutData.orders : [];
  const orderIds = new Set<string>();

  for (const order of orders) {
    const directId = String(order?.id || "").trim();
    if (directId) {
      orderIds.add(directId);
      continue;
    }

    const links = Array.isArray(order?.links) ? order.links : [];
    for (const link of links) {
      const href = String(link?.href || "").trim();
      if (!href) continue;

      const match = href.match(/\/orders\/([^/?#]+)/i);
      if (match?.[1]) {
        orderIds.add(match[1]);
      }
    }
  }

  return Array.from(orderIds);
}

export function extractCheckoutStatus(checkoutData: any) {
  const topLevelChargeStatus = String(
    Array.isArray(checkoutData?.charges) && checkoutData.charges.length > 0
      ? checkoutData.charges[0]?.status || ""
      : "",
  ).toUpperCase();
  if (topLevelChargeStatus) return topLevelChargeStatus;

  const topLevelTransactionStatus = String(
    Array.isArray(checkoutData?.transactions) && checkoutData.transactions.length > 0
      ? checkoutData.transactions[0]?.status || ""
      : "",
  ).toUpperCase();
  if (topLevelTransactionStatus) return topLevelTransactionStatus;

  const orderChargeStatus = String(
    Array.isArray(checkoutData?.orders) && checkoutData.orders.length > 0
      ? Array.isArray(checkoutData.orders[0]?.charges) && checkoutData.orders[0].charges.length > 0
        ? checkoutData.orders[0].charges[0]?.status || ""
        : ""
      : "",
  ).toUpperCase();
  if (orderChargeStatus) return orderChargeStatus;

  const payments = Array.isArray(checkoutData?.payments) ? checkoutData.payments : [];
  if (payments.length > 0) {
    const charges = Array.isArray(payments[0]?.charges) ? payments[0].charges : [];
    if (charges.length > 0) {
      const chargeStatus = String(charges[0]?.status || "").toUpperCase();
      if (chargeStatus) return chargeStatus;
    }

    const paymentStatus = String(payments[0]?.status || "").toUpperCase();
    if (paymentStatus) return paymentStatus;
  }

  const lastPaymentStatus = String(checkoutData?.last_payment?.status || "").toUpperCase();
  if (lastPaymentStatus) return lastPaymentStatus;

  const lastTransactionStatus = String(checkoutData?.last_transaction?.status || "").toUpperCase();
  if (lastTransactionStatus) return lastTransactionStatus;

  return String(checkoutData?.status || "").toUpperCase();
}

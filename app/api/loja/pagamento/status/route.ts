import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { createMainConnection } from "@/lib/db";
import {
  extractCheckoutOrderIds,
  extractCheckoutStatus,
  extractOrderChargeStatus,
  getCheckout,
  getOrder,
  isFinalStatus,
  mapProviderStatusToLocal,
} from "@/lib/pagbank-loja";
import {
  loadLojaPaymentDiscordContext,
  sendLojaPaymentDiscordWebhook,
} from "@/lib/loja-payment-discord-webhook";
import { deleteStalePendingPayments } from "@/lib/loja-payment-cleanup";

export const dynamic = "force-dynamic";

type PaymentRow = {
  id: number;
  payment_ref?: string;
  provider_type: "CHECKOUT" | "ORDER";
  provider_id: string | null;
  provider_checkout_url: string | null;
  provider_qr_code_url: string | null;
  provider_qr_code_text: string | null;
  estoque_id: number;
  status: string;
  failure_reason: string | null;
  expires_at: string | null;
  paid_at: string | null;
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

async function hasPaidDiscordWebhookSent(connection: any, paymentId: number) {
  const [rows] = await connection.query(
    `SELECT id
     FROM loja_pagamentos_logs
     WHERE payment_id = ?
       AND event_name = 'DISCORD_WEBHOOK_SENT'
       AND status_after = 'PAID'
     ORDER BY id DESC
     LIMIT 1`,
    [paymentId],
  );

  return Array.isArray(rows) && rows.length > 0;
}

function isFinalLocalStatus(status: string) {
  const value = String(status || "").toUpperCase();
  return ["PAID", "DECLINED", "CANCELED", "EXPIRED", "FAILED"].includes(value);
}

function getProviderStatusPriority(statusRaw: string) {
  const status = String(statusRaw || "").toUpperCase();
  if (["AUTHORIZED", "PAID"].includes(status)) return 100;
  if (["IN_ANALYSIS"].includes(status)) return 70;
  if (["WAITING"].includes(status)) return 60;
  if (["DECLINED", "CANCELED", "EXPIRED", "FAILED"].includes(status)) return 50;
  if (["ACTIVE"].includes(status)) return 10;
  return 0;
}

async function markPaidAndDecrementStock(connection: any, paymentId: number, paymentRef?: string) {
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
        paymentRef,
        eventName: "PAYMENT_ALREADY_PAID",
        statusBefore: currentStatus,
        statusAfter: currentStatus,
        source: "api-status",
      });
      await connection.commit();
      return { finalStatus: currentStatus };
    }

    const [stockRows] = await connection.query("SELECT estoque FROM estoque WHERE id = ? FOR UPDATE", [payment.estoque_id]);
    const items = stockRows as Array<{ estoque: number }>;

    if (!items.length) {
      await connection.query(
        "UPDATE loja_pagamentos SET status = 'FAILED', failure_reason = ? WHERE id = ?",
        ["Item nao encontrado na confirmacao.", paymentId],
      );
      await createPaymentLog(connection, {
        paymentId,
        paymentRef,
        eventName: "PAYMENT_FAILED_STOCK_ITEM_NOT_FOUND",
        statusBefore: currentStatus,
        statusAfter: "FAILED",
        source: "api-status",
      });
      await connection.commit();
      return { finalStatus: "FAILED" };
    }

    const stock = Number(items[0].estoque || 0);
    if (stock <= 0) {
      await connection.query(
        "UPDATE loja_pagamentos SET status = 'FAILED', failure_reason = ? WHERE id = ?",
        ["Sem estoque na confirmacao.", paymentId],
      );
      await createPaymentLog(connection, {
        paymentId,
        paymentRef,
        eventName: "PAYMENT_FAILED_STOCK_EMPTY",
        statusBefore: currentStatus,
        statusAfter: "FAILED",
        source: "api-status",
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
      paymentRef,
      eventName: "PAYMENT_CONFIRMED_AND_STOCK_DECREMENTED",
      statusBefore: currentStatus,
      statusAfter: "PAID",
      source: "api-status",
    });

    await connection.commit();
    return { finalStatus: "PAID" };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

async function updateByProviderStatus(connection: any, payment: PaymentRow, providerStatusRaw: string) {
  const localStatus = mapProviderStatusToLocal(providerStatusRaw);
  const currentStatus = String(payment.status || "").toUpperCase();

  await createPaymentLog(connection, {
    paymentId: payment.id,
    paymentRef: payment.payment_ref,
    eventName: "PROVIDER_STATUS_SYNC",
    statusBefore: currentStatus,
    statusAfter: localStatus,
    source: "api-status",
    details: {
      providerStatusRaw,
      providerType: payment.provider_type,
    },
  });

  if (localStatus === "PAID") {
    const result = await markPaidAndDecrementStock(connection, payment.id, payment.payment_ref);
    return {
      status: result.finalStatus,
      previousStatus: currentStatus,
      changed: result.finalStatus !== currentStatus,
    };
  }

  if (localStatus !== currentStatus && !isFinalLocalStatus(currentStatus)) {
    await connection.query("UPDATE loja_pagamentos SET status = ? WHERE id = ?", [localStatus, payment.id]);
    await createPaymentLog(connection, {
      paymentId: payment.id,
      paymentRef: payment.payment_ref,
      eventName: "STATUS_UPDATED_BY_SYNC",
      statusBefore: currentStatus,
      statusAfter: localStatus,
      source: "api-status",
    });
    return {
      status: localStatus,
      previousStatus: currentStatus,
      changed: true,
    };
  }

  return {
    status: localStatus,
    previousStatus: currentStatus,
    changed: false,
  };
}

export async function GET(request: Request) {
  let connection: any;
  try {
    const paymentId = Number(new URL(request.url).searchParams.get("paymentId") || 0);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return NextResponse.json({ message: "paymentId invalido." }, { status: 400 });
    }

    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    await ensurePaymentsTable(connection);
    await ensurePaymentsLogsTable(connection);
    await deleteStalePendingPayments(connection, 30);

    const [rows] = await connection.query(
      `SELECT id, payment_ref, provider_type, provider_id, provider_checkout_url, provider_qr_code_url, provider_qr_code_text,
              estoque_id, status, failure_reason, expires_at, paid_at
       FROM loja_pagamentos WHERE id = ? LIMIT 1`,
      [paymentId],
    );

    const payments = rows as PaymentRow[];
    if (!payments.length) {
      return NextResponse.json({ message: "Pagamento nao encontrado." }, { status: 404 });
    }

    const payment = payments[0];
    let status = String(payment.status || "").toUpperCase();

    if (!isFinalLocalStatus(status) && payment.expires_at) {
      const previousStatus = String(payment.status || "").toUpperCase();
      const expiresAtMs = new Date(payment.expires_at).getTime();
      if (Number.isFinite(expiresAtMs) && Date.now() > expiresAtMs) {
        status = "EXPIRED";
        await connection.query("UPDATE loja_pagamentos SET status = 'EXPIRED' WHERE id = ? AND status NOT IN ('PAID')", [
          payment.id,
        ]);
        await createPaymentLog(connection, {
          paymentId: payment.id,
          paymentRef: payment.payment_ref,
          eventName: "STATUS_EXPIRED_BY_TIMEOUT",
          statusBefore: String(payment.status || "").toUpperCase(),
          statusAfter: "EXPIRED",
          source: "api-status",
        });
        const notificationPayment = await loadLojaPaymentDiscordContext(connection, payment.id);
        if (notificationPayment) {
          const dispatch = await sendLojaPaymentDiscordWebhook({
            eventName: "STATUS_EXPIRED_BY_TIMEOUT",
            source: "api-status",
            statusBefore: previousStatus,
            statusAfter: "EXPIRED",
            payment: notificationPayment,
          });
          await createPaymentLog(connection, {
            paymentId: payment.id,
            paymentRef: payment.payment_ref,
            eventName: dispatch.sent ? "DISCORD_WEBHOOK_SENT" : "DISCORD_WEBHOOK_FAILED",
            statusBefore: previousStatus,
            statusAfter: "EXPIRED",
            source: "api-status",
            message: dispatch.sent
              ? "Webhook Discord enviado com sucesso."
              : dispatch.reason || dispatch.error || "Falha ao enviar webhook Discord.",
            details: dispatch,
          });
        }
      }
    }

    if (!isFinalLocalStatus(status) && payment.provider_id) {
      if (payment.provider_type === "CHECKOUT") {
        const { response, data } = await getCheckout(payment.provider_id);
        if (response.ok) {
          let providerStatusRaw = extractCheckoutStatus(data);
          let providerData = data;

          if (!isFinalStatus(providerStatusRaw)) {
            await createPaymentLog(connection, {
              paymentId: payment.id,
              paymentRef: payment.payment_ref,
              eventName: "CHECKOUT_RAW_DEBUG",
              source: "api-status",
              message: `extractCheckoutStatus="${providerStatusRaw}" — non-final, logging raw data`,
              details: {
                extractedStatus: providerStatusRaw,
                checkoutStatus: data?.status,
                topLevelChargeStatus:
                  Array.isArray(data?.charges) && data.charges.length > 0 ? data.charges[0]?.status : null,
                topLevelTransactionStatus:
                  Array.isArray(data?.transactions) && data.transactions.length > 0
                    ? data.transactions[0]?.status
                    : null,
                orderChargeStatus:
                  Array.isArray(data?.orders) && data.orders.length > 0 && Array.isArray(data.orders[0]?.charges)
                    ? data.orders[0].charges[0]?.status || null
                    : null,
                lastPaymentStatus: data?.last_payment?.status ?? null,
                lastTransactionStatus: data?.last_transaction?.status ?? null,
                paymentsCount: Array.isArray(data?.payments) ? data.payments.length : null,
                chargesCount: Array.isArray(data?.charges) ? data.charges.length : null,
                transactionsCount: Array.isArray(data?.transactions) ? data.transactions.length : null,
                ordersCount: Array.isArray(data?.orders) ? data.orders.length : null,
                firstPayment: Array.isArray(data?.payments) && data.payments.length > 0
                  ? {
                      id: data.payments[0]?.id,
                      status: data.payments[0]?.status,
                      chargesCount: Array.isArray(data.payments[0]?.charges) ? data.payments[0].charges.length : null,
                      firstChargeStatus: Array.isArray(data.payments[0]?.charges) && data.payments[0].charges.length > 0
                        ? data.payments[0].charges[0]?.status
                        : null,
                    }
                  : null,
                linksRel: Array.isArray(data?.links)
                  ? data.links.map((link: any) => ({ rel: link?.rel || null, method: link?.method || null }))
                  : null,
              },
            });

            const checkoutOrderIds = extractCheckoutOrderIds(data);
            if (checkoutOrderIds.length > 0) {
              let bestOrderStatusRaw = providerStatusRaw;
              let bestOrderData: any = null;
              let bestOrderId = "";
              let bestPriority = getProviderStatusPriority(providerStatusRaw);

              for (const orderId of checkoutOrderIds) {
                const { response: orderResponse, data: orderData } = await getOrder(orderId);
                if (!orderResponse.ok) continue;

                const orderStatusRaw = extractOrderChargeStatus(orderData);
                const orderPriority = getProviderStatusPriority(orderStatusRaw);

                if (orderPriority >= bestPriority) {
                  bestPriority = orderPriority;
                  bestOrderStatusRaw = orderStatusRaw;
                  bestOrderData = orderData;
                  bestOrderId = orderId;
                }
              }

              await createPaymentLog(connection, {
                paymentId: payment.id,
                paymentRef: payment.payment_ref,
                eventName: "CHECKOUT_ORDER_STATUS_FALLBACK",
                source: "api-status",
                message: `Checkout sem payments/charges utilizou fallback por orders: ${bestOrderStatusRaw || "SEM_STATUS"}`,
                details: {
                  checkoutStatusRaw: providerStatusRaw,
                  orderIds: checkoutOrderIds,
                  chosenOrderId: bestOrderId || null,
                  chosenOrderStatusRaw: bestOrderStatusRaw || null,
                },
              });

              if (bestOrderData && bestOrderStatusRaw && bestOrderStatusRaw !== providerStatusRaw) {
                providerStatusRaw = bestOrderStatusRaw;
                providerData = bestOrderData;
              }
            }
          }

          const result = await updateByProviderStatus(connection, payment, providerStatusRaw);
          status = result.status;
          if (result.changed) {
            const notificationPayment = await loadLojaPaymentDiscordContext(connection, payment.id);
            if (notificationPayment) {
              const dispatch = await sendLojaPaymentDiscordWebhook({
                eventName: "STATUS_UPDATED_BY_SYNC",
                source: "api-status",
                statusBefore: result.previousStatus,
                statusAfter: result.status,
                providerStatus: providerStatusRaw,
                providerData,
                payment: notificationPayment,
              });
              await createPaymentLog(connection, {
                paymentId: payment.id,
                paymentRef: payment.payment_ref,
                eventName: dispatch.sent ? "DISCORD_WEBHOOK_SENT" : "DISCORD_WEBHOOK_FAILED",
                statusBefore: result.previousStatus,
                statusAfter: result.status,
                source: "api-status",
                message: dispatch.sent
                  ? "Webhook Discord enviado com sucesso."
                  : dispatch.reason || dispatch.error || "Falha ao enviar webhook Discord.",
                details: {
                  providerStatusRaw,
                  ...dispatch,
                },
              });
            }
          }
        }
      } else {
        const { response, data } = await getOrder(payment.provider_id);
        if (response.ok) {
          const providerStatusRaw = extractOrderChargeStatus(data);
          const result = await updateByProviderStatus(connection, payment, providerStatusRaw);
          status = result.status;
          if (result.changed) {
            const notificationPayment = await loadLojaPaymentDiscordContext(connection, payment.id);
            if (notificationPayment) {
              const dispatch = await sendLojaPaymentDiscordWebhook({
                eventName: "STATUS_UPDATED_BY_SYNC",
                source: "api-status",
                statusBefore: result.previousStatus,
                statusAfter: result.status,
                providerStatus: providerStatusRaw,
                providerData: data,
                payment: notificationPayment,
              });
              await createPaymentLog(connection, {
                paymentId: payment.id,
                paymentRef: payment.payment_ref,
                eventName: dispatch.sent ? "DISCORD_WEBHOOK_SENT" : "DISCORD_WEBHOOK_FAILED",
                statusBefore: result.previousStatus,
                statusAfter: result.status,
                source: "api-status",
                message: dispatch.sent
                  ? "Webhook Discord enviado com sucesso."
                  : dispatch.reason || dispatch.error || "Falha ao enviar webhook Discord.",
                details: {
                  providerStatusRaw,
                  ...dispatch,
                },
              });
            }
          }
        }
      }
    }

    if (status === "PAID") {
      const alreadySentPaidWebhook = await hasPaidDiscordWebhookSent(connection, payment.id);
      if (!alreadySentPaidWebhook) {
        const notificationPayment = await loadLojaPaymentDiscordContext(connection, payment.id);
        if (notificationPayment) {
          const dispatch = await sendLojaPaymentDiscordWebhook({
            eventName: "STATUS_PAID_DISCORD_RECOVERY",
            source: "api-status",
            statusBefore: String(payment.status || "").toUpperCase(),
            statusAfter: "PAID",
            payment: notificationPayment,
          });

          await createPaymentLog(connection, {
            paymentId: payment.id,
            paymentRef: payment.payment_ref,
            eventName: dispatch.sent ? "DISCORD_WEBHOOK_SENT" : "DISCORD_WEBHOOK_FAILED",
            statusBefore: String(payment.status || "").toUpperCase(),
            statusAfter: "PAID",
            source: "api-status",
            message: dispatch.sent
              ? "Webhook Discord enviado com sucesso (fallback de status)."
              : dispatch.reason || dispatch.error || "Falha ao enviar webhook Discord (fallback de status).",
            details: {
              fallback: true,
              ...dispatch,
            },
          });
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        paymentId: payment.id,
        status,
        isFinal: isFinalLocalStatus(status),
        shouldClosePopup: ["PAID", "DECLINED", "CANCELED", "EXPIRED", "FAILED"].includes(status),
        checkoutUrl: String(payment.provider_checkout_url || ""),
        pix: {
          qrCodeImageUrl: String(payment.provider_qr_code_url || ""),
          qrCodeText: String(payment.provider_qr_code_text || ""),
        },
        failureReason: payment.failure_reason,
        expiresAt: payment.expires_at,
        paidAt: payment.paid_at,
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

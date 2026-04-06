import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import {
  ensurePricePaymentsTable,
  finalizeOperationWithStockPolicy,
  mapClientPaymentFailureMessage,
  mapMercadoPagoStatus,
  readOperationByCode,
  touchPendingOperation,
} from "@/lib/loja-pagamento";
import { getCheckoutProPaymentById, getMerchantOrderById } from "@/lib/mercado-pago-checkout-pro";
import {
  parseMercadoPagoWebhookMeta,
  sendMercadoPagoEventToDiscord,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercado-pago-webhook";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let connection: any;

  try {
    const body = await request.json().catch(() => ({}));
    const meta = parseMercadoPagoWebhookMeta(request, body);

    const signatureCheck = verifyMercadoPagoWebhookSignature(request, meta.id);
    if (!signatureCheck.valid) {
      await sendMercadoPagoEventToDiscord({
        meta,
        operationStatus: "rejected",
        paymentStatusDetail: `Assinatura invalida (${signatureCheck.reason})`,
        signatureDiag: {
          ts: signatureCheck.ts,
          receivedV1: signatureCheck.receivedV1,
          expectedHash: signatureCheck.expectedHash,
          requestId: signatureCheck.requestId,
        },
      });
      return NextResponse.json({ ok: false, message: "Assinatura inválida" }, { status: 401 });
    }

    if (!meta.id) {
      await sendMercadoPagoEventToDiscord({
        meta,
        operationStatus: "ignored",
        paymentStatusDetail: "Evento sem data.id / payment id",
      });
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    // merchant_order traz um ID de ordem comercial, não de pagamento.
    // Precisamos buscar a ordem para obter o external_reference e o pagamento real.
    const isMerchantOrder =
      meta.topic === "merchant_order" || meta.topic === "topic_merchant_order_wh";

    if (isMerchantOrder) {
      const order = await getMerchantOrderById(meta.id);

      const operationCode = String(order.external_reference || "").trim();
      if (!operationCode) {
        await sendMercadoPagoEventToDiscord({
          meta,
          operationStatus: "ignored",
          paymentStatusDetail: `merchant_order sem external_reference (order_status=${order.order_status})`,
        });
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }

      const ctx = await getCloudflareContext({ async: true });
      const env = ctx.env as any;
      connection = await createMainConnection(env);
      await ensurePricePaymentsTable(connection);

      const operation = await readOperationByCode(connection, operationCode);
      if (!operation) {
        await sendMercadoPagoEventToDiscord({
          meta,
          operationCode,
          operationStatus: "ignored",
          paymentStatusDetail: "Operacao nao encontrada no banco (merchant_order)",
        });
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }

      // Encontra o pagamento mais relevante dentro da ordem (último com status real).
      const payments = Array.isArray(order.payments) ? order.payments : [];
      const latestPayment = payments
        .filter((p) => p.status && p.status !== "cancelled")
        .at(-1) ?? payments.at(-1);

      const paymentStatus = latestPayment?.status ?? null;
      const paymentStatusDetail = String(latestPayment?.status_detail ?? "");
      const paymentId = String(latestPayment?.id || "");

      const mappedStatus = mapMercadoPagoStatus(paymentStatus);

      if (mappedStatus === "pending") {
        await touchPendingOperation(connection, operationCode, {
          mpPaymentId: paymentId || undefined,
        });
        await sendMercadoPagoEventToDiscord({
          meta,
          operationCode,
          operationStatus: "pending",
          paymentStatus: String(paymentStatus || ""),
          paymentStatusDetail: `merchant_order order_status=${order.order_status}`,
          checkoutUrl: operation.checkout_url || undefined,
        });
        return NextResponse.json({ ok: true, status: "pending" }, { status: 200 });
      }

      await finalizeOperationWithStockPolicy(connection, operationCode, mappedStatus, {
        cancelReason: mapClientPaymentFailureMessage(paymentStatusDetail, mappedStatus),
        mpPaymentId: paymentId || undefined,
      });

      await sendMercadoPagoEventToDiscord({
        meta,
        operationCode,
        operationStatus: mappedStatus,
        paymentStatus: String(paymentStatus || ""),
        paymentStatusDetail: `merchant_order order_status=${order.order_status} | ${paymentStatusDetail}`,
        checkoutUrl: operation.checkout_url || undefined,
      });

      return NextResponse.json({ ok: true, status: mappedStatus }, { status: 200 });
    }

    // Tópico de pagamento direto (payment / default).
    const payment = await getCheckoutProPaymentById(meta.id);

    const operationCode = String(payment.external_reference || "").trim();
    if (!operationCode) {
      await sendMercadoPagoEventToDiscord({
        meta,
        operationStatus: "ignored",
        paymentStatus: String(payment.status || ""),
        paymentStatusDetail: "Pagamento sem external_reference",
      });
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensurePricePaymentsTable(connection);

    const operation = await readOperationByCode(connection, operationCode);
    if (!operation) {
      await sendMercadoPagoEventToDiscord({
        meta,
        operationCode,
        operationStatus: "ignored",
        paymentStatus: String(payment.status || ""),
        paymentStatusDetail: "Operacao nao encontrada no banco",
      });
      return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    }

    const mappedStatus = mapMercadoPagoStatus(payment.status ?? null);
    const normalizedPaymentId = String(payment.id || meta.id);

    if (mappedStatus === "pending") {
      await touchPendingOperation(connection, operationCode, {
        mpPaymentId: normalizedPaymentId,
      });

      await sendMercadoPagoEventToDiscord({
        meta,
        operationCode,
        operationStatus: "pending",
        paymentStatus: String(payment.status || ""),
        paymentStatusDetail: String(payment.status_detail || ""),
        checkoutUrl: operation.checkout_url || undefined,
      });

      return NextResponse.json({ ok: true, status: "pending" }, { status: 200 });
    }

    await finalizeOperationWithStockPolicy(connection, operationCode, mappedStatus, {
      cancelReason: mapClientPaymentFailureMessage(payment.status_detail, mappedStatus),
      mpPaymentId: normalizedPaymentId,
    });

    await sendMercadoPagoEventToDiscord({
      meta,
      operationCode,
      operationStatus: mappedStatus,
      paymentStatus: String(payment.status || ""),
      paymentStatusDetail: String(payment.status_detail || ""),
      checkoutUrl: operation.checkout_url || undefined,
    });

    return NextResponse.json({ ok: true, status: mappedStatus }, { status: 200 });
  } catch (error) {
    console.error("[mercadopago/webhooks] erro no processamento do webhook", error);

    const metaFallback = {
      topic: "unknown",
      action: "unknown",
      id: "",
      rawQuery: "",
    };

    await sendMercadoPagoEventToDiscord({
      meta: metaFallback,
      operationStatus: "error",
      paymentStatusDetail: "Erro interno ao processar webhook",
    });

    return NextResponse.json({ ok: false, message: "Erro interno" }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(
    {
      ok: true,
      webhook: "mercado-pago",
      message: "Use POST para notificacoes do Mercado Pago.",
      query: Object.fromEntries(searchParams.entries()),
    },
    { status: 200 },
  );
}

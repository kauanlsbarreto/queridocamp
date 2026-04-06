import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import {
  ensurePricePaymentsTable,
  finalizeOperationWithStockPolicy,
  isExpired,
  mapClientPaymentFailureMessage,
  mapMercadoPagoStatus,
  readOperationByCode,
  touchPendingOperation,
} from "@/lib/loja-pagamento";
import { getCheckoutProPaymentById } from "@/lib/mercado-pago-checkout-pro";

export const dynamic = "force-dynamic";



async function syncWithMercadoPago(connection: any, operationCode: string, paymentId: string) {
  const payment = await getCheckoutProPaymentById(paymentId);

  const mappedStatus = mapMercadoPagoStatus(payment.status);
  const normalizedPaymentId = String(payment.id || paymentId);

  if (mappedStatus === "pending") {
    await touchPendingOperation(connection, operationCode, {
      mpPaymentId: normalizedPaymentId,
    });
    return;
  }

  await finalizeOperationWithStockPolicy(connection, operationCode, mappedStatus, {
    cancelReason: mapClientPaymentFailureMessage(payment.status_detail, mappedStatus),
    mpPaymentId: normalizedPaymentId,
  });
}

export async function GET(request: Request) {
  let connection: any;

  try {
    const { searchParams } = new URL(request.url);
    const operationCode = String(searchParams.get("operation") || "").trim();
    const faceitGuid = String(searchParams.get("faceit_guid") || "").trim();
    const paymentId = String(searchParams.get("payment_id") || "").trim();

    if (!operationCode) {
      return NextResponse.json({ message: "operation é obrigatório." }, { status: 400 });
    }

    if (!faceitGuid) {
      return NextResponse.json({ message: "faceit_guid é obrigatório." }, { status: 401 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensurePricePaymentsTable(connection);

    const operation = await readOperationByCode(connection, operationCode);

    if (!operation) {
      return NextResponse.json({ message: "Operação não encontrada." }, { status: 404 });
    }

    if (operation.faceit_guid !== faceitGuid) {
      return NextResponse.json({ message: "Operação não pertence ao usuário logado." }, { status: 403 });
    }

    if (operation.status === "pending") {
      const syncPaymentId = paymentId || String(operation.mp_payment_id || "").trim();
      if (syncPaymentId) {
        await syncWithMercadoPago(connection, operationCode, syncPaymentId);
      }
    }

    let updatedOperation = await readOperationByCode(connection, operationCode);

    if (updatedOperation && updatedOperation.status === "pending" && isExpired(updatedOperation)) {
      await finalizeOperationWithStockPolicy(connection, operationCode, "expired", {
        cancelReason: "Tempo limite de 5 minutos excedido.",
      });
      updatedOperation = await readOperationByCode(connection, operationCode);
    }

    if (!updatedOperation) {
      return NextResponse.json({ message: "Operação não encontrada." }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        operation: {
          operationCode: updatedOperation.operation_code,
          status: updatedOperation.status,
          itemNome: updatedOperation.item_nome,
          amount: Number(updatedOperation.amount || 0),
          checkoutUrl: updatedOperation.checkout_url,
          expiresAt: updatedOperation.expires_at,
          cancelReason: mapClientPaymentFailureMessage(updatedOperation.cancel_reason, updatedOperation.status),
          mpPreferenceId: updatedOperation.mp_preference_id,
          mpPaymentId: updatedOperation.mp_payment_id,
          createdAt: updatedOperation.created_at,
          finishedAt: updatedOperation.finished_at,
        },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[loja/pagamento/status] erro ao consultar status", error);
    return NextResponse.json({ message: "Não foi possível consultar o status agora." }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

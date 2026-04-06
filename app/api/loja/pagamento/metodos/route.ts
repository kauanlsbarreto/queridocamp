import { NextResponse } from "next/server";
import { getCheckoutProPaymentMethods } from "@/lib/mercado-pago-checkout-pro";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const methods = await getCheckoutProPaymentMethods();

    const normalized = methods
      .filter((method) => String(method.status || "").toLowerCase() === "active")
      .map((method) => ({
        id: method.id,
        name: method.name,
        paymentTypeId: method.payment_type_id,
        status: method.status,
        siteId: method.site_id,
      }));

    return NextResponse.json({
      success: true,
      methods: normalized,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar métodos de pagamento";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

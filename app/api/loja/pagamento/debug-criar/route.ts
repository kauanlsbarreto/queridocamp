import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import {
  createCheckout,
  hasPagBankToken,
  extractCheckoutPaymentUrl,
  toCents,
  buildIsoFromNow,
  generatePaymentRef,
} from "@/lib/pagbank-loja";

/**
 * DEBUG ENDPOINT: Test checkout creation with the current token
 * Call: POST /api/loja/pagamento/debug-criar
 */
export async function POST(request: Request) {
  try {
    const env = await getRuntimeEnv();

    if (!hasPagBankToken()) {
      return NextResponse.json(
        { error: "TOKEN_PAGSEGURO nao configurado no ambiente." },
        { status: 500 },
      );
    }

    // Simple test payload
    const paymentRef = generatePaymentRef(999);
    const testPayload: Record<string, unknown> = {
      reference_id: paymentRef,
      expiration_date: buildIsoFromNow(45),
      items: [
        {
          reference_id: "test-item",
          name: "Test Item for Debug",
          quantity: 1,
          unit_amount: toCents(100), // R$ 1.00
        },
      ],
      payment_methods: [{ type: "CREDIT_CARD" }],
      redirect_url: "https://queridocamp.com.br/loja/pagamento?debug=true",
      return_url: "https://queridocamp.com.br/loja/pagamento?debug=true",
      notification_urls: [
        "https://queridocamp.com.br/api/loja/pagamento/webhook?debug=true",
      ],
    };

    const { response, data } = await createCheckout(testPayload);

    const url = extractCheckoutPaymentUrl(data);

    return NextResponse.json(
      {
        success: response.ok,
        status: response.status,
        paymentRef,
        extractedUrl: url,
        responseStructure: {
          id: data?.id,
          status: data?.status,
          hasLinks: Array.isArray(data?.links),
          linksCount: Array.isArray(data?.links) ? data.links.length : 0,
          availableFields: Object.keys(data || {}).sort(),
        },
        firstLinkIfExists: Array.isArray(data?.links) ? data.links[0] : null,
        allLinks: Array.isArray(data?.links) ? data.links : [],
        fullResponse: data,
      },
      { status: response.ok ? 200 : response.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

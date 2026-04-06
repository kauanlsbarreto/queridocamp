import { Payment, PaymentMethod, Preference } from "mercadopago";
import { formatDateForMercadoPago, getMercadoPagoClient, resolveRequestOrigin } from "@/lib/loja-pagamento";

type CheckoutPreferenceParams = {
  request: Request;
  operationCode: string;
  itemId: number;
  itemNome: string;
  amount: number;
  expiresAt: Date;
};

function parseSafeUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isPublicHttps(url: URL) {
  const host = url.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  return url.protocol === "https:" && !isLocal;
}

export function resolveCheckoutProOrigin(request: Request) {
  const fromRequest = resolveRequestOrigin(request);
  const fromSiteEnv = (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "").trim();
  const fromFaceitRedirect = (process.env.NEXT_PUBLIC_FACEIT_REDIRECT_URI || "").trim();

  const candidates = [
    fromSiteEnv,
    fromFaceitRedirect ? parseSafeUrl(fromFaceitRedirect)?.origin || "" : "",
    fromRequest,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const parsed = parseSafeUrl(candidate);
    if (parsed && isPublicHttps(parsed)) {
      return parsed.origin;
    }
  }

  return "";
}

export function getCheckoutProBackUrls(request: Request, operationCode: string) {
  const origin = resolveCheckoutProOrigin(request);
  if (!origin) {
    throw new Error(
      "URL de retorno inválida para Mercado Pago. Configure NEXT_PUBLIC_SITE_URL com um dominio HTTPS publico.",
    );
  }

  return {
    success: `${origin}/loja/pagamento?op=${operationCode}&result=success`,
    failure: `${origin}/loja/pagamento?op=${operationCode}&result=failure`,
    pending: `${origin}/loja/pagamento?op=${operationCode}&result=pending`,
    notification: `${origin}/api/mercadopago/webhooks`,
  };
}

export async function createCheckoutProPreference(params: CheckoutPreferenceParams) {
  const mpClient = getMercadoPagoClient();
  const preferenceClient = new Preference(mpClient);
  const backUrls = getCheckoutProBackUrls(params.request, params.operationCode);

  return preferenceClient.create({
    body: {
      items: [
        {
          id: String(params.itemId),
          title: params.itemNome,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(params.amount),
        },
      ],
      external_reference: params.operationCode,
      back_urls: {
        success: backUrls.success,
        failure: backUrls.failure,
        pending: backUrls.pending,
      },
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
      },
      notification_url: backUrls.notification,
      auto_return: "approved",
      expires: true,
      expiration_date_from: formatDateForMercadoPago(new Date()),
      expiration_date_to: formatDateForMercadoPago(params.expiresAt),
    },
  });
}

export async function getCheckoutProPaymentById(paymentId: string | number) {
  const mpClient = getMercadoPagoClient();
  const paymentClient = new Payment(mpClient);
  return paymentClient.get({ id: Number(paymentId) });
}

export async function getCheckoutProPaymentMethods() {
  const mpClient = getMercadoPagoClient();
  const paymentMethodsClient = new PaymentMethod(mpClient);
  return paymentMethodsClient.get();
}

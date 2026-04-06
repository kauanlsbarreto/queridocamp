import { formatDateForMercadoPago, getMercadoPagoToken, resolveRequestOrigin } from "@/lib/loja-pagamento";

type CheckoutPreferenceParams = {
  request: Request;
  operationCode: string;
  itemId: number;
  itemNome: string;
  amount: number;
  expiresAt: Date;
};

export type MpPreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
  [key: string]: unknown;
};

export type MpPaymentResponse = {
  id: number | null;
  status: string | null;
  status_detail: string | null;
  external_reference: string | null;
  [key: string]: unknown;
};

export type MpPaymentMethodItem = {
  id: string;
  name: string;
  payment_type_id: string;
  status: string;
  site_id?: string;
  [key: string]: unknown;
};

async function mpFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getMercadoPagoToken();
  const res = await fetch(`https://api.mercadopago.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as any)?.message ||
      (data as any)?.error ||
      (data as any)?.cause?.[0]?.description ||
      `Erro Mercado Pago (${res.status})`;
    throw new Error(String(message));
  }

  return data as T;
}

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

export async function createCheckoutProPreference(
  params: CheckoutPreferenceParams,
): Promise<MpPreferenceResponse> {
  const backUrls = getCheckoutProBackUrls(params.request, params.operationCode);

  return mpFetch<MpPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify({
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
    }),
  });
}

export async function getCheckoutProPaymentById(
  paymentId: string | number,
): Promise<MpPaymentResponse> {
  return mpFetch<MpPaymentResponse>(`/v1/payments/${paymentId}`);
}

export type MpMerchantOrderPayment = {
  id: number | null;
  status: string | null;
  status_detail: string | null;
  [key: string]: unknown;
};

export type MpMerchantOrderResponse = {
  id: number | null;
  status: string | null;
  order_status: string | null;
  external_reference: string | null;
  payments: MpMerchantOrderPayment[];
  [key: string]: unknown;
};

export async function getMerchantOrderById(
  orderId: string | number,
): Promise<MpMerchantOrderResponse> {
  return mpFetch<MpMerchantOrderResponse>(`/merchant_orders/${orderId}`);
}

export async function getCheckoutProPaymentMethods(): Promise<MpPaymentMethodItem[]> {
  return mpFetch<MpPaymentMethodItem[]>("/v1/payment_methods");
}

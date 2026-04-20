import {
  ensureBillingColumns,
  formatBillingAddress,
  normalizeBillingProfile,
} from "@/lib/loja-billing";

type LojaPaymentDiscordContext = {
  id: number;
  payment_ref: string;
  provider_type: string;
  provider_id: string | null;
  faceit_guid: string;
  player_id: number;
  player_nickname: string | null;
  player_email: string | null;
  estoque_id: number;
  item_nome: string;
  metodo: string;
  amount_cents: number;
  status: string;
  failure_reason: string | null;
  expires_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  billing_full_name: string | null;
  billing_company_name: string | null;
  billing_cpf_cnpj: string | null;
  billing_street: string | null;
  billing_number: string | null;
  billing_complement: string | null;
  billing_neighborhood: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  billing_phone: string | null;
};

type LojaPaymentDiscordPayload = {
  eventName: string;
  source: string;
  statusBefore?: string | null;
  statusAfter?: string | null;
  providerStatus?: string | null;
  providerData?: any;
  webhookBody?: any;
  payment: LojaPaymentDiscordContext;
};

export type LojaPaymentDiscordSendResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  statusCode?: number;
  error?: string;
};

function getDiscordWebhookUrl() {
  return (
    process.env.LOJA_PAGAMENTO_DISCORD_WEBHOOK_URL?.trim() ||
    process.env.LOJA_WEBHOOK_URL?.trim() ||
    ""
  );
}

function formatCurrencyBRL(amountCents: number) {
  return (Number(amountCents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeStatusLabel(statusRaw: unknown) {
  const status = String(statusRaw || "").toUpperCase();
  if (status === "PAID") return "Pago";
  if (status === "PENDING") return "Pendente";
  if (status === "WAITING") return "Aguardando";
  if (status === "IN_ANALYSIS") return "Em analise";
  if (status === "DECLINED") return "Negado";
  if (status === "CANCELED") return "Cancelado";
  if (status === "EXPIRED") return "Expirado";
  if (status === "FAILED") return "Falhou";
  return status || "Desconhecido";
}

function resolveColor(statusRaw: unknown) {
  const status = String(statusRaw || "").toUpperCase();
  if (status === "PAID") return 0x22c55e;
  if (["PENDING", "WAITING", "IN_ANALYSIS"].includes(status)) return 0xf59e0b;
  if (status === "CANCELED") return 0x6b7280;
  if (status === "EXPIRED") return 0x7c3aed;
  return 0xef4444;
}

function pickFirstString(...values: unknown[]) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function formatPhone(phone: any) {
  if (!phone || typeof phone !== "object") return "";

  const country = pickFirstString(phone.country);
  const area = pickFirstString(phone.area);
  const number = pickFirstString(phone.number);
  const type = pickFirstString(phone.type);

  const base = compactWhitespace(
    [country ? `+${country}` : "", area ? `(${area})` : "", number].filter(Boolean).join(" "),
  );

  if (!base) return "";
  return type ? `${base} [${type}]` : base;
}

function getProviderRoots(providerData: any, webhookBody: any) {
  const baseSources = [providerData, webhookBody].filter(Boolean);
  const roots: any[] = [];

  for (const source of baseSources) {
    roots.push(source);
    if (source?.data && typeof source.data === "object") {
      roots.push(source.data);
    }
  }

  for (const root of [...roots]) {
    if (Array.isArray(root?.orders)) {
      for (const order of root.orders) {
        if (order && typeof order === "object") {
          roots.push(order);
        }
      }
    }
  }

  return roots;
}

function extractProviderPaymentDetails(providerData: any, webhookBody: any) {
  const roots = getProviderRoots(providerData, webhookBody);
  const source = roots[0] || providerData || webhookBody || {};

  let charge = null;
  for (const root of roots) {
    charge =
      (Array.isArray(root?.charges) && root.charges.length > 0 ? root.charges[0] : null) ||
      (Array.isArray(root?.payments) && Array.isArray(root.payments[0]?.charges) && root.payments[0].charges.length > 0
        ? root.payments[0].charges[0]
        : null);

    if (charge) break;
  }

  const paymentMethod = charge?.payment_method || null;
  const card = paymentMethod?.card || null;
  const paymentResponse = charge?.payment_response || null;

  return {
    orderId: pickFirstString(source?.id),
    orderReference: pickFirstString(source?.reference_id),
    chargeId: pickFirstString(charge?.id),
    chargeReference: pickFirstString(charge?.reference_id),
    chargeStatus: pickFirstString(charge?.status),
    chargeDescription: pickFirstString(charge?.description),
    paymentMethodType: pickFirstString(paymentMethod?.type),
    installments: pickFirstString(paymentMethod?.installments),
    capture: typeof paymentMethod?.capture === "boolean" ? (paymentMethod.capture ? "true" : "false") : "",
    cardBrand: pickFirstString(card?.brand),
    cardFirstDigits: pickFirstString(card?.first_digits),
    cardLastDigits: pickFirstString(card?.last_digits),
    cardExpMonth: pickFirstString(card?.exp_month),
    cardExpYear: pickFirstString(card?.exp_year),
    paymentResponseCode: pickFirstString(paymentResponse?.code),
    paymentResponseMessage: pickFirstString(paymentResponse?.message),
    paymentResponseReference: pickFirstString(paymentResponse?.reference),
    paidAt: pickFirstString(charge?.paid_at, source?.paid_at),
    createdAt: pickFirstString(charge?.created_at, source?.created_at),
  };
}

function extractCustomerInfo(payment: LojaPaymentDiscordContext, providerData: any, webhookBody: any) {
  const roots = getProviderRoots(providerData, webhookBody);
  const billingProfile = normalizeBillingProfile(payment);
  const billingAddress = formatBillingAddress(billingProfile);

  let providerCustomer = null;
  let cardHolder = null;
  for (const root of roots) {
    providerCustomer = providerCustomer || root?.customer || null;
    cardHolder =
      cardHolder ||
      root?.charges?.[0]?.payment_method?.card?.holder ||
      root?.payments?.[0]?.charges?.[0]?.payment_method?.card?.holder ||
      null;

    if (providerCustomer && cardHolder) break;
  }

  const name = pickFirstString(
    billingProfile.billing_full_name,
    providerCustomer?.name,
    cardHolder?.name,
    payment.player_nickname,
  );
  const email = pickFirstString(providerCustomer?.email, payment.player_email);
  const taxId = pickFirstString(billingProfile.billing_cpf_cnpj, providerCustomer?.tax_id, cardHolder?.tax_id);
  const phone = pickFirstString(
    billingProfile.billing_phone,
    providerCustomer?.phone,
    Array.isArray(providerCustomer?.phones)
      ? providerCustomer.phones.map((phoneItem: any) => formatPhone(phoneItem)).find(Boolean)
      : "",
  );
  const address = billingAddress || "Nao informado";

  return { name: name || "Nao informado", email: email || "Nao informado", taxId: taxId || "Nao informado", phone: phone || "Nao informado", address };
}

function truncate(value: string, max = 1024) {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

export async function sendLojaPaymentDiscordWebhook(
  payload: LojaPaymentDiscordPayload,
): Promise<LojaPaymentDiscordSendResult> {
  const webhookUrl = getDiscordWebhookUrl();
  if (!webhookUrl) {
    return { sent: false, skipped: true, reason: "DISCORD_WEBHOOK_URL_NAO_CONFIGURADA" };
  }

  const payment = payload.payment;
  const customer = extractCustomerInfo(payment, payload.providerData, payload.webhookBody);
  const providerDetails = extractProviderPaymentDetails(payload.providerData, payload.webhookBody);
  const statusAfter = String(payload.statusAfter || payment.status || "").toUpperCase();
  const statusBefore = String(payload.statusBefore || "").toUpperCase();
  const providerStatus = String(payload.providerStatus || "").toUpperCase();

  const cardSummary = compactWhitespace(
    [
      providerDetails.paymentMethodType,
      providerDetails.cardBrand,
      providerDetails.cardFirstDigits && providerDetails.cardLastDigits
        ? `${providerDetails.cardFirstDigits}******${providerDetails.cardLastDigits}`
        : providerDetails.cardLastDigits
          ? `final ${providerDetails.cardLastDigits}`
          : "",
      providerDetails.installments ? `${providerDetails.installments}x` : "",
      providerDetails.capture ? `capture=${providerDetails.capture}` : "",
      providerDetails.cardExpMonth && providerDetails.cardExpYear
        ? `exp ${providerDetails.cardExpMonth}/${providerDetails.cardExpYear}`
        : "",
    ].filter(Boolean).join(" | "),
  );

  const providerResponseSummary = compactWhitespace(
    [
      providerDetails.paymentResponseCode ? `code=${providerDetails.paymentResponseCode}` : "",
      providerDetails.paymentResponseMessage,
      providerDetails.paymentResponseReference ? `ref=${providerDetails.paymentResponseReference}` : "",
    ].filter(Boolean).join(" | "),
  );

  const providerEntitySummary = truncate(
    [
      providerDetails.orderId ? `Order ID: ${providerDetails.orderId}` : "",
      providerDetails.orderReference ? `Order Ref: ${providerDetails.orderReference}` : "",
      providerDetails.chargeId ? `Charge ID: ${providerDetails.chargeId}` : "",
      providerDetails.chargeReference ? `Charge Ref: ${providerDetails.chargeReference}` : "",
      providerDetails.chargeStatus ? `Charge Status: ${providerDetails.chargeStatus}` : "",
      providerDetails.chargeDescription ? `Descricao: ${providerDetails.chargeDescription}` : "",
    ].filter(Boolean).join("\n"),
  );

  const timelineSummary = truncate(
    [
      providerDetails.createdAt ? `Criado PagBank: ${providerDetails.createdAt}` : "",
      providerDetails.paidAt ? `Pago PagBank: ${providerDetails.paidAt}` : "",
      payment.created_at ? `Criado local: ${payment.created_at}` : "",
      payment.expires_at ? `Expira local: ${payment.expires_at}` : "",
      payment.paid_at ? `Pago local: ${payment.paid_at}` : "",
    ].filter(Boolean).join("\n"),
  );

  const embed = {
    title: `Pagamento Loja: ${normalizeStatusLabel(statusAfter)}`,
    description: truncate(
      [
        `Evento: ${payload.eventName}`,
        `Origem: ${payload.source}`,
        providerStatus ? `Status PagBank: ${providerStatus}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      4096,
    ),
    color: resolveColor(statusAfter),
    timestamp: new Date().toISOString(),
    fields: [
      {
        name: "Pagamento",
        value: truncate(
          [
            `#${payment.id}`,
            payment.payment_ref || "-",
            payment.metodo || "-",
            formatCurrencyBRL(payment.amount_cents),
          ].join(" | "),
        ),
        inline: false,
      },
      {
        name: "Status",
        value: truncate(
          [
            `Anterior: ${statusBefore ? normalizeStatusLabel(statusBefore) : "-"}`,
            `Atual: ${normalizeStatusLabel(statusAfter)}`,
            providerStatus ? `PagBank: ${providerStatus}` : "",
          ].filter(Boolean).join("\n"),
        ),
        inline: true,
      },
      {
        name: "Jogador / Item",
        value: truncate(
          [
            `Jogador: ${payment.player_nickname || "-"}`,
            `Faceit GUID: ${payment.faceit_guid || "-"}`,
            `Player ID: ${String(payment.player_id || 0)}`,
            `Item: ${payment.item_nome || "-"}`,
            `Item ID: ${String(payment.estoque_id || 0)}`,
          ].join("\n"),
        ),
        inline: true,
      },
      {
        name: "Cliente",
        value: truncate(
          [
            `Nome: ${customer.name}`,
            `Email: ${customer.email}`,
            `Documento: ${customer.taxId}`,
            `Telefone: ${customer.phone}`,
          ].join("\n"),
        ),
        inline: false,
      },
      { name: "Endereco", value: truncate(customer.address), inline: false },
      {
        name: "PagBank",
        value: providerEntitySummary || `${payment.provider_type || "-"}\n${payment.provider_id || "-"}`,
        inline: false,
      },
      {
        name: "Cartao / Metodo",
        value: cardSummary || "Nao informado",
        inline: false,
      },
      {
        name: "Resposta PagBank",
        value: providerResponseSummary || "Nao informado",
        inline: false,
      },
      {
        name: "Datas",
        value: timelineSummary || "Nao informado",
        inline: false,
      },
      {
        name: "Falha / motivo",
        value: truncate(payment.failure_reason || pickFirstString(payload.providerData?.message, payload.webhookBody?.message, "-")),
        inline: false,
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Loja PagBank",
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[loja-payment-discord] webhook Discord retornou erro:", response.status, errorText);
      return {
        sent: false,
        statusCode: response.status,
        error: errorText || "Resposta nao-OK do Discord webhook.",
      };
    }

    return { sent: true, statusCode: response.status };
  } catch (error) {
    console.error("[loja-payment-discord] erro ao enviar webhook:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar webhook Discord.",
    };
  }
}

export async function loadLojaPaymentDiscordContext(connection: any, paymentId: number) {
  await ensureBillingColumns(connection);

  const [rows] = await connection.query(
    `SELECT lp.id, lp.payment_ref, lp.provider_type, lp.provider_id, lp.faceit_guid, lp.player_id,
            lp.estoque_id, lp.item_nome, lp.metodo, lp.amount_cents, lp.status, lp.failure_reason,
            lp.expires_at, lp.paid_at, lp.created_at, lp.updated_at,
                 p.nickname AS player_nickname, p.email AS player_email,
                 p.billing_full_name, p.billing_company_name, p.billing_cpf_cnpj, p.billing_street,
                 p.billing_number, p.billing_complement, p.billing_neighborhood, p.billing_city,
                 p.billing_state, p.billing_postal_code, p.billing_country, p.billing_phone
     FROM loja_pagamentos lp
     LEFT JOIN players p ON p.id = lp.player_id
     WHERE lp.id = ?
     LIMIT 1`,
    [paymentId],
  );

  const payments = rows as LojaPaymentDiscordContext[];
  return payments[0] || null;
}
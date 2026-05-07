import { formatBillingAddress, normalizeBillingProfile } from "@/lib/loja-billing";

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const BREVO_RECIPIENTS = ["kauanlsbarreto@gmail.com", "queridocamp@gmail.com"] as const;
const BREVO_SENDER_NAME = "Querido Camp";
const BREVO_SENDER_EMAIL = "kauan@queridocamp.com.br";

export type LojaBrevoEmailPayload = {
  purchaseType: "POINTS_PURCHASE" | "PAID_ORDER";
  completedAt?: string | null;
  purchaseId?: number | null;
  paymentId?: number | null;
  paymentRef?: string | null;
  providerId?: string | null;
  paymentMethod?: string | null;
  faceitGuid: string;
  playerId: number;
  playerNickname: string | null;
  playerEmail: string | null;
  itemId: number;
  itemName: string;
  itemCategory?: string | null;
  itemType?: string | null;
  amountCents?: number | null;
  pointsCost?: number | null;
  pointsBefore?: number | null;
  pointsAfter?: number | null;
  stockBefore?: number | null;
  stockAfter?: number | null;
  labelText?: string | null;
  imageUrl?: string | null;
  billingProfile?: Record<string, unknown> | null;
  requestUrl?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type LojaBrevoEmailResult = {
  sent: boolean;
  skipped?: boolean;
  reason?: string;
  statusCode?: number;
  error?: string;
};

function resolveBrevoApiKey(env?: any) {
  return String(
    process.env.API_BREVO || process.env.BREVO_API_KEY || env?.API_BREVO || env?.BREVO_API_KEY || "",
  ).trim();
}

function formatCurrencyBRLFromCents(amountCents: number | null | undefined) {
  return (Number(amountCents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeText(value: unknown, fallback = "Nao informado") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

function formatDate(value: string | null | undefined) {
  const raw = String(value || "").trim();
  if (!raw) return "Nao informado";

  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return raw;
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function buildSections(payload: LojaBrevoEmailPayload) {
  const billingProfile = normalizeBillingProfile(payload.billingProfile || {});
  const billingAddress = formatBillingAddress(billingProfile);
  const amountLabel = payload.amountCents && payload.amountCents > 0
    ? formatCurrencyBRLFromCents(payload.amountCents)
    : "Nao informado";
  const pointsLabel = payload.pointsCost && payload.pointsCost > 0 ? String(payload.pointsCost) : "Nao informado";

  return [
    {
      title: "Resumo da compra",
      lines: [
        `Tipo: ${payload.purchaseType === "PAID_ORDER" ? "Pagamento confirmado" : "Compra com moedas"}`,
        `Concluida em: ${formatDate(payload.completedAt)}`,
        `ID da compra: ${normalizeText(payload.purchaseId, "Nao se aplica")}`,
        `ID do pagamento: ${normalizeText(payload.paymentId, "Nao se aplica")}`,
        `Referencia do pagamento: ${normalizeText(payload.paymentRef, "Nao se aplica")}`,
        `Provider ID: ${normalizeText(payload.providerId, "Nao se aplica")}`,
        `Metodo: ${normalizeText(payload.paymentMethod, "Nao informado")}`,
      ],
    },
    {
      title: "Item",
      lines: [
        `Nome: ${normalizeText(payload.itemName)}`,
        `Item ID: ${String(payload.itemId || 0)}`,
        `Categoria: ${normalizeText(payload.itemCategory, "Nao informada")}`,
        `Tipo: ${normalizeText(payload.itemType, "Nao informado")}`,
        `Label: ${normalizeText(payload.labelText, "Nao informada")}`,
        `Imagem: ${normalizeText(payload.imageUrl, "Nao informada")}`,
      ],
    },
    {
      title: "Valores",
      lines: [
        `Valor em BRL: ${amountLabel}`,
        `Custo em moedas: ${pointsLabel}`,
        `Pontos antes: ${normalizeText(payload.pointsBefore, "Nao se aplica")}`,
        `Pontos depois: ${normalizeText(payload.pointsAfter, "Nao se aplica")}`,
        `Estoque antes: ${normalizeText(payload.stockBefore, "Nao informado")}`,
        `Estoque depois: ${normalizeText(payload.stockAfter, "Nao informado")}`,
      ],
    },
    {
      title: "Cliente",
      lines: [
        `Jogador: ${normalizeText(payload.playerNickname)}`,
        `Player ID: ${String(payload.playerId || 0)}`,
        `Faceit GUID: ${normalizeText(payload.faceitGuid)}`,
        `Email: ${normalizeText(payload.playerEmail)}`,
        `Nome de cobranca: ${normalizeText(billingProfile.billing_full_name)}`,
        `Documento: ${normalizeText(billingProfile.billing_cpf_cnpj)}`,
        `Telefone: ${normalizeText(billingProfile.billing_phone)}`,
      ],
    },
    {
      title: "Endereco",
      lines: billingAddress.split("\n").map((line) => normalizeText(line)),
    },
    {
      title: "Origem",
      lines: [
        `URL: ${normalizeText(payload.requestUrl)}`,
        `IP: ${normalizeText(payload.ip)}`,
        `User-Agent: ${normalizeText(payload.userAgent)}`,
      ],
    },
  ];
}

function buildTextContent(payload: LojaBrevoEmailPayload) {
  const billingProfile = normalizeBillingProfile(payload.billingProfile || {});
  const billingAddress = formatBillingAddress(billingProfile);
  const heading = payload.purchaseType === "PAID_ORDER" ? "Pagamento confirmado" : "Compra com moedas";

  return [
    `Querido Camp - ${heading}`,
    `Item: ${normalizeText(payload.itemName)} | Categoria: ${normalizeText(payload.itemCategory, "Nao informada")} | Tipo: ${normalizeText(payload.itemType, "Nao informado")}`,
    `Pagamento: ${normalizeText(payload.paymentMethod, "Nao informado")} | Valor: ${payload.amountCents && payload.amountCents > 0 ? formatCurrencyBRLFromCents(payload.amountCents) : "Nao informado"} | Moedas: ${payload.pointsCost && payload.pointsCost > 0 ? payload.pointsCost : "Nao informado"}`,
    `Cliente: ${normalizeText(payload.playerNickname)} | Email: ${normalizeText(payload.playerEmail)} | Faceit GUID: ${normalizeText(payload.faceitGuid)}`,
    `Cobranca: ${normalizeText(billingProfile.billing_full_name)} | Documento: ${normalizeText(billingProfile.billing_cpf_cnpj)} | Telefone: ${normalizeText(billingProfile.billing_phone)}`,
    `Endereco: ${billingAddress.replace(/\n/g, " | ")}`,
    `IDs: compra=${normalizeText(payload.purchaseId, "Nao se aplica")} | pagamento=${normalizeText(payload.paymentId, "Nao se aplica")} | ref=${normalizeText(payload.paymentRef, "Nao se aplica")} | provider=${normalizeText(payload.providerId, "Nao se aplica")}`,
    `Estoque: ${normalizeText(payload.stockBefore, "Nao informado")} -> ${normalizeText(payload.stockAfter, "Nao informado")} | Pontos: ${normalizeText(payload.pointsBefore, "Nao se aplica")} -> ${normalizeText(payload.pointsAfter, "Nao se aplica")}`,
    `Concluida em: ${formatDate(payload.completedAt)}`,
    `Origem: ${normalizeText(payload.requestUrl)} | IP: ${normalizeText(payload.ip)} | User-Agent: ${normalizeText(payload.userAgent)}`,
  ].join("\n");
}

function buildInfoTable(title: string, rows: Array<[string, string]>) {
  return `
    <div style="padding:14px 16px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02);">
      <div style="margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#f5d08a;font-weight:700;">${escapeHtml(title)}</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="width:34%;padding:4px 8px 4px 0;vertical-align:top;font-size:12px;color:#8f99ad;">${escapeHtml(label)}</td>
                <td style="padding:4px 0;vertical-align:top;font-size:13px;color:#e5e7eb;word-break:break-word;">${escapeHtml(value)}</td>
              </tr>
            `,
          )
          .join("")}
      </table>
    </div>
  `;
}

function buildHtmlContent(payload: LojaBrevoEmailPayload) {
  const heading = payload.purchaseType === "PAID_ORDER" ? "Pagamento confirmado" : "Compra com moedas concluida";
  const billingProfile = normalizeBillingProfile(payload.billingProfile || {});
  const amountLabel = payload.amountCents && payload.amountCents > 0
    ? formatCurrencyBRLFromCents(payload.amountCents)
    : "Nao informado";
  const pointsLabel = payload.pointsCost && payload.pointsCost > 0 ? String(payload.pointsCost) : "Nao informado";
  const addressLabel = formatBillingAddress(billingProfile).replace(/\n/g, " | ");
  const itemSummary = `${normalizeText(payload.itemName)}${payload.itemCategory ? ` • ${normalizeText(payload.itemCategory)}` : ""}${payload.itemType ? ` • ${normalizeText(payload.itemType)}` : ""}`;

  return `
    <div style="background:#050505;padding:18px;font-family:Arial,sans-serif;color:#e5e7eb;line-height:1.4;">
      <div style="max-width:760px;margin:0 auto;background:#0b1220;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:18px;">
        <p style="margin:0 0 6px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#d4a14e;">Querido Camp</p>
        <h1 style="margin:0 0 8px;font-size:24px;line-height:1.15;color:#ffffff;">${escapeHtml(heading)}</h1>
        <p style="margin:0 0 14px;font-size:13px;color:#b7c0d1;">${escapeHtml(itemSummary)}</p>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;">
          ${buildInfoTable("Compra", [
            ["Concluida em", formatDate(payload.completedAt)],
            ["Metodo", normalizeText(payload.paymentMethod, "Nao informado")],
            ["Valor", amountLabel],
            ["Moedas", pointsLabel],
            ["Compra ID", normalizeText(payload.purchaseId, "Nao se aplica")],
            ["Pagamento ID", normalizeText(payload.paymentId, "Nao se aplica")],
          ])}
          ${buildInfoTable("Cliente", [
            ["Jogador", normalizeText(payload.playerNickname)],
            ["Email", normalizeText(payload.playerEmail)],
            ["Faceit GUID", normalizeText(payload.faceitGuid)],
            ["Nome cobranca", normalizeText(billingProfile.billing_full_name)],
            ["Documento", normalizeText(billingProfile.billing_cpf_cnpj)],
            ["Telefone", normalizeText(billingProfile.billing_phone)],
          ])}
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px;">
          ${buildInfoTable("Item", [
            ["Nome", normalizeText(payload.itemName)],
            ["Item ID", String(payload.itemId || 0)],
            ["Categoria", normalizeText(payload.itemCategory, "Nao informada")],
            ["Tipo", normalizeText(payload.itemType, "Nao informado")],
            ["Label", normalizeText(payload.labelText, "Nao informada")],
            ["Imagem", normalizeText(payload.imageUrl, "Nao informada")],
          ])}
          ${buildInfoTable("Controle", [
            ["Ref. pagamento", normalizeText(payload.paymentRef, "Nao se aplica")],
            ["Provider ID", normalizeText(payload.providerId, "Nao se aplica")],
            ["Estoque", `${normalizeText(payload.stockBefore, "Nao informado")} -> ${normalizeText(payload.stockAfter, "Nao informado")}`],
            ["Pontos", `${normalizeText(payload.pointsBefore, "Nao se aplica")} -> ${normalizeText(payload.pointsAfter, "Nao se aplica")}`],
            ["IP", normalizeText(payload.ip)],
            ["URL", normalizeText(payload.requestUrl)],
          ])}
        </div>

        <div style="margin-top:12px;padding:14px 16px;border:1px solid rgba(255,255,255,0.08);border-radius:14px;background:rgba(255,255,255,0.02);">
          <div style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#f5d08a;font-weight:700;">Endereco</div>
          <div style="font-size:13px;color:#e5e7eb;word-break:break-word;">${escapeHtml(addressLabel)}</div>
        </div>
      </div>
    </div>
  `;
}

export async function sendLojaPurchaseBrevoEmail(
  payload: LojaBrevoEmailPayload,
  env?: any,
): Promise<LojaBrevoEmailResult> {
  const apiKey = resolveBrevoApiKey(env);
  if (!apiKey) {
    return { sent: false, skipped: true, reason: "BREVO_API_KEY_NAO_CONFIGURADA" };
  }

  const subject =
    payload.purchaseType === "PAID_ORDER"
      ? `Loja: pagamento confirmado - ${payload.itemName}`
      : `Loja: compra com moedas - ${payload.itemName}`;

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: BREVO_SENDER_NAME,
          email: BREVO_SENDER_EMAIL,
        },
        to: BREVO_RECIPIENTS.map((email) => ({ email })),
        subject,
        htmlContent: buildHtmlContent(payload),
        textContent: buildTextContent(payload),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.error("[loja-brevo-email] resposta Brevo nao-OK:", response.status, errorText);
      return {
        sent: false,
        statusCode: response.status,
        error: errorText || "Resposta nao-OK da Brevo.",
      };
    }

    return { sent: true, statusCode: response.status };
  } catch (error) {
    console.error("[loja-brevo-email] erro ao enviar email:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Erro desconhecido ao enviar email Brevo.",
    };
  }
}
const DISCORD_WEBHOOK_URL =
  process.env.LOJA_WEBHOOK_URL ||
  "https://discord.com/api/webhooks/1490435749433184309/eb3HbnWTPEAdCwcVnIG0fLYlkW0HYYKsEEh47C7__2gjR-kO00aCoUJbt9KwPK-J3ab6";

export type StorePurchaseWebhookPayload = {
  purchaseId: number | string;
  faceitGuid: string;
  playerId: number;
  playerNickname: string;
  playerAvatar: string;
  playerAdmin: number;
  storeSection?: string;
  purchaseChannel?: string;
  itemId: number;
  itemName: string;
  itemCategory: string;
  itemType: string;
  itemPreco: number;
  itemMoedas: number;
  estoqueBefore: number;
  estoqueAfter: number;
  requiredPoints: number;
  pointsBefore: number;
  pointsAfter: number;
  labelText: string;
  imageUrl: string;
  imageName: string;
  imageSizeBytes: number;
  imageMimeType: string;
  requestUrl: string;
  method: string;
  ip: string;
  userAgent: string;
  referer: string;
};

export async function sendStorePurchaseWebhook(
  payload: StorePurchaseWebhookPayload
): Promise<{ sent: boolean; reason?: string; error?: string }> {
  if (!DISCORD_WEBHOOK_URL) return { sent: false, reason: "DISCORD_WEBHOOK_URL não configurada." };

  const purchaseAt = new Date().toISOString();
  const color = 0xf1c40f;

  const body = {
    username: "Loja Querido Camp",
    avatar_url: payload.playerAvatar || undefined,
    embeds: [
      {
        title: "Nova Compra na Loja",
        description: "Compra concluida com sucesso.",
        color,
        timestamp: purchaseAt,
        image: payload.imageUrl ? { url: payload.imageUrl } : undefined,
        fields: [
          { name: "Compra ID", value: String(payload.purchaseId), inline: true },
          { name: "Item ID", value: String(payload.itemId), inline: true },
          { name: "Jogador ID", value: String(payload.playerId), inline: true },

          { name: "Nickname", value: payload.playerNickname || "-", inline: true },
          { name: "Faceit GUID", value: payload.faceitGuid || "-", inline: false },
          { name: "Admin", value: String(payload.playerAdmin ?? 0), inline: true },

          { name: "Item", value: payload.itemName || "-", inline: true },
          { name: "Categoria", value: payload.itemCategory || "-", inline: true },
          { name: "Tipo", value: payload.itemType || "-", inline: true },
          { name: "Área", value: payload.storeSection || "-", inline: true },
          { name: "Canal", value: payload.purchaseChannel || "-", inline: true },

          { name: "Preco (R$)", value: `R$ ${Number(payload.itemPreco || 0).toFixed(2)}`, inline: true },
          { name: "Custo em Moedas", value: String(payload.itemMoedas || 0), inline: true },
          { name: "Pontos Debitados", value: String(payload.requiredPoints || 0), inline: true },

          { name: "Pontos Antes", value: String(payload.pointsBefore || 0), inline: true },
          { name: "Pontos Depois", value: String(payload.pointsAfter || 0), inline: true },
          { name: "Estoque", value: `${payload.estoqueBefore} -> ${payload.estoqueAfter}`, inline: true },

          { name: "Label", value: payload.labelText || "-", inline: false },
          { name: "Imagem URL", value: payload.imageUrl || "-", inline: false },
          {
            name: "Arquivo",
            value: `${payload.imageName || "-"} (${payload.imageMimeType || "-"}) - ${payload.imageSizeBytes || 0} bytes`,
            inline: false,
          },

          { name: "Metodo", value: payload.method || "-", inline: true },
          { name: "IP", value: payload.ip || "-", inline: true },
          { name: "Referer", value: payload.referer || "-", inline: false },
          { name: "User-Agent", value: payload.userAgent || "-", inline: false },
          { name: "Request URL", value: payload.requestUrl || "-", inline: false },
        ],
      },
    ],
  };

  const response = await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return { sent: false, error: `Discord webhook retornou ${response.status}: ${errorText}` };
  }

  return { sent: true };
}
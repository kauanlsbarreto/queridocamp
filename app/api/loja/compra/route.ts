import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "d87758a650d73e3186b89678a20b237f";
const DISCORD_WEBHOOK_URL =
  process.env.LOJA_WEBHOOK_URL ||
  "https://discord.com/api/webhooks/1490435749433184309/eb3HbnWTPEAdCwcVnIG0fLYlkW0HYYKsEEh47C7__2gjR-kO00aCoUJbt9KwPK-J3ab6";
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

async function ensurePurchasesTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS loja_compras (
      id INT AUTO_INCREMENT PRIMARY KEY,
      player_id INT NOT NULL,
      faceit_guid VARCHAR(255) NOT NULL,
      estoque_id INT NOT NULL,
      item_nome VARCHAR(255) NOT NULL,
      label_text VARCHAR(255) NOT NULL,
      image_url TEXT NOT NULL,
      points_cost INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_loja_compras_player (player_id),
      INDEX idx_loja_compras_faceit (faceit_guid),
      INDEX idx_loja_compras_estoque (estoque_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

function fileToBase64(buffer: ArrayBuffer) {
  return Buffer.from(buffer).toString("base64");
}

async function uploadToImgbb(file: File, labelText: string) {
  const buffer = await file.arrayBuffer();
  const imageBase64 = fileToBase64(buffer);

  const form = new FormData();
  form.append("image", imageBase64);
  form.append("name", labelText.slice(0, 100));

  const uploadUrl = `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success || !data?.data?.url) {
    throw new Error(data?.error?.message || "Falha ao enviar imagem para ImgBB.");
  }

  return String(data.data.url);
}

async function sendPurchaseWebhook(payload: {
  purchaseId: number;
  faceitGuid: string;
  playerId: number;
  playerNickname: string;
  playerAvatar: string;
  playerAdmin: number;
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
}) {
  if (!DISCORD_WEBHOOK_URL) return;

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
        image: { url: payload.imageUrl },
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

  await fetch(DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function POST(request: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensurePurchasesTable(connection);

    const formData = await request.formData();
    const itemId = Number(formData.get("item_id") || 0);
    const faceitGuid = String(formData.get("faceit_guid") || "").trim();
    const labelText = String(formData.get("label") || "").trim();
    const image = formData.get("image");

    if (!faceitGuid) {
      return NextResponse.json({ message: "Você precisa estar logado na Faceit para comprar." }, { status: 401 });
    }

    if (!Number.isFinite(itemId) || itemId <= 0) {
      return NextResponse.json({ message: "Item inválido." }, { status: 400 });
    }

    if (!labelText) {
      return NextResponse.json({ message: "A label é obrigatória." }, { status: 400 });
    }

    if (!(image instanceof File)) {
      return NextResponse.json({ message: "Imagem obrigatória." }, { status: 400 });
    }

    if (image.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ message: "A imagem deve ter no máximo 25MB." }, { status: 400 });
    }

    const contentType = image.type.toLowerCase();
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({ message: "Formato inválido. Use PNG, JPG ou JPEG." }, { status: 400 });
    }

    const [playerRows] = await connection.query(
      "SELECT id, nickname, avatar, admin, points FROM players WHERE faceit_guid = ? LIMIT 1",
      [faceitGuid],
    );
    const players = playerRows as Array<{
      id: number;
      nickname: string | null;
      avatar: string | null;
      admin: number | null;
      points: number | null;
    }>;

    if (!players.length) {
      return NextResponse.json({ message: "Jogador não encontrado." }, { status: 404 });
    }

    const playerId = Number(players[0].id);
    const playerNickname = String(players[0].nickname || "");
    const playerAvatar = String(players[0].avatar || "");
    const playerAdmin = Number(players[0].admin || 0);
    const currentPoints = Number(players[0].points || 0);

    const [itemRows] = await connection.query(
      "SELECT id, nome, preco, moedas, estoque, ativo, categoria, tipo_item FROM estoque WHERE id = ? LIMIT 1",
      [itemId],
    );
    const items = itemRows as Array<{
      id: number;
      nome: string;
      preco: number;
      moedas: number;
      estoque: number;
      ativo: number;
      categoria: string | null;
      tipo_item: string | null;
    }>;

    if (!items.length || items[0].ativo !== 1) {
      return NextResponse.json({ message: "Item não disponível para compra." }, { status: 404 });
    }

    const item = items[0];
    const estoqueBefore = Number(item.estoque || 0);
    if (Number(item.estoque || 0) <= 0) {
      return NextResponse.json({ message: "Item sem estoque." }, { status: 400 });
    }

    // Regra solicitada: item id 1 depende de pontos do perfil
    if (item.id !== 1) {
      return NextResponse.json({ message: "Compra disponível apenas para o item ID 1 no momento." }, { status: 400 });
    }

    const requiredPoints = Number(item.moedas || 0);
    if (requiredPoints <= 0) {
      return NextResponse.json({ message: "Item sem valor em pontos configurado." }, { status: 400 });
    }

    if (currentPoints < requiredPoints) {
      return NextResponse.json(
        {
          message: `Pontos insuficientes. Você tem ${currentPoints} e precisa de ${requiredPoints}.`,
          points: currentPoints,
          required: requiredPoints,
        },
        { status: 400 },
      );
    }

    const uploadedImageUrl = await uploadToImgbb(image, labelText);

    const newPoints = currentPoints - requiredPoints;
    const estoqueAfter = Math.max(0, estoqueBefore - 1);

    await connection.query("UPDATE players SET points = ? WHERE id = ?", [newPoints, playerId]);
    await connection.query("UPDATE estoque SET estoque = estoque - 1 WHERE id = ? AND estoque > 0", [item.id]);
    const insertResultRaw = await connection.query(
      `INSERT INTO loja_compras (player_id, faceit_guid, estoque_id, item_nome, label_text, image_url, points_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [playerId, faceitGuid, item.id, item.nome, labelText, uploadedImageUrl, requiredPoints],
    );
    const insertResult = insertResultRaw as any;
    const purchaseId = Number(insertResult?.[0]?.insertId || 0);

    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "";
    const userAgent = request.headers.get("user-agent") || "";
    const referer = request.headers.get("referer") || "";

    try {
      await sendPurchaseWebhook({
        purchaseId,
        faceitGuid,
        playerId,
        playerNickname,
        playerAvatar,
        playerAdmin,
        itemId: item.id,
        itemName: item.nome,
        itemCategory: String(item.categoria || ""),
        itemType: String(item.tipo_item || ""),
        itemPreco: Number(item.preco || 0),
        itemMoedas: Number(item.moedas || 0),
        estoqueBefore,
        estoqueAfter,
        requiredPoints,
        pointsBefore: currentPoints,
        pointsAfter: newPoints,
        labelText,
        imageUrl: uploadedImageUrl,
        imageName: image.name || "",
        imageSizeBytes: image.size || 0,
        imageMimeType: image.type || "",
        requestUrl: request.url,
        method: request.method,
        ip,
        userAgent,
        referer,
      });
    } catch (webhookError) {
      console.error("Falha ao enviar webhook de compra da loja:", webhookError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Compra realizada com sucesso.",
        points: newPoints,
        required: requiredPoints,
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

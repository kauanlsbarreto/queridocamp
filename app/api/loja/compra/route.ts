import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { createMainConnection } from "@/lib/db";
import { ensureBillingColumns } from "@/lib/loja-billing";
import { sendLojaPurchaseBrevoEmail } from "@/lib/loja-brevo-email";
import { sendStorePurchaseWebhook } from "@/lib/loja-purchase-webhook";

export const dynamic = "force-dynamic";

const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "d87758a650d73e3186b89678a20b237f";
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

function normalizeStorePath(raw: string | null | undefined) {
  const value = String(raw || "").trim().replace(/\\/g, "/");
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  let normalized = value;
  if (normalized.toLowerCase().startsWith("public/")) {
    normalized = normalized.slice("public".length);
  }
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

function resolvePrimaryStoreImage(raw: string | null | undefined) {
  const value = String(raw || "").trim();
  if (!value) return "";

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        const normalized = normalizeStorePath(typeof entry === "string" ? entry : "");
        if (normalized) {
          return normalized;
        }
      }
      return "";
    }
  } catch {
  }

  return normalizeStorePath(value);
}

function isWallpaperCategory(category: string | null | undefined) {
  return String(category || "").trim().toLowerCase() === "wallpaper";
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

export async function POST(request: Request) {
  let connection: any;
  try {
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);

    await ensurePurchasesTable(connection);
    await ensureBillingColumns(connection);

    const contentType = request.headers.get("content-type") || "";
    const isJsonRequest = contentType.includes("application/json");
    const body = isJsonRequest ? await request.json().catch(() => ({})) : null;
    const formData = !isJsonRequest ? await request.formData() : null;
    const itemId = Number((isJsonRequest ? (body as any)?.item_id : formData?.get("item_id")) || 0);
    const faceitGuid = String((isJsonRequest ? (body as any)?.faceit_guid : formData?.get("faceit_guid")) || "").trim();
    const labelText = String((isJsonRequest ? (body as any)?.label : formData?.get("label")) || "").trim();
    const image = isJsonRequest ? null : formData?.get("image");

    if (!faceitGuid) {
      return NextResponse.json({ message: "Você precisa estar logado na Faceit para comprar." }, { status: 401 });
    }

    if (!Number.isFinite(itemId) || itemId <= 0) {
      return NextResponse.json({ message: "Item inválido." }, { status: 400 });
    }

    const [playerRows] = await connection.query(
      `SELECT id, nickname, avatar, admin, points, email,
              billing_full_name, billing_company_name, billing_cpf_cnpj, billing_street,
              billing_number, billing_complement, billing_neighborhood, billing_city,
              billing_state, billing_postal_code, billing_country, billing_phone
       FROM players
       WHERE faceit_guid = ?
       LIMIT 1`,
      [faceitGuid],
    );
    const players = playerRows as Array<{
      id: number;
      nickname: string | null;
      avatar: string | null;
      admin: number | null;
      points: number | null;
      email: string | null;
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
    }>;

    if (!players.length) {
      return NextResponse.json({ message: "Jogador não encontrado." }, { status: 404 });
    }

    const playerId = Number(players[0].id);
    const playerNickname = String(players[0].nickname || "");
    const playerEmail = String(players[0].email || "");
    const playerAvatar = String(players[0].avatar || "");
    const playerAdmin = Number(players[0].admin || 0);
    const currentPoints = Number(players[0].points || 0);

    if (!playerEmail.trim()) {
      return NextResponse.json(
        { message: "Voce precisa cadastrar um email antes de realizar a compra." },
        { status: 400 },
      );
    }

    const [itemRows] = await connection.query(
      "SELECT id, nome, preco, moedas, estoque, ativo, categoria, tipo_item, imagem_url FROM estoque WHERE id = ? LIMIT 1",
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
      imagem_url: string | null;
    }>;

    if (!items.length || items[0].ativo !== 1) {
      return NextResponse.json({ message: "Item não disponível para compra." }, { status: 404 });
    }

    const item = items[0];
    const isWallpaper = isWallpaperCategory(item.categoria);
    const estoqueBefore = Number(item.estoque || 0);
    if (Number(item.estoque || 0) <= 0) {
      return NextResponse.json({ message: "Item sem estoque." }, { status: 400 });
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

    let finalLabelText = labelText;
    let finalImageUrl = "";

    if (isWallpaper) {
      finalImageUrl = resolvePrimaryStoreImage(item.imagem_url);
      if (!finalImageUrl) {
        return NextResponse.json({ message: "Wallpaper sem imagem configurada." }, { status: 400 });
      }
      finalLabelText = finalLabelText || item.nome;
    } else {
      if (!finalLabelText) {
        return NextResponse.json({ message: "A label é obrigatória." }, { status: 400 });
      }

      if (!(image instanceof File)) {
        return NextResponse.json({ message: "Imagem obrigatória." }, { status: 400 });
      }

      if (image.size > MAX_IMAGE_SIZE) {
        return NextResponse.json({ message: "A imagem deve ter no máximo 25MB." }, { status: 400 });
      }

      const allowedTypes = ["image/png", "image/jpeg", "image/jpg"];
      const imageContentType = image.type.toLowerCase();
      if (!allowedTypes.includes(imageContentType)) {
        return NextResponse.json({ message: "Formato inválido. Use PNG, JPG ou JPEG." }, { status: 400 });
      }

      finalImageUrl = await uploadToImgbb(image, finalLabelText);
    }

    const newPoints = currentPoints - requiredPoints;
    const estoqueAfter = Math.max(0, estoqueBefore - 1);

    await connection.query("UPDATE players SET points = ? WHERE id = ?", [newPoints, playerId]);
    if (isWallpaper) {
      await connection.query("UPDATE players SET fundoperfil = ? WHERE id = ?", [finalImageUrl, playerId]);
    }
    await connection.query("UPDATE estoque SET estoque = estoque - 1 WHERE id = ? AND estoque > 0", [item.id]);
    let purchaseId = 0;
    if (!isWallpaper) {
      const insertResultRaw = await connection.query(
        `INSERT INTO loja_compras (player_id, faceit_guid, estoque_id, item_nome, label_text, image_url, points_cost)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [playerId, faceitGuid, item.id, item.nome, finalLabelText, finalImageUrl, requiredPoints],
      );
      const insertResult = insertResultRaw as any;
      purchaseId = Number(insertResult?.[0]?.insertId || 0);
    }

    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "";
    const userAgent = request.headers.get("user-agent") || "";
    const referer = request.headers.get("referer") || "";

    try {
      await sendStorePurchaseWebhook({
        purchaseId,
        faceitGuid,
        playerId,
        playerNickname,
        playerAvatar,
        playerAdmin,
        storeSection: "Perfil",
        purchaseChannel: "Moedas",
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
        labelText: finalLabelText,
        imageUrl: finalImageUrl,
        imageName: image instanceof File ? image.name || "" : item.nome,
        imageSizeBytes: image instanceof File ? image.size || 0 : 0,
        imageMimeType: image instanceof File ? image.type || "" : "wallpaper/path",
        requestUrl: request.url,
        method: request.method,
        ip,
        userAgent,
        referer,
      });
    } catch (webhookError) {
      console.error("Falha ao enviar webhook de compra da loja:", webhookError);
    }

    try {
      const emailResult = await sendLojaPurchaseBrevoEmail(
        {
          purchaseType: "POINTS_PURCHASE",
          completedAt: new Date().toISOString(),
          purchaseId,
          faceitGuid,
          playerId,
          playerNickname,
          playerEmail,
          itemId: item.id,
          itemName: item.nome,
          itemCategory: item.categoria,
          itemType: item.tipo_item,
          amountCents: Number(item.preco || 0) > 0 ? Math.round(Number(item.preco) * 100) : 0,
          pointsCost: requiredPoints,
          pointsBefore: currentPoints,
          pointsAfter: newPoints,
          stockBefore: estoqueBefore,
          stockAfter: estoqueAfter,
          labelText: finalLabelText,
          imageUrl: finalImageUrl,
          billingProfile: players[0],
          requestUrl: request.url,
          ip,
          userAgent,
        },
        env,
      );

      if (!emailResult.sent && !emailResult.skipped) {
        console.error("Falha ao enviar email Brevo da compra da loja:", emailResult.error || emailResult.reason);
      }
    } catch (emailError) {
      console.error("Erro inesperado ao enviar email Brevo da compra da loja:", emailError);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Compra realizada com sucesso.",
        points: newPoints,
        required: requiredPoints,
        fundoperfil: isWallpaper ? finalImageUrl : undefined,
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

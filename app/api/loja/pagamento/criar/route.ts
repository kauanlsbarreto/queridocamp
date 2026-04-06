import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import {
  computeExpiresAt,
  ensurePricePaymentsTable,
  finalizeOperationWithStockPolicy,
  generateOperationCode,
  readOperationByCode,
} from "@/lib/loja-pagamento";
import { createCheckoutProPreference } from "@/lib/mercado-pago-checkout-pro";

export const dynamic = "force-dynamic";

type CreateBody = {
  item_id?: number;
  faceit_guid?: string;
};

type PlayerRow = {
  id: number;
  nickname: string | null;
};

type ItemRow = {
  id: number;
  nome: string;
  preco: number;
  moedas: number;
  estoque: number;
  ativo: number;
};

export async function POST(request: Request) {
  let connection: any;
  let reservedOperationCode = "";

  try {
    const body = (await request.json().catch(() => ({}))) as CreateBody;
    const itemId = Number(body.item_id || 0);
    const faceitGuid = String(body.faceit_guid || "").trim();

    if (!faceitGuid) {
      return NextResponse.json({ message: "Você precisa estar logado para iniciar o pagamento." }, { status: 401 });
    }

    if (!Number.isFinite(itemId) || itemId <= 0) {
      return NextResponse.json({ message: "Item inválido." }, { status: 400 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensurePricePaymentsTable(connection);

    const [playerRows] = await connection.query("SELECT id, nickname FROM players WHERE faceit_guid = ? LIMIT 1", [
      faceitGuid,
    ]);
    const players = playerRows as PlayerRow[];
    if (!players.length) {
      return NextResponse.json({ message: "Jogador não encontrado." }, { status: 404 });
    }

    const player = players[0];
    reservedOperationCode = generateOperationCode();
    const expiresAt = computeExpiresAt();

    let item: ItemRow | null = null;

    await connection.beginTransaction();

    try {
      const [itemRows] = await connection.query(
        "SELECT id, nome, preco, moedas, estoque, ativo FROM estoque WHERE id = ? LIMIT 1 FOR UPDATE",
        [itemId],
      );
      const items = itemRows as ItemRow[];

      if (!items.length || items[0].ativo !== 1) {
        await connection.rollback();
        return NextResponse.json({ message: "Item não está disponível para compra." }, { status: 404 });
      }

      item = items[0];

      if (Number(item.preco || 0) <= 0) {
        await connection.rollback();
        return NextResponse.json(
          { message: "Este item não utiliza pagamento por preço em reais." },
          { status: 400 },
        );
      }

      if (Number(item.estoque || 0) <= 0) {
        await connection.rollback();
        return NextResponse.json({ message: "Item sem estoque." }, { status: 400 });
      }

      await connection.query(
        `INSERT INTO loja_pagamentos_preco
          (operation_code, faceit_guid, player_id, estoque_id, item_nome, amount, status, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          reservedOperationCode,
          faceitGuid,
          player.id,
          item.id,
          item.nome,
          Number(item.preco || 0),
          expiresAt,
        ],
      );

      await connection.query("UPDATE estoque SET estoque = estoque - 1 WHERE id = ? AND estoque > 0", [item.id]);

      await connection.commit();
    } catch (txError) {
      await connection.rollback();
      throw txError;
    }

    if (!item) {
      throw new Error("Falha ao reservar item para pagamento.");
    }

    const preference = await createCheckoutProPreference({
      request,
      operationCode: reservedOperationCode,
      itemId: item.id,
      itemNome: item.nome,
      amount: Number(item.preco),
      expiresAt,
    });

    const checkoutUrl = String(preference.init_point || preference.sandbox_init_point || "").trim();

    if (!checkoutUrl) {
      throw new Error("Mercado Pago não retornou link de pagamento.");
    }

    await connection.query(
      `UPDATE loja_pagamentos_preco
       SET mp_preference_id = ?, checkout_url = ?
       WHERE operation_code = ?`,
      [String(preference.id || ""), checkoutUrl, reservedOperationCode],
    );

    const operation = await readOperationByCode(connection, reservedOperationCode);

    return NextResponse.json(
      {
        success: true,
        operationCode: reservedOperationCode,
        checkoutUrl,
        expiresAt: operation?.expires_at || expiresAt.toISOString(),
        item: {
          id: item.id,
          nome: item.nome,
          preco: Number(item.preco || 0),
        },
      },
      { status: 200 },
    );
  } catch (error) {
    if (connection && reservedOperationCode) {
      try {
        await finalizeOperationWithStockPolicy(connection, reservedOperationCode, "failed", {
          cancelReason: "Erro ao iniciar o pagamento.",
        });
      } catch {
        // no-op
      }
    }

    console.error("[loja/pagamento/criar] erro ao criar pagamento", error);
    return NextResponse.json({ message: "Não foi possível iniciar o pagamento agora." }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

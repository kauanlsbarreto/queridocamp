import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import { ensureBillingColumns } from "@/lib/loja-billing";
import { sendLojaPurchaseBrevoEmail } from "@/lib/loja-brevo-email";

export const dynamic = "force-dynamic";

async function isAdminOneOrTwo(connection: any, faceitGuid: string) {
  const [rows] = await connection.query("SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1", [faceitGuid]);
  const adminRows = rows as Array<{ admin: number | null }>;
  if (!adminRows.length) return false;
  return adminRows[0].admin === 1 || adminRows[0].admin === 2;
}

export async function POST(request: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);
    await ensureBillingColumns(connection);

    const body = await request.json().catch(() => ({}));
    const faceitGuid = String((body as Record<string, unknown>)?.faceit_guid || "").trim();

    if (!faceitGuid) {
      return NextResponse.json({ message: "faceit_guid ausente." }, { status: 400 });
    }

    const allowed = await isAdminOneOrTwo(connection, faceitGuid);
    if (!allowed) {
      return NextResponse.json({ message: "Apenas Admin 1 e 2 podem enviar email de teste." }, { status: 403 });
    }

    const [rows] = await connection.query(
      `SELECT id, nickname, email,
              billing_full_name, billing_company_name, billing_cpf_cnpj, billing_street,
              billing_number, billing_complement, billing_neighborhood, billing_city,
              billing_state, billing_postal_code, billing_country, billing_phone
       FROM players
       WHERE faceit_guid = ?
       LIMIT 1`,
      [faceitGuid],
    );

    const players = rows as Array<{
      id: number;
      nickname: string | null;
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
      return NextResponse.json({ message: "Jogador nao encontrado." }, { status: 404 });
    }

    const player = players[0];
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "";
    const userAgent = request.headers.get("user-agent") || "";

    const result = await sendLojaPurchaseBrevoEmail(
      {
        purchaseType: "PAID_ORDER",
        completedAt: new Date().toISOString(),
        purchaseId: 999999,
        paymentId: 999999,
        paymentRef: "TESTE-BREVO-LOJA",
        providerId: "TESTE-BREVO",
        paymentMethod: "TESTE",
        faceitGuid,
        playerId: Number(player.id || 0),
        playerNickname: player.nickname,
        playerEmail: player.email,
        itemId: 999999,
        itemName: "Email de teste da loja",
        itemCategory: "Teste",
        itemType: "Atalho Ctrl+Alt+E",
        amountCents: 1990,
        pointsCost: 150,
        pointsBefore: 500,
        pointsAfter: 350,
        stockBefore: 10,
        stockAfter: 9,
        labelText: "Disparo manual de teste",
        imageUrl: "https://queridocamp.com.br/images/cs2-player.png",
        billingProfile: player,
        requestUrl: request.url,
        ip,
        userAgent,
      },
      env,
    );

    if (!result.sent) {
      return NextResponse.json(
        { message: result.reason || result.error || "Nao foi possivel enviar email de teste." },
        { status: result.skipped ? 400 : 500 },
      );
    }

    return NextResponse.json({ success: true, message: "Email de teste enviado com sucesso." }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
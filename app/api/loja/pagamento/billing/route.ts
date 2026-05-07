import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import {
  EMPTY_BILLING_PROFILE,
  ensureBillingColumns,
  isBillingProfileComplete,
  normalizeBillingProfile,
} from "@/lib/loja-billing";

export const dynamic = "force-dynamic";

type BillingRequestBody = {
  faceit_guid?: string;
} & Partial<typeof EMPTY_BILLING_PROFILE>;

function resolveBillingApiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Erro desconhecido.";
  const errorCode = String((error as { code?: string } | null)?.code || "").trim().toUpperCase();

  if (
    errorCode === "ER_DUP_ENTRY" &&
    (message.includes("players.email") || message.toLowerCase().includes("for key 'email'"))
  ) {
    return {
      status: 409,
      message: "Este email ja esta cadastrado em outra conta. Use outro email para continuar.",
    };
  }

  if (errorCode === "ER_DUP_ENTRY") {
    return {
      status: 409,
      message: "Ja existe um cadastro com esses dados. Revise as informacoes e tente novamente.",
    };
  }

  return {
    status: 500,
    message,
  };
}

async function loadBillingProfile(connection: any, faceitGuid: string) {
  const [rows] = await connection.query(
    `SELECT id,
            email,
            billing_full_name, billing_company_name, billing_cpf_cnpj, billing_street, billing_number,
            billing_complement, billing_neighborhood, billing_city, billing_state, billing_postal_code,
            billing_country, billing_phone
     FROM players
     WHERE faceit_guid = ?
     LIMIT 1`,
    [faceitGuid],
  );

  const player = Array.isArray(rows) ? rows[0] : null;
  if (!player) return null;

  const profile = normalizeBillingProfile(player);
  return {
    playerId: Number(player.id || 0),
    profile,
    isComplete: isBillingProfileComplete(profile),
  };
}

export async function GET(request: Request) {
  let connection: any;
  try {
    const faceitGuid = String(new URL(request.url).searchParams.get("faceit_guid") || "").trim();
    if (!faceitGuid) {
      return NextResponse.json({ message: "faceit_guid obrigatorio." }, { status: 400 });
    }

    const ctx = await getCloudflareContext({ async: true });
    connection = await createMainConnection(ctx.env as any);
    await ensureBillingColumns(connection);

    const result = await loadBillingProfile(connection, faceitGuid);
    if (!result) {
      return NextResponse.json({ message: "Jogador nao encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      playerId: result.playerId,
      profile: result.profile,
      isComplete: result.isComplete,
    });
  } catch (error) {
    const resolvedError = resolveBillingApiError(error);
    return NextResponse.json(
      { message: resolvedError.message },
      { status: resolvedError.status },
    );
  } finally {
    if (connection) await connection.end();
  }
}

export async function PUT(request: Request) {
  let connection: any;
  try {
    const body = (await request.json().catch(() => ({}))) as BillingRequestBody;
    const faceitGuid = String(body.faceit_guid || "").trim();
    if (!faceitGuid) {
      return NextResponse.json({ message: "faceit_guid obrigatorio." }, { status: 400 });
    }

    const profile = normalizeBillingProfile(body);
    if (!isBillingProfileComplete(profile)) {
      return NextResponse.json(
        { message: "Preencha email, nome, documento, telefone e endereco completo." },
        { status: 400 },
      );
    }

    const ctx = await getCloudflareContext({ async: true });
    connection = await createMainConnection(ctx.env as any);
    await ensureBillingColumns(connection);

    const existing = await loadBillingProfile(connection, faceitGuid);
    if (!existing) {
      return NextResponse.json({ message: "Jogador nao encontrado." }, { status: 404 });
    }

    await connection.query(
      `UPDATE players
         SET email = ?,
           billing_full_name = ?,
           billing_company_name = ?,
           billing_cpf_cnpj = ?,
           billing_street = ?,
           billing_number = ?,
           billing_complement = ?,
           billing_neighborhood = ?,
           billing_city = ?,
           billing_state = ?,
           billing_postal_code = ?,
           billing_country = ?,
           billing_phone = ?
       WHERE faceit_guid = ?`,
      [
        profile.email,
        profile.billing_full_name,
        profile.billing_company_name,
        profile.billing_cpf_cnpj,
        profile.billing_street,
        profile.billing_number,
        profile.billing_complement,
        profile.billing_neighborhood,
        profile.billing_city,
        profile.billing_state,
        profile.billing_postal_code,
        profile.billing_country,
        profile.billing_phone,
        faceitGuid,
      ],
    );

    return NextResponse.json({ success: true, profile, isComplete: true });
  } catch (error) {
    const resolvedError = resolveBillingApiError(error);
    return NextResponse.json(
      { message: resolvedError.message },
      { status: resolvedError.status },
    );
  } finally {
    if (connection) await connection.end();
  }
}
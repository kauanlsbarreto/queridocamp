import { NextRequest, NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import type { Env } from "@/lib/db";
import { sendDesafiarErrorBrevoEmail } from "@/lib/copadraft-desafiar-brevo-error";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const env = await getRuntimeEnv();

    await sendDesafiarErrorBrevoEmail(
      {
        source: "client",
        errorMessage: String(body?.message || "Erro no client"),
        errorStack: body?.stack ? String(body.stack) : null,
        actorGuid: body?.faceit_guid ? String(body.faceit_guid) : null,
        actorNickname: body?.nickname ? String(body.nickname) : null,
        requestUrl: body?.url ? String(body.url) : null,
        extra: {
          userAgent: body?.userAgent ? String(body.userAgent) : "",
          kind: body?.kind ? String(body.kind) : "",
        },
      },
      env,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[desafiar/api/error]", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

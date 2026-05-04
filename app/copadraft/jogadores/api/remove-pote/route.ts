import { NextResponse } from 'next/server';
import { createJogadoresConnection } from '@/lib/db';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Env } from '@/lib/db';

export async function PUT(req: Request) {
  let conn: any;

  try {
    const body = await req.json();
    const jogadorId = Number(body?.jogadorId);

    if (!Number.isInteger(jogadorId) || jogadorId <= 0) {
      return NextResponse.json({ error: 'jogadorId invalido.' }, { status: 400 });
    }

    const ctx = await getCloudflareContext({ async: true });
    conn = await createJogadoresConnection(ctx.env as unknown as Env);
    const [result]: any = await conn.query(
      'UPDATE jogadores SET pote = NULL WHERE id = ? LIMIT 1',
      [jogadorId]
    );

    if (!result || result.affectedRows === 0) {
      return NextResponse.json({ error: 'Jogador nao encontrado.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, jogadorId, pote: null });
  } catch {
    return NextResponse.json({ error: 'Erro ao remover pote.' }, { status: 500 });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

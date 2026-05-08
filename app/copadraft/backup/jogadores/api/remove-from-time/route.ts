import { NextResponse } from 'next/server';
import { createJogadoresConnection } from '@/lib/db';

export async function PUT(req: Request) {
  let conn: any;

  try {
    const body = await req.json();
    const jogadorId = Number(body?.jogadorId);

    if (!Number.isInteger(jogadorId) || jogadorId <= 0) {
      return NextResponse.json({ error: 'jogadorId invalido.' }, { status: 400 });
    }

    conn = await createJogadoresConnection({});

    // Primeiro, buscar o timeid do jogador
    const [rows]: any = await conn.query(
      'SELECT timeid FROM jogadores WHERE id = ? LIMIT 1',
      [jogadorId]
    );

    const jogador = Array.isArray(rows) ? rows[0] : null;
    if (!jogador || !jogador.timeid) {
      return NextResponse.json({ error: 'Jogador nao esta em nenhum time.' }, { status: 404 });
    }

    const timeid = Number(jogador.timeid);

    // Remover timeid de todos os jogadores desse time
    await conn.query(
      'UPDATE jogadores SET timeid = NULL WHERE timeid = ?',
      [timeid]
    );

    return NextResponse.json({ ok: true, jogadorId, timeid });
  } catch {
    return NextResponse.json({ error: 'Erro ao remover do time.' }, { status: 500 });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

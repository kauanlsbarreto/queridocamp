import { NextResponse } from 'next/server';
import { createJogadoresConnection } from '@/lib/db';

export async function PUT(req: Request) {
  let conn: any;

  try {
    const body = await req.json();
    const capitaoId = Number(body?.capitaoId);

    if (!Number.isInteger(capitaoId) || capitaoId <= 0) {
      return NextResponse.json({ error: 'capitaoId invalido.' }, { status: 400 });
    }

    conn = await createJogadoresConnection({});
    await conn.beginTransaction();

    const [capRows]: any = await conn.query(
      'SELECT id, pote FROM jogadores WHERE id = ? LIMIT 1 FOR UPDATE',
      [capitaoId]
    );

    const capitao = Array.isArray(capRows) ? capRows[0] : null;
    if (!capitao) {
      await conn.rollback();
      return NextResponse.json({ error: 'Capitao nao encontrado.' }, { status: 404 });
    }

    if (Number(capitao.pote) !== 1) {
      await conn.rollback();
      return NextResponse.json({ error: 'Somente times com capitao do pote 1 podem ser restaurados.' }, { status: 400 });
    }

    await conn.query(
      'UPDATE jogadores SET timeid = NULL WHERE timeid = ? AND id <> ? ',
      [capitaoId, capitaoId]
    );

    const novoDinheiro = 500000;
    await conn.query('UPDATE jogadores SET dinheiro = ? WHERE id = ? LIMIT 1', [novoDinheiro, capitaoId]);

    await conn.commit();

    return NextResponse.json({ ok: true, capitaoId, novoDinheiro });
  } catch {
    if (conn) {
      await conn.rollback().catch(() => {});
    }
    return NextResponse.json({ error: 'Erro ao restaurar time.' }, { status: 500 });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

import { NextResponse } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  let env: any = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }

  // Cria a conexão usando o padrão Hyperdrive
  const db = await createMainConnection(env);

  try {
    const body = await request.json();
    const { userId, adicionados } = body;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    // Query usando prepared statements padrão
    await db.query('UPDATE players SET adicionados = ? WHERE id = ?', [adicionados, userId]);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  } finally {
    await db.end(); // fecha a conexão
  }
}

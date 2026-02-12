import { NextResponse } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPools } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: dbPool } = getPools(env);

  try {
    const body = await request.json();
    const { userId, adicionados } = body;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    // Atualiza apenas a coluna adicionados
    await dbPool.execute('UPDATE players SET adicionados = ? WHERE id = ?', [adicionados, userId]);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
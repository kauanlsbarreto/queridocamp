import { NextResponse } from 'next/server';
import { getJogadoresEnriquecidos } from '@/lib/getJogadoresEnriquecidos';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Env } from '@/lib/db';

export async function GET() {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const jogadores = await getJogadoresEnriquecidos(ctx.env as unknown as Env);
    return NextResponse.json({ jogadores });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar jogadores.' }, { status: 500 });
  }
}

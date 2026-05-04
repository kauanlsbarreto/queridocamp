import { NextResponse } from 'next/server';
import { getJogadoresEnriquecidos } from '@/lib/getJogadoresEnriquecidos';

export async function GET() {
  try {
    const jogadores = await getJogadoresEnriquecidos();
    return NextResponse.json({ jogadores });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar jogadores.' }, { status: 500 });
  }
}

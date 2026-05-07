import JogadoresPageClient from './JogadoresPageClient';
import { getJogadoresEnriquecidos } from '@/lib/getJogadoresEnriquecidos';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Env } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  let jogadores: any[] = [];

  try {
    jogadores = await (async () => {
      const ctx = await getCloudflareContext({ async: true });
      return getJogadoresEnriquecidos(ctx.env as unknown as Env, {
        enableServerFaceitFallback: false,
      });
    })().catch((error) => {
      console.error('Erro ao carregar dados de /copadraft/jogadores:', error);
      return [] as any[];
    });
  } catch (error) {
    // Prevent build-time failures when DB is unreachable in prerender/build context.
    console.error('Erro ao renderizar /copadraft/jogadores:', error);
  }

  return <JogadoresPageClient jogadores={jogadores} />;
}


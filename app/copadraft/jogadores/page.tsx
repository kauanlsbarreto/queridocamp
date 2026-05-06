import JogadoresPageClient from './JogadoresPageClient';
import { getJogadoresEnriquecidos } from '@/lib/getJogadoresEnriquecidos';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Env } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const PAGE_DATA_TIMEOUT_MS = 4500;
const TIMEOUT_SENTINEL = Symbol('copadraft-jogadores-timeout');

export default async function Page() {
  let jogadores: any[] = [];

  try {
    const dataPromise = (async () => {
      const ctx = await getCloudflareContext({ async: true });
      return getJogadoresEnriquecidos(ctx.env as unknown as Env, {
        enableServerFaceitFallback: false,
      });
    })().catch((error) => {
      console.error('Erro ao carregar dados de /copadraft/jogadores:', error);
      return [] as any[];
    });

    const timedResult = await Promise.race([
      dataPromise,
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
        setTimeout(() => resolve(TIMEOUT_SENTINEL), PAGE_DATA_TIMEOUT_MS);
      }),
    ]);

    if (timedResult === TIMEOUT_SENTINEL) {
      console.warn(`Timeout ao carregar /copadraft/jogadores em ${PAGE_DATA_TIMEOUT_MS}ms. Renderizando fallback.`);
      jogadores = [];
    } else {
      jogadores = timedResult;
    }
  } catch (error) {
    // Prevent build-time failures when DB is unreachable in prerender/build context.
    console.error('Erro ao renderizar /copadraft/jogadores:', error);
  }

  return <JogadoresPageClient jogadores={jogadores} />;
}


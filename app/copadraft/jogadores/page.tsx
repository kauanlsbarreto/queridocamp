import JogadoresPageClient from './JogadoresPageClient';
import { getJogadoresEnriquecidos } from '@/lib/getJogadoresEnriquecidos';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createJogadoresConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const SSR_ENRICHED_TIMEOUT_MS = Number(process.env.COPADRAFT_SSR_ENRICHED_TIMEOUT_MS || 4500);
const SSR_FAST_SNAPSHOT_TIMEOUT_MS = Number(process.env.COPADRAFT_SSR_FAST_SNAPSHOT_TIMEOUT_MS || 3500);

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT_${timeoutMs}MS`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function getJogadoresSnapshotRapido(env: Env) {
  let connection: any = null;
  try {
    connection = await createJogadoresConnection(env);
    const [rows] = await connection.query({ sql: 'SELECT * FROM jogadores', timeout: SSR_FAST_SNAPSHOT_TIMEOUT_MS });
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [] as any[];
  } finally {
    await Promise.allSettled([connection?.end?.()]);
  }
}

export default async function Page() {
  let jogadores: any[] = [];

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    try {
      jogadores = await withTimeout(getJogadoresEnriquecidos(env, {
        enableServerFaceitFallback: false,
      }), SSR_ENRICHED_TIMEOUT_MS, 'SSR_ENRICHED');
    } catch {
      // Fallback para snapshot rapido quando o enriquecimento demora no edge.
      jogadores = await getJogadoresSnapshotRapido(env);
    }
  } catch (error) {
    // Prevent build-time failures when DB is unreachable in prerender/build context.
    console.error('Erro ao renderizar /copadraft/jogadores:', error);
  }

  return <JogadoresPageClient jogadores={jogadores} />;
}


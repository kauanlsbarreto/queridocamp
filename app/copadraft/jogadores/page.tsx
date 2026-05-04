import JogadoresPageClient from './JogadoresPageClient';
import { getJogadoresEnriquecidos } from '@/lib/getJogadoresEnriquecidos';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Env } from '@/lib/db';

export default async function Page() {
  const ctx = await getCloudflareContext({ async: true });
  const jogadores = await getJogadoresEnriquecidos(ctx.env as unknown as Env);
  return <JogadoresPageClient jogadores={jogadores} />;
}


import JogadoresPageClient from './JogadoresPageClient';
import { getJogadoresEnriquecidos } from '@/lib/getJogadoresEnriquecidos';

export default async function Page() {
  const jogadores = await getJogadoresEnriquecidos();
  return <JogadoresPageClient jogadores={jogadores} />;
}


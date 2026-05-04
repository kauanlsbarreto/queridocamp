import { createJogadoresConnection, createMainConnection } from '@/lib/db';

export async function getJogadoresEnriquecidos() {
  const connJogadores = await createJogadoresConnection({});
  const [jogadores] = await connJogadores.query('SELECT * FROM jogadores');
  await connJogadores.end();

  const connMain = await createMainConnection({});
  const [players] = await connMain.query('SELECT * FROM players');
  await connMain.end();

  const jogadoresArr: any[] = Array.isArray(jogadores) ? jogadores : [];
  const playersArr: any[] = Array.isArray(players) ? players : [];

  const playersMap = new Map();
  for (const p of playersArr) {
    if (p.faceit_guid) playersMap.set(String(p.faceit_guid).toLowerCase(), p);
  }

  const enriched = jogadoresArr.map((j: any) => {
    const player = j.faceit_guid ? playersMap.get(String(j.faceit_guid).toLowerCase()) : null;
    return {
      ...j,
      nick: player?.nickname || j.nick,
      faceit_image: player?.avatar || j.faceit_image,
      nickname: player?.nickname || null,
      avatar: player?.avatar || null,
    };
  });

  return enriched;
}

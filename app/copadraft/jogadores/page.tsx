import JogadoresPageClient from './JogadoresPageClient';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createJogadoresConnection, createMainConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const SSR_FAST_SNAPSHOT_TIMEOUT_MS = Number(process.env.COPADRAFT_SSR_FAST_SNAPSHOT_TIMEOUT_MS || 1800);

async function getJogadoresSnapshotRapido(env: Env) {
  let jogadoresConnection: any = null;
  let mainConnection: any = null;
  try {
    [jogadoresConnection, mainConnection] = await Promise.all([
      createJogadoresConnection(env),
      createMainConnection(env),
    ]);

    const [jogadoresRows, playersRows] = await Promise.all([
      jogadoresConnection.query({ sql: 'SELECT * FROM jogadores', timeout: SSR_FAST_SNAPSHOT_TIMEOUT_MS }),
      mainConnection.query({ sql: 'SELECT faceit_guid, nickname, avatar FROM players', timeout: SSR_FAST_SNAPSHOT_TIMEOUT_MS }),
    ]);

    let top90: any[] = [];
    try {
      const [top90Rows] = await mainConnection.query({ sql: 'SELECT * FROM top90_stats', timeout: SSR_FAST_SNAPSHOT_TIMEOUT_MS });
      top90 = Array.isArray(top90Rows) ? top90Rows : [];
    } catch {
      top90 = [];
    }

    const jogadores = Array.isArray((jogadoresRows as any)?.[0]) ? (jogadoresRows as any)[0] : [];
    const players = Array.isArray((playersRows as any)?.[0]) ? (playersRows as any)[0] : [];

    const byGuid = new Map<string, { nickname: string; avatar: string }>();
    const avatarByNickname = new Map<string, string>();
    const top90NickByGuid = new Map<string, string>();
    const top90NickByNick = new Map<string, string>();

    for (const player of players) {
      const guidKey = String(player?.faceit_guid || '').trim().toLowerCase();
      const nickname = String(player?.nickname || '').trim();
      const nickKey = nickname.toLowerCase();
      const avatar = String(player?.avatar || '').trim();

      if (guidKey) byGuid.set(guidKey, { nickname, avatar });
      if (nickKey && avatar && !avatarByNickname.has(nickKey)) avatarByNickname.set(nickKey, avatar);
    }

    for (const row of top90) {
      const guidKey = String(row?.faceit_guild || row?.faceit_guid || '').trim().toLowerCase();
      const nick = String(row?.nick || row?.nickname || '').trim();
      const nickKey = nick.toLowerCase();

      if (guidKey && nick && !top90NickByGuid.has(guidKey)) top90NickByGuid.set(guidKey, nick);
      if (nickKey && nick && !top90NickByNick.has(nickKey)) top90NickByNick.set(nickKey, nick);
    }

    return jogadores.map((j: any) => {
      const guidKey = String(j?.faceit_guid || '').trim().toLowerCase();
      const sourceNick = String(j?.nick || '').trim();
      const sourceNickKey = sourceNick.toLowerCase();
      const fromPlayer = byGuid.get(guidKey);
      const fromTop90 = !fromPlayer
        ? (top90NickByGuid.get(guidKey) || top90NickByNick.get(sourceNickKey) || '')
        : '';

      const resolvedNick = String(fromPlayer?.nickname || fromTop90 || sourceNick || '').trim();
      const resolvedNickKey = resolvedNick.toLowerCase();
      const resolvedAvatar =
        String(fromPlayer?.avatar || '').trim() ||
        String(avatarByNickname.get(resolvedNickKey) || '').trim() ||
        String(j?.faceit_image || '').trim() ||
        '/images/cs2-player.png';

      return {
        ...j,
        nick: resolvedNick,
        nickname: resolvedNick,
        faceit_image: resolvedAvatar,
        avatar: resolvedAvatar,
      };
    });
  } catch {
    return [] as any[];
  } finally {
    await Promise.allSettled([
      jogadoresConnection?.end?.(),
      mainConnection?.end?.(),
    ]);
  }
}

export default async function Page() {
  let jogadores: any[] = [];

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    jogadores = await getJogadoresSnapshotRapido(env);
  } catch (error) {
    // Prevent build-time failures when DB is unreachable in prerender/build context.
    console.error('Erro ao renderizar /copadraft/jogadores:', error);
  }

  return <JogadoresPageClient jogadores={jogadores} />;
}


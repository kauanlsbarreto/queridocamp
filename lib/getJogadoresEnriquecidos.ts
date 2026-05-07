import { createJogadoresConnection, createMainConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

const FACEIT_API_BASE = 'https://open.faceit.com/data/v4';
const FALLBACK_FACEIT_API_KEY = '7b080715-fe0b-461d-a1f1-62cfd0c47e63';
const DEFAULT_PLAYER_AVATAR = '/images/cs2-player.png';
const MYSQL_QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_MYSQL_QUERY_TIMEOUT_MS || 20000);

type FaceitPlayerPayload = {
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
};

type Top90Stats = {
  kd: number;
  kr: number;
  k: number;
  d: number;
};

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toInteger(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function normalizeTop90Stats(row: any): Top90Stats {
  return {
    kd: toNumber(row?.kd ?? row?.k_d ?? row?.kdr),
    kr: toNumber(row?.kr ?? row?.k_r),
    k: toInteger(row?.k ?? row?.kills),
    d: toInteger(row?.d ?? row?.deaths ?? row?.mortes),
  };
}

function getFaceitApiKey() {
  const envKey = typeof process !== 'undefined' ? process.env.FACEIT_API_KEY?.trim() : '';
  return envKey || FALLBACK_FACEIT_API_KEY;
}

function getAvatarFromPayload(payload: FaceitPlayerPayload | null) {
  if (!payload) return '';
  if (typeof payload.avatar === 'string' && payload.avatar.trim()) return payload.avatar.trim();
  if (typeof payload.avatar_url === 'string' && payload.avatar_url.trim()) return payload.avatar_url.trim();
  return '';
}

async function fetchFaceitProfile(params: { guid?: string; nickname?: string }) {
  const headers = { Authorization: `Bearer ${getFaceitApiKey()}` };
  const normalizedGuid = String(params.guid || '').trim();
  const normalizedNick = String(params.nickname || '').trim();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1800);

  try {
    if (normalizedGuid) {
      const byGuidRes = await fetch(`${FACEIT_API_BASE}/players/${encodeURIComponent(normalizedGuid)}`, { headers, signal: controller.signal });
      if (byGuidRes.ok) {
        clearTimeout(timeout);
        const byGuid = (await byGuidRes.json()) as FaceitPlayerPayload;
        return {
          nickname: String(byGuid?.nickname || '').trim(),
          avatar: getAvatarFromPayload(byGuid),
        };
      }
    }

    if (normalizedNick) {
      const byNickRes = await fetch(`${FACEIT_API_BASE}/players?nickname=${encodeURIComponent(normalizedNick)}`, { headers, signal: controller.signal });
      if (byNickRes.ok) {
        clearTimeout(timeout);
        const byNick = (await byNickRes.json()) as FaceitPlayerPayload;
        return {
          nickname: String(byNick?.nickname || '').trim(),
          avatar: getAvatarFromPayload(byNick),
        };
      }
    }
  } catch {
    clearTimeout(timeout);
    return null;
  }

  clearTimeout(timeout);

  return null;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number) {
  const workers = Array.from({ length: Math.max(1, concurrency) }, async (_, workerIndex) => {
    for (let i = workerIndex; i < tasks.length; i += Math.max(1, concurrency)) {
      await tasks[i]();
    }
  });
  await Promise.all(workers);
}

async function queryWithTimeout(connection: any, sql: string, values?: any[]) {
  return connection.query(
    {
      sql,
      timeout: MYSQL_QUERY_TIMEOUT_MS,
    },
    values,
  );
}

export async function getJogadoresEnriquecidos(
  env: Env,
  options?: { enableServerFaceitFallback?: boolean },
) {
  let connJogadores: any = null;
  let connMain: any = null;

  let jogadores: any[] = [];
  let players: any[] = [];
  let top90Rows: any[] = [];

  try {
    connJogadores = await createJogadoresConnection(env);
    const [jogadoresRows] = await queryWithTimeout(connJogadores, 'SELECT * FROM jogadores');
    jogadores = Array.isArray(jogadoresRows) ? jogadoresRows : [];

    connMain = await createMainConnection(env);
    const [playerRows] = await queryWithTimeout(connMain, 'SELECT * FROM players');
    players = Array.isArray(playerRows) ? playerRows : [];

    try {
      const [rows] = await queryWithTimeout(connMain, 'SELECT * FROM top90_stats');
      top90Rows = Array.isArray(rows) ? rows : [];
    } catch {
      top90Rows = [];
    }
  } finally {
    await Promise.allSettled([
      connJogadores?.end?.(),
      connMain?.end?.(),
    ]);
  }

  const jogadoresArr: any[] = jogadores;
  const playersArr: any[] = players;

  const playersMap = new Map();
  const playerAvatarByNick = new Map<string, string>();
  for (const p of playersArr) {
    if (p.faceit_guid) playersMap.set(String(p.faceit_guid).toLowerCase(), p);

    const nickKey = String(p?.nickname || '').trim().toLowerCase();
    const avatar = String(p?.avatar || '').trim();
    if (nickKey && avatar && !playerAvatarByNick.has(nickKey)) {
      playerAvatarByNick.set(nickKey, avatar);
    }
  }

  const top90ByGuid = new Map<string, Top90Stats>();
  const top90ByNick = new Map<string, Top90Stats>();
  const top90NickByGuid = new Map<string, string>();
  const top90NickByNick = new Map<string, string>();

  for (const row of top90Rows) {
    const guid = String(row?.faceit_guild || row?.faceit_guid || '').trim().toLowerCase();
    const nick = String(row?.nick || row?.nickname || '').trim().toLowerCase();
    const rawNick = String(row?.nick || row?.nickname || '').trim();
    const stats = normalizeTop90Stats(row);

    if (guid) top90ByGuid.set(guid, stats);
    if (nick) top90ByNick.set(nick, stats);
    if (guid && rawNick) top90NickByGuid.set(guid, rawNick);
    if (nick && rawNick) top90NickByNick.set(nick, rawNick);
  }

  const faceitFallbackCache = new Map<string, { nickname: string; avatar: string } | null>();
  const enableServerFaceitFallback =
    typeof options?.enableServerFaceitFallback === 'boolean'
      ? options.enableServerFaceitFallback
      : false;

  if (enableServerFaceitFallback) {
    const fallbackTasks = jogadoresArr.map((j: any) => async () => {
      const guidKey = String(j?.faceit_guid || '').trim().toLowerCase();
      if (!guidKey || playersMap.has(guidKey) || faceitFallbackCache.has(guidKey)) return;

      const profile = await fetchFaceitProfile({
        guid: String(j?.faceit_guid || ''),
        nickname: String(j?.nick || ''),
      });

      faceitFallbackCache.set(guidKey, profile);
    });

    await runWithConcurrency(fallbackTasks, 4);
  }

  const enriched = jogadoresArr.map((j: any) => {
    const guidKey = String(j?.faceit_guid || '').trim().toLowerCase();
    const player = guidKey ? playersMap.get(guidKey) : null;
    const fallbackProfile = guidKey ? faceitFallbackCache.get(guidKey) || null : null;
    const sourceNick = String(j?.nick || '').trim();
    const sourceNickKey = sourceNick.toLowerCase();

    const top90Nickname =
      (!player && (top90NickByGuid.get(guidKey) || top90NickByNick.get(sourceNickKey))) || '';

    const resolvedNickname = player?.nickname || top90Nickname || fallbackProfile?.nickname || sourceNick;
    const resolvedNicknameKey = String(resolvedNickname || '').trim().toLowerCase();
    const avatarByResolvedNickname = resolvedNicknameKey ? playerAvatarByNick.get(resolvedNicknameKey) : '';
    const resolvedAvatar =
      String(player?.avatar || '').trim() ||
      String(avatarByResolvedNickname || '').trim() ||
      String(fallbackProfile?.avatar || '').trim() ||
      String(j?.faceit_image || '').trim() ||
      DEFAULT_PLAYER_AVATAR;
    const normalizedNick = String(resolvedNickname || j?.nick || '').trim().toLowerCase();
    const top90Stats = top90ByGuid.get(guidKey) || top90ByNick.get(normalizedNick) || null;

    return {
      ...j,
      nick: resolvedNickname,
      faceit_image: resolvedAvatar,
      nickname: resolvedNickname || null,
      avatar: resolvedAvatar || null,
      top90Stats,
    };
  });

  return enriched;
}

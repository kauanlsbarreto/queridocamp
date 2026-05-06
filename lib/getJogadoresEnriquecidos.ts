import { createJogadoresConnection, createMainConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

const FACEIT_API_BASE = 'https://open.faceit.com/data/v4';
const FALLBACK_FACEIT_API_KEY = '7b080715-fe0b-461d-a1f1-62cfd0c47e63';

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

const JOGADORES_CACHE_TTL_MS = 20000;
let jogadoresCacheValue: any[] | null = null;
let jogadoresCacheUpdatedAt = 0;
let jogadoresInFlight: Promise<any[]> | null = null;

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

export async function getJogadoresEnriquecidos(
  env: Env,
  options?: { enableServerFaceitFallback?: boolean; bypassCache?: boolean },
) {
  const bypassCache = options?.bypassCache === true;
  const cacheAgeMs = Date.now() - jogadoresCacheUpdatedAt;
  if (!bypassCache && jogadoresCacheValue && cacheAgeMs < JOGADORES_CACHE_TTL_MS) {
    return jogadoresCacheValue;
  }

  if (!bypassCache && jogadoresInFlight) {
    return jogadoresInFlight;
  }

  const loadPromise = (async () => {
  const connJogadores = await createJogadoresConnection(env);
  const [jogadores] = await connJogadores.query('SELECT * FROM jogadores');
  await connJogadores.end();

  const connMain = await createMainConnection(env);
  const [players] = await connMain.query('SELECT * FROM players');

  let top90Rows: any[] = [];
  try {
    const [rows] = await connMain.query('SELECT * FROM top90_stats');
    top90Rows = Array.isArray(rows) ? rows : [];
  } catch {
    top90Rows = [];
  }

  await connMain.end();

  const jogadoresArr: any[] = Array.isArray(jogadores) ? jogadores : [];
  const playersArr: any[] = Array.isArray(players) ? players : [];

  const playersMap = new Map();
  for (const p of playersArr) {
    if (p.faceit_guid) playersMap.set(String(p.faceit_guid).toLowerCase(), p);
  }

  const top90ByGuid = new Map<string, Top90Stats>();
  const top90ByNick = new Map<string, Top90Stats>();

  for (const row of top90Rows) {
    const guid = String(row?.faceit_guild || row?.faceit_guid || '').trim().toLowerCase();
    const nick = String(row?.nick || row?.nickname || '').trim().toLowerCase();
    const stats = normalizeTop90Stats(row);

    if (guid) top90ByGuid.set(guid, stats);
    if (nick) top90ByNick.set(nick, stats);
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

    const resolvedNickname = player?.nickname || fallbackProfile?.nickname || j.nick;
    const resolvedAvatar = player?.avatar || fallbackProfile?.avatar || j.faceit_image;
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

    jogadoresCacheValue = enriched;
    jogadoresCacheUpdatedAt = Date.now();

    return enriched;
  })();

  jogadoresInFlight = loadPromise;

  try {
    return await loadPromise;
  } finally {
    if (jogadoresInFlight === loadPromise) {
      jogadoresInFlight = null;
    }
  }
}

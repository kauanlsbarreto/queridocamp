import { createJogadoresConnection, createMainConnection } from '@/lib/db';

const FACEIT_API_BASE = 'https://open.faceit.com/data/v4';
const FALLBACK_FACEIT_API_KEY = '7b080715-fe0b-461d-a1f1-62cfd0c47e63';

type FaceitPlayerPayload = {
  nickname?: string;
  avatar?: string;
  avatar_url?: string;
};

function getFaceitApiKey() {
  return process.env.FACEIT_API_KEY?.trim() || FALLBACK_FACEIT_API_KEY;
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

  try {
    if (normalizedGuid) {
      const byGuidRes = await fetch(`${FACEIT_API_BASE}/players/${encodeURIComponent(normalizedGuid)}`, { headers });
      if (byGuidRes.ok) {
        const byGuid = (await byGuidRes.json()) as FaceitPlayerPayload;
        return {
          nickname: String(byGuid?.nickname || '').trim(),
          avatar: getAvatarFromPayload(byGuid),
        };
      }
    }

    if (normalizedNick) {
      const byNickRes = await fetch(`${FACEIT_API_BASE}/players?nickname=${encodeURIComponent(normalizedNick)}`, { headers });
      if (byNickRes.ok) {
        const byNick = (await byNickRes.json()) as FaceitPlayerPayload;
        return {
          nickname: String(byNick?.nickname || '').trim(),
          avatar: getAvatarFromPayload(byNick),
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

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

  const faceitFallbackCache = new Map<string, { nickname: string; avatar: string } | null>();

  const fallbackTasks = jogadoresArr.map(async (j: any) => {
    const guidKey = String(j?.faceit_guid || '').trim().toLowerCase();
    if (!guidKey || playersMap.has(guidKey) || faceitFallbackCache.has(guidKey)) return;

    const profile = await fetchFaceitProfile({
      guid: String(j?.faceit_guid || ''),
      nickname: String(j?.nick || ''),
    });

    faceitFallbackCache.set(guidKey, profile);
  });

  await Promise.all(fallbackTasks);

  const enriched = jogadoresArr.map((j: any) => {
    const guidKey = String(j?.faceit_guid || '').trim().toLowerCase();
    const player = guidKey ? playersMap.get(guidKey) : null;
    const fallbackProfile = guidKey ? faceitFallbackCache.get(guidKey) || null : null;

    const resolvedNickname = player?.nickname || fallbackProfile?.nickname || j.nick;
    const resolvedAvatar = player?.avatar || fallbackProfile?.avatar || j.faceit_image;

    return {
      ...j,
      nick: resolvedNickname,
      faceit_image: resolvedAvatar,
      nickname: resolvedNickname || null,
      avatar: resolvedAvatar || null,
    };
  });

  return enriched;
}

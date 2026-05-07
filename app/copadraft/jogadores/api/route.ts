import { NextResponse } from 'next/server';
import { getJogadoresEnriquecidos } from '@/lib/getJogadoresEnriquecidos';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createJogadoresConnection } from '@/lib/db';
import type { Env } from '@/lib/db';

const FACEIT_API_BASE = 'https://open.faceit.com/data/v4';
const FALLBACK_FACEIT_API_KEY = '7b080715-fe0b-461d-a1f1-62cfd0c47e63';

function normalizeText(value: unknown) {
  return String(value || '').trim();
}

function parseFaceitLevel(payload: any): number {

  const cs2SkillLevel = Number(payload?.games?.cs2?.skill_level);
  if (Number.isInteger(cs2SkillLevel) && cs2SkillLevel >= 1 && cs2SkillLevel <= 10) return cs2SkillLevel;

  const csgoSkillLevel = Number(payload?.games?.csgo?.skill_level);
  if (Number.isInteger(csgoSkillLevel) && csgoSkillLevel >= 1 && csgoSkillLevel <= 10) return csgoSkillLevel;

  return 0;
}

function getFaceitApiKey(env?: Record<string, unknown>) {
  const workerKey = normalizeText(env?.FACEIT_API_KEY);
  if (workerKey) return workerKey;

  const processKey = typeof process !== 'undefined' ? normalizeText(process.env.FACEIT_API_KEY) : '';
  return processKey || FALLBACK_FACEIT_API_KEY;
}

async function fetchFaceitJson(url: string, token: string, retries = 1) {
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return { ok: true as const, status: response.status, data: await response.json() };
      }

      lastStatus = response.status;
      if ((response.status === 429 || response.status === 503 || response.status >= 500) && attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }

      return { ok: false as const, status: response.status, data: null };
    } catch {
      clearTimeout(timeout);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        continue;
      }
    }
  }

  return { ok: false as const, status: lastStatus, data: null };
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number) {
  const workers = Array.from({ length: Math.max(1, concurrency) }, async (_, workerIndex) => {
    for (let i = workerIndex; i < tasks.length; i += Math.max(1, concurrency)) {
      await tasks[i]();
    }
  });
  await Promise.all(workers);
}


function buildBulkLevelUpdate(changedLevels: Array<{ id: number; nextLevel: number }>) {
  const cases = changedLevels.map(() => 'WHEN ? THEN ?').join(' ');
  const idsPlaceholders = changedLevels.map(() => '?').join(', ');
  const sql = `UPDATE jogadores SET level = CASE id ${cases} END WHERE id IN (${idsPlaceholders})`;

  const params: Array<number> = [];
  for (const row of changedLevels) {
    params.push(row.id, row.nextLevel);
  }
  for (const row of changedLevels) {
    params.push(row.id);
  }

  return { sql, params };
}

async function syncJogadoresLevels(env: Env) {
  const connection = await createJogadoresConnection(env);

  try {
    const token = getFaceitApiKey(env as unknown as Record<string, unknown>);

    const [zeroNoGuidResult] = await connection.query(
      `UPDATE jogadores
       SET level = 0
       WHERE (faceit_guid IS NULL OR TRIM(faceit_guid) = '')
         AND COALESCE(level, 0) <> 0`,
    );

    const [rows] = await connection.query(
      `SELECT id, faceit_guid, level
       FROM jogadores
       WHERE faceit_guid IS NOT NULL
         AND TRIM(faceit_guid) <> ''`,
    );

    const jogadores = Array.isArray(rows) ? rows as Array<{ id: number; faceit_guid: string; level: number | null }> : [];
    if (!jogadores.length) {
      return {
        totalComGuid: 0,
        faceitOk: 0,
        faceitFalhas: 0,
        alterados: 0,
        atualizados: 0,
        semGuidZerados: Number((zeroNoGuidResult as any)?.affectedRows || 0),
        porStatus: {},
      };
    }

    const CONCURRENCY = 8;
    const MAX_PASSES = 4;
    const DELAY_BETWEEN_PASSES_MS = 400;

    const statusCounter: Record<string, number> = {};
    // Mapa de id → nível confirmado pela FACEIT
    const resolvedLevels = new Map<number, number>();

    type JogadorEntry = { id: number; faceit_guid: string; currentLevel: number };

    const allEntries: JogadorEntry[] = jogadores.map((j) => ({
      id: Number(j.id),
      faceit_guid: normalizeText(j.faceit_guid),
      currentLevel: Number(j.level || 0),
    }));

    // FASE 1 — Prioridade: quem está com level null/0 (ainda não tem nível)
    // Tenta até MAX_PASSES vezes; quem recebe nível sai da fila.
    let pendingSemNivel = allEntries.filter((j) => j.currentLevel <= 0);

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      if (!pendingSemNivel.length) break;

      const nextPending: JogadorEntry[] = [];
      const isLastPass = pass === MAX_PASSES;

      const tasks = pendingSemNivel.map((jogador) => async () => {
        const byId = await fetchFaceitJson(`${FACEIT_API_BASE}/players/${encodeURIComponent(jogador.faceit_guid)}`, token);
        const statusKey = String(byId.status ?? 'network_error');
        statusCounter[statusKey] = (statusCounter[statusKey] || 0) + 1;

        if (byId.ok) {
          const level = parseFaceitLevel(byId.data);
          if (level >= 1) {
            resolvedLevels.set(jogador.id, level);
            return;
          }
          // Respondeu mas sem jogo — no último pass registra 0 (sem CS2)
          if (isLastPass) {
            resolvedLevels.set(jogador.id, 0);
            return;
          }
        }

        nextPending.push(jogador);
      });

      await runWithConcurrency(tasks, CONCURRENCY);
      pendingSemNivel = nextPending;

      if (!isLastPass && pendingSemNivel.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PASSES_MS));
      }
    }

    // FASE 2 — Verifica mudança de nível: quem já tinha level > 0
    // Tenta até MAX_PASSES vezes; só atualiza se o nível mudou para >= 1.
    let pendingComNivel = allEntries.filter((j) => j.currentLevel > 0);

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      if (!pendingComNivel.length) break;

      const nextPending: JogadorEntry[] = [];

      const tasks = pendingComNivel.map((jogador) => async () => {
        const byId = await fetchFaceitJson(`${FACEIT_API_BASE}/players/${encodeURIComponent(jogador.faceit_guid)}`, token);
        const statusKey = String(byId.status ?? 'network_error');
        statusCounter[statusKey] = (statusCounter[statusKey] || 0) + 1;

        if (byId.ok) {
          const level = parseFaceitLevel(byId.data);
          if (level >= 1) {
            // Só registra se mudou; se não mudou, não precisa update
            resolvedLevels.set(jogador.id, level);
            return;
          }
          // Respondeu 0 — não rebaixa quem já tinha nível, apenas ignora
          return;
        }

        // Falhou → tenta de novo no próximo pass
        nextPending.push(jogador);
      });

      await runWithConcurrency(tasks, CONCURRENCY);
      pendingComNivel = nextPending;

      if (pass < MAX_PASSES && pendingComNivel.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_PASSES_MS));
      }
    }

    const changedLevels = allEntries
      .filter((j) => {
        if (!resolvedLevels.has(j.id)) return false;
        const nextLevel = resolvedLevels.get(j.id)!;
        // Nunca rebaixa level > 0 para 0
        if (nextLevel === 0 && j.currentLevel > 0) return false;
        return nextLevel !== j.currentLevel;
      })
      .map((j) => ({ id: j.id, nextLevel: resolvedLevels.get(j.id)! }));

    const semNivelTotal = allEntries.filter((j) => j.currentLevel <= 0).length;
    const comNivelTotal = allEntries.filter((j) => j.currentLevel > 0).length;

    if (!changedLevels.length) {
      return {
        totalComGuid: jogadores.length,
        semNivelTotal,
        comNivelTotal,
        resolvidos: resolvedLevels.size,
        naoResolvidos: jogadores.length - resolvedLevels.size,
        alterados: 0,
        atualizados: 0,
        semGuidZerados: Number((zeroNoGuidResult as any)?.affectedRows || 0),
        porStatus: statusCounter,
      };
    }

    const bulkUpdate = buildBulkLevelUpdate(changedLevels);
    const [updateResult] = await connection.query(bulkUpdate.sql, bulkUpdate.params);

    return {
      totalComGuid: jogadores.length,
      semNivelTotal,
      comNivelTotal,
      resolvidos: resolvedLevels.size,
      naoResolvidos: jogadores.length - resolvedLevels.size,
      alterados: changedLevels.length,
      atualizados: Number((updateResult as any)?.affectedRows || 0),
      semGuidZerados: Number((zeroNoGuidResult as any)?.affectedRows || 0),
      porStatus: statusCounter,
    };
  } finally {
    await connection.end();
  }
}

export async function GET(request: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;

    const shouldSyncLevels = new URL(request.url).searchParams.get('syncLevels') === '1';
    let syncResumo: any = null;
    if (shouldSyncLevels) {
      syncResumo = await syncJogadoresLevels(env);
    }

    const jogadores = await getJogadoresEnriquecidos(env, {
      enableServerFaceitFallback: false,
    });

    return NextResponse.json({ jogadores, syncResumo });
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar jogadores.' }, { status: 500 });
  }
}

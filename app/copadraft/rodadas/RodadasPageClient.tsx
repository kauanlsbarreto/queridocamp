"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export type Jogo = {
  rodada: number;
  time1: string;
  time2: string;
  placar?: string | null;
  matchid?: string | null;
};

type Props = {
  jogos: Jogo[];
};

const TOTAL_RODADAS = 7;

function TeamFlag({ teamName }: { teamName: string }) {
  const [index, setIndex] = useState(0);
  const lower = teamName.toLowerCase();
  const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const encLower = encodeURIComponent(lower);
  const encNorm = encodeURIComponent(normalized);
  const candidates = [
    `/selecoes/${encLower}.jpg`,
    `/selecoes/${encNorm}.jpg`,
    `/selecoes/${encLower}.png`,
    `/selecoes/${encNorm}.png`,
  ];

  return (
    <img
      src={candidates[index] ?? candidates[0]}
      alt={teamName}
      className="h-16 w-24 rounded-lg border border-white/20 object-cover shadow-[0_4px_16px_rgba(0,0,0,0.4)] md:h-20 md:w-28"
      onError={() => {
        setIndex((prev) => {
          const next = prev + 1;
          return next < candidates.length ? next : prev;
        });
      }}
    />
  );
}

function MatchCard({ jogo }: { jogo: Jogo }) {
  const predictionId = String(jogo.matchid || "").trim();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#071940]/90 to-[#0a2256]/80 px-4 py-5 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all duration-200 hover:border-cyan-400/30 hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_65%)]" />

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <TeamFlag teamName={jogo.time1} />
          <span className="text-xs font-black uppercase tracking-widest text-white md:text-sm">
            {jogo.time1}
          </span>
        </div>

        <div className="flex flex-col items-center gap-1 px-1">
          {jogo.placar ? (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-[#050e28] px-3 py-1.5 shadow-[0_0_18px_rgba(34,211,238,0.25)]">
                {(() => {
                  const parts = String(jogo.placar).split(/\s*x\s*/i);
                  const s1 = parts[0]?.trim() ?? "?";
                  const s2 = parts[1]?.trim() ?? "?";
                  return (
                    <>
                      <span className="text-lg font-black tabular-nums text-white md:text-xl">{s1}</span>
                      <span className="text-xs font-bold text-cyan-400">x</span>
                      <span className="text-lg font-black tabular-nums text-white md:text-xl">{s2}</span>
                    </>
                  );
                })()}
              </div>
              <span className="text-[9px] uppercase tracking-[0.15em] text-cyan-400/70">Placar</span>
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/40 bg-[#050e28] shadow-[0_0_18px_rgba(34,211,238,0.3)] md:h-12 md:w-12">
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-300 md:text-xs">
                VS
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <TeamFlag teamName={jogo.time2} />
          <span className="text-xs font-black uppercase tracking-widest text-white md:text-sm">
            {jogo.time2}
          </span>
        </div>
      </div>

      {predictionId && (
        <div className="relative mt-4 flex justify-end">
          <Link
            href={`/copadraft/jogos/${encodeURIComponent(predictionId)}`}
            className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white transition hover:bg-blue-500"
          >
            Abrir
          </Link>
        </div>
      )}
    </div>
  );
}

function RoundCard({ rodada, jogos }: { rodada: number; jogos: Jogo[] }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#071331]/85 p-4 shadow-[0_24px_55px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(34,211,238,0.14),transparent_55%)]" />

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/40 bg-cyan-400/10 text-sm font-black text-cyan-300">
            {rodada}
          </div>
          <h2 className="text-base font-black uppercase tracking-[0.08em] text-cyan-200 md:text-lg">
            Rodada {rodada}
          </h2>
        </div>

        {jogos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/50">
            Nenhum jogo definido para esta rodada.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {jogos.map((jogo, idx) => (
              <MatchCard key={`${jogo.rodada}-${jogo.time1}-${jogo.time2}-${idx}`} jogo={jogo} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function RodadasPageClient({ jogos }: Props) {
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    try {
      const legacyKeys = ["rodadas_page_cache", "jogos_page_cache", "desafiar_matches_cache"];
      const hasLegacyCache = legacyKeys.some((key) => sessionStorage.getItem(key) !== null);
      if (!hasLegacyCache) return;

      setIsClearingCache(true);
      for (const key of legacyKeys) {
        sessionStorage.removeItem(key);
      }

      const timer = window.setTimeout(() => {
        window.location.reload();
      }, 900);

      return () => window.clearTimeout(timer);
    } catch {
      // ignore storage access errors
    }
  }, []);

  const byRound = new Map<number, Jogo[]>();
  for (let r = 1; r <= TOTAL_RODADAS; r++) byRound.set(r, []);
  for (const jogo of jogos) {
    const r = Number(jogo.rodada);
    if (r >= 1 && r <= TOTAL_RODADAS) {
      byRound.get(r)!.push(jogo);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030a1e] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_35%),linear-gradient(125deg,rgba(14,165,233,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(120deg,transparent_0%,transparent_35%,rgba(56,189,248,0.35)_50%,transparent_65%,transparent_100%)]" />

      <div className="relative mx-auto max-w-6xl">
        {isClearingCache && (
          <div className="mb-4 rounded-lg border border-amber-300/50 bg-amber-300/10 px-4 py-2 text-center text-sm font-bold uppercase tracking-wide text-amber-200">
            Limpando cache
          </div>
        )}

        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200/90">Copa Draft</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
            Rodadas
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-cyan-100/80 md:text-base">
            Todos os confrontos da fase de grupos, organizados por rodada.
          </p>
        </header>

        {/* Rounds */}
        <div className="flex flex-col gap-6">
          {Array.from({ length: TOTAL_RODADAS }, (_, i) => i + 1).map((rodada) => (
            <RoundCard key={rodada} rodada={rodada} jogos={byRound.get(rodada) ?? []} />
          ))}
        </div>
      </div>
    </main>
  );
}

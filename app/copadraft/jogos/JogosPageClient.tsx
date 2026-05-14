"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";

export type ConfirmedGame = {
  id: number;
  rodada: number | null;
  date: string;
  time: string;
  team1: string;
  team2: string;
  score: string | null;
  isPlayed: boolean;
};

type Props = {
  games: ConfirmedGame[];
};

function formatDateLabel(date: string) {
  const raw = String(date || "").trim();
  if (!raw) return "-";

  let dt: Date | null = null;
  const isoLike = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoLike) {
    dt = new Date(`${isoLike[1]}-${isoLike[2]}-${isoLike[3]}T00:00:00`);
  } else {
    const parsed = new Date(raw);
    if (Number.isFinite(parsed.getTime())) dt = parsed;
  }

  if (!dt || !Number.isFinite(dt.getTime())) return raw;

  if (!Number.isFinite(dt.getTime())) return date;
  return dt.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

function GameCard({ game }: { game: ConfirmedGame }) {
  const hasScore = Boolean(String(game.score || "").trim());
  const now = Date.now();
  const scheduledAt = Number.isFinite(new Date(`${game.date}T${game.time}:00`).getTime())
    ? new Date(`${game.date}T${game.time}:00`).getTime()
    : null;
  const isLive = Boolean(!game.isPlayed && scheduledAt != null && now >= scheduledAt && now <= scheduledAt + 4 * 60 * 60 * 1000);
  const isUpcoming = Boolean(!game.isPlayed && !isLive);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#071940]/90 to-[#0a2256]/80 px-4 py-5 shadow-[0_12px_30px_rgba(0,0,0,0.4)] backdrop-blur-sm transition-all duration-200 hover:border-cyan-400/30 hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_65%)]" />

      <div className="relative mb-3 flex items-center justify-between">
        <span className="rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
          {game.rodada ? `Rodada ${game.rodada}` : "Rodada -"}
        </span>
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border ${
          isLive
            ? "border-red-400/50 bg-red-500/15 text-red-300"
            : isUpcoming
            ? "border-blue-400/50 bg-blue-500/15 text-blue-300"
            : "border-gray-400/40 bg-gray-500/10 text-gray-300"
        }`}>
          {isLive ? "AO VIVO" : isUpcoming ? "EM BREVE" : "FINALIZADA"}
        </span>
        <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/90">
          {game.time}
        </span>
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <TeamFlag teamName={game.team1} />
          <span className="text-xs font-black uppercase tracking-widest text-white md:text-sm">{game.team1}</span>
        </div>

        <div className="flex flex-col items-center gap-1 px-1">
          {hasScore ? (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-[#050e28] px-3 py-1.5 shadow-[0_0_18px_rgba(34,211,238,0.25)]">
                {(() => {
                  const parts = String(game.score).split(/\s*x\s*/i);
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
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-300 md:text-xs">VS</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center gap-2 text-center">
          <TeamFlag teamName={game.team2} />
          <span className="text-xs font-black uppercase tracking-widest text-white md:text-sm">{game.team2}</span>
        </div>
      </div>

      <div className="relative mt-4 flex justify-end">
        <Link
          href={`/copadraft/prediction/${encodeURIComponent(String(game.id))}`}
          className={`inline-flex items-center rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition ${
            isLive
              ? "bg-red-600 text-white hover:bg-red-500"
              : "bg-blue-600 text-white hover:bg-blue-500"
          }`}
        >
          {isLive ? "Ao Vivo" : "Abrir"}
        </Link>
      </div>
    </div>
  );
}

function DateSection({ date, games }: { date: string; games: ConfirmedGame[] }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#071331]/85 p-4 shadow-[0_24px_55px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(34,211,238,0.14),transparent_55%)]" />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-black uppercase tracking-[0.08em] text-cyan-200 md:text-lg">{formatDateLabel(date)}</h2>
          <span className="text-xs text-zinc-300">{games.length} jogo(s)</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function JogosPageClient({ games }: Props) {
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "played">("upcoming");

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

  const upcomingGrouped = useMemo(() => {
    const map = new Map<string, ConfirmedGame[]>();
    for (const game of games.filter((item) => !item.isPlayed)) {
      const dateKey = String(game.date || "").slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(game);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [games]);

  const playedGrouped = useMemo(() => {
    const map = new Map<string, ConfirmedGame[]>();
    for (const game of games.filter((item) => item.isPlayed)) {
      const dateKey = String(game.date || "").slice(0, 10);
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(game);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [games]);

  const activeGrouped = activeTab === "upcoming" ? upcomingGrouped : playedGrouped;
  const upcomingCount = games.filter((item) => !item.isPlayed).length;
  const playedCount = games.filter((item) => item.isPlayed).length;

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
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">Jogos</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-cyan-100/80 md:text-base">
          </p>
        </header>

        <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("upcoming")}
            className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "upcoming"
                ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
                : "border-white/15 bg-white/5 text-zinc-300 hover:border-cyan-300/40"
            }`}
          >
            Próximos jogos ({upcomingCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("played")}
            className={`rounded-lg border px-4 py-2 text-xs font-black uppercase tracking-wider transition ${
              activeTab === "played"
                ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100"
                : "border-white/15 bg-white/5 text-zinc-300 hover:border-cyan-300/40"
            }`}
          >
            Jogos já realizados ({playedCount})
          </button>
        </div>

        {activeGrouped.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#071331]/85 p-8 text-center text-zinc-300">
            {activeTab === "upcoming"
              ? "Nenhum próximo jogo confirmado encontrado."
              : "Nenhum jogo realizado com placar encontrado."}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {activeGrouped.map(([date, dateGames]) => (
              <DateSection key={date} date={date} games={dateGames} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

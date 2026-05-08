"use client";

import { useMemo, useState } from "react";

type Player = {
  nickname: string;
  faceit_guid: string;
  avatar?: string;
};

type Team = {
  nome_time: string;
  jogadores: Player[];
};

type Props = {
  teamsData: Team[];
};

const GROUP_A = [
  "Alemanha",
  "Espanha",
  "Belgica",
  "Italia",
  "Franca",
  "Japao",
  "Portugal",
] as const;

const GROUP_B = [
  "Brasil",
  "Mexico",
  "Holanda",
  "Argentina",
  "Croacia",
  "Inglaterra",
  "Uruguai",
] as const;

function normalizeName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
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
    `/selecoes/${encLower}.webp`,
    `/selecoes/${encNorm}.webp`,
  ];

  return (
    <img
      src={candidates[index]}
      alt={teamName}
      className="h-8 w-12 rounded-sm border border-white/20 object-cover"
      onError={() => {
        setIndex((prev) => {
          const next = prev + 1;
          return next < candidates.length ? next : prev;
        });
      }}
    />
  );
}

function TeamRow({
  team,
  isOpen,
  onToggle,
}: {
  team: Team;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full rounded-xl border border-white/15 bg-white px-3 py-2 text-left transition hover:brightness-95"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <TeamFlag teamName={team.nome_time} />
            <span className="text-sm font-black uppercase tracking-wide text-[#0a1538] md:text-base">
              {team.nome_time}
            </span>
          </div>
          <span className="text-xs font-bold text-[#1e3a8a]">
            {isOpen ? "FECHAR" : "VER ELENCO"}
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="rounded-xl border border-cyan-300/35 bg-[#081430]/90 p-3">
          {team.jogadores.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {team.jogadores.map((player) => {
                const avatar = String(player.avatar || "").trim() || "/images/cs2-player.png";
                return (
                  <div
                    key={`${team.nome_time}-${player.faceit_guid}-${player.nickname}`}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                  >
                    <img
                      src={avatar}
                      alt={player.nickname}
                      className="h-10 w-10 rounded-full border border-cyan-300/40 bg-[#0f1d44]"
                      onError={(e) => {
                        const target = e.currentTarget;
                        target.src = "/images/cs2-player.png";
                      }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{player.nickname}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-white/20 px-3 py-4 text-center text-sm text-white/70">
              Nenhum jogador encontrado para este time.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({
  title,
  teams,
  activeKey,
  setActiveKey,
}: {
  title: string;
  teams: Team[];
  activeKey: string | null;
  setActiveKey: (value: string | null) => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-cyan-300/25 bg-[#071331]/85 p-4 shadow-[0_24px_55px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(34,211,238,0.18),transparent_55%)]" />
      <div className="relative">
        <h2 className="mb-4 text-xl font-black uppercase tracking-[0.08em] text-cyan-200">{title}</h2>
        <div className="space-y-3">
          {teams.map((team) => {
            const key = normalizeName(team.nome_time);
            const isOpen = activeKey === key;
            return (
              <TeamRow
                key={key}
                team={team}
                isOpen={isOpen}
                onToggle={() => setActiveKey(isOpen ? null : key)}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function TimesPageClient({ teamsData }: Props) {
  const [activeTeamKey, setActiveTeamKey] = useState<string | null>(null);

  const teamsByName = useMemo(() => {
    const map = new Map<string, Team>();
    for (const team of teamsData || []) {
      map.set(normalizeName(team.nome_time), team);
    }
    return map;
  }, [teamsData]);

  const groupA = GROUP_A.map((name) => {
    const found = teamsByName.get(normalizeName(name));
    return found || { nome_time: name, jogadores: [] };
  });

  const groupB = GROUP_B.map((name) => {
    const found = teamsByName.get(normalizeName(name));
    return found || { nome_time: name, jogadores: [] };
  });

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#030a1e] px-4 py-10 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_35%),linear-gradient(125deg,rgba(14,165,233,0.18),transparent_35%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(120deg,transparent_0%,transparent_35%,rgba(56,189,248,0.35)_50%,transparent_65%,transparent_100%)]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-200/90">Copa Draft</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-white md:text-5xl">
          Grupos 
          </h1>
        </header>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <GroupCard title="Grupo A" teams={groupA} activeKey={activeTeamKey} setActiveKey={setActiveTeamKey} />
          <GroupCard title="Grupo B" teams={groupB} activeKey={activeTeamKey} setActiveKey={setActiveTeamKey} />
        </div>
      </div>
    </main>
  );
}

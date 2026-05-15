"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_AVATAR = "/images/cs2-player.png";

type StatsEntry = {
  steamId: string;
  nickname: string;
  avatar: string;
  teamName: string | null;
  pote: number;
  round: number;
  map: number | null;
  matchKey: string;
  hltvRating2: number;
  killCount: number;
  assistCount: number;
  deathCount: number;
  killDeathRatio: number;
  damageHealth: number;
  averageDamagePerRound: number;
  utilityDamage: number;
  averageUtilityDamagePerRound: number;
  headshotCount: number;
  headshotPercentage: number;
  kast: number;
  tradeKillCount: number;
  firstKillCount: number;
  firstDeathCount: number;
  mvpCount: number;
  bombPlantedCount: number;
  bombDefusedCount: number;
  score: number;
};

type RoundMapStats = {
  appearances: number;
  hltvRating2: number;
  averageDamagePerRound: number;
  averageUtilityDamagePerRound: number;
  headshotPercentage: number;
  kast: number;
  score: number;
  killCount: number;
  assistCount: number;
  deathCount: number;
  damageHealth: number;
  utilityDamage: number;
  headshotCount: number;
  tradeKillCount: number;
  firstKillCount: number;
  firstDeathCount: number;
  mvpCount: number;
  bombPlantedCount: number;
  bombDefusedCount: number;
};

type AggregatedPlayer = Omit<StatsEntry, "round" | "map" | "matchKey"> & {
  appearances: number;
  roundsPlayed: number[];
  mapBreakdown: Array<{
    map: number;
  } & RoundMapStats>;
  roundBreakdown: Array<{
    round: number;
    map1: RoundMapStats | null;
    map2: RoundMapStats | null;
    totals: Omit<RoundMapStats, "appearances">;
  }>;
};

const POTE_TABS = [
  { label: "Todos", value: 0 },
  { label: "Pote 1", value: 1 },
  { label: "Pote 2", value: 2 },
  { label: "Pote 3", value: 3 },
  { label: "Pote 4", value: 4 },
  { label: "Pote 5", value: 5 },
] as const;

const ROUND_OPTIONS = [
  { label: "Geral", value: "geral" },
  { label: "Rodada 1", value: "1" },
  { label: "Rodada 2", value: "2" },
  { label: "Rodada 3", value: "3" },
  { label: "Rodada 4", value: "4" },
  { label: "Rodada 5", value: "5" },
  { label: "Rodada 6", value: "6" },
  { label: "Rodada 7", value: "7" },
] as const;

const SORT_OPTIONS = [
  { label: "HLTV", value: "hltv" },
  { label: "Kills", value: "kills" },
  { label: "ADR", value: "adr" },
  { label: "Score", value: "score" },
] as const;

type SortOption = (typeof SORT_OPTIONS)[number]["value"];

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeNickname(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildPlayerAggregateKey(entry: Pick<StatsEntry, "steamId" | "nickname">) {
  const steamId = String(entry?.steamId || "").trim();
  if (steamId) return `steam:${steamId}`;
  return `nick:${normalizeNickname(entry?.nickname)}`;
}

function formatPct(value: number) {
  return `${toNumber(value).toFixed(1)}%`;
}

function TeamFlag({ teamName }: { teamName: string | null }) {
  const normalizedTeamName = String(teamName || "").trim();
  const [index, setIndex] = useState(0);

  if (!normalizedTeamName) return null;

  const lower = normalizedTeamName.toLowerCase();
  const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const encodedLower = encodeURIComponent(lower);
  const encodedNormalized = encodeURIComponent(normalized);
  const candidates = [
    `/selecoes/${encodedLower}.jpg`,
    `/selecoes/${encodedNormalized}.jpg`,
    `/selecoes/${encodedLower}.png`,
    `/selecoes/${encodedNormalized}.png`,
    `/selecoes/${encodedLower}.webp`,
    `/selecoes/${encodedNormalized}.webp`,
  ];

  return (
    <img
      src={candidates[index] || candidates[0]}
      alt={normalizedTeamName}
      title={normalizedTeamName}
      className="h-8 w-12 rounded-md border border-cyan-300/30 object-cover shadow-[0_4px_12px_rgba(0,0,0,0.25)]"
      onError={() => {
        setIndex((prev) => {
          const next = prev + 1;
          return next < candidates.length ? next : prev;
        });
      }}
    />
  );
}

function StatLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-200">
      <span className="text-zinc-400">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}

function EqStatLine({
  label,
  left,
  right,
  total,
  divisor,
}: {
  label: string;
  left: string;
  right: string;
  total: string;
  divisor?: number;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 px-2 py-1.5 text-xs">
      <span className="text-zinc-400">{label}</span>
      <span className="font-black uppercase tracking-wide text-white/95">
        {divisor ? <span className="text-white/35">(</span> : null}
        <span className="text-white/45">{left}</span>
        <span className="px-1 text-white/35">+</span>
        <span className="text-white/45">{right}</span>
        {divisor ? (
          <>
            <span className="text-white/35">)</span>
            <span className="px-1 text-white/35">/</span>
            <span className="text-white/45">{divisor}</span>
          </>
        ) : null}
        <span className="px-1 text-white/35">=</span>
        <span className="text-cyan-100">{total}</span>
      </span>
    </div>
  );
}

function PlayerCard({
  player,
  isOpen,
  onToggle,
  selectedRound,
}: {
  player: AggregatedPlayer;
  isOpen: boolean;
  onToggle: () => void;
  selectedRound: string;
}) {
  const equationRounds = player.roundBreakdown.filter((item) => item.map1 || item.map2);
  const canShowEquation = selectedRound !== "geral" && equationRounds.length > 0;
  const roundsLabel =
    player.roundsPlayed.length > 0
      ? `Rodadas: ${player.roundsPlayed.slice().sort((a, b) => a - b).join(", ")}`
      : "Rodadas: -";

  function avgMapStat(value: number, appearances: number) {
    if (!appearances) return 0;
    return value / appearances;
  }

  function mapAvg(
    mapData: RoundMapStats | null,
    field:
      | "hltvRating2"
      | "averageDamagePerRound"
      | "averageUtilityDamagePerRound"
      | "headshotPercentage"
      | "kast"
      | "score"
  ) {
    if (!mapData || !mapData.appearances) return null;
    return avgMapStat(mapData[field], mapData.appearances);
  }

  function mapAvgFormatted(
    mapData: RoundMapStats | null,
    field:
      | "hltvRating2"
      | "averageDamagePerRound"
      | "averageUtilityDamagePerRound"
      | "headshotPercentage"
      | "kast"
      | "score",
    decimals: number,
    withPct = false
  ) {
    const value = mapAvg(mapData, field);
    if (value === null) return "-";
    const fixed = value.toFixed(decimals);
    return withPct ? `${fixed}%` : fixed;
  }

  function mapInt(
    mapData: RoundMapStats | null,
    field:
      | "killCount"
      | "assistCount"
      | "deathCount"
      | "damageHealth"
      | "utilityDamage"
      | "headshotCount"
      | "tradeKillCount"
      | "firstKillCount"
      | "firstDeathCount"
      | "mvpCount"
      | "bombPlantedCount"
      | "bombDefusedCount"
  ) {
    if (!mapData) return "-";
    return String(mapData[field]);
  }

  function mapKd(mapData: RoundMapStats | null) {
    if (!mapData) return null;
    if (mapData.deathCount > 0) return mapData.killCount / mapData.deathCount;
    return mapData.killCount > 0 ? mapData.killCount : 0;
  }

  return (
    <article className="self-start rounded-xl border border-cyan-300/20 bg-[#071331]/80 p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
      <div className="mb-3 flex items-center gap-3">
        <img
          src={player.avatar || DEFAULT_AVATAR}
          alt={player.nickname}
          className="h-12 w-12 rounded-full border border-cyan-300/40 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black uppercase tracking-wide text-white">{player.nickname}</p>
          <p className="text-[11px] text-cyan-200/85">Pote {player.pote}</p>
          <p className="text-[10px] text-zinc-300/80">{roundsLabel}</p>
        </div>
        <span className={`text-2xl font-black leading-none ${player.score >= 70 ? "text-green-400" : player.score >= 60 ? "text-yellow-400" : "text-red-500"}`}>{Math.round(player.score)}</span>
        <TeamFlag teamName={player.teamName} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <StatLine label="HLTV 2.0" value={player.hltvRating2.toFixed(2)} />
        <StatLine label="Kills" value={player.killCount} />
        <StatLine label="Mortes" value={player.deathCount} />
        <StatLine label="ADR" value={player.averageDamagePerRound.toFixed(1)} />
      </div>

      <div className="mt-3 rounded-lg border border-white/10 bg-black/10 p-2">
        <button
          type="button"
          onClick={onToggle}
          className="w-full cursor-pointer text-center text-xs font-bold uppercase tracking-wider text-cyan-300"
        >
          {isOpen ? "Mostrar menos" : "Mostrar mais"}
        </button>

        {isOpen ? (
          <div className="mt-2 grid grid-cols-1 gap-1.5">
            {canShowEquation ? (
              <>
                {equationRounds.map((roundItem) => {
                  const averageDivisor = (roundItem.map1 ? 1 : 0) + (roundItem.map2 ? 1 : 0) || 1;
                  const totalKd =
                    roundItem.totals.deathCount > 0
                      ? roundItem.totals.killCount / roundItem.totals.deathCount
                      : roundItem.totals.killCount > 0
                        ? roundItem.totals.killCount
                        : 0;

                  return (
                    <div key={`round-eq-${player.steamId}-${roundItem.round}`} className="rounded-lg border border-white/10 bg-black/10 p-2">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cyan-200/90">Rodada {roundItem.round}</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        <EqStatLine
                          label="HLTV 2.0 (M1 + M2)"
                          left={mapAvgFormatted(roundItem.map1, "hltvRating2", 2)}
                          right={mapAvgFormatted(roundItem.map2, "hltvRating2", 2)}
                          total={roundItem.totals.hltvRating2.toFixed(2)}
                          divisor={averageDivisor}
                        />
                        <EqStatLine
                          label="ADR (M1 + M2)"
                          left={mapAvgFormatted(roundItem.map1, "averageDamagePerRound", 1)}
                          right={mapAvgFormatted(roundItem.map2, "averageDamagePerRound", 1)}
                          total={roundItem.totals.averageDamagePerRound.toFixed(1)}
                          divisor={averageDivisor}
                        />
                        <EqStatLine
                          label="Score (M1 + M2)"
                          left={mapAvgFormatted(roundItem.map1, "score", 1)}
                          right={mapAvgFormatted(roundItem.map2, "score", 1)}
                          total={roundItem.totals.score.toFixed(1)}
                          divisor={averageDivisor}
                        />
                        <EqStatLine
                          label="HS% (M1 + M2)"
                          left={mapAvgFormatted(roundItem.map1, "headshotPercentage", 1, true)}
                          right={mapAvgFormatted(roundItem.map2, "headshotPercentage", 1, true)}
                          total={formatPct(roundItem.totals.headshotPercentage)}
                          divisor={averageDivisor}
                        />
                        <EqStatLine
                          label="KAST (M1 + M2)"
                          left={mapAvgFormatted(roundItem.map1, "kast", 1, true)}
                          right={mapAvgFormatted(roundItem.map2, "kast", 1, true)}
                          total={formatPct(roundItem.totals.kast)}
                          divisor={averageDivisor}
                        />
                        <EqStatLine
                          label="Kills (M1 + M2)"
                          left={mapInt(roundItem.map1, "killCount")}
                          right={mapInt(roundItem.map2, "killCount")}
                          total={String(roundItem.totals.killCount)}
                        />
                        <EqStatLine
                          label="Assistencias (M1 + M2)"
                          left={mapInt(roundItem.map1, "assistCount")}
                          right={mapInt(roundItem.map2, "assistCount")}
                          total={String(roundItem.totals.assistCount)}
                        />
                        <EqStatLine
                          label="Mortes (M1 + M2)"
                          left={mapInt(roundItem.map1, "deathCount")}
                          right={mapInt(roundItem.map2, "deathCount")}
                          total={String(roundItem.totals.deathCount)}
                        />
                        <EqStatLine
                          label="K/D (Kills/Mortes)"
                          left={
                            roundItem.map1
                              ? `${roundItem.map1.killCount}/${roundItem.map1.deathCount} (${(mapKd(roundItem.map1) || 0).toFixed(2)})`
                              : "-"
                          }
                          right={
                            roundItem.map2
                              ? `${roundItem.map2.killCount}/${roundItem.map2.deathCount} (${(mapKd(roundItem.map2) || 0).toFixed(2)})`
                              : "-"
                          }
                          total={`${roundItem.totals.killCount}/${roundItem.totals.deathCount} (${totalKd.toFixed(2)})`}
                        />
                        <EqStatLine
                          label="Dano total (M1 + M2)"
                          left={mapInt(roundItem.map1, "damageHealth")}
                          right={mapInt(roundItem.map2, "damageHealth")}
                          total={String(roundItem.totals.damageHealth)}
                        />
                        <EqStatLine
                          label="Dano utilitario (M1 + M2)"
                          left={mapInt(roundItem.map1, "utilityDamage")}
                          right={mapInt(roundItem.map2, "utilityDamage")}
                          total={String(roundItem.totals.utilityDamage)}
                        />
                        <EqStatLine
                          label="Media utilitario/round (M1 + M2)"
                          left={mapAvgFormatted(roundItem.map1, "averageUtilityDamagePerRound", 1)}
                          right={mapAvgFormatted(roundItem.map2, "averageUtilityDamagePerRound", 1)}
                          total={roundItem.totals.averageUtilityDamagePerRound.toFixed(1)}
                          divisor={averageDivisor}
                        />
                        <EqStatLine
                          label="Headshots (M1 + M2)"
                          left={mapInt(roundItem.map1, "headshotCount")}
                          right={mapInt(roundItem.map2, "headshotCount")}
                          total={String(roundItem.totals.headshotCount)}
                        />
                        <EqStatLine
                          label="Trade kills (M1 + M2)"
                          left={mapInt(roundItem.map1, "tradeKillCount")}
                          right={mapInt(roundItem.map2, "tradeKillCount")}
                          total={String(roundItem.totals.tradeKillCount)}
                        />
                        <EqStatLine
                          label="First kills (M1 + M2)"
                          left={mapInt(roundItem.map1, "firstKillCount")}
                          right={mapInt(roundItem.map2, "firstKillCount")}
                          total={String(roundItem.totals.firstKillCount)}
                        />
                        <EqStatLine
                          label="First deaths (M1 + M2)"
                          left={mapInt(roundItem.map1, "firstDeathCount")}
                          right={mapInt(roundItem.map2, "firstDeathCount")}
                          total={String(roundItem.totals.firstDeathCount)}
                        />
                        <EqStatLine
                          label="MVPs (M1 + M2)"
                          left={mapInt(roundItem.map1, "mvpCount")}
                          right={mapInt(roundItem.map2, "mvpCount")}
                          total={String(roundItem.totals.mvpCount)}
                        />
                        <EqStatLine
                          label="Bombs plantadas (M1 + M2)"
                          left={mapInt(roundItem.map1, "bombPlantedCount")}
                          right={mapInt(roundItem.map2, "bombPlantedCount")}
                          total={String(roundItem.totals.bombPlantedCount)}
                        />
                        <EqStatLine
                          label="Bombs defusadas (M1 + M2)"
                          left={mapInt(roundItem.map1, "bombDefusedCount")}
                          right={mapInt(roundItem.map2, "bombDefusedCount")}
                          total={String(roundItem.totals.bombDefusedCount)}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            ) : null}
            {!canShowEquation ? <StatLine label="Assistências" value={player.assistCount} /> : null}
            {!canShowEquation ? <StatLine label="K/D" value={player.killDeathRatio.toFixed(2)} /> : null}
            {!canShowEquation ? <StatLine label="Dano total" value={player.damageHealth} /> : null}
            {!canShowEquation ? <StatLine label="Dano utilitário" value={player.utilityDamage} /> : null}
            {!canShowEquation ? <StatLine label="Média utilitário/round" value={player.averageUtilityDamagePerRound.toFixed(1)} /> : null}
            {!canShowEquation ? <StatLine label="Headshots" value={player.headshotCount} /> : null}
            {!canShowEquation ? <StatLine label="Headshot %" value={formatPct(player.headshotPercentage)} /> : null}
            {!canShowEquation ? <StatLine label="KAST" value={formatPct(player.kast)} /> : null}
            {!canShowEquation ? <StatLine label="Trade kills" value={player.tradeKillCount} /> : null}
            {!canShowEquation ? <StatLine label="First kills" value={player.firstKillCount} /> : null}
            {!canShowEquation ? <StatLine label="First deaths" value={player.firstDeathCount} /> : null}
            {!canShowEquation ? <StatLine label="MVPs" value={player.mvpCount} /> : null}
            {!canShowEquation ? <StatLine label="Bombs plantadas" value={player.bombPlantedCount} /> : null}
            {!canShowEquation ? <StatLine label="Bombs defusadas" value={player.bombDefusedCount} /> : null}
            {!canShowEquation ? <StatLine label="Score" value={player.score.toFixed(1)} /> : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function StatsCardsClient({ entries }: { entries: StatsEntry[] }) {
  const router = useRouter();
  const [selectedPote, setSelectedPote] = useState<number>(0);
  const [selectedRound, setSelectedRound] = useState<string>("geral");
  const [selectedSort, setSelectedSort] = useState<SortOption>("hltv");
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [faceitGuid, setFaceitGuid] = useState<string>("");
  const [adminLevel, setAdminLevel] = useState<number>(0);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin12 = adminLevel === 1 || adminLevel === 2;
  const canShowUploadButton = isAdmin12 && Boolean(faceitGuid);
  const hasAnyData = entries.length > 0;

  useEffect(() => {
    try {
      const raw = localStorage.getItem("faceit_user");
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        faceit_guid?: string;
        Admin?: number | string;
        admin?: number | string;
      };

      setFaceitGuid(String(parsed?.faceit_guid || "").trim());
      const level = Number(parsed?.Admin ?? parsed?.admin ?? 0);
      setAdminLevel(Number.isFinite(level) ? level : 0);
    } catch {
      setFaceitGuid("");
      setAdminLevel(0);
    }
  }, []);

  async function handleFileSelected(file: File | null) {
    if (!file) return;

    if (!isAdmin12) {
      window.alert("Apenas Admin 1 e 2 podem enviar JSON.");
      return;
    }

    if (!faceitGuid) {
      window.alert("Faça login como admin para enviar arquivos.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("faceit_guid", faceitGuid);
      formData.append("file", file);

      const response = await fetch("/api/copadraft/stats/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const availableTeams = Array.isArray(data?.availableTeams) ? data.availableTeams.join(", ") : "";
        const message = String(data?.message || "Falha ao enviar arquivo.");
        window.alert(availableTeams ? `${message}\n\nTimes válidos: ${availableTeams}` : message);
        return;
      }

      const warnings = Array.isArray(data?.warnings) ? data.warnings.filter(Boolean) : [];
      const message = String(data?.message || "Upload concluído com sucesso.");
      if (warnings.length > 0) {
        window.alert(`${message}\n\nAvisos:\n- ${warnings.join("\n- ")}`);
      } else {
        window.alert(message);
      }
      router.refresh();
    } catch {
      window.alert("Erro inesperado ao enviar arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const players = useMemo(() => {
    const filtered = entries.filter((entry) => {
      const matchPote = selectedPote === 0 || entry.pote === selectedPote;
      const matchRound = selectedRound === "geral" || entry.round === Number(selectedRound);
      return matchPote && matchRound;
    });

    const byPlayer = new Map<string, AggregatedPlayer>();
    const playerRounds = new Map<string, Set<number>>();
    const playerMaps = new Map<
      string,
      Map<
        number,
        {
          map: number;
        } & RoundMapStats
      >
    >();
    const playerRoundMaps = new Map<
      string,
      Map<
        number,
        Map<number, RoundMapStats>
      >
    >();
    const playerRoundTotals = new Map<string, Map<number, RoundMapStats>>();

    for (const entry of filtered) {
      const key = buildPlayerAggregateKey(entry);
      const current = byPlayer.get(key);

      if (!current) {
        byPlayer.set(key, {
          steamId: entry.steamId,
          nickname: entry.nickname,
          avatar: entry.avatar,
          teamName: entry.teamName,
          pote: entry.pote,
          appearances: 1,
          hltvRating2: entry.hltvRating2,
          killCount: entry.killCount,
          assistCount: entry.assistCount,
          deathCount: entry.deathCount,
          killDeathRatio: 0,
          damageHealth: entry.damageHealth,
          averageDamagePerRound: entry.averageDamagePerRound,
          utilityDamage: entry.utilityDamage,
          averageUtilityDamagePerRound: entry.averageUtilityDamagePerRound,
          headshotCount: entry.headshotCount,
          headshotPercentage: entry.headshotPercentage,
          kast: entry.kast,
          tradeKillCount: entry.tradeKillCount,
          firstKillCount: entry.firstKillCount,
          firstDeathCount: entry.firstDeathCount,
          mvpCount: entry.mvpCount,
          bombPlantedCount: entry.bombPlantedCount,
          bombDefusedCount: entry.bombDefusedCount,
          score: entry.score,
          roundsPlayed: [entry.round],
          mapBreakdown: [],
          roundBreakdown: [],
        });

        playerRounds.set(key, new Set<number>([entry.round]));

        if (entry.map !== null) {
          playerMaps.set(
            key,
            new Map([
              [
                entry.map,
                {
                  map: entry.map,
                  appearances: 1,
                  hltvRating2: entry.hltvRating2,
                  averageDamagePerRound: entry.averageDamagePerRound,
                  averageUtilityDamagePerRound: entry.averageUtilityDamagePerRound,
                  headshotPercentage: entry.headshotPercentage,
                  kast: entry.kast,
                  score: entry.score,
                  killCount: entry.killCount,
                  assistCount: entry.assistCount,
                  deathCount: entry.deathCount,
                  damageHealth: entry.damageHealth,
                  utilityDamage: entry.utilityDamage,
                  headshotCount: entry.headshotCount,
                  tradeKillCount: entry.tradeKillCount,
                  firstKillCount: entry.firstKillCount,
                  firstDeathCount: entry.firstDeathCount,
                  mvpCount: entry.mvpCount,
                  bombPlantedCount: entry.bombPlantedCount,
                  bombDefusedCount: entry.bombDefusedCount,
                },
              ],
            ])
          );
        }

        const newRoundTotals = new Map<number, RoundMapStats>();
        newRoundTotals.set(entry.round, {
          appearances: 1,
          hltvRating2: entry.hltvRating2,
          averageDamagePerRound: entry.averageDamagePerRound,
          averageUtilityDamagePerRound: entry.averageUtilityDamagePerRound,
          headshotPercentage: entry.headshotPercentage,
          kast: entry.kast,
          score: entry.score,
          killCount: entry.killCount,
          assistCount: entry.assistCount,
          deathCount: entry.deathCount,
          damageHealth: entry.damageHealth,
          utilityDamage: entry.utilityDamage,
          headshotCount: entry.headshotCount,
          tradeKillCount: entry.tradeKillCount,
          firstKillCount: entry.firstKillCount,
          firstDeathCount: entry.firstDeathCount,
          mvpCount: entry.mvpCount,
          bombPlantedCount: entry.bombPlantedCount,
          bombDefusedCount: entry.bombDefusedCount,
        });
        playerRoundTotals.set(key, newRoundTotals);

        if (entry.map !== null) {
          const newRoundMapBucket = new Map<number, Map<number, RoundMapStats>>();

          newRoundMapBucket.set(
            entry.round,
            new Map([
              [
                entry.map,
                {
                  appearances: 1,
                  hltvRating2: entry.hltvRating2,
                  averageDamagePerRound: entry.averageDamagePerRound,
                  averageUtilityDamagePerRound: entry.averageUtilityDamagePerRound,
                  headshotPercentage: entry.headshotPercentage,
                  kast: entry.kast,
                  score: entry.score,
                  killCount: entry.killCount,
                  assistCount: entry.assistCount,
                  deathCount: entry.deathCount,
                  damageHealth: entry.damageHealth,
                  utilityDamage: entry.utilityDamage,
                  headshotCount: entry.headshotCount,
                  tradeKillCount: entry.tradeKillCount,
                  firstKillCount: entry.firstKillCount,
                  firstDeathCount: entry.firstDeathCount,
                  mvpCount: entry.mvpCount,
                  bombPlantedCount: entry.bombPlantedCount,
                  bombDefusedCount: entry.bombDefusedCount,
                },
              ],
            ])
          );

          playerRoundMaps.set(key, newRoundMapBucket);
        }

        continue;
      }

      current.appearances += 1;
      current.hltvRating2 += entry.hltvRating2;
      current.killCount += entry.killCount;
      current.assistCount += entry.assistCount;
      current.deathCount += entry.deathCount;
      current.damageHealth += entry.damageHealth;
      current.averageDamagePerRound += entry.averageDamagePerRound;
      current.utilityDamage += entry.utilityDamage;
      current.averageUtilityDamagePerRound += entry.averageUtilityDamagePerRound;
      current.headshotCount += entry.headshotCount;
      current.headshotPercentage += entry.headshotPercentage;
      current.kast += entry.kast;
      current.tradeKillCount += entry.tradeKillCount;
      current.firstKillCount += entry.firstKillCount;
      current.firstDeathCount += entry.firstDeathCount;
      current.mvpCount += entry.mvpCount;
      current.bombPlantedCount += entry.bombPlantedCount;
      current.bombDefusedCount += entry.bombDefusedCount;
      current.score += entry.score;

      const roundsSet = playerRounds.get(key) || new Set<number>();
      roundsSet.add(entry.round);
      playerRounds.set(key, roundsSet);

      if (entry.map !== null) {
        const mapBuckets = playerMaps.get(key) || new Map();
        const currentMap = mapBuckets.get(entry.map);

        if (!currentMap) {
          mapBuckets.set(entry.map, {
            map: entry.map,
            appearances: 1,
            hltvRating2: entry.hltvRating2,
            averageDamagePerRound: entry.averageDamagePerRound,
            averageUtilityDamagePerRound: entry.averageUtilityDamagePerRound,
            headshotPercentage: entry.headshotPercentage,
            kast: entry.kast,
            score: entry.score,
            killCount: entry.killCount,
            assistCount: entry.assistCount,
            deathCount: entry.deathCount,
            damageHealth: entry.damageHealth,
            utilityDamage: entry.utilityDamage,
            headshotCount: entry.headshotCount,
            tradeKillCount: entry.tradeKillCount,
            firstKillCount: entry.firstKillCount,
            firstDeathCount: entry.firstDeathCount,
            mvpCount: entry.mvpCount,
            bombPlantedCount: entry.bombPlantedCount,
            bombDefusedCount: entry.bombDefusedCount,
          });
        } else {
          currentMap.appearances += 1;
          currentMap.hltvRating2 += entry.hltvRating2;
          currentMap.averageDamagePerRound += entry.averageDamagePerRound;
          currentMap.averageUtilityDamagePerRound += entry.averageUtilityDamagePerRound;
          currentMap.headshotPercentage += entry.headshotPercentage;
          currentMap.kast += entry.kast;
          currentMap.score += entry.score;
          currentMap.killCount += entry.killCount;
          currentMap.assistCount += entry.assistCount;
          currentMap.deathCount += entry.deathCount;
          currentMap.damageHealth += entry.damageHealth;
          currentMap.utilityDamage += entry.utilityDamage;
          currentMap.headshotCount += entry.headshotCount;
          currentMap.tradeKillCount += entry.tradeKillCount;
          currentMap.firstKillCount += entry.firstKillCount;
          currentMap.firstDeathCount += entry.firstDeathCount;
          currentMap.mvpCount += entry.mvpCount;
          currentMap.bombPlantedCount += entry.bombPlantedCount;
          currentMap.bombDefusedCount += entry.bombDefusedCount;
        }

        playerMaps.set(key, mapBuckets);
      }

      const roundTotalsByRound = playerRoundTotals.get(key) || new Map();
      const currentRoundTotal = roundTotalsByRound.get(entry.round);
      if (!currentRoundTotal) {
        roundTotalsByRound.set(entry.round, {
          appearances: 1,
          hltvRating2: entry.hltvRating2,
          averageDamagePerRound: entry.averageDamagePerRound,
          averageUtilityDamagePerRound: entry.averageUtilityDamagePerRound,
          headshotPercentage: entry.headshotPercentage,
          kast: entry.kast,
          score: entry.score,
          killCount: entry.killCount,
          assistCount: entry.assistCount,
          deathCount: entry.deathCount,
          damageHealth: entry.damageHealth,
          utilityDamage: entry.utilityDamage,
          headshotCount: entry.headshotCount,
          tradeKillCount: entry.tradeKillCount,
          firstKillCount: entry.firstKillCount,
          firstDeathCount: entry.firstDeathCount,
          mvpCount: entry.mvpCount,
          bombPlantedCount: entry.bombPlantedCount,
          bombDefusedCount: entry.bombDefusedCount,
        });
      } else {
        currentRoundTotal.appearances += 1;
        currentRoundTotal.hltvRating2 += entry.hltvRating2;
        currentRoundTotal.averageDamagePerRound += entry.averageDamagePerRound;
        currentRoundTotal.averageUtilityDamagePerRound += entry.averageUtilityDamagePerRound;
        currentRoundTotal.headshotPercentage += entry.headshotPercentage;
        currentRoundTotal.kast += entry.kast;
        currentRoundTotal.score += entry.score;
        currentRoundTotal.killCount += entry.killCount;
        currentRoundTotal.assistCount += entry.assistCount;
        currentRoundTotal.deathCount += entry.deathCount;
        currentRoundTotal.damageHealth += entry.damageHealth;
        currentRoundTotal.utilityDamage += entry.utilityDamage;
        currentRoundTotal.headshotCount += entry.headshotCount;
        currentRoundTotal.tradeKillCount += entry.tradeKillCount;
        currentRoundTotal.firstKillCount += entry.firstKillCount;
        currentRoundTotal.firstDeathCount += entry.firstDeathCount;
        currentRoundTotal.mvpCount += entry.mvpCount;
        currentRoundTotal.bombPlantedCount += entry.bombPlantedCount;
        currentRoundTotal.bombDefusedCount += entry.bombDefusedCount;
      }
      playerRoundTotals.set(key, roundTotalsByRound);

      if (entry.map !== null) {
        const roundMapsByRound = playerRoundMaps.get(key) || new Map();
        const roundMapBucket = roundMapsByRound.get(entry.round) || new Map();
        const currentRoundMap = roundMapBucket.get(entry.map);

        if (!currentRoundMap) {
          roundMapBucket.set(entry.map, {
            appearances: 1,
            hltvRating2: entry.hltvRating2,
            averageDamagePerRound: entry.averageDamagePerRound,
            averageUtilityDamagePerRound: entry.averageUtilityDamagePerRound,
            headshotPercentage: entry.headshotPercentage,
            kast: entry.kast,
            score: entry.score,
            killCount: entry.killCount,
            assistCount: entry.assistCount,
            deathCount: entry.deathCount,
            damageHealth: entry.damageHealth,
            utilityDamage: entry.utilityDamage,
            headshotCount: entry.headshotCount,
            tradeKillCount: entry.tradeKillCount,
            firstKillCount: entry.firstKillCount,
            firstDeathCount: entry.firstDeathCount,
            mvpCount: entry.mvpCount,
            bombPlantedCount: entry.bombPlantedCount,
            bombDefusedCount: entry.bombDefusedCount,
          });
        } else {
          currentRoundMap.appearances += 1;
          currentRoundMap.hltvRating2 += entry.hltvRating2;
          currentRoundMap.averageDamagePerRound += entry.averageDamagePerRound;
          currentRoundMap.averageUtilityDamagePerRound += entry.averageUtilityDamagePerRound;
          currentRoundMap.headshotPercentage += entry.headshotPercentage;
          currentRoundMap.kast += entry.kast;
          currentRoundMap.score += entry.score;
          currentRoundMap.killCount += entry.killCount;
          currentRoundMap.assistCount += entry.assistCount;
          currentRoundMap.deathCount += entry.deathCount;
          currentRoundMap.damageHealth += entry.damageHealth;
          currentRoundMap.utilityDamage += entry.utilityDamage;
          currentRoundMap.headshotCount += entry.headshotCount;
          currentRoundMap.tradeKillCount += entry.tradeKillCount;
          currentRoundMap.firstKillCount += entry.firstKillCount;
          currentRoundMap.firstDeathCount += entry.firstDeathCount;
          currentRoundMap.mvpCount += entry.mvpCount;
          currentRoundMap.bombPlantedCount += entry.bombPlantedCount;
          currentRoundMap.bombDefusedCount += entry.bombDefusedCount;
        }

        roundMapsByRound.set(entry.round, roundMapBucket);
        playerRoundMaps.set(key, roundMapsByRound);
      }
    }

    const result = Array.from(byPlayer.values()).map((player) => {
      const key = buildPlayerAggregateKey(player);
      const count = Math.max(1, player.appearances);
      const hltv = player.hltvRating2 / count;
      const adr = player.averageDamagePerRound / count;
      const score = selectedRound === "geral" ? player.score / count : player.score / 2;
      const headshotPct = player.headshotPercentage / count;
      const kast = player.kast / count;
      const utilityAdr = player.averageUtilityDamagePerRound / count;
      const roundTotalsByRound = playerRoundTotals.get(key) || new Map();
      const roundMapsByRound = playerRoundMaps.get(key) || new Map();

      const roundBreakdown = Array.from(roundTotalsByRound.entries())
        .map(([round, totals]) => {
          const perRoundCount = Math.max(1, totals.appearances);
          const maps = roundMapsByRound.get(round) || new Map();
          const map1 = maps.get(1) || null;
          const map2 = maps.get(2) || null;

          return {
            round,
            map1,
            map2,
            totals: {
              hltvRating2: totals.hltvRating2 / perRoundCount,
              averageDamagePerRound: totals.averageDamagePerRound / perRoundCount,
              averageUtilityDamagePerRound: totals.averageUtilityDamagePerRound / perRoundCount,
              headshotPercentage: totals.headshotPercentage / perRoundCount,
              kast: totals.kast / perRoundCount,
              score: totals.score / perRoundCount,
              killCount: totals.killCount,
              assistCount: totals.assistCount,
              deathCount: totals.deathCount,
              damageHealth: totals.damageHealth,
              utilityDamage: totals.utilityDamage,
              headshotCount: totals.headshotCount,
              tradeKillCount: totals.tradeKillCount,
              firstKillCount: totals.firstKillCount,
              firstDeathCount: totals.firstDeathCount,
              mvpCount: totals.mvpCount,
              bombPlantedCount: totals.bombPlantedCount,
              bombDefusedCount: totals.bombDefusedCount,
            },
          };
        })
        .sort((a, b) => a.round - b.round);

      const kd = player.deathCount > 0 ? player.killCount / player.deathCount : (player.killCount > 0 ? player.killCount : 0);

      return {
        steamId: player.steamId,
        nickname: player.nickname,
        avatar: player.avatar,
        teamName: player.teamName,
        pote: player.pote,
        appearances: player.appearances,
        hltvRating2: hltv,
        killCount: player.killCount,
        assistCount: player.assistCount,
        deathCount: player.deathCount,
        killDeathRatio: kd,
        damageHealth: player.damageHealth,
        averageDamagePerRound: adr,
        utilityDamage: player.utilityDamage,
        averageUtilityDamagePerRound: utilityAdr,
        headshotCount: player.headshotCount,
        headshotPercentage: headshotPct,
        kast,
        tradeKillCount: player.tradeKillCount,
        firstKillCount: player.firstKillCount,
        firstDeathCount: player.firstDeathCount,
        mvpCount: player.mvpCount,
        bombPlantedCount: player.bombPlantedCount,
        bombDefusedCount: player.bombDefusedCount,
        score,
        roundsPlayed: Array.from(playerRounds.get(key) || []),
        mapBreakdown: Array.from(
          (playerMaps.get(key) || new Map()).values()
        ).sort((a, b) => a.map - b.map),
        roundBreakdown,
      };
    });

    result.sort((a, b) => {
      if (selectedSort === "kills") {
        if (b.killCount !== a.killCount) return b.killCount - a.killCount;
        if (b.hltvRating2 !== a.hltvRating2) return b.hltvRating2 - a.hltvRating2;
        if (b.averageDamagePerRound !== a.averageDamagePerRound) return b.averageDamagePerRound - a.averageDamagePerRound;
        return a.deathCount - b.deathCount;
      }

      if (selectedSort === "adr") {
        if (b.averageDamagePerRound !== a.averageDamagePerRound) return b.averageDamagePerRound - a.averageDamagePerRound;
        if (b.hltvRating2 !== a.hltvRating2) return b.hltvRating2 - a.hltvRating2;
        if (b.killCount !== a.killCount) return b.killCount - a.killCount;
        return a.deathCount - b.deathCount;
      }

      if (selectedSort === "score") {
        if (b.score !== a.score) return b.score - a.score;
        if (b.hltvRating2 !== a.hltvRating2) return b.hltvRating2 - a.hltvRating2;
        if (b.killCount !== a.killCount) return b.killCount - a.killCount;
        return a.deathCount - b.deathCount;
      }

      if (b.hltvRating2 !== a.hltvRating2) return b.hltvRating2 - a.hltvRating2;
      if (b.killCount !== a.killCount) return b.killCount - a.killCount;
      if (b.averageDamagePerRound !== a.averageDamagePerRound) return b.averageDamagePerRound - a.averageDamagePerRound;
      return a.deathCount - b.deathCount;
    });

    return result;
  }, [entries, selectedPote, selectedRound, selectedSort]);

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-[#071331]/85 p-4 shadow-[0_24px_55px_rgba(0,0,0,0.35)] backdrop-blur-sm md:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {POTE_TABS.map((tab) => {
            const active = selectedPote === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setSelectedPote(tab.value);
                  setOpenCardId(null);
                }}
                className={`rounded-md border px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                  active
                    ? "border-cyan-300/70 bg-cyan-300/15 text-cyan-100"
                    : "border-white/20 bg-black/20 text-zinc-300 hover:border-cyan-300/40 hover:text-cyan-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {hasAnyData ? (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="rodada-filter" className="text-xs font-bold uppercase tracking-wider text-cyan-200/90">
                Rodada
              </label>

              <div className="relative">
                <select
                  id="rodada-filter"
                  value={selectedRound}
                  onChange={(event) => {
                    setSelectedRound(event.target.value);
                    setOpenCardId(null);
                  }}
                  className="appearance-none rounded-lg border border-cyan-300/40 bg-gradient-to-b from-[#0c234f] to-[#081936] py-2 pl-3 pr-9 text-xs font-black uppercase tracking-wider text-cyan-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)] outline-none transition focus:border-cyan-200/80"
                >
                  {ROUND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-cyan-200">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M5.25 7.5a.75.75 0 0 1 1.06 0L10 11.19l3.69-3.69a.75.75 0 1 1 1.06 1.06l-4.22 4.22a.75.75 0 0 1-1.06 0L5.25 8.56a.75.75 0 0 1 0-1.06Z" />
                  </svg>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="sort-filter" className="text-xs font-bold uppercase tracking-wider text-cyan-200/90">
                Ordem
              </label>

              <div className="relative">
                <select
                  id="sort-filter"
                  value={selectedSort}
                  onChange={(event) => {
                    setSelectedSort(event.target.value as SortOption);
                    setOpenCardId(null);
                  }}
                  className="appearance-none rounded-lg border border-cyan-300/40 bg-gradient-to-b from-[#0c234f] to-[#081936] py-2 pl-3 pr-9 text-xs font-black uppercase tracking-wider text-cyan-100 shadow-[0_8px_20px_rgba(0,0,0,0.35)] outline-none transition focus:border-cyan-200/80"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-cyan-200">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M5.25 7.5a.75.75 0 0 1 1.06 0L10 11.19l3.69-3.69a.75.75 0 1 1 1.06 1.06l-4.22 4.22a.75.75 0 0 1-1.06 0L5.25 8.56a.75.75 0 0 1 0-1.06Z" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {canShowUploadButton ? (
        <div className="mb-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              void handleFileSelected(file);
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-md border border-emerald-200/50 bg-emerald-300/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-100 transition hover:bg-emerald-300/30 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {uploading ? "Enviando..." : "Enviar JSON"}
          </button>
        </div>
      ) : null}

      {players.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 px-3 py-8 text-center text-sm text-zinc-300">
          Nenhum jogador encontrado para este filtro.
        </div>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {players.map((player, index) => {
            const cardId = `${player.steamId}-${index}`;
            const isOpen = openCardId === cardId;

            return (
              <PlayerCard
                key={cardId}
                player={player}
                isOpen={isOpen}
                onToggle={() => setOpenCardId((prev) => (prev === cardId ? null : cardId))}
                selectedRound={selectedRound}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

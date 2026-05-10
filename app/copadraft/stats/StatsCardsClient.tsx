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

type AggregatedPlayer = Omit<StatsEntry, "round" | "map" | "matchKey"> & {
  appearances: number;
  roundsPlayed: number[];
  mapBreakdown: Array<{
    map: number;
    appearances: number;
    hltvRating2: number;
    averageDamagePerRound: number;
    headshotPercentage: number;
    kast: number;
    score: number;
    killCount: number;
    deathCount: number;
  }>;
  roundBreakdown: Array<{
    round: number;
    map1: {
      appearances: number;
      hltvRating2: number;
      averageDamagePerRound: number;
      headshotPercentage: number;
      kast: number;
      score: number;
      killCount: number;
      deathCount: number;
    } | null;
    map2: {
      appearances: number;
      hltvRating2: number;
      averageDamagePerRound: number;
      headshotPercentage: number;
      kast: number;
      score: number;
      killCount: number;
      deathCount: number;
    } | null;
    totals: {
      hltvRating2: number;
      averageDamagePerRound: number;
      headshotPercentage: number;
      kast: number;
      score: number;
      killCount: number;
      deathCount: number;
    };
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

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
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
}: {
  player: AggregatedPlayer;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const equationRounds = player.roundBreakdown.filter((item) => item.map1 || item.map2);
  const canShowEquation = equationRounds.length > 0;
  const roundsLabel =
    player.roundsPlayed.length > 0
      ? `Rodadas: ${player.roundsPlayed.slice().sort((a, b) => a - b).join(", ")}`
      : "Rodadas: -";

  function avgMapStat(value: number, appearances: number) {
    if (!appearances) return 0;
    return value / appearances;
  }

  function mapAvg(
    mapData:
      | {
          appearances: number;
          hltvRating2: number;
          averageDamagePerRound: number;
          headshotPercentage: number;
          kast: number;
          score: number;
          killCount: number;
          deathCount: number;
        }
      | null,
    field: "hltvRating2" | "averageDamagePerRound" | "headshotPercentage" | "kast" | "score"
  ) {
    if (!mapData || !mapData.appearances) return null;
    return avgMapStat(mapData[field], mapData.appearances);
  }

  function mapAvgFormatted(
    mapData:
      | {
          appearances: number;
          hltvRating2: number;
          averageDamagePerRound: number;
          headshotPercentage: number;
          kast: number;
          score: number;
          killCount: number;
          deathCount: number;
        }
      | null,
    field: "hltvRating2" | "averageDamagePerRound" | "headshotPercentage" | "kast" | "score",
    decimals: number,
    withPct = false
  ) {
    const value = mapAvg(mapData, field);
    if (value === null) return "-";
    const fixed = value.toFixed(decimals);
    return withPct ? `${fixed}%` : fixed;
  }

  function mapInt(
    mapData:
      | {
          appearances: number;
          hltvRating2: number;
          averageDamagePerRound: number;
          headshotPercentage: number;
          kast: number;
          score: number;
          killCount: number;
          deathCount: number;
        }
      | null,
    field: "killCount" | "deathCount"
  ) {
    if (!mapData) return "-";
    return String(mapData[field]);
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
        <TeamFlag teamName={player.teamName} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <StatLine label="HLTV" value={player.hltvRating2.toFixed(2)} />
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
                  const map1Label = roundItem.map1 ? `M1 (${roundItem.round}1)` : `M1 (${roundItem.round}1)`;
                  const map2Label = roundItem.map2 ? `M2 (${roundItem.round}2)` : `M2 (${roundItem.round}2)`;
                  const averageDivisor = (roundItem.map1 ? 1 : 0) + (roundItem.map2 ? 1 : 0) || 1;

                  return (
                    <div key={`round-eq-${player.steamId}-${roundItem.round}`} className="rounded-lg border border-white/10 bg-black/10 p-2">
                      <p className="mb-1 text-[10px] font-black uppercase tracking-wider text-cyan-200/90">Rodada {roundItem.round}</p>
                      <div className="grid grid-cols-1 gap-1.5">
                        <EqStatLine
                          label="HLTV (M1 + M2)"
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
                          label="Mortes (M1 + M2)"
                          left={mapInt(roundItem.map1, "deathCount")}
                          right={mapInt(roundItem.map2, "deathCount")}
                          total={String(roundItem.totals.deathCount)}
                        />
                      </div>
                    </div>
                  );
                })}
              </>
            ) : null}
            <StatLine label="Assistências" value={player.assistCount} />
            <StatLine label="K/D" value={player.killDeathRatio.toFixed(2)} />
            <StatLine label="Dano total" value={player.damageHealth} />
            <StatLine label="Dano utilitário" value={player.utilityDamage} />
            <StatLine label="Média utilitário/round" value={player.averageUtilityDamagePerRound.toFixed(1)} />
            <StatLine label="Headshots" value={player.headshotCount} />
            <StatLine label="Headshot %" value={formatPct(player.headshotPercentage)} />
            <StatLine label="KAST" value={formatPct(player.kast)} />
            <StatLine label="Trade kills" value={player.tradeKillCount} />
            <StatLine label="First kills" value={player.firstKillCount} />
            <StatLine label="First deaths" value={player.firstDeathCount} />
            <StatLine label="MVPs" value={player.mvpCount} />
            <StatLine label="Bombs plantadas" value={player.bombPlantedCount} />
            <StatLine label="Bombs defusadas" value={player.bombDefusedCount} />
            <StatLine label="Score" value={player.score.toFixed(1)} />
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
          appearances: number;
          hltvRating2: number;
          averageDamagePerRound: number;
          headshotPercentage: number;
          kast: number;
          score: number;
          killCount: number;
          deathCount: number;
        }
      >
    >();
    const playerRoundMaps = new Map<
      string,
      Map<
        number,
        Map<
          number,
          {
            appearances: number;
            hltvRating2: number;
            averageDamagePerRound: number;
            headshotPercentage: number;
            kast: number;
            score: number;
            killCount: number;
            deathCount: number;
          }
        >
      >
    >();
    const playerRoundTotals = new Map<
      string,
      Map<
        number,
        {
          appearances: number;
          hltvRating2: number;
          averageDamagePerRound: number;
          headshotPercentage: number;
          kast: number;
          score: number;
          killCount: number;
          deathCount: number;
        }
      >
    >();

    for (const entry of filtered) {
      const key = `${entry.steamId}::${entry.nickname.toLowerCase()}`;
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
          killDeathRatio: entry.killDeathRatio,
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
                  headshotPercentage: entry.headshotPercentage,
                  kast: entry.kast,
                  score: entry.score,
                  killCount: entry.killCount,
                  deathCount: entry.deathCount,
                },
              ],
            ])
          );
        }

        const newRoundTotals = new Map<number, {
          appearances: number;
          hltvRating2: number;
          averageDamagePerRound: number;
          headshotPercentage: number;
          kast: number;
          score: number;
          killCount: number;
          deathCount: number;
        }>();
        newRoundTotals.set(entry.round, {
          appearances: 1,
          hltvRating2: entry.hltvRating2,
          averageDamagePerRound: entry.averageDamagePerRound,
          headshotPercentage: entry.headshotPercentage,
          kast: entry.kast,
          score: entry.score,
          killCount: entry.killCount,
          deathCount: entry.deathCount,
        });
        playerRoundTotals.set(key, newRoundTotals);

        if (entry.map !== null) {
          const newRoundMapBucket = new Map<
            number,
            Map<
              number,
              {
                appearances: number;
                hltvRating2: number;
                averageDamagePerRound: number;
                headshotPercentage: number;
                kast: number;
                score: number;
                killCount: number;
                deathCount: number;
              }
            >
          >();

          newRoundMapBucket.set(
            entry.round,
            new Map([
              [
                entry.map,
                {
                  appearances: 1,
                  hltvRating2: entry.hltvRating2,
                  averageDamagePerRound: entry.averageDamagePerRound,
                  headshotPercentage: entry.headshotPercentage,
                  kast: entry.kast,
                  score: entry.score,
                  killCount: entry.killCount,
                  deathCount: entry.deathCount,
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
      current.killDeathRatio += entry.killDeathRatio;
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
            headshotPercentage: entry.headshotPercentage,
            kast: entry.kast,
            score: entry.score,
            killCount: entry.killCount,
            deathCount: entry.deathCount,
          });
        } else {
          currentMap.appearances += 1;
          currentMap.hltvRating2 += entry.hltvRating2;
          currentMap.averageDamagePerRound += entry.averageDamagePerRound;
          currentMap.headshotPercentage += entry.headshotPercentage;
          currentMap.kast += entry.kast;
          currentMap.score += entry.score;
          currentMap.killCount += entry.killCount;
          currentMap.deathCount += entry.deathCount;
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
          headshotPercentage: entry.headshotPercentage,
          kast: entry.kast,
          score: entry.score,
          killCount: entry.killCount,
          deathCount: entry.deathCount,
        });
      } else {
        currentRoundTotal.appearances += 1;
        currentRoundTotal.hltvRating2 += entry.hltvRating2;
        currentRoundTotal.averageDamagePerRound += entry.averageDamagePerRound;
        currentRoundTotal.headshotPercentage += entry.headshotPercentage;
        currentRoundTotal.kast += entry.kast;
        currentRoundTotal.score += entry.score;
        currentRoundTotal.killCount += entry.killCount;
        currentRoundTotal.deathCount += entry.deathCount;
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
            headshotPercentage: entry.headshotPercentage,
            kast: entry.kast,
            score: entry.score,
            killCount: entry.killCount,
            deathCount: entry.deathCount,
          });
        } else {
          currentRoundMap.appearances += 1;
          currentRoundMap.hltvRating2 += entry.hltvRating2;
          currentRoundMap.averageDamagePerRound += entry.averageDamagePerRound;
          currentRoundMap.headshotPercentage += entry.headshotPercentage;
          currentRoundMap.kast += entry.kast;
          currentRoundMap.score += entry.score;
          currentRoundMap.killCount += entry.killCount;
          currentRoundMap.deathCount += entry.deathCount;
        }

        roundMapsByRound.set(entry.round, roundMapBucket);
        playerRoundMaps.set(key, roundMapsByRound);
      }
    }

    const result = Array.from(byPlayer.values()).map((player) => {
      const key = `${player.steamId}::${player.nickname.toLowerCase()}`;
      const count = Math.max(1, player.appearances);
      const hltv = player.hltvRating2 / count;
      const adr = player.averageDamagePerRound / count;
      const score = player.score / count;
      const headshotPct = player.headshotPercentage / count;
      const kast = player.kast / count;
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
              headshotPercentage: totals.headshotPercentage / perRoundCount,
              kast: totals.kast / perRoundCount,
              score: totals.score / perRoundCount,
              killCount: totals.killCount,
              deathCount: totals.deathCount,
            },
          };
        })
        .sort((a, b) => a.round - b.round);

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
        killDeathRatio: player.killDeathRatio,
        damageHealth: player.damageHealth,
        averageDamagePerRound: adr,
        utilityDamage: player.utilityDamage,
        averageUtilityDamagePerRound: player.averageUtilityDamagePerRound,
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
      if (b.killCount !== a.killCount) return b.killCount - a.killCount;
      if (b.hltvRating2 !== a.hltvRating2) return b.hltvRating2 - a.hltvRating2;
      if (b.averageDamagePerRound !== a.averageDamagePerRound) return b.averageDamagePerRound - a.averageDamagePerRound;
      return a.deathCount - b.deathCount;
    });

    return result;
  }, [entries, selectedPote, selectedRound]);

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
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

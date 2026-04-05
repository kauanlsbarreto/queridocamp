"use client"

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronUp,
  ExternalLink,
  Filter,
  Map,
} from "lucide-react";
import PremiumCard from "@/components/premium-card";

const API_KEY_FACEIT = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

interface FaceitTeam {
  name: string;
  avatar: string;
}

interface FaceitScore {
  faction1?: number;
  faction2?: number;
}

export interface FaceitQueueMatch {
  match_id: string;
  status: string;
  started_at?: number;
  finished_at?: number;
  best_of?: number;
  faceit_url?: string;
  teams: {
    faction1: FaceitTeam;
    faction2: FaceitTeam;
  };
  results?: {
    score?: FaceitScore;
  };
}

interface MatchMapInfo {
  name: string;
}

interface ProcessedMatch {
  id: string;
  teamA: FaceitTeam;
  teamB: FaceitTeam;
  scoreA: number;
  scoreB: number;
  date: Date;
  faceitUrl: string;
  bestOf: number;
}

const processMatches = (matchesData: FaceitQueueMatch[]): ProcessedMatch[] => {
  return matchesData
    .filter((match) => {
      const score = match.results?.score;
      return (
        !!match.teams?.faction1?.name &&
        !!match.teams?.faction2?.name &&
        typeof score?.faction1 === "number" &&
        typeof score?.faction2 === "number"
      );
    })
    .map((match) => ({
      id: match.match_id,
      teamA: match.teams.faction1,
      teamB: match.teams.faction2,
      scoreA: match.results?.score?.faction1 || 0,
      scoreB: match.results?.score?.faction2 || 0,
      date: new Date(((match.finished_at || match.started_at || 0) as number) * 1000),
      faceitUrl: (match.faceit_url || `https://www.faceit.com/en/cs2/room/${match.match_id}`).replace("{lang}", "en"),
      bestOf: match.best_of || 1,
    }));
};

function ResultMatchCard({ match }: { match: ProcessedMatch }) {
  const router = useRouter();
  const isWinnerA = match.scoreA > match.scoreB;
  const isWinnerB = match.scoreB > match.scoreA;

  const [mapInfo, setMapInfo] = useState<MatchMapInfo[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchMapInfo = async () => {
      try {
        const response = await fetch(`https://open.faceit.com/data/v4/matches/${match.id}/stats`, {
          headers: { Authorization: `Bearer ${API_KEY_FACEIT}` },
        });

        if (!response.ok) return;

        const data = await response.json();
        const rounds = Array.isArray(data?.rounds) ? data.rounds : [];
        const maps = rounds
          .map((round: any) => ({ name: String(round?.round_stats?.Map || "").trim() }))
          .filter((round: MatchMapInfo) => round.name.length > 0);

        if (isMounted) {
          setMapInfo(maps);
        }
      } catch (error) {
        console.error("Erro ao buscar mapa da partida da fila:", error);
      }
    };

    fetchMapInfo();

    return () => {
      isMounted = false;
    };
  }, [match.id]);

  return (
    <PremiumCard>
      <div
        className="cursor-pointer p-4 transition-colors hover:bg-white/[0.03] md:p-6"
        role="link"
        tabIndex={0}
        onClick={() => router.push(`/queridafila/partidas/${match.id}`)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            router.push(`/queridafila/partidas/${match.id}`);
          }
        }}
      >
        <div className="flex justify-between items-center text-xs text-gray-400 mb-4 gap-3">
          <span>
            {match.date.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              timeZone: "UTC",
            })}
          </span>
          <a
            href={match.faceitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-gold transition-colors flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            Ver partida <ExternalLink size={14} />
          </a>
        </div>

        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-3 flex-1 w-1/3 min-w-0">
            <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
              <Image
                src={match.teamA.avatar || "/images/team-placeholder.png"}
                alt={match.teamA.name}
                fill
                className="object-cover rounded-full"
                unoptimized
              />
            </div>
            <span className={`font-bold text-sm md:text-lg truncate ${isWinnerA ? "text-white" : "text-gray-400"}`}>
              {match.teamA.name}
            </span>
          </div>

          <div className="flex items-center gap-2 text-2xl md:text-4xl font-bold flex-shrink-0">
            <span className={isWinnerA ? "text-gold" : "text-white"}>{match.scoreA}</span>
            <span className="text-gray-500 text-xl">x</span>
            <span className={isWinnerB ? "text-gold" : "text-white"}>{match.scoreB}</span>
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end w-1/3 text-right min-w-0">
            <span className={`font-bold text-sm md:text-lg truncate ${isWinnerB ? "text-white" : "text-gray-400"}`}>
              {match.teamB.name}
            </span>
            <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
              <Image
                src={match.teamB.avatar || "/images/team-placeholder.png"}
                alt={match.teamB.name}
                fill
                className="object-cover rounded-full"
                unoptimized
              />
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-white/10 pt-4 flex flex-wrap justify-center items-center gap-3 text-xs text-gray-300">
          {mapInfo.length > 0 ? (
            mapInfo.map((map) => (
              <div key={`${match.id}-${map.name}`} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Map size={12} className="text-gold" />
                <span className="uppercase tracking-wide">{map.name}</span>
              </div>
            ))
          ) : (
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <Map size={12} className="text-gold" />
              <span className="uppercase tracking-wide">MD{match.bestOf}</span>
            </div>
          )}
        </div>
      </div>
    </PremiumCard>
  );
}

export default function QueridaFilaPartidasClient({ matchesData }: { matchesData: FaceitQueueMatch[] }) {
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedTeam, setSelectedTeam] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("all");
  const [itemsPerPage, setItemsPerPage] = useState<number>(6);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const allMatches = useMemo(() => processMatches(matchesData), [matchesData]);

  const uniqueTeams = useMemo(() => {
    const names = new Set<string>();
    allMatches.forEach((match) => {
      names.add(match.teamA.name);
      names.add(match.teamB.name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [allMatches]);

  const uniqueDates = useMemo(() => {
    const dates = new Set(allMatches.map((match) => match.date.toISOString().split("T")[0]));
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [allMatches]);

  const filteredAndSortedMatches = useMemo(() => {
    let filtered = allMatches;

    if (selectedTeam !== "all") {
      filtered = filtered.filter((match) => match.teamA.name === selectedTeam || match.teamB.name === selectedTeam);
    }

    if (selectedDate !== "all") {
      filtered = filtered.filter((match) => match.date.toISOString().startsWith(selectedDate));
    }

    return [...filtered].sort((a, b) => {
      const dateA = a.date.getTime();
      const dateB = b.date.getTime();

      if (dateA !== dateB) {
        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
      }

      return sortOrder === "newest" ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id);
    });
  }, [allMatches, selectedDate, selectedTeam, sortOrder]);

  const paginatedMatches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedMatches.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, filteredAndSortedMatches, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedMatches.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedDate, selectedTeam, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <section className="py-16 bg-gradient-to-b from-black to-gray-900 relative overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <div className="particles">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="particle"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`,
                animationDuration: `${5 + Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <PremiumCard>
            <div className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between flex-wrap">
              <div className="flex items-center gap-2 text-white">
                <Filter size={18} className="text-gold" />
                <span className="font-semibold">Filtros</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto flex-wrap justify-center">
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="bg-black/50 border border-white/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-gold w-full sm:w-auto"
                >
                  <option value="all">Todos os times</option>
                  {uniqueTeams.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-black/50 border border-white/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-gold w-full sm:w-auto"
                >
                  <option value="all">Todas as datas</option>
                  {uniqueDates.map((date) => (
                    <option key={date} value={date}>
                      {new Date(date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))}
                  className="flex items-center gap-2 bg-black/50 border border-white/20 rounded-md px-3 py-2 text-white hover:border-gold transition-colors w-full sm:w-auto justify-center"
                >
                  {sortOrder === "newest" ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                  <span>{sortOrder === "newest" ? "Mais Recentes" : "Mais Antigos"}</span>
                </button>

                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="bg-black/50 border border-white/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-gold w-full sm:w-auto"
                >
                  <option value={6}>6 por página</option>
                  <option value={12}>12 por página</option>
                  <option value={24}>24 por página</option>
                </select>
              </div>
            </div>
          </PremiumCard>

          <div className="mt-8 space-y-6">
            {paginatedMatches.length > 0 ? (
              paginatedMatches.map((match, index) => (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                >
                  <ResultMatchCard match={match} />
                </motion.div>
              ))
            ) : (
              <PremiumCard>
                <div className="p-8 text-center text-gray-400">
                  Nenhuma partida encontrada para os filtros selecionados.
                </div>
              </PremiumCard>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-8 flex justify-center items-center gap-2 text-white">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md bg-black/50 border border-white/20 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md bg-black/50 border border-white/20 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-semibold text-sm px-4">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md bg-black/50 border border-white/20 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md bg-black/50 border border-white/20 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
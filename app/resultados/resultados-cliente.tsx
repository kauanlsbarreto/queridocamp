"use client"

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ChevronDown, ChevronUp, Filter, ExternalLink, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from "lucide-react";
import PremiumCard from "@/components/premium-card";

export interface Team {
  id: number;
  name: string;
  logo: string;
}

export interface DbMatch {
  id: number;
  match_id: string;
  data: string;
  time1: string;
  time2: string;
  mapa1: string;
  placar_mapa1_time1: number;
  placar_mapa1_time2: number;
  mapa2: string;
  placar_mapa2_time1: number;
  placar_mapa2_time2: number;
  rodada?: string;
}

interface MapScore {
  name: string;
  scoreA: number | null;
  scoreB: number | null;
}

export interface ProcessedMatch {
  id: number;
  faceitId: string;
  teamA: Team;
  teamB: Team;
  date: Date;
  map1: MapScore | null;
  map2: MapScore | null;
  totalScoreA: number;
  totalScoreB: number;
}

const processMatches = (teams: Team[], matchesData: DbMatch[]): ProcessedMatch[] => {
  return matchesData
    .filter(dbMatch => dbMatch.placar_mapa1_time1 !== null)
    .map(dbMatch => {
      const teamA = teams.find(t => t.name === dbMatch.time1);
      const teamB = teams.find(t => t.name === dbMatch.time2);

      if (!teamA || !teamB) return undefined;

      let map1: MapScore | null = null;
      if (dbMatch.mapa1 && dbMatch.placar_mapa1_time1 !== null && dbMatch.placar_mapa1_time2 !== null) {
        map1 = {
          name: dbMatch.mapa1,
          scoreA: dbMatch.placar_mapa1_time1,
          scoreB: dbMatch.placar_mapa1_time2,
        };
      }

      let map2: MapScore | null = null;
      if (dbMatch.mapa2 && dbMatch.placar_mapa2_time1 !== null && dbMatch.placar_mapa2_time2 !== null) {
        map2 = {
          name: dbMatch.mapa2,
          scoreA: dbMatch.placar_mapa2_time1,
          scoreB: dbMatch.placar_mapa2_time2,
        };
      }

      let totalScoreA = 0;
      let totalScoreB = 0;
      if (map1 && map1.scoreA !== null && map1.scoreB !== null && map1.scoreA > map1.scoreB) totalScoreA++;
      if (map1 && map1.scoreA !== null && map1.scoreB !== null && map1.scoreB > map1.scoreA) totalScoreB++;
      if (map2 && map2.scoreA !== null && map2.scoreB !== null && map2.scoreA > map2.scoreB) totalScoreA++;
      if (map2 && map2.scoreA !== null && map2.scoreB !== null && map2.scoreB > map2.scoreA) totalScoreB++;

      return {
        id: dbMatch.id,
        faceitId: dbMatch.match_id || '',
        teamA,
        teamB,
        date: new Date(dbMatch.data),
        map1,
        map2,
        totalScoreA,
        totalScoreB,
      };
    })
    .filter((match): match is ProcessedMatch => !!match);
};

function ResultMatchCard({ match }: { match: ProcessedMatch }) {
  const isWinnerA = match.totalScoreA > match.totalScoreB;
  const isWinnerB = match.totalScoreB > match.totalScoreA;

  const map1WinnerA = match.map1 && match.map1.scoreA !== null && match.map1.scoreB !== null ? match.map1.scoreA > match.map1.scoreB : null;
  const map2WinnerA = match.map2 && match.map2.scoreA !== null && match.map2.scoreB !== null ? match.map2.scoreA > match.map2.scoreB : null;

  return (
    <PremiumCard>
      <div className="p-4 md:p-6">
        <div className="flex justify-between items-center text-xs text-gray-400 mb-4">
          <span>{match.date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}</span>
          {match.faceitId && (
            <a href={`https://www.faceit.com/en/cs2/room/${match.faceitId}`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gold transition-colors flex items-center gap-1">
              Ver partida <ExternalLink size={14} />
            </a>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 md:gap-4">
          <div className="flex items-center gap-3 flex-1 w-1/3">
            <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
              <Image src={match.teamA.logo || "/placeholder.svg"} alt={match.teamA.name} fill className="object-contain" />
            </div>
            <span className={`font-bold text-sm md:text-lg truncate ${isWinnerA ? 'text-white' : 'text-gray-400'}`}>{match.teamA.name}</span>
          </div>

          <div className="flex items-center gap-2 text-2xl md:text-4xl font-bold">
            <span className={isWinnerA ? 'text-gold' : 'text-white'}>{match.totalScoreA}</span>
            <span className="text-gray-500 text-xl">x</span>
            <span className={isWinnerB ? 'text-gold' : 'text-white'}>{match.totalScoreB}</span>
          </div>

          <div className="flex items-center gap-3 flex-1 justify-end w-1/3 text-right">
            <span className={`font-bold text-sm md:text-lg truncate ${isWinnerB ? 'text-white' : 'text-gray-400'}`}>{match.teamB.name}</span>
            <div className="relative w-12 h-12 md:w-16 md:h-16 flex-shrink-0">
              <Image src={match.teamB.logo || "/placeholder.svg"} alt={match.teamB.name} fill className="object-contain" />
            </div>
          </div>
        </div>

        {(match.map1 || match.map2) && (
          <div className="mt-4 border-t border-white/10 pt-4 flex justify-center items-start gap-4 text-xs">
            {match.map1 && (
              <div className="text-center">
                <p className="text-gray-400 uppercase">{match.map1.name}</p>
                <p className="font-bold text-base mt-1">
                  <span className={map1WinnerA === true ? 'text-white' : 'text-gray-400'}>{match.map1.scoreA}</span>
                  <span className="text-gray-500 mx-1">-</span>
                  <span className={map1WinnerA === false ? 'text-white' : 'text-gray-400'}>{match.map1.scoreB}</span>
                </p>
              </div>
            )}
            {match.map2 && match.map2.scoreA !== null && (
              <>
                <div className="border-l border-white/10 h-10"></div>
                <div className="text-center">
                  <p className="text-gray-400 uppercase">{match.map2.name}</p>
                  <p className="font-bold text-base mt-1">
                    <span className={map2WinnerA === true ? 'text-white' : 'text-gray-400'}>{match.map2.scoreA}</span>
                    <span className="text-gray-500 mx-1">-</span>
                    <span className={map2WinnerA === false ? 'text-white' : 'text-gray-400'}>{match.map2.scoreB}</span>
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </PremiumCard>
  );
}

export default function ResultadosClient({ teams, matchesData }: { teams: Team[]; matchesData: DbMatch[] }) {
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [itemsPerPage, setItemsPerPage] = useState<number>(6);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const allMatches = useMemo(() => processMatches(teams, matchesData), [teams, matchesData]);

  const uniqueDates = useMemo(() => {
    const dates = new Set(allMatches.map(m => m.date.toISOString().split('T')[0]));
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [allMatches]);

  const filteredAndSortedMatches = useMemo(() => {
    let filtered = allMatches;

    if (selectedTeam !== 'all') {
      filtered = filtered.filter(m => m.teamA.name === selectedTeam || m.teamB.name === selectedTeam);
    }

    if (selectedDate !== 'all') {
      filtered = filtered.filter(m => m.date.toISOString().startsWith(selectedDate));
    }

    filtered.sort((a, b) => {
      const dateA = a.date.getTime();
      const dateB = b.date.getTime();
      if (dateA !== dateB) {
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
      }
      return sortOrder === 'newest' ? b.id - a.id : a.id - b.id;
    });

    return filtered;
  }, [allMatches, sortOrder, selectedTeam, selectedDate]);

  const paginatedMatches = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedMatches.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedMatches, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedMatches.length / itemsPerPage);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedTeam, selectedDate, itemsPerPage]);

  return (
    <section className="py-16 bg-gradient-to-b from-black to-gray-900 relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
            <div className="particles">
            {[...Array(30)].map((_, i) => (
                <div key={i} className="particle" style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 8}s`,
                animationDuration: `${5 + Math.random() * 5}s`,
                }} />
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
                  <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="bg-black/50 border border-white/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-gold w-full sm:w-auto">
                    <option value="all">Todos os times</option>
                    {teams.map(team => (<option key={team.id} value={team.name}>{team.name}</option>))}
                  </select>

                  <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-black/50 border border-white/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-gold w-full sm:w-auto">
                    <option value="all">Todas as datas</option>
                    {uniqueDates.map(date => (<option key={date} value={date}>{new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</option>))}
                  </select>

                  <button onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')} className="flex items-center gap-2 bg-black/50 border border-white/20 rounded-md px-3 py-2 text-white hover:border-gold transition-colors w-full sm:w-auto justify-center">
                    {sortOrder === 'newest' ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    <span>{sortOrder === 'newest' ? 'Mais Recentes' : 'Mais Antigos'}</span>
                  </button>

                  <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-black/50 border border-white/20 rounded-md px-3 py-2 text-white focus:outline-none focus:border-gold w-full sm:w-auto">
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
                  <motion.div key={match.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: index * 0.1 }}>
                    <ResultMatchCard match={match} />
                  </motion.div>
                ))
              ) : (
                <PremiumCard>
                  <div className="p-8 text-center text-gray-400">
                    Nenhum resultado encontrado para os filtros selecionados.
                  </div>
                </PremiumCard>
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center gap-2 text-white">
                <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="p-2 rounded-md bg-black/50 border border-white/20 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <ChevronsLeft size={16} />
                </button>
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-md bg-black/50 border border-white/20 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={16} />
                </button>
                <span className="font-semibold text-sm px-4">
                  Página {currentPage} de {totalPages}
                </span>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-md bg-black/50 border border-white/20 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight size={16} />
                </button>
                <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-md bg-black/50 border border-white/20 hover:border-gold disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <ChevronsRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
    </section>
  );
}
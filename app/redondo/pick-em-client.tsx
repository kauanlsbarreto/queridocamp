"use client"

import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import Image from "next/image"
import { Lock, Shield, AlertCircle, CheckCircle, Eye, X, Unlock, BarChart2, Trash2, Trophy } from "lucide-react"
import FaceitLogin from "../../components/FaceitLogin"

interface TeamPick {
  id: string;
  team_name: string;
  team_image: string;
}

interface UserProfile {
  id: number;
  faceit_guid: string;
  nickname: string;
  avatar: string;
  admin?: number;
  Admin?: number;
}

function AchievementArtwork({
  image,
  title,
  size = 'large'
}: {
  image: string;
  title: string;
  size?: 'large' | 'small' | 'gallery';
}) {
  const sizeClass =
    size === 'small'
      ? 'aspect-square w-full rounded-xl'
      : size === 'gallery'
        ? 'aspect-square w-full rounded-xl'
        : 'aspect-square w-[220px] max-w-full rounded-2xl';

  return (
    <div
      aria-label={title}
      role="img"
      onContextMenu={(e) => e.preventDefault()}
      className={`${sizeClass} bg-center bg-cover bg-no-repeat select-none pointer-events-none`}
      style={{ backgroundImage: `url(${image})` }}
    />
  );
}

function getPhaseLabel(phase: string) {
  if (phase === 'slot') return 'Quartas';
  if (phase === 'semi') return 'Semi';
  if (phase === 'final') return 'Final';
  if (phase === 'winner') return 'Ganhador';
  return phase;
}

export default function PickEmClient({ 
  initialTeams, 
  usersWithPicks,
  pickStats = {},
  top8Teams = [],
  topSemiTeams = [],
  topFinalTeams = [],
  topWinner = ''
}: { 
  initialTeams: TeamPick[], 
  usersWithPicks: string[],
  pickStats?: Record<string, number>,
  top8Teams?: string[],
  topSemiTeams?: string[],
  topFinalTeams?: string[],
  topWinner?: string
}) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingPicks, setLoadingPicks] = useState(false)
  const [picksCache, setPicksCache] = useState<Record<string, any>>({});
  const [isMounted, setIsMounted] = useState(false);
  const [viewingNickname, setViewingNickname] = useState<string | null>(null)
  
  const [availableTeams, setAvailableTeams] = useState<TeamPick[]>(initialTeams)
  const [qualifiedTeams, setQualifiedTeams] = useState<(TeamPick | null)[]>(Array(8).fill(null))
  const [semiTeams, setSemiTeams] = useState<(TeamPick | null)[]>(Array(4).fill(null))
  const [finalTeams, setFinalTeams] = useState<(TeamPick | null)[]>(Array(2).fill(null))
  const [winnerTeam, setWinnerTeam] = useState<TeamPick | null>(null)
  
  const [locks, setLocks] = useState({ slot: false, semi: false, final: false, winner: false })
  const [statsTab, setStatsTab] = useState<'top' | 'unused'>('top')
  const [showGallery, setShowGallery] = useState(false)

  const userLevel = user?.Admin ?? user?.admin ?? 0;
  const isAdminView = userLevel >= 1 && userLevel <= 5; // 1 a 5 podem ver outros
  const isHighAdmin = userLevel >= 1 && userLevel <= 2; // 1 e 2 podem bloquear
  const canViewOtherPicks = userLevel === 1 || userLevel === 2 || userLevel === 5;
  const isViewingOther = !!(viewingNickname && user && viewingNickname !== user.nickname);
  const isAuthorized = user ? usersWithPicks.includes(user.nickname) : false;

  const processPicksData = useCallback((data: any) => {
    if (!data) return;

    const parsePhase = (prefix: string, size: number) => {
      return Array(size).fill(null).map((_, i) => {
        const val = data[`${prefix}_${i + 1}`];
        try {
          return typeof val === 'string' ? JSON.parse(val) : val;
        } catch (e) {
          return null;
        }
      });
    };

    const q = parsePhase('slot', 8);
    setQualifiedTeams(q);
    setSemiTeams(parsePhase('semi', 4));
    setFinalTeams(parsePhase('final', 2));
    setWinnerTeam(parsePhase('winner', 1)[0] ?? null);
    setLocks({ 
      slot: !!data.locked, 
      semi: !!data.semi_locked, 
      final: !!data.final_locked,
      winner: !!data.winner_locked
    });

    const pickedIds = new Set(q.filter(t => t).map(t => t.id));
    setAvailableTeams(initialTeams.filter(t => !pickedIds.has(t.id)));
  }, [initialTeams]);

  const checkUser = useCallback(() => {
    const storedUser = localStorage.getItem('faceit_user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        setViewingNickname(vn => vn || parsedUser.nickname)
      } catch (e) {
        console.error("Erro ao ler usuário do cache:", e);
      }
    }
  }, [])

  useEffect(() => {
    setIsMounted(true);
    checkUser()
    window.addEventListener('faceit_auth_updated', checkUser)
    return () => window.removeEventListener('faceit_auth_updated', checkUser)
  }, [checkUser])
  
  const loadUserPicks = useCallback(async (nickname: string, force = false, silent = false) => {
    if (!force && picksCache[nickname]) {
      processPicksData(picksCache[nickname]);
      return;
    }
    if (!silent) setLoadingPicks(true)
    try {
      const guid = (user && user.nickname === nickname) ? user.faceit_guid : undefined;

      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', nickname, faceit_guid: guid })
      })
      const data = await res.json()
      if (data) {
        setPicksCache(prev => ({ ...prev, [nickname]: data }));
        processPicksData(data);
      }
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      if (!silent) setLoadingPicks(false)
    }
  }, [picksCache, processPicksData, user]);

  useEffect(() => {
    if (viewingNickname) loadUserPicks(viewingNickname)
  }, [viewingNickname, loadUserPicks])

  useEffect(() => {
    if (!viewingNickname) return;

    const refreshCurrentView = () => {
      loadUserPicks(viewingNickname, true, true);
    };

    // Keep locks synchronized in near real-time without interrupting the user flow.
    const intervalId = window.setInterval(refreshCurrentView, 3000);
    window.addEventListener('focus', refreshCurrentView);
    document.addEventListener('visibilitychange', refreshCurrentView);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', refreshCurrentView);
      document.removeEventListener('visibilitychange', refreshCurrentView);
    };
  }, [viewingNickname, loadUserPicks]);

  const savePickToDb = async (phase: string, slotIndex: number, team: TeamPick | null) => {
    if (!user || isViewingOther || !isAuthorized) return
    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'save', 
        nickname: user.nickname, 
        faceit_guid: user.faceit_guid, 
        phase, 
        slotIndex, 
        team 
      })
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.error) alert(data.error);
      if (user?.nickname) await loadUserPicks(user.nickname, true);
    }
  }

  const confirmPhase = async (phase: string) => {
    if (!user || isViewingOther || !isAuthorized) return;
    if (!confirm(`Deseja confirmar suas escolhas para ${getPhaseLabel(phase)}? Isso não poderá ser desfeito.`)) return;
    
    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock', nickname: user.nickname, phase })
    });

    if (res.ok) {
      setLocks(prev => ({ ...prev, [phase]: true }));
      return;
    }

    const data = await res.json().catch(() => ({}));
    alert(data?.error || 'Falha ao confirmar fase.');
    await loadUserPicks(user.nickname, true);
  }

  const adminToggleGlobal = async (phase: string, targetStatus: boolean) => {
    if (!isHighAdmin) return;
    const actionText = targetStatus ? "BLOQUEAR NOVOS USUÁRIOS" : "DESBLOQUEAR NOVOS USUÁRIOS";
    if (!confirm(`Deseja ${actionText} para a fase ${phase}?`)) return;

    const res = await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'admin_toggle_global', 
        phase, 
        targetStatus, 
        nickname: user?.nickname,
        adminLevel: userLevel
      })
    });
    
    if (res.ok) {
      alert("Operação realizada com sucesso.");
      setPicksCache(prev => {
        const next = { ...prev };
        if (viewingNickname) delete next[viewingNickname];
        if (user?.nickname) delete next[user.nickname];
        return next;
      });

      const targetView = viewingNickname || user?.nickname;
      if (targetView) {
        await loadUserPicks(targetView, true, true);
      }
    } else {
      const data = await res.json();
      alert(`Erro: ${data.error || "Falha na operação"}`);
    }
  }

  const syncGuids = async () => {
    if (!isHighAdmin) return;
    if (!confirm('Sincronizar faceit_guid ausentes na tabela escolhas buscando na tabela players?')) return;
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync_guids', nickname: user?.nickname, adminLevel: userLevel })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Sync concluído!\nTotal sem GUID: ${data.total}\nAtualizados: ${data.updated}\nNão encontrados: ${data.notFound}`);
      } else {
        alert(`Erro: ${data.error || 'Falha na operação'}`);
      }
    } catch (e) { console.error(e); alert('Erro ao sincronizar.'); }
  };

  const awardRedondoParticipants = async () => {
    if (!isHighAdmin) return;
    if (!confirm("Premiar TODOS que participaram do Redondo com o código QCS-REDONDOP?")) return;
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'award_redondop', nickname: user?.nickname, adminLevel: userLevel })
      });
      const data = await res.json();
      if (res.ok) {
        const missingList = Array.isArray(data.missingPlayers) && data.missingPlayers.length > 0
          ? data.missingPlayers.join(', ')
          : 'nenhum';
        alert(
          `Premiação concluída!\n` +
          `Total analisados: ${data.total}\n` +
          `Atualizados: ${data.updated}\n` +
          `Já tinham: ${data.alreadyHad}\n` +
          `Sem player vinculado: ${data.missingPlayersCount}\n` +
          `Nicknames: ${missingList}`
        );
      } else {
        alert(`Erro: ${data.error || 'Falha na operação'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Erro ao premiar participantes.');
    }
  };

  const adminManageUser = async (targetNickname: string, type: 'unlock' | 'clear', phase: string) => {
    if (!isHighAdmin) return;
    const actionText = type === 'unlock' ? "DESTRAVAR" : "LIMPAR e DESTRAVAR";
    if (!confirm(`Tem certeza que deseja ${actionText} a fase ${phase} para ${targetNickname}?`)) return;

    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'admin_manage_user', 
          nickname: user?.nickname,
          adminLevel: userLevel,
          targetNickname,
          type,
          phase
        })
      });
      
      if (res.ok) {
        alert("Ação realizada com sucesso!");
        setPicksCache(prev => { const n = {...prev}; delete n[targetNickname]; return n; });
        await loadUserPicks(targetNickname, true);
      } else {
        const data = await res.json();
        alert(`Erro: ${data.error || "Falha na operação"}`);
      }
    } catch (e) { console.error(e); alert("Erro ao realizar ação."); }
  }

  const onDragEnd = (result: any) => {
    if (!user || isViewingOther || !isAuthorized) return;
    const { source, destination } = result;
    if (!destination) return;

    const sourceId = source.droppableId;
    const destId = destination.droppableId;

    if (destId.startsWith("slot-") && locks.slot) return;
    if (destId.startsWith("semi-") && locks.semi) return;
    if (destId.startsWith("final-") && locks.final) return;
    if (destId.startsWith("winner-") && locks.winner) return;

    if (destId.startsWith("semi-") && !sourceId.startsWith("slot-")) {
      alert("Para a SEMI, você deve arrastar times que escolheu nas QUARTAS!");
      return;
    }
    if (destId.startsWith("final-") && !sourceId.startsWith("semi-")) {
      alert("Para a FINAL, você deve arrastar times que escolheu nas SEMIS!");
      return;
    }
    if (destId.startsWith("winner-") && !sourceId.startsWith("final-")) {
      alert("Para o GANHADOR, você deve arrastar times que escolheu na FINAL!");
      return;
    }

    if (sourceId === "pool" && destId.startsWith("slot-")) {
      const idx = parseInt(destId.replace("slot-", ""));
      const team = availableTeams[source.index];
      const prev = qualifiedTeams[idx];
      const newQ = [...qualifiedTeams]; newQ[idx] = team;
      const newA = [...availableTeams]; newA.splice(source.index, 1);
      if (prev) newA.push(prev);
      setQualifiedTeams(newQ); setAvailableTeams(newA);
      savePickToDb('slot', idx, team);
    } 
    else if (sourceId.startsWith("slot-") && destId.startsWith("semi-")) {
      const sIdx = parseInt(sourceId.replace("slot-", ""));
      const dIdx = parseInt(destId.replace("semi-", ""));
      const team = qualifiedTeams[sIdx];
      const newS = [...semiTeams]; newS[dIdx] = team;
      setSemiTeams(newS);
      savePickToDb('semi', dIdx, team);
    }
    else if (sourceId.startsWith("semi-") && destId.startsWith("final-")) {
      const sIdx = parseInt(sourceId.replace("semi-", ""));
      const dIdx = parseInt(destId.replace("final-", ""));
      const team = semiTeams[sIdx];
      const newF = [...finalTeams]; newF[dIdx] = team;
      setFinalTeams(newF);
      savePickToDb('final', dIdx, team);
    }
    else if (sourceId.startsWith("final-") && destId.startsWith("winner-")) {
      const sIdx = parseInt(sourceId.replace("final-", ""));
      const team = finalTeams[sIdx];
      setWinnerTeam(team);
      savePickToDb('winner', 0, team);
    }
  }

  const sortedStats = initialTeams
    .map(team => ({ ...team, count: pickStats[team.id] || 0 }))
    .sort((a, b) => b.count - a.count);

  const topPicks = sortedStats.filter(t => t.count > 0);
  const unusedPicks = sortedStats.filter(t => t.count === 0);

  const top8Set = new Set(top8Teams);
  const topSemiSet = new Set(topSemiTeams);
  const topFinalSet = new Set(topFinalTeams);
  const correctPicks = qualifiedTeams.filter(t => t !== null && top8Set.has(t.team_name)).length;
  const achievementLevel = correctPicks >= 5 ? Math.min(correctPicks, 8) : null;
  const correctSemiPicks = semiTeams.filter(t => t !== null && topSemiSet.has(t.team_name)).length;
  const correctFinalPicks = finalTeams.filter(t => t !== null && topFinalSet.has(t.team_name)).length;
  const winnerHit = Boolean(winnerTeam && topWinner && winnerTeam.team_name === topWinner);
  const achievementCards = [
    { key: 'pick-5', title: '5 acertos', image: '/premiredondo/acertou5.png', achieved: correctPicks >= 5, current: achievementLevel === 5 },
    { key: 'pick-6', title: '6 acertos', image: '/premiredondo/acertou6.png', achieved: correctPicks >= 6, current: achievementLevel === 6 },
    { key: 'pick-7', title: '7 acertos', image: '/premiredondo/acertou7.png', achieved: correctPicks >= 7, current: achievementLevel === 7 },
    { key: 'pick-8', title: '8 acertos', image: '/premiredondo/acertou8.png', achieved: correctPicks >= 8, current: achievementLevel === 8 },
    { key: 'semi', title: 'Semifinal', image: '/premiredondo/semifinal.png', achieved: correctSemiPicks === 4, current: correctSemiPicks === 4 },
    { key: 'final', title: 'Finalistas', image: '/premiredondo/finalistas.png', achieved: correctFinalPicks === 2, current: correctFinalPicks === 2 },
    { key: 'winner', title: 'Ganhador', image: '/premiredondo/ganhador.png', achieved: winnerHit, current: winnerHit }
  ];
  const featuredAchievement = achievementCards.filter(card => card.achieved).at(-1) || null;

  if (!isMounted) return null;

  return (
    <div className="flex flex-col gap-8">
      {showGallery && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setShowGallery(false)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-white/10 bg-zinc-900 p-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
                <Trophy size={16} className="text-amber-500" /> Conquistas do Redondo
              </h3>
              <button onClick={() => setShowGallery(false)} className="text-zinc-500 transition-colors hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {achievementCards.map(card => (
                <div
                  key={card.key}
                  className={`flex flex-col items-center rounded-2xl border-2 p-3 transition-all ${card.current ? 'border-amber-500 bg-amber-500/5' : card.achieved ? 'border-green-500/40 bg-green-500/5' : 'border-zinc-800 bg-zinc-950/60'}`}
                >
                  <AchievementArtwork image={card.image} title={card.title} size="gallery" />
                  <p className="mt-2 text-center text-xs font-bold text-zinc-300">{card.title}</p>
                  {card.current && <span className="mt-1 text-[10px] font-bold text-amber-500">Atual</span>}
                  {!card.current && card.achieved && <span className="mt-1 text-[10px] font-bold text-green-400">Conquistado</span>}
                  {!card.achieved && <span className="mt-1 text-[10px] text-zinc-500">Expectativa</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col items-start gap-8 lg:flex-row">
        <div className="lg:w-56 w-full shrink-0 flex flex-col items-center gap-4 lg:sticky lg:top-24">
            {loadingPicks ? (
              <div className="text-xs text-zinc-500">Carregando...</div>
            ) : featuredAchievement ? (
              <>
                <button
                  onClick={() => setShowGallery(true)}
                  className="group relative cursor-pointer"
                  title="Clique para ver todas as conquistas"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <div className="drop-shadow-2xl transition-transform group-hover:scale-105">
                    <AchievementArtwork image={featuredAchievement.image} title={featuredAchievement.title} />
                  </div>
                  <div className="absolute inset-0 flex items-end justify-center pb-4 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">Ver conquistas</span>
                  </div>
                </button>
                <p className="text-sm font-black text-amber-500">{featuredAchievement.title}</p>
              </>
            ) : (
              <>
                <button
                  onClick={() => setShowGallery(true)}
                  className="flex items-center gap-2 text-zinc-500 transition-colors hover:text-amber-500"
                >
                  <Trophy size={18} className="text-zinc-600" />
                  <span className="text-xs font-bold uppercase tracking-wider">Ver conquistas</span>
                </button>
                <div className="grid w-full grid-cols-2 gap-2">
                  {achievementCards.slice(4).map(card => (
                    <div
                      key={card.key}
                      className={`rounded-2xl border p-2 ${card.achieved ? 'border-green-500/40 bg-green-500/5' : 'border-zinc-800 bg-zinc-950/60'}`}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      <AchievementArtwork image={card.image} title={card.title} size="small" />
                      <p className="mt-2 text-center text-[10px] font-bold uppercase text-zinc-300">{card.title}</p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {Array(8).fill(null).map((_, i) => {
                    const team = qualifiedTeams[i];
                    const isCorrect = team && top8Set.has(team.team_name);
                    return (
                      <div
                        key={i}
                        className={`flex h-7 w-7 items-center justify-center rounded-lg border-2 text-[10px] font-bold transition-all ${isCorrect ? 'border-green-500 bg-green-500/20 text-green-400' : team ? 'border-zinc-600 bg-zinc-800 text-zinc-500' : 'border-zinc-800 bg-zinc-900/20 text-zinc-700'}`}
                      >
                        {isCorrect ? '✓' : team ? '?' : i + 1}
                      </div>
                    );
                  })}
                </div>
                <div className="w-full space-y-1 text-center">
                  <p className="text-xs font-bold text-zinc-400">Quartas: {correctPicks}/8</p>
                  <p className="text-xs font-bold text-zinc-400">Semis: {correctSemiPicks}/4</p>
                  <p className="text-xs font-bold text-zinc-400">Final: {correctFinalPicks}/2</p>
                  <p className="text-xs font-bold text-zinc-400">Ganhador: {winnerHit ? 'acertou' : 'em aberto'}</p>
                </div>
              </>
            )}

            <Link
              href="/redondo/ranking"
              className="w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs font-black uppercase tracking-[0.25em] text-amber-300 transition-all hover:border-amber-400 hover:bg-amber-500/15 hover:text-white"
            >
              Ranking
            </Link>
          </div>

        <div className="min-w-0 flex-1">
          {!user ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 border-dashed bg-zinc-900/50 py-20">
              <FaceitLogin user={user} onAuthChange={checkUser} />
              <p className="mt-4 text-sm text-zinc-500">Entre para salvar suas escolhas</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {!isAuthorized && (
                <div className="flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-400">
                  <AlertCircle size={20} />
                  Sua conta não possui permissão para participar deste Pick'Em. Entre em contato com a administração.
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-zinc-900/80 p-6 backdrop-blur-md">
                <div className="flex items-center gap-4">
                  <div className="group relative">
                    <Image src={user.avatar || "/fallback-avatar.png"} alt={user.nickname} width={50} height={50} className="rounded-2xl border-2 border-amber-500 transition-transform group-hover:scale-105" unoptimized />
                    <div className="absolute -bottom-2 -right-2 rounded-lg bg-amber-500 p-1 text-black"><CheckCircle size={14} /></div>
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter">{user.nickname}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Participante do Redondo</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {canViewOtherPicks && (
                    <div className="flex items-center gap-2 rounded-2xl border border-white/5 bg-black/40 p-2">
                      <Eye size={16} className="ml-2 text-amber-500" />
                      <select
                        value={viewingNickname || ""}
                        onChange={(e) => setViewingNickname(e.target.value)}
                        className="cursor-pointer bg-transparent pr-4 text-xs font-bold uppercase text-amber-500 outline-none"
                      >
                        <option value={user.nickname} className="bg-zinc-900 text-amber-500">Minhas Escolhas</option>
                        {usersWithPicks.filter(n => n !== user.nickname).map(name => (
                          <option key={name} value={name} className="bg-zinc-900 text-amber-500">{name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {isHighAdmin && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-red-500/30 bg-red-500/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-black italic text-red-500">
                    <Shield size={20} /> ADMIN
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['slot', 'semi', 'final', 'winner'].map(phase => (
                      <button
                        key={phase}
                        onClick={() => adminToggleGlobal(phase, !locks[phase as keyof typeof locks])}
                        className="rounded-xl bg-red-600 px-4 py-2 text-[10px] font-bold uppercase text-white transition-all hover:bg-red-700"
                      >
                        Bloquear / Desbloquear {getPhaseLabel(phase)}
                      </button>
                    ))}
                    <button
                      onClick={syncGuids}
                      className="rounded-xl bg-zinc-700 px-4 py-2 text-[10px] font-bold uppercase text-white transition-all hover:bg-zinc-600"
                    >
                      Sincronizar GUIDs
                    </button>
                    <button
                      onClick={awardRedondoParticipants}
                      className="rounded-xl bg-amber-600 px-4 py-2 text-[10px] font-bold uppercase text-black transition-all hover:bg-amber-500"
                    >
                      Premiar Redondo
                    </button>
                  </div>
                </div>
              )}

              {isHighAdmin && viewingNickname && (
                <div className="flex flex-col gap-3 rounded-2xl border-2 border-blue-500/30 bg-blue-500/10 p-4">
                  <div className="flex items-center gap-2 text-sm font-black italic text-blue-500">
                    <Shield size={20} /> GERENCIAR: {viewingNickname}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {['slot', 'semi', 'final', 'winner'].map(phase => (
                      <div key={phase} className="flex items-center gap-1 rounded-lg border border-white/5 bg-black/20 p-1">
                        <span className="w-16 px-2 text-center text-[10px] font-bold uppercase text-zinc-400">{getPhaseLabel(phase)}</span>
                        <button
                          onClick={() => adminManageUser(viewingNickname, 'unlock', phase)}
                          className="rounded-md bg-green-600 p-1.5 text-white transition-all hover:bg-green-700"
                          title="Destravar"
                        >
                          <Unlock size={12} />
                        </button>
                        <button
                          onClick={() => adminManageUser(viewingNickname, 'clear', phase)}
                          className="rounded-md bg-red-600 p-1.5 text-white transition-all hover:bg-red-700"
                          title="Limpar e Destravar"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                  <div className="space-y-4 lg:col-span-3">
                    <div className="rounded-3xl border border-white/5 bg-zinc-900/50 p-6">
                      <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        <AlertCircle size={14}/> Lista de Equipes
                      </h3>
                      <Droppable droppableId="pool" isDropDisabled={isViewingOther || !isAuthorized}>
                        {(provided) => (
                          <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-2 gap-3">
                            {availableTeams.map((team, index) => (
                              <Draggable key={team.id} draggableId={team.id} index={index} isDragDisabled={locks.slot || isViewingOther || !isAuthorized}>
                                {(p, s) => (
                                  <div
                                    ref={p.innerRef}
                                    {...p.draggableProps}
                                    {...p.dragHandleProps}
                                    className={`flex aspect-square items-center justify-center rounded-2xl border-2 border-zinc-800 bg-black/40 p-3 transition-all hover:border-amber-500/50 ${s.isDragging ? 'z-50 scale-110 border-amber-500 shadow-2xl' : ''}`}
                                  >
                                    <Image src={team.team_image} alt={team.team_name} width={50} height={50} className="object-contain" unoptimized />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  </div>

                  <div className={`${canViewOtherPicks ? 'lg:col-span-6' : 'lg:col-span-9'} space-y-12`}>
                    {[
                      { title: 'Quartas de Final', data: qualifiedTeams, key: 'slot', cols: 4 },
                      { title: 'Semi-Finais', data: semiTeams, key: 'semi', cols: 4 },
                      { title: 'Grande Final', data: finalTeams, key: 'final', cols: 2 },
                      { title: 'Ganhador', data: [winnerTeam], key: 'winner', cols: 1 }
                    ].map((phase) => {
                      const isLocked = locks[phase.key as keyof typeof locks];
                      const nextPhaseKey = phase.key === 'slot' ? 'semi' : (phase.key === 'semi' ? 'final' : (phase.key === 'final' ? 'winner' : null));
                      const isNextLocked = nextPhaseKey ? locks[nextPhaseKey as keyof typeof locks] : true;
                      const dragDisabled = (isLocked && (!nextPhaseKey || isNextLocked)) || isViewingOther || !isAuthorized;

                      return (
                        <div key={phase.key} className="relative">
                          <div className="mb-6 flex items-center justify-between">
                            <h2 className="flex items-center gap-3 text-3xl font-black uppercase italic tracking-tighter">
                              {locks[phase.key as keyof typeof locks] ? <Lock className="text-red-500" /> : <Unlock className="text-amber-500" />}
                              {phase.title}
                            </h2>
                            {!locks[phase.key as keyof typeof locks] && !isViewingOther && isAuthorized && (
                              <button
                                onClick={() => confirmPhase(phase.key)}
                                className="rounded-full bg-amber-500 px-6 py-2 text-xs font-black uppercase text-black shadow-lg shadow-amber-500/20 transition-all hover:bg-white"
                              >
                                Confirmar Escolhas
                              </button>
                            )}
                          </div>

                          <div className={`grid grid-cols-2 gap-4 md:grid-cols-${phase.cols}`}>
                            {phase.data.map((team, index) => (
                              <Droppable key={index} droppableId={`${phase.key}-${index}`} isDropDisabled={locks[phase.key as keyof typeof locks] || isViewingOther || !isAuthorized}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={`flex h-40 flex-col items-center justify-center rounded-3xl border-2 border-dashed transition-all ${team ? 'border-amber-500 bg-amber-500/5' : 'border-zinc-800 bg-zinc-900/20'} ${snapshot.isDraggingOver ? 'scale-105 border-amber-400 bg-amber-500/10' : ''}`}
                                  >
                                    {team ? (
                                      <Draggable draggableId={`${phase.key}-slot-${team.id}-${index}`} index={index} isDragDisabled={dragDisabled}>
                                        {(p) => (
                                          <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="flex flex-col items-center">
                                            <Image src={team.team_image} alt="" width={64} height={64} className="drop-shadow-2xl" unoptimized />
                                            <span className="mt-3 text-[10px] font-black uppercase tracking-tighter text-amber-500">{team.team_name}</span>
                                          </div>
                                        )}
                                      </Draggable>
                                    ) : (
                                      <span className="select-none text-5xl font-black text-zinc-800">{phase.key === 'winner' ? 'W' : index + 1}</span>
                                    )}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {canViewOtherPicks && (
                    <div className="space-y-4 lg:col-span-3">
                      <div className="h-full rounded-3xl border border-white/5 bg-zinc-900/50 p-6">
                        <h3 className="mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">
                          <BarChart2 size={14}/> Estatísticas
                        </h3>

                        <div className="mb-4 flex gap-2 rounded-xl bg-black/20 p-1">
                          <button
                            onClick={() => setStatsTab('top')}
                            className={`flex-1 rounded-lg py-2 text-[10px] font-bold uppercase transition-all ${statsTab === 'top' ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                          >
                            Mais Escolhidos
                          </button>
                          <button
                            onClick={() => setStatsTab('unused')}
                            className={`flex-1 rounded-lg py-2 text-[10px] font-bold uppercase transition-all ${statsTab === 'unused' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                          >
                            Não Escolhidos
                          </button>
                        </div>

                        <div className="custom-scrollbar max-h-[600px] space-y-2 overflow-y-auto pr-2">
                          {(statsTab === 'top' ? topPicks : unusedPicks).map((team, idx) => (
                            <div key={team.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-2">
                              <div className="flex items-center gap-3">
                                <span className={`w-4 text-center text-xs font-bold ${idx < 3 && statsTab === 'top' ? 'text-amber-500' : 'text-zinc-600'}`}>
                                  {idx + 1}
                                </span>
                                <Image src={team.team_image} alt={team.team_name} width={24} height={24} className="object-contain" unoptimized />
                                <span className="max-w-[100px] truncate text-xs font-bold text-zinc-300">{team.team_name}</span>
                              </div>
                              {statsTab === 'top' && (
                                <div className="rounded-lg bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-500">
                                  {team.count}
                                </div>
                              )}
                            </div>
                          ))}
                          {(statsTab === 'top' ? topPicks : unusedPicks).length === 0 && (
                            <p className="py-4 text-center text-xs text-zinc-600">Nenhum time encontrado.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </DragDropContext>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
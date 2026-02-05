"use client"

import { useState, useEffect, useCallback } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import Image from "next/image"
import { Lock, Shield, AlertCircle, CheckCircle, Eye, X, Unlock, BarChart2, Trash2 } from "lucide-react"
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

export default function PickEmClient({ 
  initialTeams, 
  usersWithPicks,
  pickStats = {}
}: { 
  initialTeams: TeamPick[], 
  usersWithPicks: string[],
  pickStats?: Record<string, number>
}) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingPicks, setLoadingPicks] = useState(false)
  const [picksCache, setPicksCache] = useState<Record<string, any>>({});
  const [viewingNickname, setViewingNickname] = useState<string | null>(null)
  
  const [availableTeams, setAvailableTeams] = useState<TeamPick[]>(initialTeams)
  const [qualifiedTeams, setQualifiedTeams] = useState<(TeamPick | null)[]>(Array(8).fill(null))
  const [semiTeams, setSemiTeams] = useState<(TeamPick | null)[]>(Array(4).fill(null))
  const [finalTeams, setFinalTeams] = useState<(TeamPick | null)[]>(Array(2).fill(null))
  
  const [locks, setLocks] = useState({ slot: false, semi: false, final: false })
  const [statsTab, setStatsTab] = useState<'top' | 'unused'>('top')

  // Permissões baseadas no Guid e Level
  const userLevel = user?.Admin ?? user?.admin ?? 0;
  const isAdminView = userLevel >= 1 && userLevel <= 5; // 1 a 5 podem ver outros
  const isHighAdmin = userLevel >= 1 && userLevel <= 2; // 1 e 2 podem bloquear
  const isViewingOther = !!(viewingNickname && user && viewingNickname !== user.nickname);

  const processPicksData = useCallback((data: any) => {
    if (!data) return;

    const parsePhase = (prefix: string, size: number) => {
      return Array(size).fill(null).map((_, i) => {
        const val = data[`${prefix}_${i + 1}`];
        return typeof val === 'string' ? JSON.parse(val) : val;
      });
    };

    const q = parsePhase('slot', 8);
    setQualifiedTeams(q);
    setSemiTeams(parsePhase('semi', 4));
    setFinalTeams(parsePhase('final', 2));
    setLocks({ 
      slot: !!data.locked, 
      semi: !!data.semi_locked, 
      final: !!data.final_locked 
    });

    const pickedIds = new Set(q.filter(t => t).map(t => t.id));
    setAvailableTeams(initialTeams.filter(t => !pickedIds.has(t.id)));
  }, [initialTeams]);

  const checkUser = useCallback(() => {
    const storedUser = localStorage.getItem('faceit_user')
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser)
      setUser(parsedUser)
      setViewingNickname(vn => vn || parsedUser.nickname)
    }
  }, [])

  useEffect(() => {
    checkUser()
    window.addEventListener('faceit_auth_updated', checkUser)
    return () => window.removeEventListener('faceit_auth_updated', checkUser)
  }, [checkUser])
  
  const loadUserPicks = useCallback(async (nickname: string) => {
    if (picksCache[nickname]) {
      processPicksData(picksCache[nickname]);
      return;
    }
    setLoadingPicks(true)
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', nickname })
      })
      const data = await res.json()
      if (data) {
        setPicksCache(prev => ({ ...prev, [nickname]: data }));
        processPicksData(data);
      }
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      setLoadingPicks(false)
    }
  }, [picksCache, processPicksData]);

  useEffect(() => {
    if (viewingNickname) loadUserPicks(viewingNickname)
  }, [viewingNickname, loadUserPicks])

  const savePickToDb = async (phase: string, slotIndex: number, team: TeamPick | null) => {
    if (!user || isViewingOther) return
    await fetch('/api/picks', {
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
  }

  const confirmPhase = async (phase: string) => {
    if (!user || isViewingOther) return;
    if (!confirm(`Deseja confirmar suas escolhas para ${phase}? Isso não poderá ser desfeito.`)) return;
    
    await fetch('/api/picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'lock', nickname: user.nickname, phase })
    });
    setLocks(prev => ({ ...prev, [phase]: true }));
  }

  const adminToggleGlobal = async (phase: string, targetStatus: boolean) => {
    if (!isHighAdmin) return;
    const actionText = targetStatus ? "BLOQUEAR NOVOS USUÁRIOS" : "DESBLOQUEAR NOVOS USUÁRIOS";
    if (!confirm(`Deseja ${actionText} para a fase ${phase}?`)) return;

    await fetch('/api/picks', {
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
    alert("Operação realizada com sucesso.");
    window.location.reload();
  }

  const adminManageUser = async (targetNickname: string, type: 'unlock' | 'clear', phase: string) => {
    if (!isHighAdmin) return;
    const actionText = type === 'unlock' ? "DESTRAVAR" : "LIMPAR e DESTRAVAR";
    if (!confirm(`Tem certeza que deseja ${actionText} a fase ${phase} para ${targetNickname}?`)) return;

    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'admin_manage_user', 
          adminLevel: userLevel,
          targetNickname,
          type,
          phase
        })
      });
      
      if (res.ok) {
        alert("Ação realizada com sucesso!");
        // Invalida o cache para recarregar os dados atualizados
        setPicksCache(prev => { const n = {...prev}; delete n[targetNickname]; return n; });
        loadUserPicks(targetNickname);
      }
    } catch (e) { console.error(e); alert("Erro ao realizar ação."); }
  }

  const onDragEnd = (result: any) => {
    if (!user || isViewingOther) return;
    const { source, destination } = result;
    if (!destination) return;

    const sourceId = source.droppableId;
    const destId = destination.droppableId;

    // Bloqueios de Trava
    if (destId.startsWith("slot-") && locks.slot) return;
    if (destId.startsWith("semi-") && locks.semi) return;
    if (destId.startsWith("final-") && locks.final) return;

    // Regras de Cascata
    if (destId.startsWith("semi-") && !sourceId.startsWith("slot-")) {
      alert("Para a SEMI, você deve arrastar times que escolheu nas QUARTAS!");
      return;
    }
    if (destId.startsWith("final-") && !sourceId.startsWith("semi-")) {
      alert("Para a FINAL, você deve arrastar times que escolheu nas SEMIS!");
      return;
    }

    // Lógica de Movimentação Quartas
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
    // Lógica de Movimentação Semis
    else if (sourceId.startsWith("slot-") && destId.startsWith("semi-")) {
      const sIdx = parseInt(sourceId.replace("slot-", ""));
      const dIdx = parseInt(destId.replace("semi-", ""));
      const team = qualifiedTeams[sIdx];
      const newS = [...semiTeams]; newS[dIdx] = team;
      setSemiTeams(newS);
      savePickToDb('semi', dIdx, team);
    }
    // Lógica de Movimentação Final
    else if (sourceId.startsWith("semi-") && destId.startsWith("final-")) {
      const sIdx = parseInt(sourceId.replace("semi-", ""));
      const dIdx = parseInt(destId.replace("final-", ""));
      const team = semiTeams[sIdx];
      const newF = [...finalTeams]; newF[dIdx] = team;
      setFinalTeams(newF);
      savePickToDb('final', dIdx, team);
    }
  }

  const sortedStats = initialTeams
    .map(team => ({ ...team, count: pickStats[team.id] || 0 }))
    .sort((a, b) => b.count - a.count);

  const topPicks = sortedStats.filter(t => t.count > 0);
  const unusedPicks = sortedStats.filter(t => t.count === 0);

  return (
    <div className="flex flex-col gap-8">
      {!user ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-3xl border border-white/5 border-dashed">
          <FaceitLogin user={user} onAuthChange={checkUser} />
          <p className="mt-4 text-zinc-500 text-sm">Entre para salvar suas escolhas</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-900/80 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Image src={user.avatar || "/fallback-avatar.png"} alt={user.nickname} width={50} height={50} className="rounded-2xl border-2 border-amber-500 group-hover:scale-105 transition-transform" unoptimized />
                <div className="absolute -bottom-2 -right-2 bg-amber-500 text-black p-1 rounded-lg"><CheckCircle size={14} /></div>
              </div>
              <div>
                <h3 className="text-xl font-black italic tracking-tighter uppercase">{user.nickname}</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Participante do Redondo</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isAdminView && (
                <div className="flex items-center gap-2 bg-black/40 p-2 rounded-2xl border border-white/5">
                  <Eye size={16} className="text-amber-500 ml-2" />
                  <select 
                    value={viewingNickname || ""} 
                    onChange={(e) => setViewingNickname(e.target.value)}
                    className="bg-transparent text-xs font-bold uppercase outline-none cursor-pointer pr-4 text-amber-500"
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
            <div className="bg-red-500/10 border-2 border-red-500/30 p-4 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-500 font-black italic text-sm">
                <Shield size={20} /> ADMIN
              </div>
              <div className="flex gap-2">
                {['slot', 'semi', 'final'].map(phase => (
                  <button 
                    key={phase}
                    onClick={() => adminToggleGlobal(phase, !locks[phase as keyof typeof locks])}
                    className="bg-red-600 hover:bg-red-700 text-white text-[10px] px-4 py-2 rounded-xl font-bold uppercase transition-all"
                  >
                    Bloquear / Desbloquear {phase === 'slot' ? 'Quartas' : phase}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isHighAdmin && viewingNickname && (
            <div className="bg-blue-500/10 border-2 border-blue-500/30 p-4 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2 text-blue-500 font-black italic text-sm">
                <Shield size={20} /> GERENCIAR: {viewingNickname}
              </div>
              <div className="flex flex-wrap gap-2">
                {['slot', 'semi', 'final'].map(phase => (
                  <div key={phase} className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                    <span className="text-[10px] font-bold text-zinc-400 uppercase px-2 w-16 text-center">{phase === 'slot' ? 'Quartas' : phase}</span>
                    <button 
                      onClick={() => adminManageUser(viewingNickname, 'unlock', phase)}
                      className="bg-green-600 hover:bg-green-700 text-white p-1.5 rounded-md transition-all"
                      title="Destravar"
                    >
                      <Unlock size={12} />
                    </button>
                    <button 
                      onClick={() => adminManageUser(viewingNickname, 'clear', phase)}
                      className="bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-md transition-all"
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
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5">
                  <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                    <AlertCircle size={14}/> Lista de Equipes
                  </h3>
                  <Droppable droppableId="pool" isDropDisabled={isViewingOther}>
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="grid grid-cols-2 gap-3">
                        {availableTeams.map((team, index) => (
                          <Draggable key={team.id} draggableId={team.id} index={index} isDragDisabled={locks.slot || isViewingOther}>
                            {(p, s) => (
                              <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps}
                                className={`aspect-square rounded-2xl border-2 border-zinc-800 bg-black/40 p-3 flex items-center justify-center hover:border-amber-500/50 transition-all ${s.isDragging ? "scale-110 shadow-2xl border-amber-500 z-50" : ""}`}>
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

              {/* Grid Principal das Fases */}
              <div className={`${isAdminView ? "lg:col-span-6" : "lg:col-span-9"} space-y-12`}>
                {/* Renderização Dinâmica das Fases */}
                {[
                  { title: "Quartas de Final", data: qualifiedTeams, key: 'slot', cols: 4 },
                  { title: "Semi-Finais", data: semiTeams, key: 'semi', cols: 4 },
                  { title: "Grande Final", data: finalTeams, key: 'final', cols: 2 }
                ].map((phase) => {
                  const isLocked = locks[phase.key as keyof typeof locks];
                  const nextPhaseKey = phase.key === 'slot' ? 'semi' : (phase.key === 'semi' ? 'final' : null);
                  const isNextLocked = nextPhaseKey ? locks[nextPhaseKey as keyof typeof locks] : true;
                  const dragDisabled = (isLocked && (!nextPhaseKey || isNextLocked)) || isViewingOther;

                  return (
                  <div key={phase.key} className="relative">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                        {locks[phase.key as keyof typeof locks] ? <Lock className="text-red-500" /> : <Unlock className="text-amber-500" />}
                        {phase.title}
                      </h2>
                      {!locks[phase.key as keyof typeof locks] && !isViewingOther && (
                        <button 
                          onClick={() => confirmPhase(phase.key)}
                          className="bg-amber-500 text-black px-6 py-2 rounded-full font-black text-xs uppercase hover:bg-white transition-all shadow-lg shadow-amber-500/20"
                        >
                          Confirmar Escolhas
                        </button>
                      )}
                    </div>

                    <div className={`grid grid-cols-2 md:grid-cols-${phase.cols} gap-4`}>
                      {phase.data.map((team, index) => (
                        <Droppable key={index} droppableId={`${phase.key}-${index}`} isDropDisabled={locks[phase.key as keyof typeof locks] || isViewingOther}>
                          {(provided, snapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps}
                              className={`h-40 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center transition-all
                                ${team ? "border-amber-500 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/20"}
                                ${snapshot.isDraggingOver ? "border-amber-400 bg-amber-500/10 scale-105" : ""}`}>
                              {team ? (
                                <Draggable draggableId={`${phase.key}-slot-${team.id}-${index}`} index={index} isDragDisabled={dragDisabled}>
                                  {(p) => (
                                    <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className="flex flex-col items-center">
                                      <Image src={team.team_image} alt="" width={64} height={64} className="drop-shadow-2xl" unoptimized />
                                      <span className="text-[10px] font-black mt-3 text-amber-500 tracking-tighter uppercase">{team.team_name}</span>
                                    </div>
                                  )}
                                </Draggable>
                              ) : (
                                <span className="text-zinc-800 font-black text-5xl select-none">{index + 1}</span>
                              )}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      ))}
                    </div>
                  </div>
                )})}
              </div>

              {/* Stats Sidebar */}
              {isAdminView && (
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-zinc-900/50 p-6 rounded-3xl border border-white/5 h-full">
                  <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-widest mb-6 flex items-center gap-2">
                    <BarChart2 size={14}/> Estatísticas
                  </h3>
                  
                  <div className="flex gap-2 mb-4 bg-black/20 p-1 rounded-xl">
                    <button 
                      onClick={() => setStatsTab('top')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${statsTab === 'top' ? 'bg-amber-500 text-black' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Mais Escolhidos
                    </button>
                    <button 
                      onClick={() => setStatsTab('unused')}
                      className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all ${statsTab === 'unused' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-white'}`}
                    >
                      Não Escolhidos
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                    {(statsTab === 'top' ? topPicks : unusedPicks).map((team, idx) => (
                      <div key={team.id} className="flex items-center justify-between bg-black/40 p-2 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold w-4 text-center ${idx < 3 && statsTab === 'top' ? 'text-amber-500' : 'text-zinc-600'}`}>
                            {idx + 1}
                          </span>
                          <Image src={team.team_image} alt={team.team_name} width={24} height={24} className="object-contain" unoptimized />
                          <span className="text-xs font-bold text-zinc-300 truncate max-w-[100px]">{team.team_name}</span>
                        </div>
                        {statsTab === 'top' && (
                          <div className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-2 py-1 rounded-lg">
                            {team.count}
                          </div>
                        )}
                      </div>
                    ))}
                    {(statsTab === 'top' ? topPicks : unusedPicks).length === 0 && (
                      <p className="text-center text-zinc-600 text-xs py-4">Nenhum time encontrado.</p>
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
  )
}
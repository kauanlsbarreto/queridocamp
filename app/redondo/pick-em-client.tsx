"use client"

import { useState, useEffect, useCallback } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import Image from "next/image"
import { Lock, Shield, AlertCircle, CheckCircle, Eye, X, Unlock, Globe } from "lucide-react"

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
  Admin?: number;
}

export default function PickEmClient({ initialTeams, usersWithPicks, adminGuids }: { initialTeams: TeamPick[], usersWithPicks: string[], adminGuids: string[] }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingPicks, setLoadingPicks] = useState(false)
  const [viewingNickname, setViewingNickname] = useState<string | null>(null)
  
  const [availableTeams, setAvailableTeams] = useState<TeamPick[]>(initialTeams)
  
  // Estados para as etapas
  const [qualifiedTeams, setQualifiedTeams] = useState<(TeamPick | null)[]>(Array(8).fill(null))
  const [semiTeams, setSemiTeams] = useState<(TeamPick | null)[]>(Array(4).fill(null))
  const [finalTeams, setFinalTeams] = useState<(TeamPick | null)[]>(Array(2).fill(null))

  // Estados de bloqueio
  const [isLocked, setIsLocked] = useState(false)
  const [isSemiLocked, setIsSemiLocked] = useState(false)
  const [isFinalLocked, setIsFinalLocked] = useState(false)

  const isAdmin = !!(user && adminGuids.includes(user.faceit_guid));
  const isViewingOther = !!(viewingNickname && user && viewingNickname !== user.nickname);

  const checkUser = useCallback(() => {
    const storedUser = localStorage.getItem('faceit_user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setUser(prev => (prev?.faceit_guid !== parsedUser.faceit_guid ? parsedUser : prev))
        setViewingNickname(prev => prev ? prev : parsedUser.nickname)
      } catch (e) {
        console.error("Erro ao parsear usuário", e)
        setUser(null)
      }
    } else {
      setUser(null)
      setViewingNickname(null)
      setQualifiedTeams(Array(8).fill(null))
      setSemiTeams(Array(4).fill(null))
      setFinalTeams(Array(2).fill(null))
      setAvailableTeams(initialTeams)
      setIsLocked(false)
      setIsSemiLocked(false)
      setIsFinalLocked(false)
    }
  }, [initialTeams])

  useEffect(() => {
    checkUser() 
    const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'faceit_user') checkUser()
    }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('faceit_auth_updated', checkUser)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('faceit_auth_updated', checkUser)
    }
  }, [checkUser])

  useEffect(() => {
    if (viewingNickname) loadUserPicks(viewingNickname)
  }, [viewingNickname])

  const loadUserPicks = async (nickname: string) => {
    setLoadingPicks(true)
    try {
      let guidToUpdate = user && user.nickname === nickname ? user.faceit_guid : undefined;
      
      if (!guidToUpdate && typeof window !== 'undefined') {
        const stored = localStorage.getItem('faceit_user');
        if (stored) {
           const p = JSON.parse(stored);
           if (p.nickname === nickname) guidToUpdate = p.faceit_guid;
        }
      }

      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', nickname, faceit_guid: guidToUpdate })
      })
      const data = await res.json()
      
      if (data) {
        const savedPicks = Array(8).fill(null)
        const savedSemi = Array(4).fill(null)
        const savedFinal = Array(2).fill(null)
        const pickedTeamIds = new Set<string>()

        // Carregar Quartas
        for (let i = 0; i < 8; i++) {
          const slotKey = `slot_${i + 1}`
          if (data[slotKey]) {
            const team = typeof data[slotKey] === 'string' ? JSON.parse(data[slotKey]) : data[slotKey]
            savedPicks[i] = team
            pickedTeamIds.add(team.id)
          }
        }

        // Carregar Semi
        for (let i = 0; i < 4; i++) {
          const slotKey = `semi_${i + 1}`
          if (data[slotKey]) {
            const team = typeof data[slotKey] === 'string' ? JSON.parse(data[slotKey]) : data[slotKey]
            savedSemi[i] = team
          }
        }

        // Carregar Final
        for (let i = 0; i < 2; i++) {
          const slotKey = `final_${i + 1}`
          if (data[slotKey]) {
            const team = typeof data[slotKey] === 'string' ? JSON.parse(data[slotKey]) : data[slotKey]
            savedFinal[i] = team
          }
        }

        setQualifiedTeams(savedPicks)
        setSemiTeams(savedSemi)
        setFinalTeams(savedFinal)
        
        setIsLocked(!!data.locked)
        setIsSemiLocked(!!data.semi_locked)
        setIsFinalLocked(!!data.final_locked)
        
        const remainingTeams = initialTeams.filter(t => !pickedTeamIds.has(t.id))
        setAvailableTeams(remainingTeams)
      }
    } catch (error) {
      console.error("Erro ao carregar picks:", error)
    } finally {
      setLoadingPicks(false)
    }
  }

  const savePickToDb = async (field: string, team: TeamPick | null) => {
    if (!user || (isViewingOther && !isAdmin)) return
    try {
      await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          nickname: viewingNickname || user.nickname,
          faceit_guid: user.faceit_guid, 
          field,
          team
        })
      })
    } catch (error) {
      console.error("Erro ao salvar pick:", error)
    }
  }

  // ATUALIZADO: Agora aceita isGlobalAction para diferenciar bloqueio geral de confirmação pessoal
  const toggleLock = async (stage: 'quarters' | 'semi' | 'final', currentState: boolean, isGlobalAction: boolean) => {
    if (!user) return
    
    // Se não for admin, só pode bloquear (confirmar)
    if (!isAdmin && currentState) return;

    // Se for Confirmação Pessoal (não global)
    if (!isGlobalAction) {
        // Validação: só pode confirmar se a etapa estiver completa
        let isComplete = false;
        if (stage === 'quarters') isComplete = qualifiedTeams.every(t => t !== null);
        else if (stage === 'semi') isComplete = semiTeams.every(t => t !== null);
        else if (stage === 'final') isComplete = finalTeams.every(t => t !== null);

        if (!isComplete && !currentState) {
            alert("Você precisa preencher todos os times desta etapa para confirmar.");
            return;
        }
    }

    let confirmMsg = "";
    if (isGlobalAction) {
        // Mensagem para Admin usando Botão Global
        confirmMsg = currentState 
            ? "GLOBAL: Isso irá DESBLOQUEAR esta etapa para TODOS os usuários. Continuar?" 
            : "GLOBAL: Isso irá BLOQUEAR esta etapa para TODOS os usuários. Continuar?";
    } else {
        // Mensagem para Usuário (ou Admin confirmando o seu)
        confirmMsg = currentState 
            ? "Deseja desbloquear suas escolhas?" 
            : "Tem certeza? Após confirmar, você não poderá mais alterar suas escolhas.";
    }
    
    if (!window.confirm(confirmMsg)) return

    try {
      await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'lock', 
          nickname: viewingNickname || user.nickname,
          faceit_guid: user.faceit_guid,
          stage,
          locked: !currentState,
          global: isGlobalAction // Envia true apenas se clicou no botão global
        })
      })
      
      // Atualiza o estado visual localmente
      if (stage === 'quarters') setIsLocked(!currentState)
      if (stage === 'semi') setIsSemiLocked(!currentState)
      if (stage === 'final') setIsFinalLocked(!currentState)

    } catch (error) {
      console.error("Erro ao alterar bloqueio:", error)
    }
  }

  const removePick = (index: number, stage: 'quarters' | 'semi' | 'final') => {
    if (!user || (isViewingOther && !isAdmin)) return
    
    if (stage === 'quarters') {
        if (isLocked) return
        const teamToRemove = qualifiedTeams[index]
        if (!teamToRemove) return
        const newQualified = [...qualifiedTeams]
        newQualified[index] = null
        setQualifiedTeams(newQualified)
        setAvailableTeams([...availableTeams, teamToRemove])
        savePickToDb(`slot_${index + 1}`, null)
    } else if (stage === 'semi') {
        if (isSemiLocked) return
        const newSemi = [...semiTeams]
        newSemi[index] = null
        setSemiTeams(newSemi)
        savePickToDb(`semi_${index + 1}`, null)
    } else if (stage === 'final') {
        if (isFinalLocked) return
        const newFinal = [...finalTeams]
        newFinal[index] = null
        setFinalTeams(newFinal)
        savePickToDb(`final_${index + 1}`, null)
    }
  }

  const onDragEnd = (result: any) => {
    if (!user || (isViewingOther && !isAdmin)) return

    const { source, destination } = result
    if (!destination) return

    if (source.droppableId === "pool" && destination.droppableId.startsWith("slot-")) {
      if (isLocked) return
      const slotIndex = parseInt(destination.droppableId.replace("slot-", ""))
      const movedTeam = availableTeams[source.index]
      const previousTeam = qualifiedTeams[slotIndex]

      const newQualified = [...qualifiedTeams]
      newQualified[slotIndex] = movedTeam
      setQualifiedTeams(newQualified)

      const newAvailable = Array.from(availableTeams)
      newAvailable.splice(source.index, 1)
      if (previousTeam) newAvailable.push(previousTeam)

      setAvailableTeams(newAvailable)
      savePickToDb(`slot_${slotIndex + 1}`, movedTeam)
      return
    }

    if (source.droppableId.startsWith("slot-") && destination.droppableId.startsWith("semi-")) {
      if (isSemiLocked) return
      const sourceIndex = parseInt(source.droppableId.replace("slot-", ""))
      const destIndex = parseInt(destination.droppableId.replace("semi-", ""))
      const teamToCopy = qualifiedTeams[sourceIndex]
      if (!teamToCopy) return
      const newSemi = [...semiTeams]
      newSemi[destIndex] = teamToCopy
      setSemiTeams(newSemi)
      savePickToDb(`semi_${destIndex + 1}`, teamToCopy)
      return
    }

    if (source.droppableId.startsWith("semi-") && destination.droppableId.startsWith("final-")) {
      if (isFinalLocked) return
      const sourceIndex = parseInt(source.droppableId.replace("semi-", ""))
      const destIndex = parseInt(destination.droppableId.replace("final-", ""))
      const teamToCopy = semiTeams[sourceIndex]
      if (!teamToCopy) return
      const newFinal = [...finalTeams]
      newFinal[destIndex] = teamToCopy
      setFinalTeams(newFinal)
      savePickToDb(`final_${destIndex + 1}`, teamToCopy)
      return
    }
    
    if (source.droppableId.startsWith("slot-") && destination.droppableId === "pool") {
        removePick(parseInt(source.droppableId.replace("slot-", "")), 'quarters')
        return
    }
  }

  const renderLockControl = (isLockedState: boolean, stage: 'quarters' | 'semi' | 'final') => {
      // Verifica se a etapa está completa visualmente
      let isComplete = false;
      if (stage === 'quarters') isComplete = qualifiedTeams.every(t => t !== null);
      else if (stage === 'semi') isComplete = semiTeams.every(t => t !== null);
      else if (stage === 'final') isComplete = finalTeams.every(t => t !== null);

      return (
        <div className="flex items-center gap-3">
            {/* BOTÃO GLOBAL - APENAS ADMIN */}
            {isAdmin && (
                <button
                    onClick={() => toggleLock(stage, isLockedState, true)}
                    title="Trava Global (Impede novas submissões de todos)"
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase transition-all ${
                        isLockedState 
                        ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30" 
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/50 hover:bg-blue-500/30"
                    }`}
                >
                    <Globe size={12} />
                    {isLockedState ? `Desbloquear Global` : `Bloquear Global`}
                </button>
            )}

            {/* BOTÃO DE CONFIRMAÇÃO PESSOAL (ADMIN TAMBÉM VÊ O SEU) */}
            {!isViewingOther && (
                isLockedState ? (
                    isAdmin ? (
                        // Admin pode desbloquear o seu próprio
                        <button
                            onClick={() => toggleLock(stage, true, false)}
                            className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-700 transition-all cursor-pointer"
                        >
                            <Lock size={12} className="text-zinc-500" />
                            <span className="text-[10px] font-bold uppercase text-zinc-500">Confirmado (Desbloquear)</span>
                        </button>
                    ) : (
                        // Usuário comum só vê que está confirmado
                        <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
                            <Lock size={12} className="text-zinc-500" />
                            <span className="text-[10px] font-bold uppercase text-zinc-500">Confirmado</span>
                        </div>
                    )
                ) : (
                    // Botão de Confirmar (Habilitado apenas se completo)
                    <button
                        onClick={() => toggleLock(stage, false, false)}
                        disabled={!isComplete}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                            isComplete 
                            ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/30 cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.2)]" 
                            : "bg-zinc-800 text-zinc-600 border-zinc-700 cursor-not-allowed opacity-50"
                        }`}
                    >
                        <CheckCircle size={12} />
                        <span className="text-[10px] font-bold uppercase">Confirmar Escolhas</span>
                    </button>
                )
            )}
        </div>
      )
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3">
          <Shield className="text-amber-500" />
          <span className="font-bold text-zinc-300">
            {user ? `Bem-vindo, ${user.nickname}!` : "Faça login para começar seus palpites"}
          </span>
        </div>
        {isAdmin && (
            <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-700">
            <Eye className="text-gold" size={20} />
            <select 
                value={viewingNickname || ""} 
                onChange={(e) => setViewingNickname(e.target.value)}
                className="bg-transparent text-white outline-none border-none cursor-pointer min-w-[200px]"
            >
                <option value={user?.nickname} className="bg-zinc-900">Meus Palpites</option>
                <optgroup label="Usuários">
                {usersWithPicks.filter(u => u !== user?.nickname).map(u => (
                    <option key={u} value={u} className="bg-zinc-900">{u}</option>
                ))}
                </optgroup>
            </select>
            </div>
        )}
      </div>

      {!user ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl">
          <AlertCircle className="w-16 h-16 text-zinc-600 mb-4" />
          <h3 className="text-2xl font-bold text-zinc-400 mb-2">Login Necessário</h3>
          <p className="text-zinc-500">Conecte sua conta Faceit acima para liberar o quadro de escolhas.</p>
        </div>
      ) : loadingPicks ? (
        <div className="text-center py-20 text-amber-500 animate-pulse">Carregando seus palpites...</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Pool de Times */}
            <div className="bg-zinc-900/50 p-6 rounded-2xl border border-white/10 h-fit">
              <h2 className="text-amber-500 font-bold mb-6 uppercase tracking-tighter flex items-center gap-2 italic">
                <Shield size={20} /> Equipes Disponíveis
              </h2>
              
              <Droppable droppableId="pool">
                {(provided) => (
                  <div 
                    {...provided.droppableProps} 
                    ref={provided.innerRef}
                    className="grid grid-cols-3 gap-3"
                  >
                    {availableTeams.map((team, index) => (
                      <Draggable key={team.id} draggableId={team.id} index={index} isDragDisabled={isLocked || (isViewingOther && !isAdmin)}>
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="relative aspect-square bg-zinc-800 rounded-lg p-2 border border-white/5 hover:border-amber-500 transition-all shadow-xl cursor-grab active:cursor-grabbing"
                          >
                            <Image 
                              src={team.team_image} 
                              alt={team.team_name} 
                              fill 
                              className="object-contain p-2"
                              unoptimized
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            <div className="lg:col-span-2 space-y-8">
              
              {/* Quartas de Final */}
              <div className="bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-white font-bold uppercase tracking-tighter flex items-center gap-2 italic">
                        <span className="text-amber-500">1.</span> Quartas de Final (8 Times)
                    </h2>
                    {renderLockControl(isLocked, 'quarters')}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    {qualifiedTeams.map((team, index) => (
                      <Droppable key={`q-${index}`} droppableId={`slot-${index}`} isDropDisabled={isLocked || (isViewingOther && !isAdmin)}> 
                        {(provided, snapshot) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={`h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                              team 
                                ? "border-amber-500 bg-amber-500/10" 
                                : snapshot.isDraggingOver 
                                  ? "border-white bg-zinc-800" 
                                  : "border-zinc-800 bg-zinc-900/40"
                            }`}
                          >
                            {team ? (
                              <Draggable key={`q-drag-${team.id}`} draggableId={team.id} index={0} isDragDisabled={(isLocked && !isAdmin) || (isViewingOther && !isAdmin)}>
                                {(dragProvided) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className="flex flex-col items-center w-full h-full justify-center relative group"
                                  >
                                    {!isLocked && (!isViewingOther || isAdmin) && (
                                        <button onClick={(e) => { e.stopPropagation(); removePick(index, 'quarters'); }} className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-0.5 hover:bg-red-600 z-10"><X size={10} /></button>
                                    )}
                                    <div className="relative w-12 h-12">
                                       <Image src={team.team_image} alt={team.team_name} fill className="object-contain" unoptimized />
                                    </div>
                                    <span className="text-[9px] mt-2 font-bold text-amber-500 uppercase text-center px-1 truncate w-full">{team.team_name}</span>
                                  </div>
                                )}
                              </Draggable>
                            ) : <span className="text-zinc-800 font-black text-2xl select-none">{index + 1}</span>}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))}
                  </div>
              </div>

              {/* Semi Finais */}
              <div className="bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-white font-bold uppercase tracking-tighter flex items-center gap-2 italic">
                        <span className="text-amber-500">2.</span> Semi-Finais (4 Times)
                    </h2>
                    {renderLockControl(isSemiLocked, 'semi')}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-4">
                    {semiTeams.map((team, index) => (
                      <Droppable key={`s-${index}`} droppableId={`semi-${index}`} isDropDisabled={isSemiLocked || (isViewingOther && !isAdmin)}> 
                        {(provided, snapshot) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={`h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                              team 
                                ? "border-amber-500 bg-amber-500/10" 
                                : snapshot.isDraggingOver 
                                  ? "border-white bg-zinc-800" 
                                  : "border-zinc-800 bg-zinc-900/40"
                            }`}
                          >
                            {team ? (
                              <Draggable key={`s-drag-${team.id}`} draggableId={team.id} index={0} isDragDisabled={(isSemiLocked && !isAdmin) || (isViewingOther && !isAdmin)}>
                                {(dragProvided) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className="flex flex-col items-center w-full h-full justify-center relative group"
                                  >
                                    {!isSemiLocked && (!isViewingOther || isAdmin) && (
                                        <button onClick={(e) => { e.stopPropagation(); removePick(index, 'semi'); }} className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-0.5 hover:bg-red-600 z-10"><X size={10} /></button>
                                    )}
                                    <div className="relative w-12 h-12">
                                       <Image src={team.team_image} alt={team.team_name} fill className="object-contain" unoptimized />
                                    </div>
                                    <span className="text-[9px] mt-2 font-bold text-amber-500 uppercase text-center px-1 truncate w-full">{team.team_name}</span>
                                  </div>
                                )}
                              </Draggable>
                            ) : <span className="text-zinc-800 font-black text-2xl select-none">S{index + 1}</span>}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))}
                  </div>
              </div>

              {/* Final */}
              <div className="bg-zinc-900/30 p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-white font-bold uppercase tracking-tighter flex items-center gap-2 italic">
                        <span className="text-amber-500">3.</span> Grande Final (2 Times)
                    </h2>
                    {renderLockControl(isFinalLocked, 'final')}
                  </div>
                  
                  <div className="flex justify-center gap-8">
                    {finalTeams.map((team, index) => (
                      <Droppable key={`f-${index}`} droppableId={`final-${index}`} isDropDisabled={isFinalLocked || (isViewingOther && !isAdmin)}> 
                        {(provided, snapshot) => (
                          <div
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                            className={`h-40 w-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                              team 
                                ? "border-amber-500 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.3)]" 
                                : snapshot.isDraggingOver 
                                  ? "border-white bg-zinc-800" 
                                  : "border-zinc-800 bg-zinc-900/40"
                            }`}
                          >
                            {team ? (
                              <Draggable key={`f-drag-${team.id}`} draggableId={team.id} index={0} isDragDisabled={(isFinalLocked && !isAdmin) || (isViewingOther && !isAdmin)}>
                                {(dragProvided) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className="flex flex-col items-center w-full h-full justify-center relative group"
                                  >
                                    {!isFinalLocked && (!isViewingOther || isAdmin) && (
                                        <button onClick={(e) => { e.stopPropagation(); removePick(index, 'final'); }} className="absolute top-1 right-1 bg-red-500/80 text-white rounded-full p-0.5 hover:bg-red-600 z-10"><X size={10} /></button>
                                    )}
                                    <div className="relative w-16 h-16">
                                       <Image src={team.team_image} alt={team.team_name} fill className="object-contain" unoptimized />
                                    </div>
                                    <span className="text-[10px] mt-2 font-bold text-amber-500 uppercase text-center px-1 truncate w-full">{team.team_name}</span>
                                  </div>
                                )}
                              </Draggable>
                            ) : <span className="text-zinc-800 font-black text-3xl select-none">F{index + 1}</span>}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    ))}
                  </div>
              </div>

            </div>
          </div>
        </DragDropContext>
      )}
    </div>
  )
}
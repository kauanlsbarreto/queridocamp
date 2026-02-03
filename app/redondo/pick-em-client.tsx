"use client"

import { useState, useEffect, useCallback } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import Image from "next/image"
import { Lock, Shield, AlertCircle, CheckCircle, Eye, X } from "lucide-react"

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
}

export default function PickEmClient({ initialTeams, usersWithPicks, adminGuids }: { initialTeams: TeamPick[], usersWithPicks: string[], adminGuids: string[] }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingPicks, setLoadingPicks] = useState(false)
  const [viewingNickname, setViewingNickname] = useState<string | null>(null)
  
  const [availableTeams, setAvailableTeams] = useState<TeamPick[]>(initialTeams)
  const [qualifiedTeams, setQualifiedTeams] = useState<(TeamPick | null)[]>(Array(8).fill(null))
  const [isLocked, setIsLocked] = useState(false)

  const isAdmin = user && adminGuids.includes(user.faceit_guid);
  const isViewingOther = viewingNickname && user && viewingNickname !== user.nickname;

  // 🔹 Função para verificar usuário (usando useCallback para não recriar a cada render)
  const checkUser = useCallback(() => {
    const storedUser = localStorage.getItem('faceit_user')
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        // Só atualiza se o ID mudou para evitar loops
        setUser(prev => (prev?.faceit_guid !== parsedUser.faceit_guid ? parsedUser : prev))
        
        // Se não estiver visualizando ninguém, define como o próprio usuário
        setViewingNickname(prev => prev ? prev : parsedUser.nickname)
      } catch (e) {
        console.error("Erro ao parsear usuário", e)
        setUser(null)
      }
    } else {
      setUser(null)
      setViewingNickname(null)
      setQualifiedTeams(Array(8).fill(null))
      setAvailableTeams(initialTeams)
      setIsLocked(false)
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
        const pickedTeamIds = new Set<string>()

        for (let i = 0; i < 8; i++) {
          const slotKey = `slot_${i + 1}`
          if (data[slotKey]) {
            const team = typeof data[slotKey] === 'string' ? JSON.parse(data[slotKey]) : data[slotKey]
            savedPicks[i] = team
            pickedTeamIds.add(team.id)
          }
        }

        setQualifiedTeams(savedPicks)
        setIsLocked(!!data.locked)
        
        const remainingTeams = initialTeams.filter(t => !pickedTeamIds.has(t.id))
        setAvailableTeams(remainingTeams)
      }
    } catch (error) {
      console.error("Erro ao carregar picks:", error)
    } finally {
      setLoadingPicks(false)
    }
  }

  const savePickToDb = async (slotIndex: number, team: TeamPick | null) => {
    if (!user || isViewingOther) return
    try {
      await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          nickname: user.nickname,
          faceit_guid: user.faceit_guid,
          slotIndex,
          team
        })
      })
    } catch (error) {
      console.error("Erro ao salvar pick:", error)
    }
  }

  const removePick = (slotIndex: number) => {
    if (!user || isLocked || isViewingOther) return
    
    const teamToRemove = qualifiedTeams[slotIndex]
    if (!teamToRemove) return

    const newQualified = [...qualifiedTeams]
    newQualified[slotIndex] = null
    setQualifiedTeams(newQualified)

    const newAvailable = [...availableTeams, teamToRemove]
    setAvailableTeams(newAvailable)

    savePickToDb(slotIndex, null)
  }

  const confirmPicks = async () => {
    if (!user || isViewingOther) return
    const confirm = window.confirm("Tem certeza? Após confirmar, você não poderá mais alterar suas escolhas.")
    if (!confirm) return

    try {
      await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'lock', 
          nickname: user.nickname,
          faceit_guid: user.faceit_guid
        })
      })
      setIsLocked(true)
    } catch (error) {
      console.error("Erro ao confirmar:", error)
    }
  }

  const onDragEnd = (result: any) => {
    if (!user || isLocked || isViewingOther) return

    const { source, destination } = result
    if (!destination) return

    if (source.droppableId === "pool" && destination.droppableId.startsWith("slot-")) {
      const slotIndex = parseInt(destination.droppableId.replace("slot-", ""))
      const movedTeam = availableTeams[source.index]
      const previousTeam = qualifiedTeams[slotIndex]

      const newQualified = [...qualifiedTeams]
      newQualified[slotIndex] = movedTeam
      setQualifiedTeams(newQualified)

      const newAvailable = Array.from(availableTeams)
      newAvailable.splice(source.index, 1)
      
      if (previousTeam) {
        newAvailable.push(previousTeam)
      }

      setAvailableTeams(newAvailable)
      savePickToDb(slotIndex, movedTeam)
      return
    }

    if (source.droppableId.startsWith("slot-") && destination.droppableId === "pool") {
      const slotIndex = parseInt(source.droppableId.replace("slot-", ""))
      removePick(slotIndex)
      return
    }

    if (source.droppableId.startsWith("slot-") && destination.droppableId.startsWith("slot-")) {
      const sourceSlotIndex = parseInt(source.droppableId.replace("slot-", ""))
      const destSlotIndex = parseInt(destination.droppableId.replace("slot-", ""))
      
      if (sourceSlotIndex === destSlotIndex) return

      const sourceTeam = qualifiedTeams[sourceSlotIndex]
      const destTeam = qualifiedTeams[destSlotIndex]

      const newQualified = [...qualifiedTeams]
      newQualified[destSlotIndex] = sourceTeam
      newQualified[sourceSlotIndex] = destTeam
      setQualifiedTeams(newQualified)

      savePickToDb(destSlotIndex, sourceTeam)
      savePickToDb(sourceSlotIndex, destTeam)
    }
  }

  return (
    <div className="space-y-8">
      {/* Barra de Login Superior */}
      <div className="flex justify-between items-center bg-zinc-900/80 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center gap-3">
          <Shield className="text-amber-500" />
          <span className="font-bold text-zinc-300">
            {user ? `Bem-vindo, ${user.nickname}!` : "Faça login para começar seus palpites"}
          </span>
        </div>
      </div>

      {!user ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl">
          <AlertCircle className="w-16 h-16 text-zinc-600 mb-4" />
          <h3 className="text-2xl font-bold text-zinc-400 mb-2">Login Necessário</h3>
          <p className="text-zinc-500">Conecte sua conta Faceit acima para liberar o quadro de escolhas.</p>
          {/* Removido qualquer botão duplicado aqui, deixando apenas o da barra superior */}
        </div>
      ) : loadingPicks ? (
        <div className="text-center py-20 text-amber-500 animate-pulse">Carregando seus palpites...</div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            
            {isAdmin ? (
              <div className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-700">
                <Eye className="text-gold" size={20} />
                <select 
                  value={viewingNickname || ""} 
                  onChange={(e) => setViewingNickname(e.target.value)}
                  className="bg-transparent text-white outline-none border-none cursor-pointer min-w-[200px]"
                >
                  <option value={user.nickname} className="bg-zinc-900">Meus Palpites</option>
                  <optgroup label="Usuários">
                    {usersWithPicks.filter(u => u !== user.nickname).map(u => (
                      <option key={u} value={u} className="bg-zinc-900">{u}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
            ) : <div></div>}

            {isLocked ? (
              <div className="flex items-center gap-2 bg-green-500/20 text-green-400 px-6 py-3 rounded-xl border border-green-500/50">
                <CheckCircle size={20} />
                <span className="font-bold">Escolhas Confirmadas</span>
              </div>
            ) : isViewingOther ? (
              <div className="text-zinc-500 italic flex items-center gap-2">
                <Eye size={16} /> Visualizando {viewingNickname}
              </div>
            ) : (
              <button
                onClick={confirmPicks}
                disabled={qualifiedTeams.some(t => t === null)}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold px-8 py-3 rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                <Lock size={18} /> Confirmar Escolhas
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
                      <Draggable key={team.id} draggableId={team.id} index={index} isDragDisabled={isLocked || !!isViewingOther}>
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

            <div className="lg:col-span-2">
              <h2 className="text-white font-bold mb-6 uppercase tracking-tighter flex items-center gap-2 italic">
                <Lock size={20} className="text-amber-500" /> Quartas de Final (Passam 8)
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {qualifiedTeams.map((team, index) => (
                  <Droppable key={index} droppableId={`slot-${index}`} isDropDisabled={isLocked || !!isViewingOther}> 
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                          team 
                            ? "border-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                            : snapshot.isDraggingOver 
                              ? "border-white bg-zinc-800" 
                              : "border-zinc-800 bg-zinc-900/40"
                        }`}
                      >
                        {team ? (
                          <Draggable key={team.id} draggableId={team.id} index={0} isDragDisabled={isLocked || !!isViewingOther}>
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className="flex flex-col items-center animate-in zoom-in duration-300 relative group w-full h-full justify-center"
                              >
                                {!isLocked && !isViewingOther && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removePick(index);
                                    }}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-md z-10 hover:bg-red-600"
                                    title="Remover time"
                                  >
                                    <X size={12} />
                                  </button>
                                )}
                                <div className="relative w-16 h-16 drop-shadow-lg">
                                   <Image src={team.team_image} alt={team.team_name} fill className="object-contain" unoptimized />
                                </div>
                                <span className="text-[10px] mt-3 font-bold text-amber-500 uppercase text-center px-1">
                                  {team.team_name}
                                </span>
                                {isLocked && (
                                  <div className="flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-black/50">
                                    <Lock size={10} className="text-amber-500" />
                                    <span className="text-[9px] font-bold uppercase text-zinc-400">
                                      Confirmado
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ) : (
                          <span className="text-zinc-800 font-black text-4xl select-none">{index + 1}</span>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>

              <div className="mt-12 opacity-15 grayscale select-none pointer-events-none border-t border-zinc-800 pt-10">
                 <div className="flex justify-around items-center">
                    <div className="flex flex-col gap-6">
                       <div className="w-40 h-20 border border-zinc-700 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase italic">Semi-Final 1</div>
                       <div className="w-40 h-20 border border-zinc-700 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase italic">Semi-Final 2</div>
                    </div>
                    <div className="w-52 h-32 border-2 border-amber-500/50 rounded-2xl flex items-center justify-center">
                       <span className="text-amber-500 font-black text-2xl italic tracking-tighter uppercase">Final do Querido Draft</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </DragDropContext>
      )}
    </div>
  )
}
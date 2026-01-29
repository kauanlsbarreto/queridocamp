"use client"

import { useState, useEffect } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import Image from "next/image"
import { Lock, Shield, AlertCircle } from "lucide-react"
import FaceitLogin from "../../components/FaceitLogin" // Certifique-se que o caminho está certo

interface TeamPick {
  id: string;
  team_name: string;
  team_image: string;
}

interface UserProfile {
  nickname: string;
  avatar: string;
}

export default function PickEmClient({ initialTeams }: { initialTeams: TeamPick[] }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loadingPicks, setLoadingPicks] = useState(false)
  
  // O estado inicial dos times disponíveis é todos os times
  const [availableTeams, setAvailableTeams] = useState<TeamPick[]>(initialTeams)
  // O estado inicial dos slots é vazio
  const [qualifiedTeams, setQualifiedTeams] = useState<(TeamPick | null)[]>(Array(8).fill(null))

  // 1. Monitorar Login do Usuário
  useEffect(() => {
    const checkUser = () => {
      const storedUser = localStorage.getItem('faceit_user')
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        loadUserPicks(parsedUser.nickname)
      } else {
        setUser(null)
        // Se deslogar, reseta tudo
        setQualifiedTeams(Array(8).fill(null))
        setAvailableTeams(initialTeams)
      }
    }

    checkUser()
    window.addEventListener('storage', checkUser)
    // Ouve evento customizado do FaceitLogin se necessário, ou apenas storage
    return () => window.removeEventListener('storage', checkUser)
  }, [initialTeams])

  // 2. Carregar escolhas do banco
  const loadUserPicks = async (nickname: string) => {
    setLoadingPicks(true)
    try {
      const res = await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'load', nickname })
      })
      const data = await res.json()
      
      if (data) {
        const savedPicks = Array(8).fill(null)
        const pickedTeamIds = new Set<string>()

        // Preenche os slots baseados nas colunas slot_1 a slot_8
        for (let i = 0; i < 8; i++) {
          const slotKey = `slot_${i + 1}`
          if (data[slotKey]) {
            // O banco retorna JSON string ou objeto direto dependendo do driver
            const team = typeof data[slotKey] === 'string' ? JSON.parse(data[slotKey]) : data[slotKey]
            savedPicks[i] = team
            pickedTeamIds.add(team.id)
          }
        }

        setQualifiedTeams(savedPicks)
        
        // Remove dos times disponíveis aqueles que já foram escolhidos
        const remainingTeams = initialTeams.filter(t => !pickedTeamIds.has(t.id))
        setAvailableTeams(remainingTeams)
      }
    } catch (error) {
      console.error("Erro ao carregar picks:", error)
    } finally {
      setLoadingPicks(false)
    }
  }

  // 3. Salvar escolha no banco
  const savePickToDb = async (slotIndex: number, team: TeamPick) => {
    if (!user) return
    try {
      await fetch('/api/picks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save',
          nickname: user.nickname,
          slotIndex,
          team
        })
      })
    } catch (error) {
      console.error("Erro ao salvar pick:", error)
      // Opcional: Reverter estado visual se der erro
    }
  }

  const onDragEnd = (result: any) => {
    if (!user) return // Segurança extra

    const { source, destination } = result

    // Se soltou fora ou no mesmo lugar
    if (!destination || destination.droppableId === "pool") return

    const slotIndex = parseInt(destination.droppableId.replace("slot-", ""))
    
    // Se o slot já está ocupado, não faz nada (TRAVA)
    if (qualifiedTeams[slotIndex] !== null) return

    const movedTeam = availableTeams[source.index]

    // Atualiza visualmente (Otimista)
    const newQualified = [...qualifiedTeams]
    newQualified[slotIndex] = movedTeam
    setQualifiedTeams(newQualified)

    const newAvailable = Array.from(availableTeams)
    newAvailable.splice(source.index, 1)
    setAvailableTeams(newAvailable)

    // Salva no banco
    savePickToDb(slotIndex, movedTeam)
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
        <FaceitLogin />
      </div>

      {/* Se não estiver logado, bloqueia a visão ou interação */}
      {!user ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl">
          <AlertCircle className="w-16 h-16 text-zinc-600 mb-4" />
          <h3 className="text-2xl font-bold text-zinc-400 mb-2">Login Necessário</h3>
          <p className="text-zinc-500">Conecte sua conta Faceit acima para liberar o quadro de escolhas.</p>
        </div>
      ) : loadingPicks ? (
        <div className="text-center py-20 text-amber-500 animate-pulse">Carregando seus palpites...</div>
      ) : (
        /* Jogo Real */
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Pool de Times Disponíveis */}
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
                      <Draggable key={team.id} draggableId={team.id} index={index}>
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

            {/* Slots das Quartas de Final */}
            <div className="lg:col-span-2">
              <h2 className="text-white font-bold mb-6 uppercase tracking-tighter flex items-center gap-2 italic">
                <Lock size={20} className="text-amber-500" /> Quartas de Final (Passam 8)
              </h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {qualifiedTeams.map((team, index) => (
                  <Droppable key={index} droppableId={`slot-${index}`} isDropDisabled={!!team}> 
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
                          <div className="flex flex-col items-center animate-in zoom-in duration-300">
                            <div className="relative w-16 h-16 drop-shadow-lg">
                               <Image src={team.team_image} alt={team.team_name} fill className="object-contain" unoptimized />
                            </div>
                            <span className="text-[10px] mt-3 font-bold text-amber-500 uppercase text-center px-1">
                              {team.team_name}
                            </span>
                            <div className="flex items-center gap-1 mt-1 px-2 py-0.5 bg-black/50 rounded-full">
                                <Lock size={10} className="text-amber-500" />
                                <span className="text-[9px] text-zinc-400 font-bold uppercase">Escolhido</span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-800 font-black text-4xl select-none">{index + 1}</span>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                ))}
              </div>

              {/* Parte decorativa inferior (Semi e Final) - Mantida igual */}
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
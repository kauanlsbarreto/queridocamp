'use client'

import { useState, useEffect, useMemo } from "react"
import PremiumCard from "@/components/premium-card"
import FaceitLogin from "@/components/FaceitLogin"
import { motion } from "framer-motion"
import { Search, Save, Check, Loader2, AlertCircle, Shield, Sword, Settings2 } from "lucide-react"
import Image from "next/image"
import { Input } from "@/components/ui/input"

// Categorias de armas (mantidas as mesmas)
const WEAPON_CATEGORIES: Record<string, string[]> = {
  "Pistolas": ["weapon_glock", "weapon_usp_silencer", "weapon_hkp2000", "weapon_deagle", "weapon_p250", "weapon_fiveseven", "weapon_cz75a", "weapon_tec9", "weapon_revolver", "weapon_elite"],
  "Rifles": ["weapon_ak47", "weapon_m4a1", "weapon_m4a1_silencer", "weapon_galilar", "weapon_famas", "weapon_aug", "weapon_sg556"],
  "Snipers": ["weapon_awp", "weapon_ssg08", "weapon_g3sg1", "weapon_scar20"],
  "SMGs": ["weapon_mac10", "weapon_mp9", "weapon_mp7", "weapon_mp5sd", "weapon_ump45", "weapon_p90", "weapon_bizon"],
  "Pesadas": ["weapon_nova", "weapon_xm1014", "weapon_mag7", "weapon_sawedoff", "weapon_m249", "weapon_negev"],
  "Facas": ["weapon_knife", "weapon_bayonet", "weapon_knife_survival_bowie", "weapon_knife_butterfly", "weapon_knife_falchion", "weapon_knife_flip", "weapon_knife_gut", "weapon_knife_tactical", "weapon_knife_m9_bayonet", "weapon_knife_push", "weapon_knife_stiletto", "weapon_knife_ursus", "weapon_knife_gypsy_jackknife", "weapon_knife_widowmaker", "weapon_knife_css", "weapon_knife_cord", "weapon_knife_canis", "weapon_knife_outdoor", "weapon_knife_skeleton", "weapon_knife_kukri", "weapon_knife_karambit"]
}

const WEAPON_NAMES: Record<string, string> = {
  "weapon_ak47": "AK-47",
  "weapon_m4a1": "M4A4",
  "weapon_m4a1_silencer": "M4A1-S",
  "weapon_awp": "AWP",
  "weapon_glock": "Glock-18",
  "weapon_usp_silencer": "USP-S",
  "weapon_deagle": "Desert Eagle",
}

const formatWeaponName = (name: string) => {
  if (WEAPON_NAMES[name]) return WEAPON_NAMES[name]
  return name.replace("weapon_", "").replace(/_/g, " ").toUpperCase()
}

export default function SkinsPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>({ skins: [], agents: [], gloves: [] })
  
  const [mainTab, setMainTab] = useState<"skins" | "gloves" | "agents">("skins")
  const [selectedCategory, setSelectedCategory] = useState("Rifles")
  const [selectedWeapon, setSelectedWeapon] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  
  // userSelection armazena as escolhas. 
  // Chaves: 'weapon_ak47', 'knife_ct', 'glove_t', 'agent_ct', etc.
  const [userSelection, setUserSelection] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const checkUser = () => {
      const stored = localStorage.getItem('faceit_user')
      if (stored) {
        const userData = JSON.parse(stored)
        setUser(userData)
        if (userData.steam_id_64) {
          loadUserSkins(userData.steam_id_64)
        }
      } else setUser(null)
    }
    checkUser()
    window.addEventListener('faceit_auth_updated', checkUser)
    loadData()
    return () => window.removeEventListener('faceit_auth_updated', checkUser)
  }, [])

  const loadData = async () => {
    try {
      const baseUrl = "https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/refs/heads/main/website/data"
      const [agentsRes, glovesRes, skinsRes] = await Promise.all([
        fetch(`${baseUrl}/agents_en.json`).then(r => r.json()),
        fetch(`${baseUrl}/gloves_en.json`).then(r => r.json()),
        fetch(`${baseUrl}/skins_en.json`).then(r => r.json()),
      ])
      
      // Adiciona faca padrão
      const defaultKnife = {
        weapon_defindex: 'weapon_knife_default',
        weapon_name: 'weapon_knife_default',
        paint: 'default',
        image: 'https://raw.githubusercontent.com/Nereziel/cs2-WeaponPaints/main/website/img/skins/weapon_knife.png',
        paint_name: 'Padrão',
        legacy_model: false
      }
      if (skinsRes) skinsRes.unshift(defaultKnife)

      setData({ agents: agentsRes, gloves: glovesRes, skins: skinsRes })
      setLoading(false)
    } catch (e) {
      console.error("Erro ao carregar dados", e)
      setLoading(false)
    }
  }

  const loadUserSkins = async (steamid: string) => {
    try {
      const res = await fetch(`/api/skins/get?steamid=${steamid}`)
      const dbData = await res.json()
      
      const newSelection: Record<string, any> = {}

      // Mapear Agentes
      if (dbData.agents) {
        if (dbData.agents.agent_ct) newSelection['agent_ct'] = { model: dbData.agents.agent_ct }
        if (dbData.agents.agent_t) newSelection['agent_t'] = { model: dbData.agents.agent_t }
      }

      // Mapear Skins (Armas)
      // Precisamos converter weapon_defindex (número) de volta para weapon_name (string) se possível,
      // ou armazenar pelo ID. O frontend usa weapon_name como chave para armas normais.
      // Como não temos um mapa reverso fácil aqui sem iterar tudo, vamos armazenar pelo defindex também
      // e ajustar a lógica de seleção para verificar ambos.
      if (Array.isArray(dbData.skins)) {
        dbData.skins.forEach((skin: any) => {
            // Tenta encontrar o nome da arma nos dados carregados se possível, ou usa o ID
            // Para simplificar, vamos salvar no estado com a chave sendo o ID (string)
            // E na renderização verificamos se o item selecionado tem esse ID.
            const key = skin.weapon_defindex.toString()
            newSelection[key] = {
                paint: skin.weapon_paint_id,
                wear: skin.weapon_wear,
                seed: skin.weapon_seed,
                team: skin.weapon_team,
                nametag: skin.weapon_nametag,
                stattrak: skin.weapon_stattrak,
                stattrak_count: skin.weapon_stattrak_count
            }
        })
      }

      // Mapear Facas
      if (Array.isArray(dbData.knives)) {
        dbData.knives.forEach((knife: any) => {
            const teamKey = knife.weapon_team === 2 ? 'knife_t' : 'knife_ct'
            // Recupera dados da skin da tabela de skins se houver
            // A faca na tabela wp_player_knife tem o nome (ex: weapon_knife_karambit)
            // Precisamos achar o defindex dela para pegar a skin
            newSelection[teamKey] = {
                weapon_name: knife.knife,
                team: knife.weapon_team
            }
            // Nota: A skin da faca estaria em dbData.skins, mas precisamos cruzar os dados.
            // O frontend vai precisar lidar com isso.
        })
      }

      // Mapear Luvas
      if (Array.isArray(dbData.gloves)) {
        dbData.gloves.forEach((glove: any) => {
            const teamKey = glove.weapon_team === 2 ? 'glove_t' : 'glove_ct'
            newSelection[teamKey] = {
                weapon_defindex: glove.weapon_defindex,
                team: glove.weapon_team
            }
            // A skin da luva também estaria em dbData.skins com o defindex da luva
            const gloveSkin = dbData.skins.find((s: any) => s.weapon_defindex === glove.weapon_defindex && s.weapon_team === glove.weapon_team)
            if (gloveSkin) {
                newSelection[teamKey].paint = gloveSkin.weapon_paint_id
                newSelection[teamKey].wear = gloveSkin.weapon_wear
                newSelection[teamKey].seed = gloveSkin.weapon_seed
            }
        })
      }

      setUserSelection(newSelection)
    } catch (e) {
      console.error("Erro ao carregar skins do usuário", e)
    }
  }

  const filteredWeapons = useMemo(() => {
    if (mainTab !== "skins") return []
    const categoryWeapons = WEAPON_CATEGORIES[selectedCategory] || []
    const availableWeapons = new Set(data.skins.map((s: any) => s.weapon_name))
    return categoryWeapons.filter(w => availableWeapons.has(w))
  }, [data.skins, selectedCategory, mainTab])

  const filteredSkins = useMemo(() => {
    let list = []
    if (mainTab === "skins" && selectedWeapon) {
      list = data.skins.filter((s: any) => s.weapon_name === selectedWeapon)
    } else if (mainTab === "gloves") {
      list = data.gloves
    } else if (mainTab === "agents") {
      list = data.agents
    }

    if (searchQuery) {
      const lower = searchQuery.toLowerCase()
      list = list.filter((item: any) => 
        (item.paint_name || item.name || "").toLowerCase().includes(lower)
      )
    }
    return list
  }, [data, mainTab, selectedWeapon, searchQuery])

  const handleSelectSkin = (item: any) => {
    // Determina a chave no estado userSelection
    let key = ""
    let team = 0

    if (mainTab === "skins") {
        // Para armas normais, usamos o defindex como chave para consistência com o DB
        key = item.weapon_defindex ? item.weapon_defindex.toString() : selectedWeapon!
        // Se não tiver defindex no item (ex: faca padrão na lista), usa o nome
    } else if (mainTab === "gloves") {
        // Luvas são separadas por time no frontend para seleção? 
        // Vamos assumir que seleciona para ambos por padrão ou usa um seletor de time
        // Por simplificação, salvamos em ambos os slots temporariamente
        // O ideal seria ter abas CT/TR para luvas/facas
        key = "glove_ct" // Exemplo, precisaria de lógica para T também
    } else if (mainTab === "agents") {
        key = item.team === "ct" || item.team === 3 ? "agent_ct" : "agent_t"
    }

    // Se for faca, a lógica é especial pois seleciona o MODELO da faca
    if (selectedCategory === "Facas" && mainTab === "skins") {
        // Aqui o usuário selecionou uma SKIN de uma faca específica.
        // Precisamos salvar que ele quer ESSA faca (modelo) com ESSA skin.
        // Vamos salvar nas chaves knife_ct e knife_t
        key = "knife_ct" // Simplificação
    }

    const currentSelection = userSelection[key] || {}
    
    const newSelection = {
        ...currentSelection,
        weapon_defindex: item.weapon_defindex,
        weapon_name: item.weapon_name, // Importante para facas
        paint: item.paint !== undefined ? item.paint : (item.id !== undefined ? item.id : 0),
        model: item.model, // Para agentes
        image: item.image,
        name: item.paint_name || item.name
    }

    // Atualiza estado
    setUserSelection(prev => {
        const newState = { ...prev }
        
        if (mainTab === "gloves") {
            newState["glove_ct"] = { ...newSelection, team: 3 }
            newState["glove_t"] = { ...newSelection, team: 2 }
        } else if (selectedCategory === "Facas" && mainTab === "skins") {
            newState["knife_ct"] = { ...newSelection, team: 3 }
            newState["knife_t"] = { ...newSelection, team: 2 }
        } else if (mainTab === "skins") {
            // Armas normais
            // Usa o defindex como chave se disponível
            const idKey = item.weapon_defindex ? item.weapon_defindex.toString() : selectedWeapon!
            newState[idKey] = { ...newSelection, team: 0 } // 0 = ambos
        } else {
            newState[key] = newSelection
        }
        
        return newState
    })
  }

  const updateSkinConfig = (key: string, configKey: string, value: any) => {
     setUserSelection(prev => ({
        ...prev,
        [key]: { ...prev[key], [configKey]: value }
     }))
  }

  const saveToDatabase = async () => {
    if (!user) return
    setSaving(true)
    try {
        const response = await fetch('/api/skins/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                steam_id_64: user.steam_id_64,
                selections: userSelection
            })
        })
        
        if (response.ok) {
            alert("Skins salvas com sucesso!")
        } else {
            const errData = await response.json()
            alert(`Erro ao salvar: ${errData.error || 'Erro desconhecido'}`)
        }
    } catch (error) {
        console.error("Erro ao salvar", error)
        alert("Erro ao salvar skins.")
    } finally {
        setSaving(false)
    }
  }

  // Helper para verificar seleção
  const isItemSelected = (item: any) => {
      if (mainTab === "agents") {
          const key = item.team === "ct" || item.team === 3 ? "agent_ct" : "agent_t"
          return userSelection[key]?.model === item.model
      }
      if (mainTab === "gloves") {
          // Verifica se o defindex bate com glove_ct (assumindo simetria)
          const selected = userSelection["glove_ct"]
          const itemPaint = item.paint !== undefined ? item.paint : (item.id !== undefined ? item.id : 0)
          return selected?.weapon_defindex === item.weapon_defindex && selected?.paint === itemPaint
      }
      if (mainTab === "skins") {
          if (selectedCategory === "Facas") {
             // Para facas, verifica se o nome da arma bate (ex: weapon_knife_karambit)
             // E se a skin bate
             const sel = userSelection["knife_ct"]
             return sel?.weapon_name === item.weapon_name && sel?.paint === item.paint
          }
          // Armas normais
          const key = item.weapon_defindex?.toString()
          const sel = userSelection[key]
          return sel?.paint === item.paint
      }
      return false
  }

  // Renderização simplificada para brevidade, mantendo a estrutura original
  return (
    <div className="min-h-screen bg-black text-white pb-20">
      <section className="pt-28 pb-8 px-4 container mx-auto">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-3xl">
            <AlertCircle className="w-16 h-16 text-zinc-600 mb-4" />
            <h3 className="text-2xl font-bold text-zinc-400 mb-2">Login Necessário</h3>
            <p className="text-zinc-500 mb-6">Faça login com sua conta Faceit para personalizar suas skins.</p>
            <FaceitLogin />
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-40">
            <Loader2 className="w-12 h-12 text-gold animate-spin mb-4" />
            <p className="text-zinc-400">Carregando catálogo de skins...</p>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-64 flex-shrink-0 space-y-6">
              <PremiumCard>
                <div className="p-4 space-y-2">
                  <button onClick={() => { setMainTab("skins"); setSelectedWeapon(null) }} className={`w-full text-left px-4 py-3 rounded-lg font-bold transition-all ${mainTab === "skins" ? "bg-gold text-black" : "text-zinc-400 hover:bg-zinc-800"}`}><div className="flex items-center gap-2"><Sword size={18} /> Armas</div></button>
                  <button onClick={() => { setMainTab("gloves"); setSelectedWeapon(null) }} className={`w-full text-left px-4 py-3 rounded-lg font-bold transition-all ${mainTab === "gloves" ? "bg-gold text-black" : "text-zinc-400 hover:bg-zinc-800"}`}><div className="flex items-center gap-2"><Shield size={18} /> Luvas</div></button>
                  <button onClick={() => { setMainTab("agents"); setSelectedWeapon(null) }} className={`w-full text-left px-4 py-3 rounded-lg font-bold transition-all ${mainTab === "agents" ? "bg-gold text-black" : "text-zinc-400 hover:bg-zinc-800"}`}><div className="flex items-center gap-2"><Shield size={18} /> Agentes</div></button>
                </div>
              </PremiumCard>

              {mainTab === "skins" && (
                <PremiumCard>
                  <div className="p-4">
                    <h3 className="text-gold font-bold mb-3 text-sm uppercase">Categorias</h3>
                    <div className="space-y-1">
                      {Object.keys(WEAPON_CATEGORIES).map(cat => (
                        <button key={cat} onClick={() => { setSelectedCategory(cat); setSelectedWeapon(null) }} className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selectedCategory === cat ? "text-white bg-zinc-800" : "text-zinc-500 hover:text-white"}`}>{cat}</button>
                      ))}
                    </div>
                  </div>
                </PremiumCard>
              )}
              
              {mainTab === "skins" && selectedWeapon && (
                <PremiumCard>
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-2 text-gold border-b border-zinc-800 pb-2">
                      <Settings2 size={18} />
                      <h3 className="font-bold text-sm uppercase">Configurações</h3>
                    </div>
                    
                    {(() => {
                        const weaponDefindex = data.skins.find((s: any) => s.weapon_name === selectedWeapon)?.weapon_defindex?.toString() || selectedWeapon;
                        const selection = userSelection[weaponDefindex];

                        if (!selection) return <p className="text-xs text-zinc-500">Nenhuma skin selecionada.</p>;

                        return (
                            <>
                                <div>
                                  <label className="text-xs text-zinc-400 mb-1 block">Equipe</label>
                                  <select 
                                    value={selection.team ?? 0}
                                    onChange={(e) => updateSkinConfig(weaponDefindex, 'team', parseInt(e.target.value))}
                                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white focus:border-gold outline-none"
                                  >
                                    <option value={0}>Ambos (CT & TR)</option>
                                    <option value={2}>Terroristas (TR)</option>
                                    <option value={3}>Contra-Terroristas (CT)</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-xs text-zinc-400 mb-1 block">Desgaste (Wear): {selection.wear ?? 0}</label>
                                  <input 
                                    type="range" 
                                    min="0" max="1" step="0.01"
                                    value={selection.wear ?? 0}
                                    onChange={(e) => updateSkinConfig(weaponDefindex, 'wear', parseFloat(e.target.value))}
                                    className="w-full accent-gold"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-zinc-400 mb-1 block">Seed</label>
                                  <Input 
                                    type="number"
                                    value={selection.seed ?? 0}
                                    onChange={(e) => updateSkinConfig(weaponDefindex, 'seed', parseInt(e.target.value))}
                                    className="bg-zinc-900 border-zinc-700 h-8 text-sm"
                                  />
                                </div>

                                <div>
                                  <label className="text-xs text-zinc-400 mb-1 block">Nametag</label>
                                  <Input 
                                    type="text"
                                    placeholder="Nome da arma"
                                    value={selection.nametag ?? ""}
                                    onChange={(e) => updateSkinConfig(weaponDefindex, 'nametag', e.target.value)}
                                    className="bg-zinc-900 border-zinc-700 h-8 text-sm"
                                  />
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                  <input 
                                    type="checkbox"
                                    id="stattrak-check"
                                    checked={!!selection.stattrak}
                                    onChange={(e) => updateSkinConfig(weaponDefindex, 'stattrak', e.target.checked ? 1 : 0)}
                                    className="w-4 h-4 accent-gold rounded cursor-pointer"
                                  />
                                  <label htmlFor="stattrak-check" className="text-sm text-white cursor-pointer select-none">StatTrak™</label>
                                </div>

                                {selection.stattrak ? (
                                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                    <label className="text-xs text-zinc-400 mb-1 block">Kills (StatTrak)</label>
                                    <Input 
                                      type="number"
                                      value={selection.stattrak_count ?? 0}
                                      onChange={(e) => updateSkinConfig(weaponDefindex, 'stattrak_count', parseInt(e.target.value))}
                                      className="bg-zinc-900 border-zinc-700 h-8 text-sm"
                                    />
                                  </motion.div>
                                ) : null}
                            </>
                        );
                    })()}
                  </div>
                </PremiumCard>
              )}

              <button onClick={saveToDatabase} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-900/20 flex items-center justify-center gap-2 transition-all">
                {saving ? <Loader2 className="animate-spin" /> : <Save size={20} />} Salvar Alterações
              </button>
            </div>

            <div className="flex-1">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-white">{mainTab === "skins" ? (selectedWeapon ? formatWeaponName(selectedWeapon) : selectedCategory) : mainTab === "gloves" ? "Luvas" : "Agentes"}</h2>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <Input placeholder="Buscar skin..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 bg-zinc-900 border-zinc-800 text-white focus:border-gold" />
                </div>
              </div>

              {mainTab === "skins" && !selectedWeapon && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredWeapons.map((weapon) => (
                    <motion.button key={weapon} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={() => setSelectedWeapon(weapon)} className="bg-zinc-900 border border-zinc-800 hover:border-gold p-4 rounded-xl flex flex-col items-center gap-3 transition-all hover:bg-zinc-800 group">
                      <span className="font-bold text-zinc-300 group-hover:text-white">{formatWeaponName(weapon)}</span>
                    </motion.button>
                  ))}
                </div>
              )}

              {(selectedWeapon || mainTab !== "skins") && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {mainTab === "skins" && <button onClick={() => setSelectedWeapon(null)} className="col-span-full mb-4 text-left text-gold hover:underline flex items-center gap-2">← Voltar para {selectedCategory}</button>}
                  
                  {filteredSkins.map((item: any, idx: number) => {
                    const isSelected = isItemSelected(item)
                    return (
                      <motion.div key={item.id || idx} initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => handleSelectSkin(item)} className={`relative bg-zinc-900 border rounded-xl overflow-hidden cursor-pointer transition-all group ${isSelected ? "border-gold ring-1 ring-gold" : "border-zinc-800 hover:border-zinc-600"}`}>
                        <div className="aspect-[4/3] relative p-4 bg-gradient-to-b from-zinc-800/50 to-transparent">
                          <Image src={item.image} alt={item.paint_name || item.name} fill className="object-contain p-2 group-hover:scale-110 transition-transform duration-300" unoptimized />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-bold text-white truncate">{item.paint_name || item.name}</p>
                          {isSelected && <div className="absolute top-2 right-2 bg-gold text-black rounded-full p-1"><Check size={12} strokeWidth={4} /></div>}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

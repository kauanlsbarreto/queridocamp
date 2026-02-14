"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, Trash2, Save, X, Search, User, ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import PremiumCard from '@/components/premium-card';
import PerfilClient from '@/app/perfil/[id]/PerfilClient';

// --- Componentes das Abas Existentes ---

const AddCodesTab = () => {
  const [tipo, setTipo] = useState('campeonato');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codes, setCodes] = useState<any[]>([]);

  const fetchCodes = async () => {
    try {
      const res = await fetch('/api/admin/codigos_sistema');
      if (res.ok) setCodes(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchCodes(); }, []);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) return alert("Preencha o nome.");
    setLoading(true);
    const prefix = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().charAt(0);
    const code = `QCS-${Math.floor(Math.random() * 100) + 1}${prefix}`;
    
    try {
      const res = await fetch('/api/admin/codigos_sistema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nome, codigo: code })
      });
      if (res.ok) {
        setGeneratedCode(code);
        setNome('');
        fetchCodes();
        alert("Código gerado!");
      }
    } catch (e) { alert("Erro ao gerar."); }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if(!confirm("Excluir?")) return;
    await fetch('/api/admin/codigos_sistema', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    fetchCodes();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Adicionar Códigos</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Nome</label>
            <input value={nome} onChange={e => setNome(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <div>
            <label className="block text-sm font-medium">Tipo</label>
            <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full border p-2 rounded">
              <option value="campeonato">Campeonato</option>
              <option value="MVP">MVP</option>
            </select>
          </div>
          <button disabled={loading} className="bg-indigo-600 text-white px-4 py-2 rounded w-full">
            {loading ? 'Gerando...' : 'Gerar Código'}
          </button>
        </form>
        {generatedCode && <div className="mt-4 p-4 bg-gray-100 rounded text-center font-mono text-xl">{generatedCode}</div>}
        
        <div className="mt-8">
            <h3 className="font-bold mb-2">Códigos Existentes</h3>
            <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-sm text-left">
                    <thead><tr className="bg-gray-100"><th>Nome</th><th>Código</th><th>Ação</th></tr></thead>
                    <tbody>
                        {codes.map(c => (
                            <tr key={c.id} className="border-b">
                                <td className="p-2">{c.nome}</td>
                                <td className="p-2 font-mono">{c.codigo}</td>
                                <td className="p-2"><button onClick={() => handleDelete(c.id)} className="text-red-500"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ManagePlayersTab = () => {
  const [players, setPlayers] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/players').then(r => r.json()).then(data => 
        setPlayers(data.map((p: any) => ({...p, originalId: p.id})))
    );
  }, []);

  const handleSave = async (originalId: number, newId: string) => {
    if(!confirm(`Mudar ID para ${newId}?`)) return;
    const res = await fetch('/api/admin/players', {
        method: 'PATCH',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ originalId, newId })
    });
    if(res.ok) alert("Atualizado!");
  };

  return (
    <Card>
        <CardHeader><CardTitle>Gerenciar IDs</CardTitle></CardHeader>
        <CardContent>
            <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead><tr className="bg-gray-100"><th>Nick</th><th>ID</th><th>Salvar</th></tr></thead>
                    <tbody>
                        {players.map(p => (
                            <tr key={p.originalId} className="border-b">
                                <td className="p-2">{p.nickname}</td>
                                <td className="p-2">
                                    <input 
                                        defaultValue={p.id} 
                                        onBlur={(e) => p.id = e.target.value}
                                        className="border p-1 rounded w-24" 
                                    />
                                </td>
                                <td className="p-2">
                                    <button onClick={(e) => handleSave(p.originalId, p.id)} className="text-blue-600"><Save size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>
  );
};

const SetAdminsTab = () => {
    const [players, setPlayers] = useState<any[]>([]);
    const [newAdminId, setNewAdminId] = useState('');
    const [newLevel, setNewLevel] = useState(1);

    const fetchP = () => fetch('/api/admin/players').then(r => r.json()).then(setPlayers);
    useEffect(() => { fetchP(); }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        await fetch('/api/admin/players', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ identifier: newAdminId, adminLevel: newLevel })
        });
        fetchP();
        setNewAdminId('');
    };

    const handleChangeLevel = async (userId: number, level: number) => {
        await fetch('/api/admin/players', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId, adminLevel: level })
        });
        fetchP();
    };

    return (
        <Card>
            <CardHeader><CardTitle>Definir Admins</CardTitle></CardHeader>
            <CardContent>
                <form onSubmit={handleAdd} className="flex gap-2 mb-6">
                    <input value={newAdminId} onChange={e => setNewAdminId(e.target.value)} placeholder="ID ou GUID" className="border p-2 rounded flex-1" />
                    <select value={newLevel} onChange={e => setNewLevel(Number(e.target.value))} className="border p-2 rounded">
                        <option value={1}>Admin</option>
                        <option value={2}>Dev</option>
                        <option value={3}>Avaliador</option>
                    </select>
                    <button className="bg-green-600 text-white px-4 rounded">Add</button>
                </form>
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-gray-100"><th>Nick</th><th>Nível</th></tr></thead>
                        <tbody>
                            {players.filter(p => p.admin > 0).map(p => (
                                <tr key={p.id} className="border-b">
                                    <td className="p-2">{p.nickname}</td>
                                    <td className="p-2">
                                        <select 
                                            value={p.admin} 
                                            onChange={(e) => handleChangeLevel(p.id, Number(e.target.value))}
                                            className="border p-1 rounded"
                                        >
                                            <option value={0}>Remover</option>
                                            <option value={1}>Admin</option>
                                            <option value={2}>Dev</option>
                                            <option value={3}>Avaliador</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

const ModificationsTab = () => {
    const [players, setPlayers] = useState<any[]>([]);
    const [editing, setEditing] = useState<number | null>(null);
    const [val, setVal] = useState('');

    const fetchP = () => fetch('/api/admin/players').then(r => r.json()).then(setPlayers);
    useEffect(() => { fetchP(); }, []);

    const handleSave = async (userId: number) => {
        await fetch('/api/admin/players', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ userId, adicionados: val })
        });
        setEditing(null);
        fetchP();
    };

    return (
        <Card>
            <CardHeader><CardTitle>Modificações (Tags)</CardTitle></CardHeader>
            <CardContent>
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-gray-100"><th>Nick</th><th>Tags</th><th>Ação</th></tr></thead>
                        <tbody>
                            {players.map(p => (
                                <tr key={p.id} className="border-b">
                                    <td className="p-2">{p.nickname}</td>
                                    <td className="p-2">
                                        {editing === p.id ? (
                                            <input value={val} onChange={e => setVal(e.target.value)} className="border p-1 w-full" />
                                        ) : (p.adicionados || '-')}
                                    </td>
                                    <td className="p-2">
                                        {editing === p.id ? (
                                            <div className="flex gap-1">
                                                <button onClick={() => handleSave(p.id)} className="text-green-600"><Save size={16}/></button>
                                                <button onClick={() => setEditing(null)} className="text-red-600"><X size={16}/></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => {setEditing(p.id); setVal(p.adicionados||'')}} className="text-blue-600"><Pencil size={16}/></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

// --- NOVA ABA: VER PLAYER ---

const ViewPlayerTab = () => {
    const [viewMode, setViewMode] = useState<'list' | 'profile'>('list');
    const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
    const [players, setPlayers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [profileData, setProfileData] = useState<any>(null);
    const [loadingProfile, setLoadingProfile] = useState(false);

    // Carregar lista
    useEffect(() => {
        if (viewMode === 'list') {
            fetch(`/api/admin/player-profile?q=${search}`)
                .then(r => r.json())
                .then(setPlayers)
                .catch(console.error);
        }
    }, [viewMode, search]);

    // Carregar perfil
    useEffect(() => {
        if (selectedPlayerId) {
            setLoadingProfile(true);
            fetch(`/api/admin/player-profile?id=${selectedPlayerId}`)
                .then(r => r.json())
                .then(data => {
                    setProfileData(data);
                    setLoadingProfile(false);
                })
                .catch(() => setLoadingProfile(false));
        }
    }, [selectedPlayerId]);

    const handleSelectPlayer = (id: string) => {
        setSelectedPlayerId(id);
        setViewMode('profile');
    };

    const handleBack = () => {
        setSelectedPlayerId(null);
        setProfileData(null);
        setViewMode('list');
    };

    if (viewMode === 'profile') {
        if (loadingProfile || !profileData) return <div className="text-white p-10 text-center">Carregando perfil...</div>;
        
        return (
            <div className="relative min-h-screen bg-black">
                <div className="fixed top-24 left-4 z-50">
                    <button onClick={handleBack} className="bg-gold text-black font-bold px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gold/80 transition-colors shadow-lg">
                        <ArrowLeft size={20} /> Voltar
                    </button>
                </div>
                <PerfilClient 
                    player={profileData.player} 
                    initialConquistas={profileData.conquistas} 
                    upcomingMatches={profileData.upcomingMatches} 
                    teamName={profileData.teamName} 
                    playerStats={profileData.playerStats}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white pt-8 pb-12 px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
                <div>
                    <h1 className="text-2xl font-black text-gold italic uppercase tracking-tighter">Ver Player</h1>
                    <p className="text-zinc-500 text-xs font-medium uppercase tracking-widest mt-1">Selecione um jogador</p>
                </div>
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                    <input
                        type="text"
                        placeholder="BUSCAR JOGADOR..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-gold/50 transition-all uppercase text-sm font-bold"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {players.map((player) => (
                    <div key={player.id} onClick={() => handleSelectPlayer(String(player.id))} className="group cursor-pointer">
                        <PremiumCard className="h-full hover:scale-[1.03] transition-all duration-300 border-white/5 group-hover:border-gold/30 shadow-xl">
                            <div className="p-6 flex flex-col items-center text-center h-full">
                                <div className="relative w-20 h-20 mb-4">
                                    <div className="absolute inset-0 bg-gold/10 group-hover:bg-gold/20 blur-2xl rounded-full transition-colors" />
                                    <div className="relative w-full h-full rounded-full border-2 border-white/10 p-1 bg-black/40 group-hover:border-gold/50 transition-all">
                                        <Image
                                            src={player.avatar || "/images/cs2-player.png"}
                                            alt={player.nickname}
                                            fill
                                            className="rounded-full object-cover"
                                            unoptimized
                                        />
                                    </div>
                                </div>
                                <h3 className="text-lg font-black text-white italic uppercase tracking-tighter mb-1 group-hover:text-gold transition-colors truncate w-full">
                                    {player.nickname}
                                </h3>
                                <span className="text-[10px] text-zinc-500 font-bold uppercase">ID: {player.id}</span>
                                <div className="mt-4 w-full pt-4 border-t border-white/5">
                                    <span className="text-xs font-bold text-gold uppercase flex items-center justify-center gap-2">
                                        <User size={14} /> Ver Perfil
                                    </span>
                                </div>
                            </div>
                        </PremiumCard>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL ---

export default function AdminPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('faceit_user');
    if (stored) {
        const u = JSON.parse(stored);
        if (u.Admin === 1 || u.Admin === 2) setUser(u);
    }
    setLoading(false);
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-screen"><p>Carregando...</p></div>;
  if (!user) return <div className="flex justify-center items-center min-h-screen"><p>Acesso negado.</p></div>;

  return (
    <div className="container mx-auto p-4 pt-24">
      <h1 className="text-3xl font-bold mb-4 text-white">Painel de Administração</h1>
      <Tabs defaultValue="add-code" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-gray-900 text-gray-400">
          <TabsTrigger value="add-code">Adicionar Códigos</TabsTrigger>
          <TabsTrigger value="manage-players">Gerenciar Jogadores</TabsTrigger>
          <TabsTrigger value="set-admin">Definir Admins</TabsTrigger>
          <TabsTrigger value="manage-adicionados">Modificações</TabsTrigger>
          <TabsTrigger value="view-player" className="text-gold font-bold">Ver Player</TabsTrigger>
        </TabsList>
        
        <TabsContent value="add-code"><AddCodesTab /></TabsContent>
        <TabsContent value="manage-players"><ManagePlayersTab /></TabsContent>
        <TabsContent value="set-admin"><SetAdminsTab /></TabsContent>
        <TabsContent value="manage-adicionados"><ModificationsTab /></TabsContent>
        <TabsContent value="view-player"><ViewPlayerTab /></TabsContent>
      </Tabs>
    </div>
  );
}
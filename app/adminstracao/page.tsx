"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserProfile as UserProfileType } from "@/components/user-profile";
import { Pencil, Trash2, Check, X } from "lucide-react";

const AddCodeTab = () => {
  const [tipo, setTipo] = useState<'campeonato' | 'MVP'>('campeonato');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codes, setCodes] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  const fetchCodes = async () => {
    try {
      const res = await fetch('/api/admin/codigos_sistema', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setCodes(data);
      }
    } catch (error) {
      console.error("Failed to fetch codes", error);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome) {
      alert('Por favor, preencha o nome da conquista.');
      return;
    }
    setLoading(true);
    setGeneratedCode(null);

    const cleanName = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    
    const randomNum = Math.floor(Math.random() * 100) + 1;
    const initialName = cleanName.charAt(0);
    const simpleCode = `QCS-${randomNum}${initialName}`;

    try {
      const res = await fetch('/api/admin/codigos_sistema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, nome, codigo: simpleCode, code: simpleCode }),
      });
      const data = await res.json();
      if (res.ok) {
        setGeneratedCode(data.codigo || data.code || simpleCode);
        alert('Código gerado com sucesso!');
        setNome('');
        fetchCodes();
      } else {
        alert(data.message || 'Falha ao gerar o código.');
      }
    } catch (error) {
      console.error("Failed to generate code", error);
      alert('Erro ao conectar com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (code: any) => {
    setEditingId(code.id);
    setEditName(code.nome || code.name);
    setEditCode(code.codigo || code.code);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditCode("");
  };

  const saveEditing = async (id: number) => {
    try {
      const res = await fetch('/api/admin/codigos_sistema', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, nome: editName, codigo: editCode }),
      });
      if (res.ok) {
        setEditingId(null);
        fetchCodes();
      } else {
        alert('Erro ao atualizar código.');
      }
    } catch (error) {
      console.error("Failed to update code", error);
    }
  };

  const deleteCode = async (id: number) => {
    if (!confirm("Tem certeza que deseja excluir este código?")) return;
    try {
      const res = await fetch('/api/admin/codigos_sistema', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchCodes();
      } else {
        alert('Erro ao excluir código.');
      }
    } catch (error) {
      console.error("Failed to delete code", error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Adicionar Códigos de Conquista</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome da Conquista</label>
            <input
              type="text"
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="tipo" className="block text-sm font-medium text-gray-700">Tipo</label>
            <select
              id="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as 'campeonato' | 'MVP')}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="campeonato">Campeonato</option>
              <option value="MVP">MVP</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            {loading ? 'Gerando...' : 'Gerar Código'}
          </button>
        </form>
        {generatedCode && (
          <div className="mt-4 p-4 bg-gray-100 rounded-md">
            <p className="text-sm font-medium text-gray-800">Código Gerado:</p>
            <p className="text-lg font-semibold text-indigo-600">{generatedCode}</p>
          </div>
        )}

        <div className="mt-8 border-t pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Códigos do Sistema</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {codes.map((code) => (
                  <tr key={code.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingId === code.id ? (
                        <input 
                          value={editName} 
                          onChange={(e) => setEditName(e.target.value)} 
                          className="border rounded px-2 py-1 w-full"
                        />
                      ) : (
                        code.nome || code.name
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{code.tipo || code.type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                      {editingId === code.id ? (
                        <input 
                          value={editCode} 
                          onChange={(e) => setEditCode(e.target.value)} 
                          className="border rounded px-2 py-1 w-full font-mono"
                        />
                      ) : (
                        code.codigo || code.code
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {code.created_at ? new Date(code.created_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                      {editingId === code.id ? (
                        <>
                          <button onClick={() => saveEditing(code.id)} className="text-green-600 hover:text-green-900" title="Salvar"><Check size={18} /></button>
                          <button onClick={cancelEditing} className="text-red-600 hover:text-red-900" title="Cancelar"><X size={18} /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEditing(code)} className="text-indigo-600 hover:text-indigo-900" title="Editar"><Pencil size={18} /></button>
                          <button onClick={() => deleteCode(code.id)} className="text-red-600 hover:text-red-900" title="Excluir"><Trash2 size={18} /></button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Nenhum código encontrado.</td>
                  </tr>
                )}
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await fetch('/api/admin/players');
        const data = await res.json();
        setPlayers(data.map((p: any) => ({ ...p, originalId: p.id })));
      } catch (error) {
        console.error("Failed to fetch players", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, []);

  const handleIdChange = (originalId: number, newId: string) => {
    setPlayers(players.map(p => p.originalId === originalId ? { ...p, id: newId } : p));
  };

  const handleSave = async (originalId: number, newId: string) => {
    if (confirm(`Tem certeza que deseja alterar o ID do jogador para ${newId}?`)) {
      try {
        const res = await fetch('/api/admin/players', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ originalId, newId }),
        });
        if (res.ok) {
          alert('ID do jogador atualizado com sucesso!');
          setPlayers(players.map(p => p.originalId === originalId ? { ...p, originalId: Number(newId), id: Number(newId) } : p));

          const storedUser = localStorage.getItem("faceit_user");
          if (storedUser) {
            try {
              const user = JSON.parse(storedUser);
              if (user.id === originalId) {
                user.id = Number(newId);
                localStorage.setItem("faceit_user", JSON.stringify(user));
              }
            } catch (e) {
              console.error("Failed to update local storage", e);
            }
          }
        } else {
          alert('Falha ao atualizar o ID do jogador.');
        }
      } catch (error) {
        console.error("Failed to update player ID", error);
        alert('Erro ao conectar com o servidor.');
      }
    }
  };

  if (loading) {
    return <p>Carregando jogadores...</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar IDs de Jogadores</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nickname</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID Jogador</th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Salvar</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {players.map((player) => (
                <tr key={player.originalId}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.nickname}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="text"
                      value={player.id || ''}
                      onChange={(e) => handleIdChange(player.originalId, e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleSave(player.originalId, player.id)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Salvar
                    </button>
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

const SetAdminTab = ({ currentUser }: { currentUser: UserProfileType | null }) => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIdentifier, setNewIdentifier] = useState('');
  const [newLevel, setNewLevel] = useState(0);

  const fetchPlayers = async () => {
    try {
      const res = await fetch('/api/admin/players');
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      console.error("Failed to fetch players", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleAdminChange = async (userId: number, adminLevel: number) => {
    if (confirm(`Tem certeza que deseja alterar o nível de admin para ${adminLevel}?`)) {
      try {
        const res = await fetch('/api/admin/players', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, adminLevel }),
        });
        if (res.ok) {
          alert('Nível de admin atualizado com sucesso!');
          setPlayers(players.map(p => p.id === userId ? { ...p, Admin: adminLevel } : p));

          const storedUser = localStorage.getItem("faceit_user");
          if (storedUser) {
            try {
              const user = JSON.parse(storedUser);
              if (user.id === userId) {
                user.Admin = adminLevel;
                localStorage.setItem("faceit_user", JSON.stringify(user));
              }
            } catch (e) {
              console.error("Failed to update local storage", e);
            }
          }
        } else {
          alert('Falha ao atualizar o nível de admin.');
        }
      } catch (error) {
        console.error("Failed to update admin level", error);
        alert('Erro ao conectar com o servidor.');
      }
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdentifier || newLevel === 0) {
      alert("Por favor, preencha o ID/GUID e selecione um nível.");
      return;
    }

    try {
      const res = await fetch('/api/admin/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: newIdentifier, adminLevel: newLevel }),
      });

      if (res.ok) {
        alert('Admin adicionado com sucesso!');
        setNewIdentifier('');
        setNewLevel(0);
        fetchPlayers();
      } else {
        const err = await res.json();
        alert(err.message || 'Falha ao adicionar admin.');
      }
    } catch (error) {
      console.error("Failed to add admin", error);
      alert('Erro ao conectar com o servidor.');
    }
  };

  if (loading) {
    return <p>Carregando jogadores...</p>;
  }

  const canAdd = currentUser && currentUser.Admin && currentUser.Admin <= 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Níveis de Admin</CardTitle>
      </CardHeader>
      <CardContent>
        {canAdd && (
          <form onSubmit={handleAddAdmin} className="mb-8 p-4 bg-gray-50 rounded-md border border-gray-200 space-y-4">
            <h3 className="text-sm font-bold text-gray-700">Adicionar Novo Admin</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">ID ou Faceit GUID</label>
                <input
                  type="text"
                  value={newIdentifier}
                  onChange={(e) => setNewIdentifier(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  placeholder="Ex: 123 ou guid-..."
                />
              </div>
              <div className="w-40">
                <label className="block text-xs font-medium text-gray-500 mb-1">Nível</label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(parseInt(e.target.value))}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                  <option value={0}>Selecione...</option>
                  {currentUser?.Admin === 1 && (
                    <>
                      <option value={1}>Admin</option>
                      <option value={2}>Dev</option>
                    </>
                  )}
                  <option value={3}>Avaliador</option>
                  <option value={4}>Parceiro</option>
                  <option value={5}>Streamer</option>
                </select>
              </div>
              <button
                type="submit"
                className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Adicionar
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nickname</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nível de Admin</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {players.map((player) => (
                <tr key={player.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.nickname}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <select
                      value={player.Admin ?? player.admin ?? 0}
                      onChange={(e) => handleAdminChange(player.id, parseInt(e.target.value))}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option value={0}>Nenhum</option>
                      {currentUser?.Admin === 1 && (
                        <>
                          <option value={1}>Admin</option>
                          <option value={2}>Dev</option>
                        </>
                      )}
                      <option value={3}>Avaliador</option>
                      <option value={4}>Parceiro</option>
                      <option value={5}>Streamer</option>
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

const ManageAdicionadosTab = () => {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const fetchPlayers = async () => {
    try {
      const res = await fetch('/api/admin/players');
      const data = await res.json();
      setPlayers(data);
    } catch (error) {
      console.error("Failed to fetch players", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, []);

  const handleSave = async (userId: number) => {
    try {
      const res = await fetch('/api/admin/players', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, adicionados: editValue }),
      });
      if (res.ok) {
        setPlayers(players.map(p => p.id === userId ? { ...p, adicionados: editValue } : p));
        setEditingId(null);
        alert('Modificação salva com sucesso!');
      } else {
        alert('Falha ao salvar modificação.');
      }
    } catch (error) {
      console.error("Failed to update", error);
      alert('Erro ao conectar com o servidor.');
    }
  };

  if (loading) return <p>Carregando...</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Modificações (Adicionados)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nickname</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adicionados</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {players.map((player) => (
                <tr key={player.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{player.nickname}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingId === player.id ? (
                      <input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="border rounded px-2 py-1 w-full"
                        placeholder="Ex: QCS-CADEIRANTE, VIP"
                      />
                    ) : (
                      player.adicionados || '-'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {editingId === player.id ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleSave(player.id)} className="text-green-600 hover:text-green-900"><Check size={18} /></button>
                        <button onClick={() => setEditingId(null)} className="text-red-600 hover:text-red-900"><X size={18} /></button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingId(player.id); setEditValue(player.adicionados || ''); }} className="text-indigo-600 hover:text-indigo-900"><Pencil size={18} /></button>
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

export default function AdminstracaoPage() {
  const [user, setUser] = useState<UserProfileType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const session = localStorage.getItem("faceit_user");
      let loadedUser: UserProfileType | null = null;

      if (session) {
        try {
          const parsedUser = JSON.parse(session);
          if (parsedUser.faceit_guid) {
            const res = await fetch(`/api/admin/players?faceit_guid=${parsedUser.faceit_guid}`, { cache: 'no-store' });
            if (res.ok) {
              const dbUser = await res.json();
              // Atualiza o usuário com os dados reais do banco (especialmente o Admin)
              loadedUser = { ...parsedUser, ...dbUser, Admin: dbUser.admin };
            }
          }
        } catch (e) {
          console.error("Failed to parse user session", e);
        }
      }

      // Libera acesso se estiver em localhost
      if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
        if (!loadedUser || (loadedUser.Admin !== 1 && loadedUser.Admin !== 2)) {
          loadedUser = { id: 999999, faceit_guid: 'local', nickname: '-ShaykonBio-', avatar: '', Admin: 1 };
        }
      }

      setUser(loadedUser);
      setLoading(false);
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!user || (user.Admin !== 1 && user.Admin !== 2)) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Acesso negado. Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 pt-24">
      <h1 className="text-3xl font-bold mb-4">Painel de Administração</h1>
      <Tabs defaultValue="add-code">
        <TabsList>
          <TabsTrigger value="add-code">Adicionar Códigos</TabsTrigger>
          <TabsTrigger value="manage-players">Gerenciar Jogadores</TabsTrigger>
          <TabsTrigger value="set-admin">Definir Admins</TabsTrigger>
          <TabsTrigger value="manage-adicionados">Modificações</TabsTrigger>
        </TabsList>
        <TabsContent value="add-code">
          <AddCodeTab />
        </TabsContent>
        <TabsContent value="manage-players">
          <ManagePlayersTab />
        </TabsContent>
        <TabsContent value="set-admin">
          <SetAdminTab currentUser={user} />
        </TabsContent>
        <TabsContent value="manage-adicionados">
          <ManageAdicionadosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

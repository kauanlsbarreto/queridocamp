'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, PlusCircle, Save } from 'lucide-react'

type StreamPlatform = 'youtube' | 'twitch1' | 'twitch2';

interface ScheduledMatch {
  id: string;
  team1_name: string;
  team1_avatar: string;
  team2_name: string;
  team2_avatar: string;
  scheduled_time: string;
  live_enabled: boolean;
  live_platform?: StreamPlatform;
}

interface Team {
  team_name: string;
  team_nick: string;
  team_image: string;
}

const AdminJogosPage = () => {
  const [matches, setMatches] = useState<ScheduledMatch[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('faceit_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const permissions: string[] = Array.isArray(user.permissions) ? user.permissions : [];
        if (permissions.includes('schedule_matches')) {
          setIsAuthorized(true);
        } else {
          router.push('/');
        }
      } catch (e) {
        console.error("Falha ao verificar autorização:", e);
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [router]);
  const fetchMatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/scheduled-matches');
      const data = await response.json();
      
      const now = new Date();
      const activeMatches = data.filter((m: any) => new Date(m.scheduled_time) > now);

      setMatches(activeMatches.map((m: any) => {
        const raw = typeof m.scheduled_time === 'string'
          ? m.scheduled_time
          : (m.scheduled_time as Date).toISOString();
        const normalised = raw.replace(' ', 'T').substring(0, 16);
        return {...m, id: m.id.toString(), scheduled_time: normalised };
      }));
    } catch (error) {
      console.error("Failed to fetch matches:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAllTeams = useCallback(async () => {
    try {
      const response = await fetch('/api/teams');
      if (!response.ok) {
        console.error(`Falha ao buscar times: ${response.status} ${response.statusText}`);
        setAllTeams([]);
        return;
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        const sortedTeams = data.sort((a, b) => a.team_name.localeCompare(b.team_name));
        setAllTeams(sortedTeams);
      } else {
        console.error("Os dados recebidos de /api/teams não são um array:", data);
        setAllTeams([]);
      }
    } catch (error) {
      console.error("Failed to fetch teams:", error);
      setAllTeams([]); 
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) {
      fetchMatches();
      fetchAllTeams();
    }
  }, [isAuthorized, fetchMatches, fetchAllTeams]);

  const handleUpdateMatch = (id: string, field: keyof ScheduledMatch, value: any) => {
    setMatches(prev =>
      prev.map(m => (m.id === id ? { ...m, [field]: value } : m))
    );
  };

  const handleTeamSelect = (matchId: string, teamNumber: 1 | 2, teamNick: string) => {
    const selectedTeam = allTeams.find(t => t.team_nick === teamNick);
    if (selectedTeam) {
        setMatches(prev => prev.map(m => {
            if (m.id === matchId) {
                return {
                    ...m,
                    [`team${teamNumber}_name`]: selectedTeam.team_name,
                    [`team${teamNumber}_avatar`]: selectedTeam.team_image,
                };
            }
            return m;
        }));
    }
  };

  const handleSaveChanges = async (match: ScheduledMatch) => {
    console.log('Salvando partida:', match);
    try {
      const isNew = match.id.startsWith('new-');
      const url = isNew ? '/api/scheduled-matches' : `/api/scheduled-matches/${match.id}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(match),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Não foi possível ler a resposta do servidor.' }));
        const detail = errorData.error || errorData.message;
        throw new Error(`Falha ao salvar a partida: ${response.statusText} (${response.status}).\nDetalhes: ${detail}`);
      }

      await fetchMatches(); 
      alert(`Partida entre ${match.team1_name} e ${match.team2_name} foi salva com sucesso!`);
    } catch (error) {
      console.error('Erro ao salvar a partida:', error);
      alert(String(error));
    }
  };

  const handleAddNewMatch = () => {
    const newMatch: ScheduledMatch = {
      id: `new-${Date.now()}`,
      team1_name: 'Novo Time 1',
      team1_avatar: '',
      team2_name: 'Novo Time 2',
      team2_avatar: '',
      scheduled_time: new Date().toISOString().substring(0, 16),
      live_enabled: false,
    };
    setMatches(prev => [newMatch, ...prev]);
  };

  const handleDeleteMatch = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir esta partida?')) {
      console.log('Excluindo partida:', id);
      try {
        const response = await fetch(`/api/scheduled-matches/${id}`, { method: 'DELETE' });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: 'Não foi possível ler a resposta do servidor.' }));
          const detail = errorData.error || errorData.message;
          throw new Error(`Falha ao excluir a partida: ${response.statusText} (${response.status}).\nDetalhes: ${detail}`);
        }
        
        alert('Partida excluída com sucesso!');
        await fetchMatches(); 
      } catch (error) {
        console.error('Erro ao excluir a partida:', error);
        alert(String(error));
      }
    }
  };

  if (!isAuthorized) {
    return (
      <div className="container mx-auto px-4 py-10 text-white text-center">
        <p>Verificando permissões...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 text-white">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gold">Gerenciar Jogos Agendados</h1>
        <Button onClick={handleAddNewMatch} className="bg-gold hover:bg-gold/90 text-black">
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Jogo
        </Button>
      </div>

      {isLoading ? (
        <p>Carregando jogos...</p>
      ) : (
        <div className="space-y-6">
          {matches.length > 0 ? (
            matches.map(match => (
              <div key={match.id} className="bg-gray-900 border border-white/10 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Time 1</Label>
                    <Select onValueChange={(teamNick) => handleTeamSelect(match.id, 1, teamNick)} value={allTeams.find(t => t.team_name === match.team1_name)?.team_nick}>
                        <SelectTrigger className="bg-white/5 border-white/10">
                            <SelectValue placeholder="Selecione o Time 1" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-white/20 text-white">
                            {allTeams.map(team => (
                                <SelectItem key={`t1-${team.team_nick}`} value={team.team_nick}>{team.team_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <img src={match.team1_avatar || '/images/team-placeholder.png'} alt="Avatar Time 1" className="w-16 h-16 rounded-full mx-auto mt-2 border-2 border-white/10"/>
                  </div>

                  <div className="space-y-2">
                    <Label>Time 2</Label>
                    <Select onValueChange={(teamNick) => handleTeamSelect(match.id, 2, teamNick)} value={allTeams.find(t => t.team_name === match.team2_name)?.team_nick}>
                        <SelectTrigger className="bg-white/5 border-white/10">
                            <SelectValue placeholder="Selecione o Time 2" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-white/20 text-white">
                            {allTeams.map(team => (
                                <SelectItem key={`t2-${team.team_nick}`} value={team.team_nick}>{team.team_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <img src={match.team2_avatar || '/images/team-placeholder.png'} alt="Avatar Time 2" className="w-16 h-16 rounded-full mx-auto mt-2 border-2 border-white/10"/>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`time-${match.id}`}>Data e Hora <span className="text-xs text-gray-400 font-normal">(Horário de Brasília)</span></Label>
                    <Input
                      id={`time-${match.id}`}
                      type="datetime-local"
                      value={match.scheduled_time}
                      onChange={e => handleUpdateMatch(match.id, 'scheduled_time', e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                    {match.scheduled_time && (
                      <p className="text-xs text-gold/80 font-mono mt-1">
                        {(() => {
                          const [datePart, timePart] = match.scheduled_time.split('T');
                          if (!datePart || !timePart) return '';
                          const [year, month, day] = datePart.split('-');
                          const monthNames = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
                          return `${day} de ${monthNames[Number(month)-1]} de ${year} às ${timePart} (BRT)`;
                        })()}
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-white/10 my-4"></div>

                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <Label htmlFor={`live-switch-${match.id}`} className="flex items-center gap-2 cursor-pointer">
                      <Switch
                        id={`live-switch-${match.id}`}
                        checked={match.live_enabled}
                        onCheckedChange={checked => handleUpdateMatch(match.id, 'live_enabled', checked)}
                      />
                      Habilitar Transmissão
                    </Label>
                    {match.live_enabled && (
                      <Select
                        value={match.live_platform}
                        onValueChange={(value: StreamPlatform) => handleUpdateMatch(match.id, 'live_platform', value)}
                      >
                        <SelectTrigger className="w-[180px] bg-white/5 border-white/10">
                          <SelectValue placeholder="Plataforma" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-white/20 text-white">
                          <SelectItem value="twitch1">TV Querido Camp</SelectItem>
                          <SelectItem value="twitch2">Querido Camp</SelectItem>
                          <SelectItem value="youtube">Youtube</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                      <Button variant="destructive" size="sm" onClick={() => !match.id.startsWith('new-') && handleDeleteMatch(match.id)}>
                          <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" onClick={() => handleSaveChanges(match)} className="bg-blue-600 hover:bg-blue-700">
                          <Save className="mr-2 h-4 w-4" /> {match.id.startsWith('new-') ? 'Salvar' : 'Editar'}
                      </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-gray-900/50 rounded-lg border border-dashed border-white/10">
              <p className="text-gray-400">Nenhum jogo agendado encontrado.</p>
              <p className="text-sm text-gray-500 mt-2">Clique em "Adicionar Jogo" para criar o primeiro.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminJogosPage;
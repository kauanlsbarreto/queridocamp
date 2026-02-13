import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import type { Env } from '@/lib/db';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';

export const revalidate = 0;

const normalizeText = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') 
    .replace(/[^a-z0-9]/g, '');
};

async function getTeamData(teamName: string, mainConn: any, jogadoresConn: any) {
  const [teams]: any = await mainConn.query('SELECT * FROM team_config');
  const team = teams.find((t: any) => normalizeText(t.team_name) === normalizeText(teamName));

  if (!team) return null;

  const teamPlayerNicks = (team.player_nick || '').split(',').map((n: string) => n.trim());
  
  const [jogadoresRows]: any = await jogadoresConn.query('SELECT * FROM jogadores');
  const [playersRows]: any = await mainConn.query('SELECT * FROM players');

  const playersMap = new Map<string, any>(playersRows.map((p: any) => [normalizeText(p.nickname), p]));
  const jogadoresMap = new Map<string, any>(jogadoresRows.map((j: any) => [normalizeText(j.nick), j]));

  let captainGuid = null;

  // Tenta encontrar o capitão primeiro
  for (const nick of teamPlayerNicks) {
    const normalized = normalizeText(nick);
    const jogador = jogadoresMap.get(normalized);
    if (jogador) {
        const captainId = jogador.captain_id || jogador.id;
        if (String(captainId) === String(jogador.id)) {
            const player = playersMap.get(normalized);
            if (player?.faceit_guid) {
                captainGuid = player.faceit_guid;
                break; 
            }
        }
    }
  }
  
  // Se não achar capitão com GUID, pega qualquer jogador com GUID para representar as stats
  if (!captainGuid) {
      for (const nick of teamPlayerNicks) {
        const player = playersMap.get(normalizeText(nick));
        if (player?.faceit_guid) {
            captainGuid = player.faceit_guid;
            break;
        }
      }
  }

  return { team, captainGuid };
}

export default async function TeamPage(props: { searchParams: Promise<{ search?: string }> }) {
  const searchParams = await props.searchParams;
  const teamName = searchParams?.search;

  if (!teamName) {
    return <div className="min-h-screen bg-black text-white p-8 text-center">Time não encontrado.</div>;
  }

  let mainConnection, jogadoresConnection;
  let teamData = null;
  let faceitStats = null;

  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as Env;
    mainConnection = await createMainConnection(env);
    jogadoresConnection = await createJogadoresConnection(env);

    const data = await getTeamData(teamName, mainConnection, jogadoresConnection);
    if (data) {
        teamData = data.team;
        if (data.captainGuid) {
            try {
                const res = await fetch(`https://open.faceit.com/data/v4/players/${data.captainGuid}/stats/cs2`, {
                    headers: { 'Authorization': 'Bearer 7b080715-fe0b-461d-a1f1-62cfd0c47e63' }
                });
                if (res.ok) faceitStats = await res.json();
            } catch (e) {
                console.error("Faceit API error", e);
            }
        }
    }

  } catch (error: any) {
    console.error("Erro:", error.message);
  } finally {
    if (mainConnection) await mainConnection.end().catch(() => {});
    if (jogadoresConnection) await jogadoresConnection.end().catch(() => {});
  }

  if (!teamData) return notFound();

  const segments = faceitStats?.segments || [];
  const sortedMaps = [...segments].sort((a: any, b: any) => Number(b.stats.Matches) - Number(a.stats.Matches));

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/classificacao" className="text-gold hover:underline mb-6 inline-block">← Voltar</Link>
        
        <div className="glass-gold p-8 rounded-2xl mb-8 flex flex-col md:flex-row items-center gap-8">
            {teamData.team_image ? (
                <div className="relative w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
                    <Image src={teamData.team_image} alt={teamData.team_name} fill className="object-contain" />
                </div>
            ) : (
                <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center text-4xl font-bold flex-shrink-0">
                    {teamData.team_name.substring(0, 2)}
                </div>
            )}
            <div className="text-center md:text-left">
                <h1 className="text-4xl md:text-5xl font-bold text-gold mb-2">{teamData.team_name}</h1>
                <p className="text-gray-400 text-lg">Line-up: <span className="text-white">{teamData.player_nick}</span></p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white/5 border border-white/10 p-6 rounded-xl text-center">
                <h3 className="text-gold font-bold text-lg uppercase tracking-wider mb-2">Vitórias</h3>
                <p className="text-5xl font-bold text-green-500">{teamData.vitorias}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-xl text-center">
                <h3 className="text-gold font-bold text-lg uppercase tracking-wider mb-2">Derrotas</h3>
                <p className="text-5xl font-bold text-red-500">{teamData.derrotas}</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 rounded-xl text-center">
                <h3 className="text-gold font-bold text-lg uppercase tracking-wider mb-2">Pontos</h3>
                <p className="text-5xl font-bold text-white">{teamData.sp}</p>
            </div>
        </div>

        {faceitStats && (
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gold border-l-4 border-gold pl-4">Mapas Mais Escolhidos & Stats</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedMaps.map((map: any) => (
                        <div key={map.label} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-colors">
                            <div className="relative h-24 bg-black/50">
                                <img src={map.img_small} alt={map.label} className="w-full h-full object-cover opacity-50" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xl font-bold text-white drop-shadow-lg">{map.label}</span>
                                </div>
                            </div>
                            <div className="p-4 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Partidas</span>
                                    <span className="font-bold">{map.stats.Matches}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">Win Rate</span>
                                    <span className={`font-bold ${Number(map.stats["Win Rate %"]) >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                                        {map.stats["Win Rate %"]}%
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400 text-sm">K/D Ratio</span>
                                    <span className="font-bold text-gold">{map.stats["Average K/D Ratio"]}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500 text-center mt-4">* Estatísticas baseadas no capitão ou representante do time na Faceit.</p>
            </div>
        )}
      </div>
    </div>
  );
}
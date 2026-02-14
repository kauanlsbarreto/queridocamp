import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import TeamStatsClient from './team-stats-client';

export const dynamic = "force-dynamic";

const normalizeText = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    let mainConnection: any;
    let jogadoresConnection: any;
    let teamData = null;

    try {
        const ctx = await getCloudflareContext({ async: true });
        mainConnection = await createMainConnection(ctx.env as any);
        jogadoresConnection = await createJogadoresConnection(ctx.env as any);
        
        const decodedSlug = decodeURIComponent(slug);

        // 1. Buscar todos os times para encontrar o correto via slug gerado
        const [allTeams]: any = await mainConnection.query("SELECT * FROM team_config");
        
        const team = allTeams.find((t: any) => {
            const rawNick = (t.player_nick || "").split(',').pop()?.trim() || "";
            const tSlug = t.team_nick || normalizeText(t.team_name) || rawNick;
            return tSlug.toLowerCase() === decodedSlug.toLowerCase();
        });

        if (team) {
            // Lógica corrigida para buscar TODOS os jogadores do time baseados no capitão
            const rawNick = (team.player_nick || "").split(',').pop()?.trim() || "";
            
            // Buscar todos os jogadores para resolver a composição do time
            const [allJogadores]: any = await jogadoresConnection.query("SELECT * FROM jogadores");
            
            // Encontrar o capitão pelo nick (case insensitive)
            const captain = allJogadores.find((p: any) => p.nick.toLowerCase() === rawNick.toLowerCase());
            
            let nicks: string[] = [];
            
            if (captain) {
                // Filtrar jogadores que são o capitão ou têm o ID do capitão como captain_id
                nicks = allJogadores
                    .filter((p: any) => p.id === captain.id || String(p.captain_id) === String(captain.id))
                    .map((p: any) => p.nick);
            } else {
                // Fallback: usa a lista do team_config se não achar na tabela jogadores
                nicks = team.player_nick ? team.player_nick.split(',').map((n: string) => n.trim()) : [];
            }
            
            // Buscar dados ricos dos jogadores (Pote, Stats, Imagem)
            let statsRows: any[] = [];
            let jogadoresRows: any[] = [];
            let faceitRows: any[] = [];
            let playerGuids: any[] = [];

            if (nicks.length > 0) {
                [statsRows] = await mainConnection.query(
                    "SELECT * FROM top90_stats WHERE nick IN (?)",
                    [nicks]
                );

                // Reutilizando allJogadores para pegar o pote, mas garantindo que temos os dados filtrados
                jogadoresRows = allJogadores.filter((j: any) => nicks.includes(j.nick));

                [faceitRows] = await jogadoresConnection.query(
                    "SELECT faceit_nickname, fotoperfil, discord_id FROM faceit_players WHERE faceit_nickname IN (?)",
                    [nicks]
                );

                // Buscar GUIDs para a API da Faceit (Client Side)
                [playerGuids] = await mainConnection.query(
                    "SELECT nickname, faceit_guid FROM players WHERE nickname IN (?)",
                    [nicks]
                );
            }

            teamData = {
                name: team.team_name,
                image: team.team_image,
                players: playerGuids,
                tournamentStats: statsRows.map((stat: any) => ({
                    ...stat,
                    pote: jogadoresRows.find((j: any) => j.nick === stat.nick)?.pote || 0,
                    faceit_image: faceitRows.find((f: any) => f.faceit_nickname === stat.nick)?.fotoperfil || '/images/cs2-player.png'
                }))
            };
        }
    } catch (err) {
        console.error(err);
    } finally {
        if (mainConnection) await mainConnection.end();
        if (jogadoresConnection) await jogadoresConnection.end();
    }

    if (!teamData) return <div className="text-white text-center py-20">Time não encontrado.</div>;

    return <TeamStatsClient team={teamData} />;
}
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
            
            // OTIMIZAÇÃO: Buscar apenas o capitão e seus jogadores diretamente
            // 1. Tentar encontrar o capitão pelo nick
            const [captainRows]: any = await jogadoresConnection.query(
                "SELECT * FROM jogadores WHERE nick = ?", 
                [rawNick]
            );
            const captain = captainRows[0];
            
            let teamPlayers = [];
            
            if (captain) {
                // 2. Se achou capitão, busca jogadores vinculados a ele (squad)
                const [squadRows]: any = await jogadoresConnection.query(
                    "SELECT * FROM jogadores WHERE id = ? OR captain_id = ?",
                    [captain.id, captain.id]
                );
                teamPlayers = squadRows;
            } else {
                // 3. Fallback: Se não achou capitão, usa a lista de nicks do config
                const nicksFromConfig = team.player_nick ? team.player_nick.split(',').map((n: string) => n.trim()) : [];
                if (nicksFromConfig.length > 0) {
                     const [playersByNick]: any = await jogadoresConnection.query(
                         "SELECT * FROM jogadores WHERE nick IN (?)",
                         [nicksFromConfig]
                     );
                     teamPlayers = playersByNick;
                }
            }
            
            // Extrair nicks para as próximas queries
            const nicks = teamPlayers.map((p: any) => p.nick);
            
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

                // Reutilizando teamPlayers para pegar o pote
                jogadoresRows = teamPlayers;

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
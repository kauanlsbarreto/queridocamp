import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import TeamStatsClient from './team-stats-client';

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({ params }: { params: { slug: string } }) {
    const { slug } = params;
    let mainConnection: any;
    let jogadoresConnection: any;
    let teamData = null;

    try {
        const ctx = await getCloudflareContext({ async: true });
        mainConnection = await createMainConnection(ctx.env as any);
        jogadoresConnection = await createJogadoresConnection(ctx.env as any);

        // 1. Buscar dados do time e seus jogadores
        const [teamRows]: any = await mainConnection.query(
            "SELECT team_name, team_image, player_nick FROM team_config WHERE LOWER(team_nick) = ?", 
            [slug]
        );

        if (teamRows.length > 0) {
            const team = teamRows[0];
            // Buscar GUIDs dos jogadores para consultar na Faceit
            const nicks = team.player_nick.split(',').map((n: string) => n.trim());
            const [playerRows]: any = await mainConnection.query(
                "SELECT nickname, faceit_guid FROM players WHERE nickname IN (?)",
                [nicks]
            );

            teamData = {
                name: team.team_name,
                image: team.team_image,
                players: playerRows
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
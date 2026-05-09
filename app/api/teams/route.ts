import { NextResponse } from 'next/server';
import { getRuntimeEnv } from '@/lib/runtime-env';
import { createMainConnection, Env } from '@/lib/db';
import { unstable_cache } from 'next/cache';

export interface Player {
  id: number;
  nick: string;
  pote: number;
  captain_id: string;
  faceit_image?: string;
  faceit_url?: string;
  discord_id?: string;
}

export interface TeamData {
  team_name: string;
  team_nick: string;
  team_image: string;
  players: Player[];
}

const normalizeText = (str: string | null | undefined): string => {
    if (!str) return '';
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
};

const getTeamsData = unstable_cache(async (connection: any): Promise<TeamData[]> => {
    try {
      const [
        [teamsResult],
        [playersResult],
      ] = await Promise.all([
        connection.query('SELECT * FROM team_config') as Promise<[any[], any]>,
        connection.query('SELECT * FROM jogadores') as Promise<[any[], any]>,
      ]);
  
      const playersMap = new Map<string, Player>();
      const playersById = new Map<string, Player>();
      const normalizedPlayersMap = new Map<string, Player>();
      const playersByCaptainId = new Map<string, Player[]>();
  
      playersResult.forEach((p: any) => {
        const player: Player = { ...p, pote: Number(p.pote) };
        const normalizedNick = player.nick ? normalizeText(player.nick) : '';
        if (player.nick) {
          playersMap.set(player.nick.toLowerCase().trim(), player);
          normalizedPlayersMap.set(normalizedNick, player);
        }
        playersById.set(String(player.id), player);
  
        if (player.captain_id) {
          const cId = String(player.captain_id);
          if (!playersByCaptainId.has(cId)) playersByCaptainId.set(cId, []);
          playersByCaptainId.get(cId)!.push(player);
        }
      });
  
      return teamsResult.map((team: any) => {
        const playerNicks = (team.player_nick || "").split(',').map((n: string) => n.trim());
        const rawNick = playerNicks[playerNicks.length - 1] || "";
        const normalizedRawNick = normalizeText(rawNick);
        const slug = team.team_nick || normalizeText(team.team_name) || rawNick;
        let captain = playersMap.get(rawNick.toLowerCase()) || playersById.get(rawNick) || normalizedPlayersMap.get(normalizedRawNick);
  
        let rawTeamPlayers: Player[] = [];
        if (captain) {
          if (playerNicks.length > 1) {
            captain = { ...captain, pote: 1 };
          }
          const members = playersByCaptainId.get(String(captain.id)) || [];
          rawTeamPlayers = [captain, ...members];
        }
        const uniquePlayers = Array.from(new Map(rawTeamPlayers.map(p => [p.id, p])).values());
  
        return {
          team_name: team.team_name || "Time sem nome",
          team_nick: slug,
          team_image: team.team_image || "",
          players: uniquePlayers
        };
      });
    } catch (err) {
      console.error("Erro ao buscar dados dos times na API:", err);
      return [];
    }
  }, ['teams-data-api'], { revalidate: 3600 });

export async function GET() {
    let connection;
    try {
    const env = await getRuntimeEnv();
        connection = await createMainConnection(env);
        const teams = await getTeamsData(connection);
        return NextResponse.json(teams);
    } catch (error) {
        console.error('API /api/teams error:', error);
        return NextResponse.json({ message: 'Error fetching teams', error }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, createJogadoresConnection } from '@/lib/db';
import TeamStatsClient from './team-stats-client';

export const revalidate = 86400;

const API_KEY = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
const HUB_IDS = [
    "fdd5221c-408c-4148-bc63-e2940da4a490",
    "04a14d7f-0511-451b-8208-9a6c3215ccaa"
];
const START_TIMESTAMP = 1769308800;

const normalizeText = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

async function getTeamStats(team: any) {
    try {
        const allHistories = await Promise.all(
            team.players.map(async (p: any) => {
                if (!p.faceit_guid) return null;
                const res = await fetch(`https://open.faceit.com/data/v4/players/${p.faceit_guid}/history?game=cs2&from=${START_TIMESTAMP}&limit=50`, {
                    headers: { 'Authorization': `Bearer ${API_KEY}` },
                    next: { revalidate: 3600 }
                });
                if (!res.ok) return null;
                const data = await res.json();
                return { player_id: p.faceit_guid, items: data.items };
            })
        );

        const validHistories = allHistories.filter(h => h !== null);
        const mapStats: any = {};
        const vetoStats: Record<string, number> = {};
        const matchStats: any = { wins: 0, losses: 0, draws: 0, total: 0, players: {}, halfDrawsDetails: [], halfWinsDetails: [], matchesList: [] };
        const processedMatches = new Set();

        validHistories.forEach((history: any) => {
            history.items.forEach((match: any) => {
                if (HUB_IDS.includes(match.competition_id)) {
                    if (!processedMatches.has(match.match_id)) {
                        processedMatches.add(match.match_id);
                    }
                }
            });
        });

        if (team.tournamentStats) {
            team.tournamentStats.forEach((stat: any) => {
                Object.keys(stat).forEach((key) => {
                    if (/^r\d+_m1_id$/.test(key)) {
                        const matchId = stat[key];
                        if (matchId && matchId !== 'NULL' && String(matchId).trim() !== '') {
                            processedMatches.add(matchId);
                        }
                    }
                });
            });
        }
        
        const uniqueMatchIds = Array.from(processedMatches);
        const matchDetailsPromises = uniqueMatchIds.map(id => 
            Promise.all([
                fetch(`https://open.faceit.com/data/v4/matches/${id}`, { headers: { 'Authorization': `Bearer ${API_KEY}` }, next: { revalidate: 3600 } }).then(r => r.ok ? r.json() : null),
                fetch(`https://open.faceit.com/data/v4/matches/${id}/stats`, { headers: { 'Authorization': `Bearer ${API_KEY}` }, next: { revalidate: 3600 } }).then(r => r.ok ? r.json() : null)
            ])
        );
        
        const matchesData = await Promise.all(matchDetailsPromises);
        
        matchesData.forEach(([m, s]: any[]) => {
            // Verifica se a partida e as estatísticas existem (ignora W.O ou canceladas sem stats)
            if (!m || !s || !s.rounds || s.rounds.length === 0) return;
            
            const teamPlayerIds = team.players.map((p: any) => p.faceit_guid);
            const teamPlayerNicks = team.players.map((p: any) => p.nickname?.toLowerCase());

            const faction1Ids = m.teams?.faction1?.roster?.map((p: any) => p.player_id) || [];
            const faction1Nicks = m.teams?.faction1?.roster?.map((p: any) => p.nickname?.toLowerCase()) || [];
            
            const isFaction1 = faction1Ids.some((id: string) => teamPlayerIds.includes(id)) ||
                               faction1Nicks.some((nick: string) => teamPlayerNicks.includes(nick));
            
            const score1 = Number(m.results?.score?.faction1 || 0);
            const score2 = Number(m.results?.score?.faction2 || 0);
            const myScore = isFaction1 ? score1 : score2;
            const enemyScore = isFaction1 ? score2 : score1;

            matchStats.total++;
            if (myScore > enemyScore) matchStats.wins++;
            else if (myScore < enemyScore) matchStats.losses++;
            else matchStats.draws++;

            const myTeamName = isFaction1 ? m.teams.faction1.name : m.teams.faction2.name;
            const enemyTeamName = isFaction1 ? m.teams.faction2.name : m.teams.faction1.name;

            matchStats.matchesList.push({
                id: m.match_id,
                label: `${myTeamName} x ${enemyTeamName}`,
                url: `https://www.faceit.com/en/cs2/room/${m.match_id}`,
                score: `${myScore}-${enemyScore}`,
                result: myScore > enemyScore ? 'W' : (myScore < enemyScore ? 'L' : 'D'),
                timestamp: m.started_at
            });

            if (m.voting?.map?.veto && Array.isArray(m.voting.map.veto) && m.voting.map.veto.length > 0) {
                const firstBanIndex = isFaction1 ? 0 : 1;
                const firstBanMap = m.voting.map.veto.length > firstBanIndex ? m.voting.map.veto[firstBanIndex] : null;
                if (firstBanMap) {
                    if (!vetoStats[firstBanMap]) vetoStats[firstBanMap] = 0;
                    vetoStats[firstBanMap]++;
                }
            }

            s.rounds.forEach((roundStats: any) => {
                    const mapName = roundStats.round_stats?.Map || "Unknown";
                    if (!mapStats[mapName]) mapStats[mapName] = { wins: 0, matches: 0 };
                    mapStats[mapName].matches++;

                    if (roundStats.teams && roundStats.teams.length === 2) {
                        const t1Stats = roundStats.teams[0].team_stats;
                        const t2Stats = roundStats.teams[1].team_stats;
                        
                        const myTeamObj = roundStats.teams.find((t: any) => t.players.some((p: any) => teamPlayerIds.includes(p.player_id)));
                        const enemyTeamObj = roundStats.teams.find((t: any) => !t.players.some((p: any) => teamPlayerIds.includes(p.player_id)));

                        // Map Win Check
                        if (myTeamObj && enemyTeamObj) {
                            const myScore = Number(myTeamObj.team_stats["Final Score"]);
                            const enemyScore = Number(enemyTeamObj.team_stats["Final Score"]);
                            if (myScore > enemyScore) {
                                mapStats[mapName].wins++;
                            }
                        }

                        if (t1Stats["First Half Score"] === "6" && t2Stats["First Half Score"] === "6") {
                            if (!mapStats[mapName].halfDraws) mapStats[mapName].halfDraws = 0;
                            mapStats[mapName].halfDraws++;
                            
                            const enemyName = enemyTeamObj ? (m.teams.faction1.faction_id === enemyTeamObj.team_id ? m.teams.faction1.name : m.teams.faction2.name) : "Oponente";
                            matchStats.halfDrawsDetails.push({ map: mapName, score: "6-6", opponent: enemyName });
                        }

                        if (myTeamObj && enemyTeamObj) {
                            const myHalf = Number(myTeamObj.team_stats["First Half Score"]);
                            const enemyHalf = Number(enemyTeamObj.team_stats["First Half Score"]);
                            if (myHalf > enemyHalf) {
                                if (!mapStats[mapName].halfWins) mapStats[mapName].halfWins = 0;
                                mapStats[mapName].halfWins++;
                                
                                const enemyName = m.teams.faction1.faction_id === enemyTeamObj.team_id ? m.teams.faction1.name : m.teams.faction2.name;
                                matchStats.halfWinsDetails.push({ map: mapName, score: `${myHalf}-${enemyHalf}`, opponent: enemyName });
                            }
                        }
                    }

                    // 2. Clutchers e Entry Kills
                    roundStats.teams.forEach((t: any) => {
                        const isMyTeam = t.players.some((p: any) => teamPlayerIds.includes(p.player_id));
                        
                        if (isMyTeam) {
                            t.players.forEach((p: any) => {
                                const pid = p.player_id;
                                const stats = p.player_stats;
                                
                                if (!matchStats.players) matchStats.players = {};
                                if (!matchStats.players[pid]) matchStats.players[pid] = { 
                                    nickname: p.nickname, 
                                    clutches: 0, 
                                    entryKills: 0,
                                    sniperKills: 0,
                                    matches: 0,
                                    headshots: 0,
                                    pistolKills: 0,
                                    utilitySuccesses: 0,
                                    enemiesFlashed: 0,
                                    damage: 0,
                                    quadroKills: 0,
                                    pentaKills: 0,
                                    knifeKills: 0,
                                    zeusKills: 0
                                };

                                matchStats.players[pid].matches++;

                                const clutches = Number(stats["1v1Wins"] || 0) + Number(stats["1v2Wins"] || 0);
                                
                                matchStats.players[pid].clutches += clutches;
                                matchStats.players[pid].entryKills += Number(stats["First Kills"] || 0);
                                matchStats.players[pid].sniperKills += Number(stats["Sniper Kills"] || 0);
                                matchStats.players[pid].headshots += Number(stats["Headshots"] || 0);
                                matchStats.players[pid].pistolKills += Number(stats["Pistol Kills"] || 0);
                                matchStats.players[pid].utilitySuccesses += Number(stats["Utility Successes"] || 0);
                                matchStats.players[pid].enemiesFlashed += Number(stats["Enemies Flashed"] || 0);
                                matchStats.players[pid].damage += Number(stats["Damage"] || 0);
                                matchStats.players[pid].quadroKills += Number(stats["Quadro Kills"] || 0);
                                matchStats.players[pid].pentaKills += Number(stats["Penta Kills"] || 0);
                                matchStats.players[pid].knifeKills += Number(stats["Knife Kills"] || 0);
                                matchStats.players[pid].zeusKills += Number(stats["Zeus Kills"] || 0);
                            });
                        }
                    });
            });
        });

        matchStats.matchesList.sort((a: any, b: any) => b.timestamp - a.timestamp);

        return { mapStats, vetoStats, matchStats };
    } catch (e) {
        console.error(e);
        return null;
    }
}

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    let mainConnection: any;
    let jogadoresConnection: any;
    let teamData = null;
    let statsData = null;

    try {
        const ctx = await getCloudflareContext({ async: true });
        mainConnection = await createMainConnection(ctx.env as any);
        jogadoresConnection = await createJogadoresConnection(ctx.env as any);
        
        const decodedSlug = decodeURIComponent(slug);

        const [allTeams]: any = await mainConnection.query("SELECT * FROM team_config");
        
        const team = allTeams.find((t: any) => {
            const rawNick = (t.player_nick || "").split(',').pop()?.trim() || "";
            const tSlug = t.team_nick || normalizeText(t.team_name) || rawNick;
            return tSlug.toLowerCase() === decodedSlug.toLowerCase();
        });

        if (team) {
            const rawNick = (team.player_nick || "").split(',').pop()?.trim() || "";
            
            let captain = null;

            if (/^\d+$/.test(rawNick)) {
                const [rows]: any = await jogadoresConnection.query("SELECT * FROM jogadores WHERE id = ?", [rawNick]);
                captain = rows[0];
            }

            if (!captain) {
                const [rows]: any = await jogadoresConnection.query(
                    "SELECT * FROM jogadores WHERE LOWER(TRIM(nick)) = ?",
                    [rawNick.toLowerCase()]
                );
                captain = rows[0];
            }

            if (!captain) {
                const [allJogadores]: any = await jogadoresConnection.query("SELECT id, nick FROM jogadores");
                const targetNormalized = normalizeText(rawNick);
                const foundPlayer = allJogadores.find((p: any) => normalizeText(p.nick) === targetNormalized);
                
                if (foundPlayer) {
                    const [rows]: any = await jogadoresConnection.query("SELECT * FROM jogadores WHERE id = ?", [foundPlayer.id]);
                    captain = rows[0];
                }
            }
            
            let teamPlayers = [];
            
            if (captain) {
                const [squadRows]: any = await jogadoresConnection.query(
                    "SELECT * FROM jogadores WHERE id = ? OR captain_id = ?",
                    [captain.id, captain.id]
                );
                teamPlayers = squadRows;
            } else {
                const nicksFromConfig = team.player_nick ? team.player_nick.split(',').map((n: string) => n.trim()) : [];
                if (nicksFromConfig.length > 0) {
                     const [playersByNick]: any = await jogadoresConnection.query(
                         "SELECT * FROM jogadores WHERE nick IN (?) OR id IN (?)",
                         [nicksFromConfig, nicksFromConfig]
                     );
                     teamPlayers = playersByNick;
                }
            }
            
            const nicks = teamPlayers.map((p: any) => p.nick ? p.nick.trim() : "");
            
            let statsRows: any[] = [];
            let jogadoresRows: any[] = [];
            let faceitRows: any[] = [];
            let playerGuids: any[] = [];

            if (nicks.length > 0) {
                // Busca todas as estatísticas e filtra via JS para garantir normalização
                const [allStatsRows]: any = await mainConnection.query("SELECT * FROM top90_stats");
                const normalizedNicks = new Set(nicks.map((n: string) => normalizeText(n)));
                statsRows = allStatsRows.filter((s: any) => normalizedNicks.has(normalizeText(s.nick)));

                jogadoresRows = teamPlayers;

                [faceitRows] = await jogadoresConnection.query(
                    "SELECT faceit_nickname, fotoperfil, discord_id FROM faceit_players WHERE faceit_nickname IN (?)",
                    [nicks]
                );

                [playerGuids] = await mainConnection.query(
                    "SELECT nickname, faceit_guid FROM players WHERE nickname IN (?)",
                    [nicks]
                );
            }

            teamData = {
                name: team.team_name,
                image: team.team_image,
                players: playerGuids.map((pg: any) => ({
                    ...pg,
                    pote: jogadoresRows.find((j: any) => normalizeText(j.nick) === normalizeText(pg.nickname))?.pote || 0
                })),
                tournamentStats: statsRows.map((stat: any) => ({
                    ...stat,
                    pote: jogadoresRows.find((j: any) => normalizeText(j.nick) === normalizeText(stat.nick))?.pote || 0,
                    faceit_image: faceitRows.find((f: any) => normalizeText(f.faceit_nickname) === normalizeText(stat.nick))?.fotoperfil || '/images/cs2-player.png'
                }))
            };

            // Fetch stats on server side
            statsData = await getTeamStats(teamData);
        }
    } catch (err) {
        console.error(err);
    } finally {
        if (mainConnection) await mainConnection.end();
        if (jogadoresConnection) await jogadoresConnection.end();
    }

    if (!teamData) return <div className="text-white text-center py-20">Time não encontrado.</div>;

    return <TeamStatsClient team={teamData} initialStats={statsData} />;
}
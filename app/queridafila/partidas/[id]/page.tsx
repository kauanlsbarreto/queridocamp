import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Shield, Swords } from "lucide-react";
import PremiumCard from "@/components/premium-card";
import SideAds from "@/components/side-ads";
import PageAccessGate from "@/components/page-access-gate";
import {
  calculateQueridaFilaPoints,
  type QueridaFilaPointsProjection,
} from "@/lib/queridafila-points";

export const revalidate = 1800;

const API_KEY_FACEIT = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

type MatchDetails = {
  match_id: string;
  status: string;
  competition_id?: string;
  best_of?: number;
  started_at?: number;
  finished_at?: number;
  faceit_url?: string;
  competition_name?: string;
  teams?: {
    faction1?: {
      faction_id?: string;
      name?: string;
      avatar?: string;
      roster?: Array<{
        player_id: string;
        nickname: string;
        avatar?: string;
        game_skill_level?: number;
      }>;
    };
    faction2?: {
      faction_id?: string;
      name?: string;
      avatar?: string;
      roster?: Array<{
        player_id: string;
        nickname: string;
        avatar?: string;
        game_skill_level?: number;
      }>;
    };
  };
  results?: {
    score?: {
      faction1?: number;
      faction2?: number;
    };
    winner?: string;
  };
};

type RoundStats = {
  round_stats?: {
    Map?: string;
    Score?: string;
    Rounds?: string;
  };
  teams?: Array<{
    team_id?: string;
    team_stats?: {
      [key: string]: string;
    };
    players?: Array<{
      player_id: string;
      nickname: string;
      player_stats?: {
        [key: string]: string;
      };
    }>;
  }>;
};

type MatchStatsResponse = {
  rounds?: RoundStats[];
};

type StatsTeam = NonNullable<RoundStats["teams"]>[number];
type StatsPlayer = NonNullable<StatsTeam["players"]>[number];

type FaceitPlayerProfile = {
  games?: {
    cs2?: {
      skill_level?: number;
    };
  };
  faceit_rank?: number;
};

type PlayerLevelData = {
  level: number;
  isChallenger: boolean;
};

type PlayerRow = {
  playerId: string;
  nickname: string;
  avatar: string;
  level: number | null;
  isChallenger: boolean;
  points: number;
  kills: number;
  deaths: number;
  assists: number;
  adr: number;
  kd: number;
  kr: number;
  hs: number;
  hsPercent: number;
  pentaKills: number;
  quadroKills: number;
  tripleKills: number;
  doubleKills: number;
  mvps: number;
};

type TeamSection = {
  name: string;
  avatar: string;
  score: number;
  firstHalfScore: number;
  secondHalfScore: number;
  teamAverageKd: number;
  players: PlayerRow[];
};

function toNumber(value: string | number | undefined | null) {
  if (value === undefined || value === null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundValue(value: number, digits = 2) {
  return value.toFixed(digits);
}

async function getMatchData(matchId: string) {
  const headers = { Authorization: `Bearer ${API_KEY_FACEIT}` };

  const [detailsResponse, statsResponse] = await Promise.all([
    fetch(`https://open.faceit.com/data/v4/matches/${matchId}`, {
      headers,
      next: { revalidate },
    }),
    fetch(`https://open.faceit.com/data/v4/matches/${matchId}/stats`, {
      headers,
      next: { revalidate },
    }),
  ]);

  if (!detailsResponse.ok || !statsResponse.ok) {
    return null;
  }

  const details = (await detailsResponse.json()) as MatchDetails;
  const stats = (await statsResponse.json()) as MatchStatsResponse;

  return { details, stats };
}

async function getPlayerLevels(playerIds: string[]) {
  const headers = { Authorization: `Bearer ${API_KEY_FACEIT}` };

  const profiles = await Promise.all(
    playerIds.map(async (playerId) => {
      try {
        const response = await fetch(`https://open.faceit.com/data/v4/players/${playerId}`, {
          headers,
          next: { revalidate },
        });

        if (!response.ok) {
          return [playerId, null] as const;
        }

        const data = (await response.json()) as FaceitPlayerProfile;
        const level = toNumber(data.games?.cs2?.skill_level);

        return [
          playerId,
          {
            level,
            isChallenger: level === 10 && toNumber(data.faceit_rank) > 0 && toNumber(data.faceit_rank) <= 1000,
          } satisfies PlayerLevelData,
        ] as const;
      } catch {
        return [playerId, null] as const;
      }
    }),
  );

  return new Map<string, PlayerLevelData>(profiles.filter((entry): entry is readonly [string, PlayerLevelData] => entry[1] !== null));
}

function buildTeamSection(
  roster: NonNullable<NonNullable<MatchDetails["teams"]>["faction1"]>["roster"] | undefined,
  matchTeam: NonNullable<MatchDetails["teams"]>["faction1"] | NonNullable<MatchDetails["teams"]>["faction2"] | undefined,
  statsTeam: StatsTeam,
  score: number,
  playerLevels: Map<string, PlayerLevelData>,
) {
  const rosterById = new Map((roster || []).map((player) => [player.player_id, player]));

  const players: PlayerRow[] = (statsTeam.players || []).map((player: StatsPlayer) => {
    const rosterPlayer = rosterById.get(player.player_id);
    const playerStats = player.player_stats || {};
    const levelData = playerLevels.get(player.player_id);

    return {
      playerId: player.player_id,
      nickname: player.nickname,
      avatar: rosterPlayer?.avatar || "/images/cs2-player.png",
      level: levelData?.level ?? rosterPlayer?.game_skill_level ?? null,
      isChallenger: levelData?.isChallenger ?? false,
      points: 5,
      kills: toNumber(playerStats["Kills"]),
      deaths: toNumber(playerStats["Deaths"]),
      assists: toNumber(playerStats["Assists"]),
      adr: toNumber(playerStats["ADR"]),
      kd: toNumber(playerStats["K/D Ratio"]),
      kr: toNumber(playerStats["K/R Ratio"]),
      hs: toNumber(playerStats["Headshots"]),
      hsPercent: toNumber(playerStats["Headshots %"]),
      pentaKills: toNumber(playerStats["Penta Kills"]),
      quadroKills: toNumber(playerStats["Quadro Kills"]),
      tripleKills: toNumber(playerStats["Triple Kills"]),
      doubleKills: toNumber(playerStats["Double Kills"]),
      mvps: toNumber(playerStats["MVPs"]),
    } satisfies PlayerRow;
  });

  players.sort((a: PlayerRow, b: PlayerRow) => {
    if (b.kd !== a.kd) return b.kd - a.kd;
    if (b.adr !== a.adr) return b.adr - a.adr;
    return b.kills - a.kills;
  });

  const averageKd = players.length > 0 ? players.reduce((sum: number, player: PlayerRow) => sum + player.kd, 0) / players.length : 0;

  return {
    name: matchTeam?.name || "Time",
    avatar: matchTeam?.avatar || "/images/team-placeholder.png",
    score,
    firstHalfScore: toNumber(statsTeam.team_stats?.["First Half Score"]),
    secondHalfScore: toNumber(statsTeam.team_stats?.["Second Half Score"]),
    teamAverageKd: averageKd,
    players,
  } satisfies TeamSection;
}

function assignMatchPoints(teamA: TeamSection, teamB: TeamSection) {
  const players = [...teamA.players, ...teamB.players];
  const projections: QueridaFilaPointsProjection[] = players.map((player) => ({
    playerId: player.playerId,
    adr: player.adr,
    kd: player.kd,
    kr: player.kr,
    assists: player.assists,
    hsPercent: player.hsPercent,
    mvps: player.mvps,
    doubleKills: player.doubleKills,
    tripleKills: player.tripleKills,
    quadroKills: player.quadroKills,
    pentaKills: player.pentaKills,
  }));
  const pointsMap = calculateQueridaFilaPoints(projections);

  const applyPoints = (team: TeamSection) => {
    team.players = team.players.map((player) => {
      return {
        ...player,
        points: pointsMap.get(player.playerId) ?? 5,
      };
    });
  };

  applyPoints(teamA);
  applyPoints(teamB);

  return { teamA, teamB };
}

function TeamTable({ team, accent, showPoints }: { team: TeamSection; accent: "blue" | "green"; showPoints: boolean }) {
  const accentClass = accent === "blue"
    ? "border-blue-500/30 bg-blue-500/8"
    : "border-emerald-500/30 bg-emerald-500/8";

  const scoreClass = accent === "blue" ? "text-blue-400" : "text-emerald-400";
  const badgeClass = accent === "blue" ? "bg-blue-500/15 text-blue-300" : "bg-emerald-500/15 text-emerald-300";
  const stickyHeaderClass = accent === "blue" ? "sticky right-0 z-10 bg-[#0d1624]" : "sticky right-0 z-10 bg-[#0c1c16]";
  const stickyCellClass = accent === "blue" ? "sticky right-0 z-10 bg-[#0a111b]" : "sticky right-0 z-10 bg-[#0a1510]";

  const getLevelImage = (player: PlayerRow) => {
    if (player.isChallenger) return "/faceitlevel/challenger.png";
    if (!player.level || player.level < 1) return "/faceitlevel/1.png";
    return `/faceitlevel/${Math.min(player.level, 10)}.png`;
  };

  return (
    <div className={`rounded-2xl border ${accentClass} overflow-hidden`}>
      <div className="flex flex-col gap-4 border-b border-white/10 bg-black/50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`min-w-8 text-center text-3xl font-black tabular-nums leading-none ${scoreClass}`}>{team.score}</div>
          <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-white/5">
            <Image src={team.avatar} alt={team.name} fill className="object-cover" unoptimized />
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-black text-white">{team.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${badgeClass}`}>
                Team avg {roundValue(team.teamAverageKd, 3)}
              </span>
              <span>First half {team.firstHalfScore}</span>
              <span>Second half {team.secondHalfScore}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-white/5 text-zinc-300">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Jogador</th>
              <th className="px-3 py-3 text-center font-semibold">Lvl</th>
              <th className="px-3 py-3 text-center font-semibold">K</th>
              <th className="px-3 py-3 text-center font-semibold">D</th>
              <th className="px-3 py-3 text-center font-semibold">A</th>
              <th className="px-3 py-3 text-center font-semibold">ADR</th>
              <th className="px-3 py-3 text-center font-semibold">K/D</th>
              <th className="px-3 py-3 text-center font-semibold">K/R</th>
              <th className="px-3 py-3 text-center font-semibold">HS</th>
              <th className="px-3 py-3 text-center font-semibold">HS %</th>
              <th className="px-3 py-3 text-center font-semibold">5k</th>
              <th className="px-3 py-3 text-center font-semibold">4k</th>
              <th className="px-3 py-3 text-center font-semibold">3k</th>
              <th className="px-3 py-3 text-center font-semibold">2k</th>
              <th className="px-3 py-3 text-center font-semibold">MVPs</th>
              {showPoints && (
                <th className={`px-3 py-3 text-center font-semibold ${stickyHeaderClass}`}>
                  <div className="flex items-center justify-center gap-2">
                    <Image src="/moeda.png" alt="Points" width={18} height={18} className="h-[18px] w-[18px] object-contain" unoptimized />
                    <span>Pontos</span>
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {team.players.map((player) => (
              <tr key={player.playerId} className="border-t border-white/5 bg-black/20 text-zinc-200 transition-colors hover:bg-white/5">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                      <Image src={player.avatar} alt={player.nickname} fill className="object-cover" unoptimized />
                    </div>
                    <span className="truncate font-semibold text-white">{player.nickname}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center">
                    <Image
                      src={getLevelImage(player)}
                      alt={player.isChallenger ? "FACEIT Challenger" : `FACEIT Level ${player.level ?? 1}`}
                      width={28}
                      height={28}
                      className="h-7 w-7 object-contain"
                      unoptimized
                    />
                  </div>
                </td>
                <td className="px-3 py-3 text-center tabular-nums">{player.kills}</td>
                <td className="px-3 py-3 text-center tabular-nums">{player.deaths}</td>
                <td className="px-3 py-3 text-center tabular-nums">{player.assists}</td>
                <td className="px-3 py-3 text-center tabular-nums">{roundValue(player.adr, 1)}</td>
                <td className="px-3 py-3 text-center tabular-nums">{roundValue(player.kd, 2)}</td>
                <td className="px-3 py-3 text-center tabular-nums">{roundValue(player.kr, 2)}</td>
                <td className="px-3 py-3 text-center tabular-nums">{player.hs}</td>
                <td className="px-3 py-3 text-center tabular-nums">{roundValue(player.hsPercent, 1)}%</td>
                <td className="px-3 py-3 text-center tabular-nums">{player.pentaKills}</td>
                <td className="px-3 py-3 text-center tabular-nums">{player.quadroKills}</td>
                <td className="px-3 py-3 text-center tabular-nums">{player.tripleKills}</td>
                <td className="px-3 py-3 text-center tabular-nums">{player.doubleKills}</td>
                <td className="px-3 py-3 text-center tabular-nums">{player.mvps}</td>
                {showPoints && (
                  <td className={`px-3 py-3 text-center ${stickyCellClass}`}>
                    <div className="flex items-center justify-center gap-2 font-bold text-white tabular-nums">
                      <Image src="/moeda.png" alt="Points" width={16} height={16} className="h-4 w-4 object-contain" unoptimized />
                      <span>{player.points}</span>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function QueridaFilaMatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matchData = await getMatchData(id);

  if (!matchData) {
    notFound();
  }

  const { details, stats } = matchData;

  const firstRound = stats.rounds?.[0];

  if (!firstRound || !details.teams?.faction1 || !details.teams?.faction2 || !firstRound.teams || firstRound.teams.length < 2) {
    notFound();
  }

  const rosterPlayerIds = [
    ...(details.teams.faction1.roster || []).map((player) => player.player_id),
    ...(details.teams.faction2.roster || []).map((player) => player.player_id),
  ];

  const playerLevels = await getPlayerLevels(rosterPlayerIds);

  const faction1Stats = firstRound.teams.find((team) => team.team_id === details.teams?.faction1?.faction_id) || firstRound.teams[0];
  const faction2Stats = firstRound.teams.find((team) => team.team_id === details.teams?.faction2?.faction_id) || firstRound.teams[1];

  let teamA = buildTeamSection(
    details.teams.faction1.roster,
    details.teams.faction1,
    faction1Stats,
    Number(details.results?.score?.faction1 || faction1Stats.team_stats?.["Final Score"] || 0),
    playerLevels,
  );

  let teamB = buildTeamSection(
    details.teams.faction2.roster,
    details.teams.faction2,
    faction2Stats,
    Number(details.results?.score?.faction2 || faction2Stats.team_stats?.["Final Score"] || 0),
    playerLevels,
  );

  ({ teamA, teamB } = assignMatchPoints(teamA, teamB));

  const playedAt = new Date(((details.finished_at || details.started_at || 0) as number) * 1000);
  const mapName = firstRound.round_stats?.Map || "Mapa indefinido";
  const faceitUrl = (details.faceit_url || `https://www.faceit.com/en/cs2/room/${id}`).replace("{lang}", "en");
  const teamAWon = teamA.score > teamB.score;
  const teamBWon = teamB.score > teamA.score;

  return (
    <PageAccessGate level={1}>
      <>
        <SideAds />
        <section className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-black py-10">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Link
                  href="/queridafila/partidas"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-gold"
                >
                  <ArrowLeft size={16} />
                  Voltar para partidas
                </Link>

                <a
                  href={faceitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300 transition-colors hover:text-gold"
                >
                  Abrir na FACEIT
                  <ExternalLink size={16} />
                </a>
              </div>

              <PremiumCard>
                <div className="p-6 md:p-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex-1">
                      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-gold">
                        <Shield size={14} />
                        {details.competition_name || "Querida Fila"}
                      </div>
                      <h1 className="text-3xl font-black uppercase tracking-tight text-white md:text-4xl">
                        {teamA.name} x {teamB.name}
                      </h1>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
                        <span>{playedAt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })}</span>
                        <span>{mapName}</span>
                        <span>MD{details.best_of || 1}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-center gap-4 md:gap-6">
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-white/5 md:h-16 md:w-16">
                          <Image src={teamA.avatar} alt={teamA.name} fill className="object-cover" unoptimized />
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-zinc-400">{teamA.name}</div>
                          <div className="text-4xl font-black text-blue-400 md:text-5xl">{teamA.score}</div>
                        </div>
                      </div>

                      <div className="rounded-full border border-white/10 bg-white/5 p-3 text-zinc-400">
                        <Swords size={18} />
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-left">
                          <div className="text-sm text-zinc-400">{teamB.name}</div>
                          <div className="text-4xl font-black text-emerald-400 md:text-5xl">{teamB.score}</div>
                        </div>
                        <div className="relative h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-white/5 md:h-16 md:w-16">
                          <Image src={teamB.avatar} alt={teamB.name} fill className="object-cover" unoptimized />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </PremiumCard>

              <div className="space-y-5">
                <TeamTable team={teamA} accent="blue" showPoints={teamAWon} />
                <TeamTable team={teamB} accent="green" showPoints={teamBWon} />
              </div>
            </div>
          </div>
        </section>
      </>
    </PageAccessGate>
  );
}
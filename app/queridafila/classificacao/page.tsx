import SideAds from "@/components/side-ads";
import QueridaFilaClassificacaoClient from "./classificacao-client";

export const revalidate = 30;

const QUEUE_ID = "c23c971b-677a-4046-8203-26023e283529";
const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FACEIT_API_KEY = process.env.FACEIT_API_KEY || "7b080715-fe0b-461d-a1f1-62cfd0c47e63";

type LeaderboardItem = {
  leaderboard_id: string;
  leaderboard_name: string;
  start_date: number;
  end_date: number;
  status: string;
};

type LeaderboardsResponse = {
  items?: LeaderboardItem[];
};

type RankingItem = {
  position: number;
  points: number;
  played: number;
  won: number;
  lost: number;
  draw: number;
  win_rate: number;
  current_streak: number;
  player: {
    user_id: string;
    nickname: string;
    avatar?: string;
    country?: string;
    skill_level?: number;
    faceit_url?: string;
  };
};

type RankingResponse = {
  items?: RankingItem[];
  end?: number;
};

type FaceitHubRole = {
  role_id: string;
  name: string;
};

type FaceitHubRolesResponse = {
  items?: FaceitHubRole[];
};

type FaceitHubMember = {
  user_id: string;
  roles?: string[];
};

type FaceitHubMembersResponse = {
  items?: FaceitHubMember[];
};

async function fetchHubLeaderboards() {
  const response = await fetch(
    `${FACEIT_API_BASE}/leaderboards/hubs/${QUEUE_ID}?offset=0&limit=100`,
    {
      headers: { Authorization: `Bearer ${FACEIT_API_KEY}` },
      next: { revalidate },
    },
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar leaderboards do hub: ${response.status}`);
  }

  return (await response.json()) as LeaderboardsResponse;
}

async function fetchAllTimeRankingPlayers() {
  const limit = 25;
  let offset = 0;
  let keepFetching = true;
  const allItems: RankingItem[] = [];

  while (keepFetching) {
    const response = await fetch(
      `${FACEIT_API_BASE}/leaderboards/hubs/${QUEUE_ID}/general?offset=${offset}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${FACEIT_API_KEY}` },
        next: { revalidate },
      },
    );

    if (!response.ok) {
      throw new Error(`Erro ao buscar ranking geral do hub: ${response.status}`);
    }

    const data = (await response.json()) as RankingResponse;
    const items = Array.isArray(data.items) ? data.items : [];

    allItems.push(...items);

    if (items.length < limit) {
      keepFetching = false;
    } else {
      offset += limit;
    }
  }

  return allItems;
}

async function fetchPremiumGuids() {
  try {
    const rolesRes = await fetch(
      `${FACEIT_API_BASE}/hubs/${QUEUE_ID}/roles?offset=0&limit=50`,
      { headers: { Authorization: `Bearer ${FACEIT_API_KEY}` }, next: { revalidate } },
    );

    if (!rolesRes.ok) {
      throw new Error(`Erro ao buscar roles do hub: ${rolesRes.status}`);
    }

    const rolesData = (await rolesRes.json()) as FaceitHubRolesResponse;
    const premiumRoleIds = new Set(
      (rolesData.items || [])
        .filter((role) => (role.name || "").toLowerCase().includes("premium"))
        .map((role) => role.role_id),
    );

    if (premiumRoleIds.size === 0) {
      return new Set<string>();
    }

    const premiumGuids = new Set<string>();
    const limit = 50;
    let offset = 0;
    let keepFetching = true;

    while (keepFetching) {
      const membersRes = await fetch(
        `${FACEIT_API_BASE}/hubs/${QUEUE_ID}/members?offset=${offset}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${FACEIT_API_KEY}` }, next: { revalidate } },
      );

      if (!membersRes.ok) {
        throw new Error(`Erro ao buscar membros do hub: ${membersRes.status}`);
      }

      const membersData = (await membersRes.json()) as FaceitHubMembersResponse;
      const members = membersData.items || [];

      for (const member of members) {
        const roles = member.roles || [];
        const isPremium = roles.some((role) => premiumRoleIds.has(role) || role.toLowerCase().includes("premium"));

        if (isPremium && member.user_id) {
          premiumGuids.add(member.user_id);
        }
      }

      if (members.length < limit) {
        keepFetching = false;
      } else {
        offset += limit;
      }
    }

    return premiumGuids;
  } catch (error) {
    console.error("Erro ao buscar Premium por roles da Faceit:", error);
    return new Set<string>();
  }
}

function getNextLeaderboard(items: LeaderboardItem[]) {
  const now = Math.floor(Date.now() / 1000);

  return [...items]
    .filter((item) => (item.status || "").toUpperCase() === "UPCOMING" || item.start_date >= now)
    .sort((a, b) => a.start_date - b.start_date)[0] || null;
}

function getActiveLeaderboard(items: LeaderboardItem[]) {
  const now = Math.floor(Date.now() / 1000);

  return (
    [...items]
      .filter((item) => {
        const status = (item.status || "").toUpperCase();
        const isOngoingByStatus = status === "ONGOING";
        const isOngoingByDates = item.start_date <= now && item.end_date >= now;
        return isOngoingByStatus || isOngoingByDates;
      })
      .sort((a, b) => b.start_date - a.start_date)[0] || null
  );
}

export default async function QueridaFilaClassificacaoPage() {
  try {
    const [leaderboardsData, premiumGuids] = await Promise.all([
      fetchHubLeaderboards(),
      fetchPremiumGuids(),
    ]);
    const leaderboards = Array.isArray(leaderboardsData.items) ? leaderboardsData.items : [];
    const activeLeaderboard = getActiveLeaderboard(leaderboards);
    const nextLeaderboard = getNextLeaderboard(leaderboards);

    const rankingPlayersRaw = await fetchAllTimeRankingPlayers();
    const rankingPlayers = rankingPlayersRaw.map((item) => ({ 
      ...item, 
      isPremium: premiumGuids.has(item.player.user_id) 
    }));

    return (
      <>
        <SideAds />
        <QueridaFilaClassificacaoClient
          nextLeaderboard={nextLeaderboard}
          players={rankingPlayers}
          pastLeaderboards={leaderboards}
          initialLeaderboardId={activeLeaderboard?.leaderboard_id || "geral"}
          activeLeaderboardId={activeLeaderboard?.leaderboard_id}
        />
      </>
    );
  } catch (error) {
    console.error("Erro ao carregar classificacao da Querida Fila:", error);

    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold text-red-500">Erro ao carregar classificacao da leaderboard.</h1>
      </div>
    );
  }
}

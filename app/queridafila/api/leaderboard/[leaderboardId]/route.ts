import { NextRequest } from "next/server";

const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FACEIT_API_KEY = process.env.FACEIT_API_KEY || "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
const HUB_ID = "c23c971b-677a-4046-8203-26023e283529";

type FaceitLeaderboardPlayer = {
  position?: number;
  rank?: number;
  points?: number;
  score?: number;
  played?: number;
  won?: number;
  lost?: number;
  draw?: number;
  win_rate?: number;
  current_streak?: number;
  stats?: {
    played?: number;
    won?: number;
    lost?: number;
    draw?: number;
    win_rate?: number;
    current_streak?: number;
  };
  player?: {
    user_id?: string;
    nickname?: string;
    avatar?: string;
    country?: string;
    skill_level?: number;
    faceit_url?: string;
  };
};

type FaceitLeaderboardResponse = {
  items?: FaceitLeaderboardPlayer[];
};

type MappedLeaderboardPlayer = {
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
    avatar: string;
    country: string;
    skill_level?: number;
    faceit_url?: string;
  };
  isPremium: boolean;
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

async function fetchPremiumUserIdsFromHub(): Promise<Set<string>> {
  const rolesRes = await fetch(`${FACEIT_API_BASE}/hubs/${HUB_ID}/roles?offset=0&limit=50`, {
    headers: { Authorization: `Bearer ${FACEIT_API_KEY}` },
  });

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

  const premiumUsers = new Set<string>();
  const limit = 50;
  let offset = 0;
  let keepFetching = true;

  while (keepFetching) {
    const membersRes = await fetch(
      `${FACEIT_API_BASE}/hubs/${HUB_ID}/members?offset=${offset}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${FACEIT_API_KEY}` } },
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
        premiumUsers.add(member.user_id);
      }
    }

    if (members.length < limit) {
      keepFetching = false;
    } else {
      offset += limit;
    }
  }

  return premiumUsers;
}

function mapItemsToPlayers(
  items: FaceitLeaderboardPlayer[],
  premiumUserIds: Set<string>,
): MappedLeaderboardPlayer[] {
  return items.map((item, idx) => ({
    position: item.position || item.rank || idx + 1,
    points: item.points ?? item.score ?? 0,
    played: item.played ?? item.stats?.played ?? 0,
    won: item.won ?? item.stats?.won ?? 0,
    lost: item.lost ?? item.stats?.lost ?? 0,
    draw: item.draw ?? item.stats?.draw ?? 0,
    win_rate: item.win_rate ?? item.stats?.win_rate ?? 0,
    current_streak: item.current_streak ?? item.stats?.current_streak ?? 0,
    player: {
      user_id: item.player?.user_id || "",
      nickname: item.player?.nickname || "",
      avatar: item.player?.avatar || "",
      country: item.player?.country || "",
      skill_level: item.player?.skill_level,
      faceit_url: item.player?.faceit_url,
    },
    isPremium: premiumUserIds.has(item.player?.user_id || ""),
  }));
}

async function fetchGeneralLeaderboardItems(): Promise<FaceitLeaderboardPlayer[]> {
  const limit = 25;
  let offset = 0;
  let keepFetching = true;
  const allItems: FaceitLeaderboardPlayer[] = [];

  while (keepFetching) {
    const response = await fetch(
      `${FACEIT_API_BASE}/leaderboards/hubs/${HUB_ID}/general?offset=${offset}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${FACEIT_API_KEY}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Erro ao buscar ranking geral do hub: ${response.status}`);
    }

    const data = (await response.json()) as FaceitLeaderboardResponse;
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leaderboardId: string }> },
) {
  const { leaderboardId } = await params;
  const premiumOnly = req.nextUrl.searchParams.get("premium") === "1";

  // Verifica se o leaderboardId foi fornecido
  if (!leaderboardId) {
    return new Response(JSON.stringify({ error: "Leaderboard ID não fornecido." }), { status: 400 });
  }

  try {
    const premiumUserIds = await fetchPremiumUserIdsFromHub();
    let players: MappedLeaderboardPlayer[] = [];

    if (leaderboardId === "geral") {
      const items = await fetchGeneralLeaderboardItems();
      players = mapItemsToPlayers(items, premiumUserIds);
    } else {
      const url = `${FACEIT_API_BASE}/leaderboards/${leaderboardId}`;
      const faceitRes = await fetch(url, {
        headers: {
          Authorization: `Bearer ${FACEIT_API_KEY}`,
        },
      });

      if (!faceitRes.ok) {
        const errorData = await faceitRes.json();
        return new Response(
          JSON.stringify({ error: `Erro Faceit: ${faceitRes.status} - ${errorData.message || "Erro desconhecido"}` }),
          { status: faceitRes.status },
        );
      }

      const data = (await faceitRes.json()) as FaceitLeaderboardResponse;
      const items = Array.isArray(data.items) ? data.items : [];
      players = mapItemsToPlayers(items, premiumUserIds);
    }

    if (premiumOnly) {
      players = players.filter((row) => Boolean(row.isPremium));
      players = players.map((row, index) => ({
        ...row,
        position: index + 1,
      }));
    }

    return new Response(JSON.stringify({ players }), { status: 200 });

  } catch (error: unknown) {
    // Retorna um erro genérico em caso de falha na requisição
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
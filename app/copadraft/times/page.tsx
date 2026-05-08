import { createMainConnection } from "@/lib/db";
import type { Env } from "@/lib/db";
import { getCopaDraftTimes } from "@/lib/copadraft-times";
import TimesPageClient from "./TimesPageClient";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const revalidate = 60;

type Player = {
	nickname: string;
	faceit_guid: string;
	avatar?: string;
};

type Team = {
	nome_time: string;
	jogadores: Player[];
};

let cachedTimesData: {
	expiresAt: number;
	data: Team[];
} | null = null;

async function loadTeams(): Promise<Team[]> {
	return getCopaDraftTimes();
}

async function loadAvatarByGuid(env: Env, teams: Team[]): Promise<Map<string, string>> {
	const guidSet = new Set<string>();

	for (const team of teams) {
		for (const player of team.jogadores || []) {
			const guid = String(player?.faceit_guid || "").trim().toLowerCase();
			if (guid) guidSet.add(guid);
		}
	}

	if (guidSet.size === 0) return new Map<string, string>();

	let connection: any = null;
	try {
		connection = await createMainConnection(env);
		const guids = Array.from(guidSet);
		const placeholders = guids.map(() => "?").join(",");
		const [rows] = await connection.query(
			`SELECT faceit_guid, avatar FROM players WHERE faceit_guid IN (${placeholders})`,
			guids
		);

		const avatarByGuid = new Map<string, string>();
		if (Array.isArray(rows)) {
			for (const row of rows as any[]) {
				const guid = String(row?.faceit_guid || "").trim().toLowerCase();
				const avatar = String(row?.avatar || "").trim();
				if (guid && avatar) avatarByGuid.set(guid, avatar);
			}
		}

		return avatarByGuid;
	} catch {
		return new Map<string, string>();
	} finally {
		await connection?.end?.();
	}
}

function mergeTeamsWithAvatar(teams: Team[], avatarByGuid: Map<string, string>): Team[] {
	return teams.map((team) => ({
		...team,
		jogadores: (team.jogadores || []).map((player) => {
			const guid = String(player?.faceit_guid || "").trim().toLowerCase();
			return {
				...player,
				avatar: avatarByGuid.get(guid) || "",
			};
		}),
	}));
}

export default async function CopaDraftTimesPage() {
	let teamsData: Team[] = [];
	const now = Date.now();
	
	if (cachedTimesData && cachedTimesData.expiresAt > now) {
		teamsData = cachedTimesData.data;
	} else {
		teamsData = await loadTeams();
		cachedTimesData = {
			expiresAt: now + 60000,
			data: teamsData,
		};
	}

	let teamsWithAvatar = teamsData;

	try {
		const env = await getRuntimeEnv() as Env;
		const avatarByGuid = await loadAvatarByGuid(env, teamsData);
		teamsWithAvatar = mergeTeamsWithAvatar(teamsData, avatarByGuid);
	} catch {
		teamsWithAvatar = mergeTeamsWithAvatar(teamsData, new Map<string, string>());
	}

	return <TimesPageClient teamsData={teamsWithAvatar} />;
}

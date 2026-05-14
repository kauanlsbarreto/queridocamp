import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

import { createMainConnection, type Env } from "@/lib/db";
import { getCopaDraftTimes } from "@/lib/copadraft-times";
import { getRuntimeEnv } from "@/lib/runtime-env";
import TeamDetailClient from "./TeamDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BANNER_DIR = path.join(process.cwd(), "public", "timesbanner");
const AUDIO_DIR = path.join(process.cwd(), "public", "audios");
const STATS_DIR = path.join(process.cwd(), "public", "stats-json");
const DEFAULT_AVATAR = "/images/cs2-player.png";
const FACEIT_API_BASE = "https://open.faceit.com/data/v4";
const FACEIT_REVALIDATE_SECONDS = 3600;

type TeamPlayer = {
	nickname: string;
	faceit_guid: string;
};

type Team = {
	nome_time: string;
	jogadores: TeamPlayer[];
};

type BannerRow = {
	time: string;
	zoom: number;
	x: number;
	y: number;
	largura: number;
	altura: number;
	ordem: string;
	avatar0: string | null;
	avatar1: string | null;
	avatar2: string | null;
	avatar3: string | null;
	avatar4: string | null;
};

type PlayerRow = {
	steamid: string | null;
	faceit_guid: string | null;
	nickname: string | null;
	avatar: string | null;
};

type RawPlayerStats = {
	steamId?: string | number;
	steamid?: string | number;
	name?: string;
	killCount?: number;
	deathCount?: number;
	averageKillsPerRound?: number;
	averageDamagePerRound?: number;

	hltvRating2?: number;
};

type JsonStatsSummary = {
	kills: number;
	deaths: number;
	kd: number;
	kr: number;
	adr: number;
	hltvRating: number;
};

type TeamPlayerView = {
	faceitGuid: string;
	steamId: string;
	nickname: string;
	avatar: string;
	stats: {
		kills: number;
		deaths: number;
		kd: number;
		kr: number;
		adr: number;
		hltvRating: number;
	} | null;
};

type TeamMatchRow = {
	rodada: number | null;
	time1: string | null;
	time2: string | null;
	placar: string | null;
	matchid: string | null;
};

type TeamMatchView = {
	rodada: number;
	teams: {
		self: string;
		opponent: string;
	};
	placar: {
		self: number | null;
		opponent: number | null;
		raw: string | null;
	};
	matchId: string | null;
};

type TeamInsightPlayer = {
	steamId: string;
	nickname: string;
	avatar: string;
	headshots: number;
	tradeKills: number;
	flashDuration: number;
	healthDamage: number;
	utilityDamage: number;
	grenadeThrows: number;
	kills: number;
};

type TeamInsightTop = {
	steamId: string;
	nickname: string;
	avatar: string;
	value: number;
} | null;

type TeamInsightWeaponLeader = {
	weaponName: string;
	steamId: string;
	nickname: string;
	avatar: string;
	kills: number;
};

type TeamInsightGrenadeLeader = {
	grenadeName: string;
	steamId: string;
	nickname: string;
	avatar: string;
	throws: number;
};

type TeamInsights = {
	topHeadshot: TeamInsightTop;
	topTradeKill: TeamInsightTop;
	topFlashDuration: TeamInsightTop;
	topHealthDamage: TeamInsightTop;
	topUtilityDamage: TeamInsightTop;
	weaponLeaders: TeamInsightWeaponLeader[];
	grenadeLeaders: TeamInsightGrenadeLeader[];
	players: TeamInsightPlayer[];
};

type TeamMapSummaryItem = {
	map: string;
	count: number;
	image: string | null;
};

type TeamMapSummary = {
	picked: TeamMapSummaryItem[];
	firstBanned: TeamMapSummaryItem[];
};

type StatsAccumulator = {
	appearances: number;
	kills: number;
	deaths: number;
	krTotal: number;
	adrTotal: number;
	hltvRatingTotal: number;
};

type StatsIndex = {
	bySteamId: Map<string, JsonStatsSummary>;
	byNickname: Map<string, JsonStatsSummary>;
};

function normalizeText(value: unknown) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/\s+/g, " ");
}

function normalizeMapToken(value: unknown) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.replace(/^de_/, "");
}

function slugify(value: unknown) {
	return normalizeText(value)
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function toNumber(value: unknown) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function toSteamId(value: unknown) {
	return String(value || "").trim();
}

function toSimpleText(value: unknown): string {
	if (value == null) return "";
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (typeof value === "object") {
		const asAny = value as any;
		if (typeof asAny.name === "string") return asAny.name.trim();
		if (typeof asAny.id === "string" || typeof asAny.id === "number") return String(asAny.id).trim();
	}
	return "";
}

function isUtilityWeapon(value: unknown) {
	const weapon = String(value || "").trim().toLowerCase();
	if (!weapon) return false;
	return (
		weapon.includes("grenade") ||
		weapon.includes("molotov") ||
		weapon.includes("flash") ||
		weapon.includes("smoke") ||
		weapon.includes("decoy")
	);
}

function toAvatarRenderUrl(rawPath: string) {
	const pathValue = String(rawPath || "").trim();
	if (!pathValue) return pathValue;

	const lowerPath = pathValue.toLowerCase();
	if (lowerPath.startsWith("https://i.ibb.co/")) return pathValue;
	if (!lowerPath.startsWith("/fotostime/")) return pathValue;

	const hasQuery = pathValue.includes("?");
	if (hasQuery) return pathValue;

	const encoded = encodeURIComponent(pathValue);
	return `/api/fotostime?path=${encoded}&v=${Date.now()}`;
}

async function resolveBannerImageUrl(teamName: string) {
	try {
		const files = await readdir(BANNER_DIR, { withFileTypes: true });
		const wanted = normalizeText(teamName);

		for (const file of files) {
			if (!file.isFile()) continue;

			const ext = path.extname(file.name).toLowerCase();
			if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) continue;

			const base = file.name.slice(0, file.name.length - ext.length).trim();
			if (normalizeText(base) === wanted) {
				return `/timesbanner/${encodeURIComponent(file.name)}`;
			}
		}
	} catch {
		return null;
	}

	return null;
}

async function resolveTeamAudioUrl(teamName: string) {
	try {
		const files = await readdir(AUDIO_DIR, { withFileTypes: true });
		const wanted = normalizeText(teamName);

		for (const file of files) {
			if (!file.isFile()) continue;

			const ext = path.extname(file.name).toLowerCase();
			if (ext !== ".mp3") continue;

			const base = file.name.slice(0, file.name.length - ext.length).trim();
			if (normalizeText(base) === wanted) {
				return `/audios/${encodeURIComponent(file.name)}`;
			}
		}
	} catch {
		return null;
	}

	return null;
}

function extractPlayers(payload: any): RawPlayerStats[] {
	if (Array.isArray(payload?.players)) return payload.players as RawPlayerStats[];

	if (Array.isArray(payload?.teams)) {
		return (payload.teams as any[])
			.flatMap((team) => (Array.isArray(team?.players) ? team.players : []))
			.filter(Boolean) as RawPlayerStats[];
	}

	if (Array.isArray(payload?.playerStats)) return payload.playerStats as RawPlayerStats[];

	return [];
}

function accumulateStats(target: Map<string, StatsAccumulator>, key: string, player: RawPlayerStats) {
	if (!key) return;

	const current =
		target.get(key) ||
		({
			appearances: 0,
			kills: 0,
			deaths: 0,
			krTotal: 0,
			adrTotal: 0,
			hltvRatingTotal: 0,
		} satisfies StatsAccumulator);

	current.appearances += 1;
	current.kills += Math.trunc(toNumber(player?.killCount));
	current.deaths += Math.trunc(toNumber(player?.deathCount));
	current.krTotal += toNumber(player?.averageKillsPerRound);
	current.adrTotal += toNumber(player?.averageDamagePerRound);
	current.hltvRatingTotal += toNumber(player?.hltvRating2);

	target.set(key, current);
}

function finalizeStatsIndex(source: Map<string, StatsAccumulator>) {
	const result = new Map<string, JsonStatsSummary>();

	Array.from(source.entries()).forEach(([key, value]) => {
		const appearances = Math.max(1, value.appearances);
		const kd = value.deaths > 0 ? value.kills / value.deaths : value.kills > 0 ? value.kills : 0;

		result.set(key, {
			kills: value.kills,
			deaths: value.deaths,
			kd,
			kr: value.krTotal / appearances,
			adr: value.adrTotal / appearances,
			hltvRating: value.hltvRatingTotal / appearances,
		});
	});

	return result;
}

async function loadJsonStatsIndex(): Promise<StatsIndex> {
	const bySteamAccumulator = new Map<string, StatsAccumulator>();
	const byNicknameAccumulator = new Map<string, StatsAccumulator>();

	let fileNames: string[] = [];

	try {
		const entries = await readdir(STATS_DIR, { withFileTypes: true });
		fileNames = entries
			.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
			.map((entry) => entry.name);
	} catch {
		return {
			bySteamId: new Map<string, JsonStatsSummary>(),
			byNickname: new Map<string, JsonStatsSummary>(),
		};
	}

	await Promise.all(
		fileNames.map(async (fileName) => {
			try {
				const content = await readFile(path.join(STATS_DIR, fileName), "utf-8");
				const parsed = JSON.parse(content);

				for (const player of extractPlayers(parsed)) {
					const steamId = toSteamId(player?.steamId ?? player?.steamid);
					const nickname = normalizeText(player?.name);

					if (steamId) accumulateStats(bySteamAccumulator, steamId, player);
					if (nickname) accumulateStats(byNicknameAccumulator, nickname, player);
				}
			} catch {
				// ignora arquivo invalido para nao quebrar a pagina
			}
		})
	);

	return {
		bySteamId: finalizeStatsIndex(bySteamAccumulator),
		byNickname: finalizeStatsIndex(byNicknameAccumulator),
	};
}

async function loadBannerConfig(env: Env, teamName: string): Promise<BannerRow | null> {
	let connection: any = null;

	try {
		connection = await createMainConnection(env);
		const [rows] = await connection.query(
			"SELECT time, zoom, x, y, largura, altura, ordem, avatar0, avatar1, avatar2, avatar3, avatar4 FROM banner WHERE time = ? LIMIT 1",
			[teamName]
		);

		const row = Array.isArray(rows) ? (rows as BannerRow[])[0] : null;
		if (!row) return null;

		return {
			time: String(row.time || teamName),
			zoom: toNumber(row.zoom) || 1,
			x: Math.trunc(toNumber(row.x)),
			y: Math.trunc(toNumber(row.y)),
			largura: Math.max(320, Math.trunc(toNumber(row.largura) || 1100)),
			altura: Math.max(120, Math.trunc(toNumber(row.altura) || 280)),
			ordem: String(row.ordem || "").trim().slice(0, 10),
			avatar0: row.avatar0 ? String(row.avatar0).trim() : null,
			avatar1: row.avatar1 ? String(row.avatar1).trim() : null,
			avatar2: row.avatar2 ? String(row.avatar2).trim() : null,
			avatar3: row.avatar3 ? String(row.avatar3).trim() : null,
			avatar4: row.avatar4 ? String(row.avatar4).trim() : null,
		};
	} catch {
		return null;
	} finally {
		await connection?.end?.();
	}
}

async function loadTeamPlayers(
	env: Env,
	team: Team,
	bannerConfig: BannerRow | null,
	statsIndex: StatsIndex
): Promise<TeamPlayerView[]> {
	const guids = Array.from(
		new Set(
			(team.jogadores || [])
				.map((player) => String(player?.faceit_guid || "").trim().toLowerCase())
				.filter(Boolean)
		)
	);

	if (guids.length === 0) return [];

	let connection: any = null;

	try {
		connection = await createMainConnection(env);

		const placeholders = guids.map(() => "?").join(",");
		const [playerRows] = await connection.query(
			`SELECT steamid, faceit_guid, nickname, avatar FROM players WHERE faceit_guid IN (${placeholders})`,
			guids
		);

		const byGuid = new Map<string, PlayerRow>();
		for (const row of (Array.isArray(playerRows) ? playerRows : []) as PlayerRow[]) {
			const guid = String(row?.faceit_guid || "").trim().toLowerCase();
			if (!guid) continue;
			byGuid.set(guid, row);
		}

		const teamAvatars = [
			bannerConfig?.avatar0,
			bannerConfig?.avatar1,
			bannerConfig?.avatar2,
			bannerConfig?.avatar3,
			bannerConfig?.avatar4,
		];

		return (team.jogadores || []).map((rawPlayer, index) => {
			const guid = String(rawPlayer?.faceit_guid || "").trim().toLowerCase();
			const dbPlayer = byGuid.get(guid);
			const bannerAvatar = String(teamAvatars[index] || "").trim();
			const resolvedAvatar = String(bannerAvatar || dbPlayer?.avatar || DEFAULT_AVATAR);
			const stats =
				statsIndex.bySteamId.get(toSteamId(dbPlayer?.steamid)) ||
				statsIndex.byNickname.get(normalizeText(dbPlayer?.nickname || rawPlayer?.nickname)) ||
				null;

			return {
				faceitGuid: guid,
				steamId: toSteamId(dbPlayer?.steamid),
				nickname: String(dbPlayer?.nickname || rawPlayer?.nickname || "Jogador"),
				avatar: toAvatarRenderUrl(resolvedAvatar),
				stats: stats
					? {
						kills: stats.kills,
						deaths: stats.deaths,
						kd: stats.kd,
						kr: stats.kr,
						adr: stats.adr,
						hltvRating: stats.hltvRating,
					}
					: null,
			};
		});
	} catch {
		return (team.jogadores || []).map((rawPlayer) => ({
			faceitGuid: String(rawPlayer?.faceit_guid || "").trim().toLowerCase(),
			steamId: "",
			nickname: String(rawPlayer?.nickname || "Jogador"),
			avatar: DEFAULT_AVATAR,
			stats: null,
		}));
	} finally {
		await connection?.end?.();
	}
}

function parsePlacar(raw: unknown) {
	const text = String(raw || "").trim();
	if (!text) return { left: null as number | null, right: null as number | null, raw: null as string | null };
	const parts = text.split(/\s*x\s*/i);
	const left = Number(parts[0]);
	const right = Number(parts[1]);
	return {
		left: Number.isFinite(left) ? left : null,
		right: Number.isFinite(right) ? right : null,
		raw: text,
	};
}

async function loadTeamMatches(env: Env, teamName: string): Promise<TeamMatchView[]> {
	let connection: any = null;

	try {
		connection = await createMainConnection(env);
		const [rows] = await connection.query(
			"SELECT rodada, time1, time2, placar, matchid FROM jogos WHERE time1 = ? OR time2 = ? ORDER BY rodada ASC",
			[teamName, teamName]
		);

		const normalizedSelf = normalizeText(teamName);
		const mapped = ((Array.isArray(rows) ? rows : []) as TeamMatchRow[])
			.map((row) => {
				const t1 = String(row?.time1 || "").trim();
				const t2 = String(row?.time2 || "").trim();
				const selfIsT1 = normalizeText(t1) === normalizedSelf;
				const selfName = selfIsT1 ? t1 : t2;
				const opponentName = selfIsT1 ? t2 : t1;
				const score = parsePlacar(row?.placar);
				const selfScore = selfIsT1 ? score.left : score.right;
				const opponentScore = selfIsT1 ? score.right : score.left;

				return {
					rodada: Math.max(1, Math.trunc(toNumber(row?.rodada) || 1)),
					teams: {
						self: selfName || teamName,
						opponent: opponentName || "Adversario",
					},
					placar: {
						self: selfScore,
						opponent: opponentScore,
						raw: score.raw,
					},
					matchId: String(row?.matchid || "").trim() || null,
				} satisfies TeamMatchView;
			})
			.filter((row) => row.teams.self && row.teams.opponent);

		return mapped;
	} catch {
		return [];
	} finally {
		await connection?.end?.();
	}
}

async function loadTeamInsights(teamName: string, players: TeamPlayerView[]): Promise<TeamInsights> {
	const playerBySteam = new Map<string, { nickname: string; avatar: string }>();
	for (const player of players) {
		const steamId = toSteamId(player?.steamId);
		if (!steamId) continue;
		playerBySteam.set(steamId, {
			nickname: String(player.nickname || "Jogador"),
			avatar: String(player.avatar || DEFAULT_AVATAR),
		});
	}

	const byPlayer = new Map<string, TeamInsightPlayer>();
	const byWeapon = new Map<string, Map<string, number>>();
	const byGrenade = new Map<string, Map<string, number>>();

	function ensurePlayer(steamId: string) {
		const profile = playerBySteam.get(steamId);
		if (!profile) return null;
		const current = byPlayer.get(steamId);
		if (current) return current;

		const created: TeamInsightPlayer = {
			steamId,
			nickname: profile.nickname,
			avatar: profile.avatar,
			headshots: 0,
			tradeKills: 0,
			flashDuration: 0,
			healthDamage: 0,
			utilityDamage: 0,
			grenadeThrows: 0,
			kills: 0,
		};
		byPlayer.set(steamId, created);
		return created;
	}

	let fileNames: string[] = [];
	try {
		const entries = await readdir(STATS_DIR, { withFileTypes: true });
		fileNames = entries
			.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"))
			.map((entry) => entry.name);
	} catch {
		fileNames = [];
	}

	const normalizedTeam = normalizeText(teamName);

	for (const fileName of fileNames) {
		try {
			const content = await readFile(path.join(STATS_DIR, fileName), "utf-8");
			const parsed = JSON.parse(content);

			const teamA = normalizeText(parsed?.teamA?.name);
			const teamB = normalizeText(parsed?.teamB?.name);
			const isTeamMatch = teamA === normalizedTeam || teamB === normalizedTeam;
			if (!isTeamMatch) continue;

			const kills = Array.isArray(parsed?.kills) ? parsed.kills : [];
			for (const kill of kills) {
				const killerSteam = toSteamId(kill?.killerSteamId);
				if (!killerSteam) continue;
				const player = ensurePlayer(killerSteam);
				if (!player) continue;

				player.kills += 1;
				if (kill?.isHeadshot) player.headshots += 1;
				if (kill?.isTradeKill) player.tradeKills += 1;

				const weaponName = String(kill?.weaponName || "").trim();
				if (weaponName) {
					if (!byWeapon.has(weaponName)) byWeapon.set(weaponName, new Map<string, number>());
					const weaponMap = byWeapon.get(weaponName)!;
					weaponMap.set(killerSteam, (weaponMap.get(killerSteam) || 0) + 1);
				}
			}

			const damages = Array.isArray(parsed?.damages) ? parsed.damages : [];
			for (const damage of damages) {
				const attackerSteam = toSteamId(damage?.attackerSteamId);
				if (!attackerSteam) continue;
				const player = ensurePlayer(attackerSteam);
				if (!player) continue;

				const hpDamage = toNumber(damage?.healthDamage);
				player.healthDamage += hpDamage;
				if (isUtilityWeapon(damage?.weaponName)) player.utilityDamage += hpDamage;
			}

			const blinds = Array.isArray(parsed?.blinds) ? parsed.blinds : [];
			for (const blind of blinds) {
				const flasherSteam = toSteamId(blind?.flasherSteamId);
				if (!flasherSteam) continue;
				const player = ensurePlayer(flasherSteam);
				if (!player) continue;
				player.flashDuration += toNumber(blind?.duration);
			}

			const grenadeDestroyed = Array.isArray(parsed?.grenadeDestroyed) ? parsed.grenadeDestroyed : [];
			for (const grenade of grenadeDestroyed) {
				const throwerSteam = toSteamId(grenade?.throwerSteamId);
				if (!throwerSteam) continue;
				const player = ensurePlayer(throwerSteam);
				if (!player) continue;

				player.grenadeThrows += 1;
				const grenadeName = String(grenade?.grenadeName || "").trim();
				if (grenadeName) {
					if (!byGrenade.has(grenadeName)) byGrenade.set(grenadeName, new Map<string, number>());
					const grenadeMap = byGrenade.get(grenadeName)!;
					grenadeMap.set(throwerSteam, (grenadeMap.get(throwerSteam) || 0) + 1);
				}
			}
		} catch {
			// ignora arquivo invalido
		}
	}

	const playersList = Array.from(byPlayer.values()).sort((a, b) => b.kills - a.kills || b.healthDamage - a.healthDamage);

	function topBy(getValue: (player: TeamInsightPlayer) => number): TeamInsightTop {
		if (playersList.length === 0) return null;
		let best = playersList[0];
		for (const player of playersList) {
			if (getValue(player) > getValue(best)) best = player;
		}
		return {
			steamId: best.steamId,
			nickname: best.nickname,
			avatar: best.avatar,
			value: getValue(best),
		};
	}

	const weaponLeaders: TeamInsightWeaponLeader[] = Array.from(byWeapon.entries())
		.map(([weaponName, playerMap]) => {
			let bestSteam = "";
			let bestKills = 0;
			for (const [steamId, count] of Array.from(playerMap.entries())) {
				if (count > bestKills) {
					bestSteam = steamId;
					bestKills = count;
				}
			}
			const profile = playerBySteam.get(bestSteam);
			if (!profile || !bestSteam || bestKills <= 0) return null;
			return {
				weaponName,
				steamId: bestSteam,
				nickname: profile.nickname,
				avatar: profile.avatar,
				kills: bestKills,
			} satisfies TeamInsightWeaponLeader;
		})
		.filter(Boolean)
		.sort((a, b) => b!.kills - a!.kills) as TeamInsightWeaponLeader[];

	const grenadeLeaders: TeamInsightGrenadeLeader[] = Array.from(byGrenade.entries())
		.map(([grenadeName, playerMap]) => {
			let bestSteam = "";
			let bestThrows = 0;
			for (const [steamId, count] of Array.from(playerMap.entries())) {
				if (count > bestThrows) {
					bestSteam = steamId;
					bestThrows = count;
				}
			}
			const profile = playerBySteam.get(bestSteam);
			if (!profile || !bestSteam || bestThrows <= 0) return null;
			return {
				grenadeName,
				steamId: bestSteam,
				nickname: profile.nickname,
				avatar: profile.avatar,
				throws: bestThrows,
			} satisfies TeamInsightGrenadeLeader;
		})
		.filter(Boolean)
		.sort((a, b) => b!.throws - a!.throws) as TeamInsightGrenadeLeader[];

	return {
		topHeadshot: topBy((p) => p.headshots),
		topTradeKill: topBy((p) => p.tradeKills),
		topFlashDuration: topBy((p) => p.flashDuration),
		topHealthDamage: topBy((p) => p.healthDamage),
		topUtilityDamage: topBy((p) => p.utilityDamage),
		weaponLeaders,
		grenadeLeaders,
		players: playersList,
	};
}

function resolveSelectedByLabel(value: unknown, team1Name: string, team2Name: string) {
	const raw = toSimpleText(value);
	if (!raw) return null;
	const normalized = normalizeText(raw);
	if (normalized === "faction1" || normalized === normalizeText(team1Name)) return team1Name;
	if (normalized === "faction2" || normalized === normalizeText(team2Name)) return team2Name;
	return raw;
}

function parseVotingEvents(matchData: any): {
	picked: Array<{ map: string; selectedBy: string | null; image: string | null }>;
	banned: Array<{ map: string; selectedBy: string | null; image: string | null }>;
} {
	const votingMap = matchData?.voting?.map || {};
	const entities = Array.isArray(votingMap?.entities) ? votingMap.entities : [];

	const team1Name = String(matchData?.teams?.faction1?.name || "Team 1").trim();
	const team2Name = String(matchData?.teams?.faction2?.name || "Team 2").trim();

	const byToken = new Map<string, { label: string; image: string | null; pickBy: string | null; banBy: string | null }>();
	for (const entry of entities) {
		const label =
			toSimpleText(entry?.name) ||
			toSimpleText(entry?.class_name) ||
			toSimpleText(entry?.game_map_id) ||
			toSimpleText(entry?.guid);
		if (!label) continue;

		const image = toSimpleText(entry?.image_lg) || toSimpleText(entry?.image_sm) || null;
		const pickBy = resolveSelectedByLabel(entry?.selected_by ?? entry?.picked_by ?? entry?.pick_by, team1Name, team2Name);
		const banBy = resolveSelectedByLabel(
			entry?.dropped_by ?? entry?.drop_by ?? entry?.removed_by ?? entry?.banned_by ?? entry?.ban_by,
			team1Name,
			team2Name
		);

		const tokens = [
			normalizeMapToken(entry?.name),
			normalizeMapToken(entry?.class_name),
			normalizeMapToken(entry?.game_map_id),
			normalizeMapToken(entry?.guid),
			normalizeMapToken(label),
		].filter(Boolean) as string[];

		for (const token of tokens) {
			if (!byToken.has(token)) {
				byToken.set(token, { label, image, pickBy: pickBy || null, banBy: banBy || null });
			}
		}
	}

	const pickRaw = [
		...(Array.isArray(votingMap?.pick) ? votingMap.pick : []),
		...(Array.isArray(votingMap?.picked) ? votingMap.picked : []),
		...(Array.isArray(votingMap?.selected) ? votingMap.selected : []),
	];
	const dropRaw = [
		...(Array.isArray(votingMap?.drop) ? votingMap.drop : []),
		...(Array.isArray(votingMap?.dropped) ? votingMap.dropped : []),
		...(Array.isArray(votingMap?.ban) ? votingMap.ban : []),
		...(Array.isArray(votingMap?.banned) ? votingMap.banned : []),
	];

	const picked: Array<{ map: string; selectedBy: string | null; image: string | null }> = [];
	const seenPick = new Set<string>();
	for (const value of pickRaw) {
		const token = normalizeMapToken(value);
		if (!token || seenPick.has(token)) continue;
		seenPick.add(token);
		const meta = byToken.get(token);
		picked.push({
			map: meta?.label || toSimpleText(value) || "Mapa",
			selectedBy: meta?.pickBy || null,
			image: meta?.image || null,
		});
	}

	const banned: Array<{ map: string; selectedBy: string | null; image: string | null }> = [];
	const seenBan = new Set<string>();
	for (const value of dropRaw) {
		const token = normalizeMapToken(value);
		if (!token || seenBan.has(token)) continue;
		seenBan.add(token);
		const meta = byToken.get(token);
		banned.push({
			map: meta?.label || toSimpleText(value) || "Mapa",
			selectedBy: meta?.banBy || null,
			image: meta?.image || null,
		});
	}

	return { picked, banned };
}

async function fetchFaceitMatch(matchId: string, apiKey: string) {
	const response = await fetch(`${FACEIT_API_BASE}/matches/${matchId}`, {
		headers: { Authorization: `Bearer ${apiKey}` },
		cache: "force-cache",
		next: { revalidate: FACEIT_REVALIDATE_SECONDS },
	});
	if (!response.ok) return null;
	return await response.json();
}

function extractHistoryMatchId(item: any) {
	const raw = item?.match_id ?? item?.matchId ?? item?.id;
	const matchId = String(raw || "").trim();
	return matchId || null;
}

function historyContainsTeam(item: any, teamName: string) {
	const normalizedTeam = normalizeText(teamName);
	if (!normalizedTeam) return false;

	const candidates = [
		item?.teams?.faction1?.name,
		item?.teams?.faction2?.name,
		item?.teams?.team1?.name,
		item?.teams?.team2?.name,
		item?.faction1?.name,
		item?.faction2?.name,
		item?.team1?.name,
		item?.team2?.name,
		item?.teams?.faction1,
		item?.teams?.faction2,
		item?.opponents?.[0]?.faction?.name,
		item?.opponents?.[1]?.faction?.name,
		item?.teams?.[0]?.name,
		item?.teams?.[1]?.name,
	];

	for (const value of candidates) {
		if (normalizeText(value) === normalizedTeam) return true;
	}

	return false;
}

async function fetchPlayerHistoryMatchIds(faceitGuid: string, teamName: string, apiKey: string): Promise<string[]> {
	const guid = String(faceitGuid || "").trim();
	if (!guid) return [];

	const matchIds: string[] = [];
	const seen = new Set<string>();
	const limit = 100;
	const maxPages = 8;

	for (let page = 0; page < maxPages; page += 1) {
		const offset = page * limit;
		const response = await fetch(`${FACEIT_API_BASE}/players/${encodeURIComponent(guid)}/history?game=cs2&offset=${offset}&limit=${limit}`, {
			headers: { Authorization: `Bearer ${apiKey}` },
			cache: "force-cache",
			next: { revalidate: FACEIT_REVALIDATE_SECONDS },
		});

		if (!response.ok) break;

		const payload = await response.json();
		const items = Array.isArray(payload?.items) ? payload.items : [];
		if (items.length === 0) break;

		for (const item of items) {
			if (!historyContainsTeam(item, teamName)) continue;
			const matchId = extractHistoryMatchId(item);
			if (!matchId || seen.has(matchId)) continue;
			seen.add(matchId);
			matchIds.push(matchId);
		}

		if (items.length < limit) break;
	}

	return matchIds;
}

async function loadTeamMapSummary(teamName: string, teamPlayers: TeamPlayer[], teamMatches: TeamMatchView[]): Promise<TeamMapSummary> {
	const faceitApiKey = String(process.env.FACEIT_API_KEY || "").trim();
	if (!faceitApiKey) return { picked: [], firstBanned: [] };

	const matchIdsFromDb = Array.from(
		new Set(
			teamMatches
				.map((m) => String(m?.matchId || "").trim())
				.filter(Boolean)
		)
	);

	const playerGuids = Array.from(
		new Set(
			(teamPlayers || [])
				.map((player) => String(player?.faceit_guid || "").trim())
				.filter(Boolean)
		)
	);

	const historyLists = await Promise.all(
		playerGuids.map(async (guid) => {
			try {
				return await fetchPlayerHistoryMatchIds(guid, teamName, faceitApiKey);
			} catch {
				return [] as string[];
			}
		})
	);

	const matchIds = Array.from(new Set([...matchIdsFromDb, ...historyLists.flat()]));

	if (matchIds.length === 0) return { picked: [], firstBanned: [] };

	const pickedCount = new Map<string, { map: string; image: string | null; count: number }>();
	const firstBanCount = new Map<string, { map: string; image: string | null; count: number }>();
	const normalizedTeam = normalizeText(teamName);

	for (const matchId of matchIds) {
		try {
			const matchData = await fetchFaceitMatch(matchId, faceitApiKey);
			if (!matchData) continue;

			const voting = parseVotingEvents(matchData);

			for (const item of voting.picked) {
				if (normalizeText(item.selectedBy) !== normalizedTeam) continue;
				const key = normalizeMapToken(item.map);
				if (!key) continue;
				const current = pickedCount.get(key) || { map: item.map, image: item.image || null, count: 0 };
				current.count += 1;
				if (!current.image && item.image) current.image = item.image;
				pickedCount.set(key, current);
			}

			const firstBanForTeam = voting.banned.find((item) => normalizeText(item.selectedBy) === normalizedTeam) || null;
			if (firstBanForTeam) {
				const key = normalizeMapToken(firstBanForTeam.map);
				if (key) {
					const current = firstBanCount.get(key) || { map: firstBanForTeam.map, image: firstBanForTeam.image || null, count: 0 };
					current.count += 1;
					if (!current.image && firstBanForTeam.image) current.image = firstBanForTeam.image;
					firstBanCount.set(key, current);
				}
			}
		} catch {
			// ignora falha de um match para manter a pagina funcional
		}
	}

	return {
		picked: Array.from(pickedCount.values())
			.sort((a, b) => b.count - a.count || a.map.localeCompare(b.map))
			.map((item) => ({ map: item.map, count: item.count, image: item.image })),
		firstBanned: Array.from(firstBanCount.values())
			.sort((a, b) => b.count - a.count || a.map.localeCompare(b.map))
			.map((item) => ({ map: item.map, count: item.count, image: item.image })),
	};
}

export default async function CopaDraftTeamPage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const decodedId = decodeURIComponent(String(id || "")).trim();
	const targetKey = slugify(decodedId);

	const teams = getCopaDraftTimes() as Team[];
	const team = teams.find((item) => slugify(item?.nome_time) === targetKey || normalizeText(item?.nome_time) === normalizeText(decodedId));

	if (!team) {
		notFound();
	}

	let env: Env | null = null;
	try {
		env = (await getRuntimeEnv()) as Env;
	} catch {
		env = null;
	}

	const [bannerImageUrl, teamAudioUrl, bannerConfig, statsIndex] = await Promise.all([
		resolveBannerImageUrl(team.nome_time),
		resolveTeamAudioUrl(team.nome_time),
		env ? loadBannerConfig(env, team.nome_time) : Promise.resolve(null),
		loadJsonStatsIndex(),
	]);

	const [players, teamMatches] = env
		? await Promise.all([
			loadTeamPlayers(env, team, bannerConfig, statsIndex),
			loadTeamMatches(env, team.nome_time),
		])
		: [[], [] as TeamMatchView[]];

	const teamInsights = await loadTeamInsights(team.nome_time, players);
	const teamMapSummary: TeamMapSummary = { picked: [], firstBanned: [] };

	return (
		<TeamDetailClient
			teamName={team.nome_time}
			bannerImageUrl={bannerImageUrl}
			teamAudioUrl={teamAudioUrl}
			initialBannerConfig={bannerConfig}
			players={players}
			teamMatches={teamMatches}
			teamInsights={teamInsights}
			teamMapSummary={teamMapSummary}
		/>
	);
}

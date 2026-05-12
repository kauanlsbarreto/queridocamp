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
			nickname: String(rawPlayer?.nickname || "Jogador"),
			avatar: DEFAULT_AVATAR,
			stats: null,
		}));
	} finally {
		await connection?.end?.();
	}
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

	const players = env ? await loadTeamPlayers(env, team, bannerConfig, statsIndex) : [];

	return (
		<TeamDetailClient
			teamName={team.nome_time}
			bannerImageUrl={bannerImageUrl}
			teamAudioUrl={teamAudioUrl}
			initialBannerConfig={bannerConfig}
			players={players}
		/>
	);
}

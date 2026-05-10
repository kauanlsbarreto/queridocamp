import { readdir } from "node:fs/promises";
import path from "node:path";
import { notFound } from "next/navigation";

import { createMainConnection, type Env } from "@/lib/db";
import { getCopaDraftTimes } from "@/lib/copadraft-times";
import { getRuntimeEnv } from "@/lib/runtime-env";
import TeamDetailClient from "./TeamDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BANNER_DIR = path.join(process.cwd(), "public", "timesbanner");
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
	faceit_guid: string | null;
	nickname: string | null;
	avatar: string | null;
};

type Top90Row = {
	faceit_guild: string | null;
	k: number | string | null;
	d: number | string | null;
	kd: number | string | null;
	kr: number | string | null;
	adr: number | string | null;
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
	};
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

function toAvatarRenderUrl(rawPath: string) {
	const pathValue = String(rawPath || "").trim();
	if (!pathValue) return pathValue;
	if (!pathValue.toLowerCase().startsWith("/fotostime/")) return pathValue;

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

async function loadTeamPlayers(env: Env, team: Team, bannerConfig: BannerRow | null): Promise<TeamPlayerView[]> {
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
			`SELECT faceit_guid, nickname, avatar FROM players WHERE faceit_guid IN (${placeholders})`,
			guids
		);
		const [topRows] = await connection.query(
			`SELECT faceit_guild, k, d, kd, kr, adr FROM top90_stats WHERE faceit_guild IN (${placeholders})`,
			guids
		);

		const byGuid = new Map<string, PlayerRow>();
		for (const row of (Array.isArray(playerRows) ? playerRows : []) as PlayerRow[]) {
			const guid = String(row?.faceit_guid || "").trim().toLowerCase();
			if (!guid) continue;
			byGuid.set(guid, row);
		}

		const statsByGuid = new Map<string, Top90Row>();
		for (const row of (Array.isArray(topRows) ? topRows : []) as Top90Row[]) {
			const guid = String(row?.faceit_guild || "").trim().toLowerCase();
			if (!guid) continue;
			statsByGuid.set(guid, row);
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
			const top = statsByGuid.get(guid);
			const bannerAvatar = String(teamAvatars[index] || "").trim();

			const resolvedAvatar = String(bannerAvatar || dbPlayer?.avatar || DEFAULT_AVATAR);

			return {
				faceitGuid: guid,
				nickname: String(dbPlayer?.nickname || rawPlayer?.nickname || "Jogador"),
				avatar: toAvatarRenderUrl(resolvedAvatar),
				stats: {
					kills: Math.trunc(toNumber(top?.k)),
					deaths: Math.trunc(toNumber(top?.d)),
					kd: toNumber(top?.kd),
					kr: toNumber(top?.kr),
					adr: toNumber(top?.adr),
				},
			};
		});
	} catch {
		return (team.jogadores || []).map((rawPlayer) => ({
			faceitGuid: String(rawPlayer?.faceit_guid || "").trim().toLowerCase(),
			nickname: String(rawPlayer?.nickname || "Jogador"),
			avatar: DEFAULT_AVATAR,
			stats: {
				kills: 0,
				deaths: 0,
				kd: 0,
				kr: 0,
				adr: 0,
			},
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

	const [bannerImageUrl, bannerConfig] = await Promise.all([
		resolveBannerImageUrl(team.nome_time),
		env ? loadBannerConfig(env, team.nome_time) : Promise.resolve(null),
	]);

	const players = env ? await loadTeamPlayers(env, team, bannerConfig) : [];

	return (
		<TeamDetailClient
			teamName={team.nome_time}
			bannerImageUrl={bannerImageUrl}
			initialBannerConfig={bannerConfig}
			players={players}
		/>
	);
}

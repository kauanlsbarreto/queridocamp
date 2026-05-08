import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection, createJogadoresConnection } from "@/lib/db";
import type { Env } from "@/lib/db";
import { promises as fs } from "node:fs";
import path from "node:path";
import JogosPageClient, { type ConfirmedGame } from "./JogosPageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_JOGOS_QUERY_TIMEOUT_MS || 5000);

type TeamJson = {
	nome_time: string;
	jogadores: Array<{ nickname: string; faceit_guid: string }>;
};

let cachedTeamsMapByCaptainGuid: { expiresAt: number; data: Map<string, string> } | null = null;

function toIsoDate(value: unknown) {
	if (!value) return "";
	if (value instanceof Date && Number.isFinite(value.getTime())) {
		return value.toISOString().slice(0, 10);
	}
	const raw = String(value).trim();
	const isoLike = raw.match(/^(\d{4}-\d{2}-\d{2})/);
	if (isoLike) return isoLike[1];
	const parsed = new Date(raw);
	if (Number.isFinite(parsed.getTime())) {
		return parsed.toISOString().slice(0, 10);
	}
	return raw.slice(0, 10);
}

function toHourMinute(value: unknown) {
	if (!value) return "";
	if (value instanceof Date && Number.isFinite(value.getTime())) {
		return value.toISOString().slice(11, 16);
	}
	const raw = String(value).trim();
	const hhmm = raw.match(/^(\d{2}:\d{2})/);
	if (hhmm) return hhmm[1];
	const parsed = new Date(raw);
	if (Number.isFinite(parsed.getTime())) {
		return parsed.toISOString().slice(11, 16);
	}
	return raw.slice(0, 5);
}

async function loadTeamsMapByCaptainGuid() {
	const now = Date.now();
	if (cachedTeamsMapByCaptainGuid && cachedTeamsMapByCaptainGuid.expiresAt > now) {
		return cachedTeamsMapByCaptainGuid.data;
	}

	const map = new Map<string, string>();
	try {
		const raw = await fs.readFile(path.join(process.cwd(), "copadraft-times.json"), "utf8");
		const parsed = JSON.parse(raw);
		const teams: TeamJson[] = Array.isArray(parsed) ? parsed : [];

		for (const team of teams) {
			const teamName = String(team?.nome_time || "").trim();
			const captainGuid = String(team?.jogadores?.[0]?.faceit_guid || "").trim().toLowerCase();
			if (teamName && captainGuid) map.set(captainGuid, teamName);
		}
	} catch {
		// keep map empty and fallback to team ids
	}

	cachedTeamsMapByCaptainGuid = {
		expiresAt: now + 60000,
		data: map,
	};

	return map;
}

async function loadConfirmedGames(env: Env): Promise<ConfirmedGame[]> {
	let mainConn: any = null;
	let jogadoresConn: any = null;

	try {
		[mainConn, jogadoresConn] = await Promise.all([
			createMainConnection(env),
			createJogadoresConnection(env),
		]);

		const [rows]: any = await mainConn.query({
			sql: `SELECT id, challenger_team_id, challenged_team_id, rodada, proposed_date, proposed_time
						FROM matches
						WHERE status = 'accepted'
							AND proposed_date IS NOT NULL
							AND proposed_time IS NOT NULL
						ORDER BY proposed_date ASC, proposed_time ASC, id ASC`,
			timeout: QUERY_TIMEOUT_MS,
		});

		const matches = Array.isArray(rows) ? rows : [];
		if (matches.length === 0) return [];

		const teamIds = Array.from(
			new Set(
				matches
					.flatMap((m: any) => [Number(m?.challenger_team_id), Number(m?.challenged_team_id)])
					.filter((id) => Number.isInteger(id) && id > 0)
			)
		);

		const teamIdToName = new Map<number, string>();
		if (teamIds.length > 0) {
			const placeholders = teamIds.map(() => "?").join(",");
			const [captains]: any = await jogadoresConn.query(
				{
					sql: `SELECT id, faceit_guid FROM jogadores WHERE pote = 1 AND id IN (${placeholders})`,
					timeout: QUERY_TIMEOUT_MS,
				},
				teamIds
			);

			const byGuid = await loadTeamsMapByCaptainGuid();
			if (Array.isArray(captains)) {
				for (const row of captains as any[]) {
					const id = Number(row?.id || 0);
					const guid = String(row?.faceit_guid || "").trim().toLowerCase();
					if (id > 0) {
						teamIdToName.set(id, byGuid.get(guid) || `Time ${id}`);
					}
				}
			}
		}

		return matches.map((m: any) => {
			const team1Id = Number(m?.challenger_team_id || 0);
			const team2Id = Number(m?.challenged_team_id || 0);
			const date = toIsoDate(m?.proposed_date);
			const time = toHourMinute(m?.proposed_time);

			return {
				id: Number(m?.id || 0),
				rodada: m?.rodada != null ? Number(m.rodada) : null,
				date,
				time,
				team1: teamIdToName.get(team1Id) || `Time ${team1Id}`,
				team2: teamIdToName.get(team2Id) || `Time ${team2Id}`,
			} satisfies ConfirmedGame;
		});
	} catch (error) {
		console.error("[copadraft/jogos] erro ao carregar jogos confirmados:", error);
		return [];
	} finally {
		await Promise.allSettled([mainConn?.end?.(), jogadoresConn?.end?.()]);
	}
}

export default async function JogosPage() {
	let games: ConfirmedGame[] = [];

	try {
		const ctx = await getCloudflareContext({ async: true });
		const env = ctx.env as unknown as Env;
		games = await loadConfirmedGames(env);
	} catch {
		games = [];
	}

	return <JogosPageClient games={games} />;
}

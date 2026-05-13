import { createMainConnection, createJogadoresConnection } from "@/lib/db";
import type { Env } from "@/lib/db";
import { getTeamNameByCaptainGuidMap } from "@/lib/copadraft-times";
import JogosPageClient, { type ConfirmedGame } from "./JogosPageClient";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MatchRow = {
	id: number;
	challenger_team_id: number;
	challenged_team_id: number;
	rodada: number | null;
	proposed_date: unknown;
	proposed_time: unknown;
};

type JogoScoreRow = {
	rodada: number | null;
	time1: string;
	time2: string;
	placar: string | null;
};

const QUERY_TIMEOUT_MS = Number(process.env.COPADRAFT_JOGOS_QUERY_TIMEOUT_MS || 5000);
const JOGOS_LOAD_TIMEOUT_MS = Number(process.env.COPADRAFT_JOGOS_LOAD_TIMEOUT_MS || 3500);

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		const timeoutPromise = new Promise<never>((_, reject) => {
			timer = setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
		});
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timer) clearTimeout(timer);
	}
}

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

function normalizeText(value: unknown) {
	return String(value || "")
		.trim()
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

function buildGameKey(rodada: number | null, team1: string, team2: string) {
	if (!Number.isInteger(rodada) || Number(rodada) <= 0) return "";
	const names = [normalizeText(team1), normalizeText(team2)].filter(Boolean).sort();
	if (names.length !== 2) return "";
	return `${Number(rodada)}::${names[0]}::${names[1]}`;
}

function buildTeamsOnlyKey(team1: string, team2: string) {
	const names = [normalizeText(team1), normalizeText(team2)].filter(Boolean).sort();
	if (names.length !== 2) return "";
	return `${names[0]}::${names[1]}`;
}

async function loadConfirmedGames(env: Env): Promise<ConfirmedGame[]> {
	let mainConn: any = null;
	let jogadoresConn: any = null;

	try {
		mainConn = await createMainConnection(env);

		const [rows]: any = await mainConn.query({
			sql: `SELECT id, challenger_team_id, challenged_team_id, rodada, proposed_date, proposed_time
						FROM matches
						WHERE status = 'accepted'
							AND proposed_date IS NOT NULL
							AND proposed_time IS NOT NULL
						ORDER BY proposed_date ASC, proposed_time ASC, id ASC`,
			timeout: QUERY_TIMEOUT_MS,
		});

		const matches = (Array.isArray(rows) ? rows : []) as MatchRow[];
		if (matches.length === 0) return [];

		const [jogosRowsRaw]: any = await mainConn.query({
			sql: "SELECT rodada, time1, time2, placar FROM jogos",
			timeout: QUERY_TIMEOUT_MS,
		});
		const jogosRows = (Array.isArray(jogosRowsRaw) ? jogosRowsRaw : []) as JogoScoreRow[];
		const scoreByGameKey = new Map<string, string>();
		const scoreByTeamsOnlyKey = new Map<string, string>();

		for (const row of jogosRows) {
			const score = String(row?.placar || "").trim();
			if (!score) continue;
			const key = buildGameKey(Number(row?.rodada || 0), row?.time1, row?.time2);
			if (key) scoreByGameKey.set(key, score);
			const teamsOnlyKey = buildTeamsOnlyKey(row?.time1, row?.time2);
			if (teamsOnlyKey) scoreByTeamsOnlyKey.set(teamsOnlyKey, score);
		}

		const teamIds = Array.from(
			new Set(
				matches
					.flatMap((m: any) => [Number(m?.challenger_team_id), Number(m?.challenged_team_id)])
					.filter((id) => Number.isInteger(id) && id > 0)
			)
		);

		const teamIdToName = new Map<number, string>();
		if (teamIds.length > 0) {
			jogadoresConn = await createJogadoresConnection(env);
			const placeholders = teamIds.map(() => "?").join(",");
			const [captains]: any = await jogadoresConn.query(
				{
					sql: `SELECT id, faceit_guid FROM jogadores WHERE pote = 1 AND id IN (${placeholders})`,
					timeout: QUERY_TIMEOUT_MS,
				},
				teamIds
			);

			const byGuid = getTeamNameByCaptainGuidMap();
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

		const resolvedGames = matches.map((m: MatchRow) => {
			const team1Id = Number(m?.challenger_team_id || 0);
			const team2Id = Number(m?.challenged_team_id || 0);
			const team1Name = teamIdToName.get(team1Id) || `Time ${team1Id}`;
			const team2Name = teamIdToName.get(team2Id) || `Time ${team2Id}`;
			const rodada = m?.rodada != null ? Number(m.rodada) : null;
			const scoreKey = buildGameKey(rodada, team1Name, team2Name);
			const teamsOnlyKey = buildTeamsOnlyKey(team1Name, team2Name);
			const score =
				(scoreKey ? scoreByGameKey.get(scoreKey) : undefined) ||
				(teamsOnlyKey ? scoreByTeamsOnlyKey.get(teamsOnlyKey) : undefined) ||
				null;
			const date = toIsoDate(m?.proposed_date);
			const time = toHourMinute(m?.proposed_time);

			return {
				id: Number(m?.id || 0),
				rodada,
				date,
				time,
				team1: team1Name,
				team2: team2Name,
				score,
				isPlayed: Boolean(score),
			} satisfies ConfirmedGame;
		});

		return resolvedGames;
	} catch (error) {
		console.error("[copadraft/jogos] erro ao carregar jogos confirmados:", error);
		throw error; // propaga para não cachear falha de DB
	} finally {
		await Promise.allSettled([mainConn?.end?.(), jogadoresConn?.end?.()]);
	}
}

async function refreshJogosData(env: Env) {
	return withTimeout(loadConfirmedGames(env), JOGOS_LOAD_TIMEOUT_MS, "jogos page load");
}

export default async function JogosPage() {
	let games: ConfirmedGame[] = [];

	try {
		const env = await getRuntimeEnv() as Env;
		games = await refreshJogosData(env);
	} catch (err) {
		console.error("[copadraft/jogos] erro na página:", err);
		games = [];
	}

	return <JogosPageClient games={games} />;
}

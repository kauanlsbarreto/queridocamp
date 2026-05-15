import { createMainConnection, type Env } from "@/lib/db";
import { getRuntimeEnv } from "@/lib/runtime-env";
import ClassificacaoAdGate from "./ClassificacaoAdGate";
import TeamFlagImage from "./TeamFlagImage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RawGroupRow = Record<string, unknown>;

type StandingRow = {
	teamName: string;
	wins: number;
	losses: number;
	sp: number;
	points: number;
};

const GROUP_A_TEAMS = [
	"Alemanha",
	"Espanha",
	"Bélgica",
	"Itália",
	"França",
	"Japão",
	"Portugal",
] as const;

const GROUP_B_TEAMS = [
	"Brasil",
	"México",
	"Holanda",
	"Argentina",
	"Croácia",
	"Inglaterra",
	"Uruguai",
] as const;

function normalizeText(value: unknown) {
	return String(value || "")
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.trim()
		.toLowerCase();
}

function toNumber(value: unknown) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function getNumberFromRow(row: RawGroupRow, keys: string[]) {
	for (const key of keys) {
		if (row[key] !== undefined && row[key] !== null) {
			return toNumber(row[key]);
		}
	}
	return 0;
}

function getTeamNameFromRow(row: RawGroupRow) {
	const candidates = ["team_name", "time", "nome_time", "nome", "name", "team"];
	for (const key of candidates) {
		const value = String(row[key] || "").trim();
		if (value) return value;
	}
	return "";
}

function makeZeroTable(teams: readonly string[]): StandingRow[] {
	return teams.map((teamName) => ({
		teamName,
		wins: 0,
		losses: 0,
		sp: 0,
		points: 0,
	}));
}

async function loadGroupStandings(connection: any, tableName: string, teams: readonly string[]) {
	const normalizedExpected = new Map(teams.map((name) => [normalizeText(name), name]));
	const rowsByTeam = new Map<string, StandingRow>();

	for (const teamName of teams) {
		rowsByTeam.set(normalizeText(teamName), {
			teamName,
			wins: 0,
			losses: 0,
			sp: 0,
			points: 0,
		});
	}

	async function applyTableRows(table: string) {
		const [rows] = (await connection.query(`SELECT * FROM ${table}`)) as [RawGroupRow[], unknown];

		for (const row of Array.isArray(rows) ? rows : []) {
			const rawName = getTeamNameFromRow(row);
			const normalized = normalizeText(rawName);
			const canonicalName = normalizedExpected.get(normalized);
			if (!canonicalName) continue;

			const existing = rowsByTeam.get(normalized) ?? { teamName: canonicalName, wins: 0, losses: 0, sp: 0, points: 0 };
			rowsByTeam.set(normalized, {
				teamName: canonicalName,
				wins: existing.wins + getNumberFromRow(row, ["vitorias", "wins", "win"]),
				losses: existing.losses + getNumberFromRow(row, ["derrotas", "losses", "loss"]),
				sp: existing.sp + getNumberFromRow(row, ["sp", "saldo", "saldo_rounds", "round_diff", "df"]),
				points: existing.points + getNumberFromRow(row, ["pontuacao", "points", "pontos", "score"]),
			});
		}
	}

	try {
		await applyTableRows(tableName);
	} catch (error) {
		console.error(`[copadraft/classificacao] falha ao consultar ${tableName}:`, error);
		return makeZeroTable(teams);
	}

	try {
		await applyTableRows(`${tableName}_somar`);
	} catch {
		// tabela _somar pode não existir ainda — ignorar silenciosamente
	}

	return teams
		.map((team) => rowsByTeam.get(normalizeText(team)) || { teamName: team, wins: 0, losses: 0, sp: 0, points: 0 })
		.sort((a, b) => {
			if (b.points !== a.points) return b.points - a.points;
			if (b.sp !== a.sp) return b.sp - a.sp;
			if (b.wins !== a.wins) return b.wins - a.wins;
			return a.losses - b.losses;
		});
}

function getSpColor(value: number) {
	if (value > 0) return "text-emerald-300";
	if (value < 0) return "text-red-300";
	return "text-sky-200";
}

function getPointsColor(value: number) {
	if (value >= 10) return "text-emerald-300";
	if (value >= 4) return "text-yellow-200";
	return "text-orange-200";
}

function TeamCell({ teamName }: { teamName: string }) {
	return (
		<div className="w-full">
			<div
				className="flex h-11 items-center gap-2 bg-[#ff8c00] px-4 text-left shadow-[0_6px_18px_rgba(0,0,0,0.32)]"
				style={{ clipPath: "polygon(0 0, 93% 0, 100% 50%, 93% 100%, 0 100%, 4% 50%)" }}
			>
				<TeamFlagImage teamName={teamName} />
				<span className="truncate text-sm font-bold uppercase tracking-wide text-white">{teamName}</span>
			</div>
		</div>
	);
}

function GroupTable({ title, rows }: { title: string; rows: StandingRow[] }) {
	return (
		<section className="rounded-2xl border border-cyan-200/30 bg-[#05204e]/80 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.36)] backdrop-blur-sm">
			<h2 className="mb-4 text-center text-2xl font-black uppercase tracking-[0.18em] text-yellow-300">{title}</h2>

			<div className="overflow-hidden rounded-xl border border-white/10">
				<div className="grid grid-cols-[minmax(0,1.85fr)_0.6fr_0.6fr_0.7fr_0.9fr] items-center gap-2 bg-[#0b2d6f] px-3 py-3 text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100 md:text-xs">
					<div>Time</div>
					<div className="text-center">Vit</div>
					<div className="text-center">Der</div>
					<div className="text-center">SP</div>
					<div className="text-center">Pontuacao</div>
				</div>

				<div className="divide-y divide-white/10 bg-[#081d44]/85">
					{rows.map((row) => (
						<div
							key={normalizeText(row.teamName)}
							className="grid grid-cols-[minmax(0,1.85fr)_0.6fr_0.6fr_0.7fr_0.9fr] items-center gap-2 px-3 py-2"
						>
							<TeamCell teamName={row.teamName} />
							<div className="text-center text-sm font-bold text-cyan-100">{row.wins}</div>
							<div className="text-center text-sm font-bold text-red-300">{row.losses}</div>
							<div className={`text-center text-sm font-bold ${getSpColor(row.sp)}`}>
								{row.sp > 0 ? `+${row.sp}` : row.sp}
							</div>
							<div className={`text-center text-sm font-bold ${getPointsColor(row.points)}`}>{row.points}</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

export default async function CopaDraftClassificacaoPage() {
	let connection: any;

	try {
		const env = (await getRuntimeEnv()) as Env;
		connection = await createMainConnection(env);

		const [groupA, groupB] = await Promise.all([
			loadGroupStandings(connection, "grupo_a", GROUP_A_TEAMS),
			loadGroupStandings(connection, "grupo_b", GROUP_B_TEAMS),
		]);

		return (
			<ClassificacaoAdGate>
				<main className="relative min-h-screen overflow-hidden bg-[#030a1e] px-4 py-10 text-white">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(56,189,248,0.22),transparent_45%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_35%),linear-gradient(125deg,rgba(14,165,233,0.18),transparent_35%)]" />
					<div className="pointer-events-none absolute inset-0 opacity-40 [background:linear-gradient(120deg,transparent_0%,transparent_35%,rgba(56,189,248,0.35)_50%,transparent_65%,transparent_100%)]" />

					<div className="relative mx-auto max-w-6xl">
						<header className="mb-8 text-center">
							<p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-100/90">Copa Draft</p>
							<h1 className="mt-2 text-3xl font-black uppercase tracking-[0.1em] text-white md:text-5xl">Classificacao</h1>
						</header>

						<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
							<GroupTable title="Grupo A" rows={groupA} />
							<GroupTable title="Grupo B" rows={groupB} />
						</div>
					</div>
				</main>
			</ClassificacaoAdGate>
		);
	} catch (error) {
		console.error("[copadraft/classificacao] erro ao carregar pagina:", error);
		return <div className="py-14 text-center text-white">Erro ao carregar classificacao.</div>;
	} finally {
		await connection?.end?.();
	}
}

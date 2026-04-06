import SideAds from "@/components/side-ads";
import QueridaFilaPartidasClient, { type FaceitQueueMatch } from "./partidas-cliente";

export const revalidate = 1800;

const API_KEY_FACEIT = "7b080715-fe0b-461d-a1f1-62cfd0c47e63";
const QUEUE_ID = "c23c971b-677a-4046-8203-26023e283529";

async function getQueueMatches(): Promise<FaceitQueueMatch[]> {
	const response = await fetch(
		`https://open.faceit.com/data/v4/hubs/${QUEUE_ID}/matches?type=past&offset=0&limit=100`,
		{
			headers: { Authorization: `Bearer ${API_KEY_FACEIT}` },
			next: { revalidate, tags: ["queridafila-partidas"] },
		}
	);

	if (!response.ok) {
		throw new Error(`Erro ao buscar partidas da Querida Fila: ${response.status}`);
	}

	const data = await response.json();
	const items = Array.isArray(data?.items) ? data.items : [];

	return items
		.filter((match: FaceitQueueMatch) => match.status === "FINISHED")
		.sort((a: FaceitQueueMatch, b: FaceitQueueMatch) => {
			const timeA = b.finished_at || b.started_at || 0;
			const timeB = a.finished_at || a.started_at || 0;
			return timeA - timeB;
		});
}

export default async function QueridaFilaPartidasPage() {
	try {
		const matches = await getQueueMatches();

		return (
			<>
				<SideAds />
				<QueridaFilaPartidasClient matchesData={matches} />
			</>
		);
	} catch (error) {
		console.error("Erro ao carregar partidas da Querida Fila:", error);

		return (
			<div className="min-h-screen bg-black text-white flex items-center justify-center px-6 text-center">
				<h1 className="text-2xl font-bold text-red-500">Erro ao carregar partidas da Querida Fila.</h1>
			</div>
		);
	}
}

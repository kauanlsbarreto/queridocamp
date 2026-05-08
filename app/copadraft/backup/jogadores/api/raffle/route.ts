import { createJogadoresConnection } from '@/lib/db';
import { NextResponse } from 'next/server';

const MIN_COSTS: Record<number, number> = {
	2: 150000,
	3: 100000,
	4: 75000,
	5: 50000,
};

function shuffleArray<T>(array: T[]): T[] {
	const arr = [...array];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export async function PUT(request: Request) {
	let conn: any;

	try {
		const { poteAlSortear } = await request.json();

		if (!poteAlSortear || ![2, 3, 4, 5].includes(poteAlSortear)) {
			return NextResponse.json({ error: 'Pote inválido' }, { status: 400 });
		}

		conn = await createJogadoresConnection({});

		// Get all teams (pote 1 capitães)
		const [teamsResult]: any = await conn.query(
			'SELECT id, dinheiro FROM jogadores WHERE pote = 1 ORDER BY id'
		);

		const teams = Array.isArray(teamsResult) ? teamsResult : [];

		if (teams.length === 0) {
			return NextResponse.json({ error: 'Nenhum time encontrado' }, { status: 400 });
		}

		// Get all available players from the requested pote (no timeid)
		const [playersResult]: any = await conn.query(
			'SELECT id FROM jogadores WHERE pote = ? AND timeid IS NULL ORDER BY id',
			[poteAlSortear]
		);

		const availablePlayers = Array.isArray(playersResult) ? playersResult.map((p: any) => p.id) : [];

		if (availablePlayers.length === 0) {
			return NextResponse.json({ error: 'Nenhum jogador disponível neste pote' }, { status: 400 });
		}

		// Shuffle players
		const shuffledPlayers = shuffleArray(availablePlayers);

		// Assign players to teams
		const updates: Array<{ jogadorId: number; timeid: number; capitaoId?: number; novoDinheiro?: number }> = [];
		const minCost = MIN_COSTS[poteAlSortear];

		for (let i = 0; i < shuffledPlayers.length; i++) {
			const playerId = shuffledPlayers[i];
			const team = teams[i % teams.length]; // Round-robin assignment

			// Assign player to team
			await conn.query(
				'UPDATE jogadores SET timeid = ? WHERE id = ?',
				[team.id, playerId]
			);

			updates.push({
				jogadorId: playerId,
				timeid: team.id,
			});

			// Deduct cost from team captain (allow negative)
			const newDinheiro = team.dinheiro - minCost;
			team.dinheiro = newDinheiro; // Update for next iteration

			await conn.query(
				'UPDATE jogadores SET dinheiro = ? WHERE id = ?',
				[newDinheiro, team.id]
			);

			updates.push({
				jogadorId: team.id,
				timeid: team.id,
				capitaoId: team.id,
				novoDinheiro: newDinheiro,
			});
		}

		return NextResponse.json({ success: true, updates }, { status: 200 });
	} catch (error) {
		console.error('Raffle error:', error);
		return NextResponse.json({ error: 'Erro ao sortear pote' }, { status: 500 });
	} finally {
		if (conn) await conn.end().catch(() => {});
	}
}


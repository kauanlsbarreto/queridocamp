import { NextResponse } from 'next/server';
import { createJogadoresConnection } from '@/lib/db';

export async function PUT(req: Request) {
	let conn: any;

	try {
		conn = await createJogadoresConnection({});

		// Update all jogadores: clear pote, timeid, and set dinheiro to 0
		const [result]: any = await conn.query(
			'UPDATE jogadores SET pote = NULL, timeid = NULL, dinheiro = 0'
		);

		return NextResponse.json({ 
			ok: true, 
			affectedRows: result?.affectedRows || 0 
		}, { status: 200 });
	} catch (error) {
		console.error('Reset all data error:', error);
		return NextResponse.json({ error: 'Erro ao limpar dados' }, { status: 500 });
	} finally {
		if (conn) await conn.end().catch(() => {});
	}
}

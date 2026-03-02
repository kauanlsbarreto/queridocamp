import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, Env } from '@/lib/db';

interface RouteParams {
    params: { id: string };
}

export async function PUT(request: Request, { params }: RouteParams) {
    let connection;
    try {
        const { id } = params;
        const match = await request.json();
        const { team1_name, team1_avatar, team2_name, team2_avatar, scheduled_time, live_enabled, live_platform } = match;

        const ctx = getCloudflareContext();
        connection = await createMainConnection(ctx.env as unknown as Env);

        const query = `
            UPDATE scheduled_matches
            SET team1_name = ?, team1_avatar = ?, team2_name = ?, team2_avatar = ?, scheduled_time = ?, live_enabled = ?, live_platform = ?
            WHERE id = ?
        `;

        await connection.execute(query, [team1_name, team1_avatar, team2_name, team2_avatar, scheduled_time, live_enabled, live_platform, id]);

        return NextResponse.json({ message: 'Match updated', id, ...match });
    } catch (error) {
        console.error(`Error updating match ${params.id}:`, error);
        return NextResponse.json({ message: 'Error updating match' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

export async function DELETE(request: Request, { params }: RouteParams) {
    let connection;
    try {
        const { id } = params;

        const ctx = getCloudflareContext();
        connection = await createMainConnection(ctx.env as unknown as Env);

        const [result] = await connection.execute('DELETE FROM scheduled_matches WHERE id = ?', [id]);

        const affectedRows = (result as any).affectedRows;
        if (affectedRows === 0) {
            return NextResponse.json({ message: 'Match not found' }, { status: 404 });
        }

        return NextResponse.json({ message: `Match ${id} deleted` });
    } catch (error) {
        console.error(`Error deleting match ${params.id}:`, error);
        return NextResponse.json({ message: 'Error deleting match' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

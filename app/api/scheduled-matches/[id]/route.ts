import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, Env } from '@/lib/db';
import mysql from 'mysql2';

interface RouteParams {
    params: { id: string };
}

export async function PUT(request: Request, { params }: RouteParams) {
    let connection;
    try {
        const { id } = params;
        const match = await request.json();
        const { team1_name, team1_avatar, team2_name, team2_avatar, scheduled_time, live_enabled, live_platform } = match;

        // Converte a string de datetime-local (YYYY-MM-DDTHH:mm) para o formato DATETIME do MySQL (YYYY-MM-DD HH:MI:SS)
        const mysqlScheduledTime = scheduled_time.replace('T', ' ') + ':00';

        const ctx = getCloudflareContext();
        connection = await createMainConnection(ctx.env as unknown as Env);

        const query = `
            UPDATE scheduled_matches
            SET team1_name = ?, team1_avatar = ?, team2_name = ?, team2_avatar = ?, scheduled_time = ?, live_enabled = ?, live_platform = ?
            WHERE id = ?
        `;

        const formattedQuery = mysql.format(query, [team1_name, team1_avatar, team2_name, team2_avatar, mysqlScheduledTime, live_enabled, live_platform || null, id]);
        await connection.query(formattedQuery);

        return NextResponse.json({ message: 'Match updated', id, ...match });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error(`Error updating match ${params.id}:`, error);
        return NextResponse.json({ message: 'Error updating match', error: errorMessage }, { status: 500 });
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

        const query = 'DELETE FROM scheduled_matches WHERE id = ?';
        const formattedQuery = mysql.format(query, [id]);
        const [result] = await connection.query(formattedQuery);

        const affectedRows = (result as any).affectedRows;
        if (affectedRows === 0) {
            return NextResponse.json({ message: 'Match not found' }, { status: 404 });
        }

        return NextResponse.json({ message: `Match ${id} deleted` });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error(`Error deleting match ${params.id}:`, error);
        return NextResponse.json({ message: 'Error deleting match', error: errorMessage }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

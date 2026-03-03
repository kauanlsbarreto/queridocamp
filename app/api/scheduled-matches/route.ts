import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection, Env } from '@/lib/db';
import mysql from 'mysql2';

// GET all scheduled matches
export async function GET() {
    let connection;
    try {
        const ctx = getCloudflareContext();
        connection = await createMainConnection(ctx.env as unknown as Env);
        const [rows] = await connection.query('SELECT * FROM scheduled_matches ORDER BY scheduled_time ASC');
        return NextResponse.json(rows);
    } catch (error) {
        console.error('Error fetching scheduled matches:', error);
        return NextResponse.json({ message: 'Error fetching matches' }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

// POST a new scheduled match
export async function POST(request: Request) {
    let connection;
    try {
        const match = await request.json();
        const { team1_name, team1_avatar, team2_name, team2_avatar, scheduled_time, live_enabled, live_platform } = match;

        // Converte a string de datetime-local (YYYY-MM-DDTHH:mm) para o formato DATETIME do MySQL (YYYY-MM-DD HH:MI:SS)
        const mysqlScheduledTime = scheduled_time.replace('T', ' ') + ':00';

        const ctx = getCloudflareContext();
        connection = await createMainConnection(ctx.env as unknown as Env);

        const query = `
            INSERT INTO scheduled_matches (team1_name, team1_avatar, team2_name, team2_avatar, scheduled_time, live_enabled, live_platform)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        const formattedQuery = mysql.format(query, [team1_name, team1_avatar, team2_name, team2_avatar, mysqlScheduledTime, live_enabled, live_platform || null]);
        const [result] = await connection.query(formattedQuery);
        
        const insertId = (result as any).insertId;

        return NextResponse.json({ message: 'Match created', id: insertId, ...match }, { status: 201 });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        console.error('Error creating scheduled match:', error);
        return NextResponse.json({ message: 'Error creating match', error: errorMessage }, { status: 500 });
    } finally {
        if (connection) await connection.end();
    }
}

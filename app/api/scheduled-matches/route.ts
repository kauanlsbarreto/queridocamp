import { NextResponse } from 'next/server';
import { getRuntimeEnv } from '@/lib/runtime-env';
import { createMainConnection, Env } from '@/lib/db';
import mysql from 'mysql2';

function normalizeTeamName(value: unknown) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function buildTeamsKey(team1: unknown, team2: unknown) {
    const names = [normalizeTeamName(team1), normalizeTeamName(team2)].filter(Boolean).sort();
    if (names.length !== 2) return '';
    return `${names[0]}::${names[1]}`;
}

// GET all scheduled matches
export async function GET() {
    let connection;
    try {
        const env = await getRuntimeEnv();
        connection = await createMainConnection(env);

        const [scheduledRows] = await connection.query('SELECT * FROM scheduled_matches ORDER BY scheduled_time ASC');
        const [jogosRows] = await connection.query('SELECT time1, time2, matchid FROM jogos');

        const matchIdByTeams = new Map<string, string>();
        if (Array.isArray(jogosRows)) {
            for (const row of jogosRows as any[]) {
                const key = buildTeamsKey(row?.time1, row?.time2);
                const matchid = String(row?.matchid || '').trim();
                if (!key || !matchid) continue;
                if (!matchIdByTeams.has(key)) {
                    matchIdByTeams.set(key, matchid);
                }
            }
        }

        const enriched = Array.isArray(scheduledRows)
            ? (scheduledRows as any[]).map((row) => {
                const key = buildTeamsKey(row?.team1_name, row?.team2_name);
                const prediction_matchid = key ? matchIdByTeams.get(key) || null : null;
                return {
                    ...row,
                    prediction_matchid,
                };
            })
            : [];

        return NextResponse.json(enriched);
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

        const env = await getRuntimeEnv();
        connection = await createMainConnection(env);

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

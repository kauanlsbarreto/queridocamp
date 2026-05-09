import { NextResponse } from 'next/server';
import { getRuntimeEnv } from '@/lib/runtime-env';
import { createMainConnection } from '@/lib/db';
import { getDatabaseLastUpdate } from '@/lib/last-update';

export const dynamic = 'force-dynamic';

const deployTime = new Date().toISOString();

export async function GET() {
  let connection;
  try {
    const env = await getRuntimeEnv();
    connection = await createMainConnection(env);
    const lastUpdate = await getDatabaseLastUpdate(connection);

    return NextResponse.json({ 
      lastUpdate: lastUpdate || deployTime 
    }, {
      headers: {
        'Cache-Control': 'no-store, max-age=0, must-revalidate',
      }
    });
  } catch (error) {
    return NextResponse.json({ lastUpdate: deployTime });
  } finally {
    if (connection) await connection.end();
  }
}
import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  let connection;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    
    connection = await createMainConnection(env);
    
    const [rows]: any = await connection.query(
      "SELECT value FROM site_metadata WHERE key_name = 'last_update'"
    );

    return NextResponse.json({ 
      lastUpdate: rows[0]?.value || new Date().toISOString() 
    });
  } catch (error) {
    return NextResponse.json({ lastUpdate: new Date().toISOString() });
  } finally {
    if (connection) await connection.end();
  }
}
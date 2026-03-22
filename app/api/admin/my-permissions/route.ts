import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';
import {
  ensurePermissionsSchema,
  hasPermission,
  getPlayerPermissions,
  PERMISSION_KEYS,
} from '@/lib/permissions';

export const dynamic = 'force-dynamic';


export async function GET(request: Request) {
  let connection;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    const { searchParams } = new URL(request.url);
    const faceitGuid = searchParams.get('faceit_guid');

    if (!faceitGuid) {
      return NextResponse.json({ permissions: [] });
    }

    connection = await createMainConnection(env);
    await ensurePermissionsSchema(connection);

    const [rows]: any = await connection.query(
      'SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1',
      [faceitGuid]
    );
    if (!rows.length || rows[0].admin < 1) {
      return NextResponse.json({ permissions: [] });
    }

    const permissions = await getPlayerPermissions(connection, faceitGuid);
    return NextResponse.json({ permissions });
  } catch (error) {
    console.error('Error fetching my permissions:', error);
    return NextResponse.json({ permissions: [] });
  } finally {
    if (connection) await connection.end();
  }
}

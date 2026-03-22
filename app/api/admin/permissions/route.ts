import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';
import {
  ensurePermissionsSchema,
  hasPermission,
  PERMISSIONS_LIST,
  PERMISSION_KEYS,
} from '@/lib/permissions';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/permissions?faceit_guid=...
 * Returns all permission definitions with which admin levels hold each.
 * Requires MANAGE_ADMINS permission or admin level 1.
 */
export async function GET(request: Request) {
  let connection;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    const { searchParams } = new URL(request.url);
    const faceitGuid = searchParams.get('faceit_guid');

    if (!faceitGuid) {
      return NextResponse.json({ message: 'faceit_guid obrigatório' }, { status: 401 });
    }

    connection = await createMainConnection(env);
    await ensurePermissionsSchema(connection);

    const [requesterRows]: any = await connection.query(
      'SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1',
      [faceitGuid]
    );
    if (!requesterRows.length) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }
    const requesterLevel = requesterRows[0].admin as number;
    const canManage =
      requesterLevel === 1 ||
      (await hasPermission(connection, faceitGuid, PERMISSION_KEYS.MANAGE_ADMINS));
    if (!canManage) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    // All granted permissions keyed by admin_level
    const [grantedRows]: any = await connection.query(
      'SELECT permission_key, admin_level FROM admin_permissions'
    );

    const permissionMap: Record<string, number[]> = {};
    for (const row of grantedRows as any[]) {
      if (!permissionMap[row.permission_key]) permissionMap[row.permission_key] = [];
      permissionMap[row.permission_key].push(Number(row.admin_level));
    }

    const permissions = PERMISSIONS_LIST.map((p) => ({
      ...p,
      grantedToLevels: permissionMap[p.key] ?? [],
    }));

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * POST /api/admin/permissions
 * Body: { requester_guid, permission_key, admin_level }
 * Grants a permission to an admin level (2–5).
 */
export async function POST(request: Request) {
  let connection;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    const body = await request.json().catch(() => ({}));
    const { requester_guid, permission_key, admin_level } = body as Record<string, any>;

    const level = Number(admin_level);
    if (!requester_guid || !permission_key || !level || level < 2 || level > 5) {
      return NextResponse.json({ message: 'Campos obrigatórios ausentes ou inválidos.' }, { status: 400 });
    }

    connection = await createMainConnection(env);
    await ensurePermissionsSchema(connection);

    const [requesterRows]: any = await connection.query(
      'SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1',
      [requester_guid]
    );
    if (!requesterRows.length) {
      return NextResponse.json({ message: 'Solicitante não encontrado.' }, { status: 403 });
    }
    const requesterLevel = requesterRows[0].admin as number;
    const canManage =
      requesterLevel === 1 ||
      (await hasPermission(connection, requester_guid, PERMISSION_KEYS.MANAGE_ADMINS));
    if (!canManage) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    await connection.query(
      'INSERT IGNORE INTO admin_permissions (permission_key, admin_level) VALUES (?, ?)',
      [permission_key, level]
    );

    return NextResponse.json({ message: 'Permissão concedida.' });
  } catch (error) {
    console.error('Error granting permission:', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

/**
 * DELETE /api/admin/permissions
 * Body: { requester_guid, permission_key, admin_level }
 * Revokes a permission from an admin level.
 */
export async function DELETE(request: Request) {
  let connection;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    const body = await request.json().catch(() => ({}));
    const { requester_guid, permission_key, admin_level } = body as Record<string, any>;

    const level = Number(admin_level);
    if (!requester_guid || !permission_key || !level || level < 2 || level > 5) {
      return NextResponse.json({ message: 'Campos obrigatórios ausentes ou inválidos.' }, { status: 400 });
    }

    connection = await createMainConnection(env);
    await ensurePermissionsSchema(connection);

    const [requesterRows]: any = await connection.query(
      'SELECT admin FROM players WHERE faceit_guid = ? LIMIT 1',
      [requester_guid]
    );
    if (!requesterRows.length) {
      return NextResponse.json({ message: 'Solicitante não encontrado.' }, { status: 403 });
    }
    const requesterLevel = requesterRows[0].admin as number;
    const canManage =
      requesterLevel === 1 ||
      (await hasPermission(connection, requester_guid, PERMISSION_KEYS.MANAGE_ADMINS));
    if (!canManage) {
      return NextResponse.json({ message: 'Acesso negado.' }, { status: 403 });
    }

    await connection.query(
      'DELETE FROM admin_permissions WHERE permission_key = ? AND admin_level = ?',
      [permission_key, level]
    );

    return NextResponse.json({ message: 'Permissão revogada.' });
  } catch (error) {
    console.error('Error revoking permission:', error);
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

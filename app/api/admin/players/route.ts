import { NextResponse } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPools } from '@/lib/db';

export async function GET(req: Request) {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const faceit_guid = searchParams.get('faceit_guid');
    const nickname = searchParams.get('nickname');

    const connection = await pool.getConnection();
    try {
      if (id) {
        const [rows]: any = await connection.query('SELECT id, nickname, admin, faceit_guid, avatar, adicionados FROM players WHERE id = ?', [id]);
        if (rows.length === 0) {
          return NextResponse.json({ message: 'Player not found' }, { status: 404 });
        }
        return NextResponse.json(rows[0]);
      }

      if (nickname) {
        const [rows]: any = await connection.query('SELECT id, nickname, admin, faceit_guid, avatar, adicionados FROM players WHERE nickname = ?', [nickname]);
        if (rows.length === 0) {
          return NextResponse.json({ message: 'Player not found' }, { status: 404 });
        }
        return NextResponse.json(rows[0]);
      }

      if (faceit_guid) {
        const [rows]: any = await connection.query('SELECT id, nickname, admin, faceit_guid, avatar, adicionados FROM players WHERE faceit_guid = ?', [faceit_guid]);
        if (rows.length === 0) {
          return NextResponse.json({ message: 'Player not found' }, { status: 404 });
        }
        return NextResponse.json(rows[0]);
      }

      const [rows] = await connection.query('SELECT id, nickname, admin, faceit_guid, adicionados FROM players ORDER BY nickname ASC');
      return NextResponse.json(rows);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro na API /api/admin/players:', error);
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function POST(req: Request) {
    let env = {};
    try {
        const ctx = await getCloudflareContext();
        env = ctx.env;
    } catch (e) { }
    const { mainPool: pool } = getPools(env);

    try {
        const { identifier, adminLevel } = await req.json();

        if (!identifier || adminLevel === undefined) {
            return NextResponse.json({ message: 'Identifier and admin level are required.' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            let query = 'UPDATE players SET admin = ? WHERE faceit_guid = ? OR nickname = ?';
            let params = [adminLevel, identifier, identifier];

            if (/^\d+$/.test(identifier)) {
                query = 'UPDATE players SET admin = ? WHERE id = ?';
                params = [adminLevel, identifier];
            }

            const [result]: any = await connection.query(query, params);

            if (result.affectedRows === 0) {
                return NextResponse.json({ message: 'Player not found.' }, { status: 404 });
            }

            return NextResponse.json({ message: 'Admin level updated successfully.' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error in API /api/admin/players:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    let env = {};
    try {
        const ctx = await getCloudflareContext();
        env = ctx.env;
    } catch (e) { }
    const { mainPool: pool } = getPools(env);

    try {
        const body = await req.json();
        const { userId, adminLevel, adicionados } = body;

        if (!userId) {
            return NextResponse.json({ message: 'User ID is required.' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            if (adminLevel !== undefined) {
                await connection.query(
                    'UPDATE players SET admin = ? WHERE id = ?',
                    [adminLevel, userId]
                );
            }
            if (adicionados !== undefined) {
                await connection.query(
                    'UPDATE players SET adicionados = ? WHERE id = ?',
                    [adicionados, userId]
                );
            }
            return NextResponse.json({ message: 'Player updated successfully.' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error in API /api/admin/players:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    let env = {};
    try {
        const ctx = await getCloudflareContext();
        env = ctx.env;
    } catch (e) { }
    const { mainPool: pool } = getPools(env);

    try {
        const body = await req.json();

        // Verifica se é uma atualização de ID (originalId e newId presentes)
        // Usamos !== undefined para permitir o ID 0
        if (body.originalId !== undefined && body.newId !== undefined) {
            const { originalId, newId } = body;
            const connection = await pool.getConnection();
            try {
                await connection.beginTransaction();
                await connection.query('SET FOREIGN_KEY_CHECKS=0');

                await connection.query(
                    'UPDATE players SET id = ? WHERE id = ?',
                    [newId, originalId]
                );
                await connection.query(
                    'UPDATE codigos_conquistas SET resgatado_por = ? WHERE resgatado_por = ?',
                    [newId, originalId]
                );

                await connection.query('SET FOREIGN_KEY_CHECKS=1');
                await connection.commit();
                return NextResponse.json({ message: 'Player ID updated successfully.' });
            } catch (error) {
                await connection.rollback();
                await connection.query('SET FOREIGN_KEY_CHECKS=1');
                throw error;
            } finally {
                connection.release();
            }
        }

        // Lógica existente para Faceit GUID
        const { userId, faceitGuid } = body;
        if (userId && faceitGuid) {
            const connection = await pool.getConnection();
            try {
                await connection.query(
                    'UPDATE players SET faceit_guid = ? WHERE id = ?',
                    [faceitGuid, userId]
                );
                return NextResponse.json({ message: 'Faceit GUID updated successfully.' });
            } finally {
                connection.release();
            }
        }

        return NextResponse.json({ message: 'Invalid parameters. Required: (originalId, newId) or (userId, faceitGuid).' }, { status: 400 });
    } catch (error) {
        console.error('Error in API /api/admin/players:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

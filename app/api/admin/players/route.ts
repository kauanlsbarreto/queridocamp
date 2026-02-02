import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute('SELECT id, nickname, admin, faceit_guid FROM players ORDER BY nickname ASC');
      return NextResponse.json(rows);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro na API /api/admin/players:', error);
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
    try {
        const { userId, adminLevel } = await req.json();

        if (!userId || adminLevel === undefined) {
            return NextResponse.json({ message: 'User ID and admin level are required.' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'UPDATE players SET admin = ? WHERE id = ?',
                [adminLevel, userId]
            );
            return NextResponse.json({ message: 'Admin level updated successfully.' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error in API /api/admin/players:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const { userId, faceitGuid } = await req.json();

        if (!userId || !faceitGuid) {
            return NextResponse.json({ message: 'User ID and Faceit GUID are required.' }, { status: 400 });
        }

        const connection = await pool.getConnection();
        try {
            await connection.execute(
                'UPDATE players SET faceit_guid = ? WHERE id = ?',
                [faceitGuid, userId]
            );
            return NextResponse.json({ message: 'Faceit GUID updated successfully.' });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error in API /api/admin/players:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPools } from '@/lib/db';

export async function POST(req: Request) {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: dbPool } = getPools(env);

  try {
    const { guid, nickname, avatar } = await req.json();

    if (!guid || !nickname) {
      return NextResponse.json({ message: 'GUID e nickname são obrigatórios.' }, { status: 400 });
    }

    const connection = await dbPool.getConnection();

    try {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS players (
          id INT AUTO_INCREMENT PRIMARY KEY,
          faceit_guid VARCHAR(255) NOT NULL UNIQUE,
          nickname VARCHAR(255) NOT NULL,
          avatar VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) AUTO_INCREMENT = 100
      `);

      let [rows]: any = await connection.query(
        'SELECT * FROM players WHERE faceit_guid = ?',
        [guid]
      );

      let user = rows[0];

      if (!user) {
        const [insertResult]: any = await connection.query(
          'INSERT INTO players (faceit_guid, nickname, avatar) VALUES (?, ?, ?)',
          [guid, nickname, avatar || '']
        );
        
        const newUserId = insertResult.insertId;

        [rows] = await connection.query(
          'SELECT * FROM players WHERE id = ?',
          [newUserId]
        );
        user = rows[0];
      } else {
        if (user.nickname !== nickname || user.avatar !== (avatar || '')) {
          await connection.query(
            'UPDATE players SET nickname = ?, avatar = ? WHERE faceit_guid = ?',
            [nickname, avatar || '', guid]
          );
          user = { ...user, nickname, avatar: avatar || '' };
        }
      }

      return NextResponse.json(user);

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro na API /api/players:', error);
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 });
  }
}
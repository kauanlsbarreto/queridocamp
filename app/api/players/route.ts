import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
export const runtime = 'edge';

const databaseUrl = process.env.DATABASE_URL || "mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway";

const dbPool = mysql.createPool(databaseUrl);

export async function POST(req: Request) {
  try {
    const { guid, nickname, avatar } = await req.json();

    if (!guid || !nickname) {
      return NextResponse.json({ message: 'GUID e nickname são obrigatórios.' }, { status: 400 });
    }

    const connection = await dbPool.getConnection();

    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS players (
          id INT AUTO_INCREMENT PRIMARY KEY,
          faceit_guid VARCHAR(255) NOT NULL UNIQUE,
          nickname VARCHAR(255) NOT NULL,
          avatar VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) AUTO_INCREMENT = 100
      `);

      let [rows]: any = await connection.execute(
        'SELECT * FROM players WHERE faceit_guid = ?',
        [guid]
      );

      let user = rows[0];

      if (!user) {
        const [insertResult]: any = await connection.execute(
          'INSERT INTO players (faceit_guid, nickname, avatar) VALUES (?, ?, ?)',
          [guid, nickname, avatar || '']
        );
        
        const newUserId = insertResult.insertId;

        [rows] = await connection.execute(
          'SELECT * FROM players WHERE id = ?',
          [newUserId]
        );
        user = rows[0];
      } else {
        if (user.nickname !== nickname || user.avatar !== (avatar || '')) {
          await connection.execute(
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
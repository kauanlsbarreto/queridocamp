import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export const dynamic = 'force-dynamic';

const dbPool = mysql.createPool("mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway");

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { userId, adicionados } = body;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    // Atualiza apenas a coluna adicionados
    await dbPool.execute('UPDATE players SET adicionados = ? WHERE id = ?', [adicionados, userId]);

    return NextResponse.json({ message: 'Success' });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
  }
}
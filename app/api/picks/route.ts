import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

 const pool = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, nickname, slotIndex, team } = body;

    if (!nickname) {
      return NextResponse.json({ error: 'Nickname is required' }, { status: 400 });
    }

    if (action === 'load') {
      const [rows]: any = await pool.execute(
        'SELECT * FROM escolhas WHERE nickname = ?',
        [nickname]
      );
      return NextResponse.json(rows[0] || {});
    }

    if (action === 'save') {
      const [rows]: any = await pool.execute(
        'SELECT locked FROM escolhas WHERE nickname = ?',
        [nickname]
      );
      
      if (rows.length > 0 && rows[0].locked) {
        return NextResponse.json({ error: 'As escolhas estão bloqueadas.' }, { status: 403 });
      }

      const slotColumn = `slot_${slotIndex + 1}`;
      
      if (!/^slot_[1-8]$/.test(slotColumn)) {
         return NextResponse.json({ error: 'Invalid slot' }, { status: 400 });
      }

      const teamJson = team ? JSON.stringify(team) : null;

      const query = `
        INSERT INTO escolhas (nickname, ${slotColumn}) 
        VALUES (?, ?) 
        ON DUPLICATE KEY UPDATE ${slotColumn} = ?
      `;

      await pool.execute(query, [nickname, teamJson, teamJson]);
      return NextResponse.json({ success: true });
    }

    if (action === 'lock') {
      await pool.execute(
        'UPDATE escolhas SET locked = TRUE WHERE nickname = ?',
        [nickname]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
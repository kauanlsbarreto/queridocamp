import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, nickname, slotIndex, team } = body;

    if (!nickname) {
      return NextResponse.json({ error: 'Nickname required' }, { status: 400 });
    }

    if (action === 'load') {
      await pool.execute(
        `INSERT IGNORE INTO escolhas (nickname) VALUES (?)`,
        [nickname]
      );

      const [rows]: any = await pool.execute(
        `SELECT * FROM escolhas WHERE nickname = ?`,
        [nickname]
      );
      
      return NextResponse.json(rows[0]);
    }

    if (action === 'save') {
      const columnName = `slot_${slotIndex + 1}`;
      
      const teamData = JSON.stringify(team);

      const query = `UPDATE escolhas SET ${columnName} = ? WHERE nickname = ?`;
      await pool.execute(query, [teamData, nickname]);

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
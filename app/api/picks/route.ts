import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, nickname, slotIndex, team, phase, faceit_guid, targetStatus, adminLevel } = body;

    if (!nickname) return NextResponse.json({ error: 'Nickname required' }, { status: 400 });

    if (action === 'load') {
      const [rows]: any = await pool.execute('SELECT * FROM escolhas WHERE nickname = ?', [nickname]);
      return NextResponse.json(rows[0] || {});
    }

    if (action === 'save') {
      const lockCol = phase === 'slot' ? 'locked' : `${phase}_locked`;
      const [rows]: any = await pool.execute(`SELECT ${lockCol} FROM escolhas WHERE nickname = ?`, [nickname]);
      if (rows.length > 0 && rows[0][lockCol]) return NextResponse.json({ error: 'Fase bloqueada' }, { status: 403 });

      const col = `${phase}_${slotIndex + 1}`;
      const teamJson = team ? JSON.stringify(team) : null;
      await pool.execute(
        `INSERT INTO escolhas (nickname, faceit_guid, ${col}) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ${col} = ?, faceit_guid = ?`,
        [nickname, faceit_guid, teamJson, teamJson, faceit_guid]
      );
      return NextResponse.json({ success: true });
    }

    if (action === 'lock') {
      const lockCol = phase === 'slot' ? 'locked' : `${phase}_locked`;
      await pool.execute(`UPDATE escolhas SET ${lockCol} = TRUE WHERE nickname = ?`, [nickname]);
      return NextResponse.json({ success: true });
    }

    if (action === 'admin_toggle_global') {
      if (adminLevel > 2) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      
      const lockCol = phase === 'slot' ? 'locked' : `${phase}_locked`;
      await pool.execute(`UPDATE escolhas SET ${lockCol} = ?`, [targetStatus]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
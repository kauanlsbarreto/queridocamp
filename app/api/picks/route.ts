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

    if (action === 'admin_manage_user') {
      if (adminLevel > 2) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      
      const { targetNickname, type, phase } = body;
      
      if (type === 'unlock') {
        const lockCol = phase === 'slot' ? 'locked' : `${phase}_locked`;
        await pool.execute(`UPDATE escolhas SET ${lockCol} = FALSE WHERE nickname = ?`, [targetNickname]);
      } else if (type === 'clear') {
        let updateQuery = "";
        if (phase === 'slot') updateQuery = "slot_1 = NULL, slot_2 = NULL, slot_3 = NULL, slot_4 = NULL, slot_5 = NULL, slot_6 = NULL, slot_7 = NULL, slot_8 = NULL, locked = FALSE";
        else if (phase === 'semi') updateQuery = "semi_1 = NULL, semi_2 = NULL, semi_3 = NULL, semi_4 = NULL, semi_locked = FALSE";
        else if (phase === 'final') updateQuery = "final_1 = NULL, final_2 = NULL, final_locked = FALSE";
        
        if (updateQuery) {
          await pool.execute(`UPDATE escolhas SET ${updateQuery} WHERE nickname = ?`, [targetNickname]);
        }
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPools } from '@/lib/db';

export async function POST(request: Request) {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  try {
    const body = await request.json();
    const { action, nickname, slotIndex, team, phase, faceit_guid, targetStatus, adminLevel } = body;

    if (!nickname) return NextResponse.json({ error: 'Nickname required' }, { status: 400 });

    if (action === 'load') {
      const [rows]: any = await pool.query('SELECT * FROM escolhas WHERE nickname = ?', [nickname]);
      return NextResponse.json(rows[0] || {});
    }

    if (action === 'save') {
      const lockCol = phase === 'slot' ? 'locked' : `${phase}_locked`;
      const [rows]: any = await pool.query(`SELECT ${lockCol} FROM escolhas WHERE nickname = ?`, [nickname]);
      if (rows.length > 0 && rows[0][lockCol]) return NextResponse.json({ error: 'Fase bloqueada' }, { status: 403 });

      // Garante que slotIndex seja tratado como número
      const idx = typeof slotIndex === 'string' ? parseInt(slotIndex) : slotIndex;
      const col = `${phase}_${idx + 1}`;
      
      const teamJson = team ? JSON.stringify(team) : null;
      await pool.query(
        `INSERT INTO escolhas (nickname, faceit_guid, ${col}) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE ${col} = ?, faceit_guid = ?`,
        [nickname, faceit_guid || null, teamJson, teamJson, faceit_guid || null]
      );
      revalidatePath('/redondo'); // Atualiza o cache global da página
      return NextResponse.json({ success: true });
    }

    if (action === 'lock') {
      const lockCol = phase === 'slot' ? 'locked' : `${phase}_locked`;
      await pool.query(`UPDATE escolhas SET ${lockCol} = 1 WHERE nickname = ?`, [nickname]);
      revalidatePath('/redondo');
      return NextResponse.json({ success: true });
    }

    if (action === 'admin_toggle_global') {
      const level = typeof adminLevel === 'string' ? parseInt(adminLevel) : adminLevel;
      if (!level || level > 2) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      
      const lockCol = phase === 'slot' ? 'locked' : `${phase}_locked`;
      await pool.query(`UPDATE escolhas SET ${lockCol} = ?`, [targetStatus]);
      revalidatePath('/redondo');
      return NextResponse.json({ success: true });
    }

    if (action === 'admin_manage_user') {
      const level = typeof adminLevel === 'string' ? parseInt(adminLevel) : adminLevel;
      if (!level || level > 2) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      
      const { targetNickname, type, phase } = body;
      
      if (!targetNickname) return NextResponse.json({ error: 'Nickname alvo não informado' }, { status: 400 });
      
      if (type === 'unlock') {
        const lockCol = phase === 'slot' ? 'locked' : `${phase}_locked`;
        await pool.query(`UPDATE escolhas SET ${lockCol} = 0 WHERE nickname = ?`, [targetNickname]);
      } else if (type === 'clear') {
        let updateQuery = "";
        if (phase === 'slot') updateQuery = "slot_1 = NULL, slot_2 = NULL, slot_3 = NULL, slot_4 = NULL, slot_5 = NULL, slot_6 = NULL, slot_7 = NULL, slot_8 = NULL, locked = 0";
        else if (phase === 'semi') updateQuery = "semi_1 = NULL, semi_2 = NULL, semi_3 = NULL, semi_4 = NULL, semi_locked = 0";
        else if (phase === 'final') updateQuery = "final_1 = NULL, final_2 = NULL, final_locked = 0";
        
        if (updateQuery) {
          await pool.query(`UPDATE escolhas SET ${updateQuery} WHERE nickname = ?`, [targetNickname]);
        }
      }
      revalidatePath('/redondo');
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error("Erro na API de picks:", error);
    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });
  }
}
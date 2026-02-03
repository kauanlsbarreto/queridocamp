import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool('mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, nickname, faceit_guid, field, team, stage, locked } = body;

    if (!nickname) {
      return NextResponse.json({ error: 'Nickname is required' }, { status: 400 });
    }

    // Carregar escolhas
    if (action === 'load') {
      const [rows]: any = await pool.execute(
        'SELECT * FROM escolhas WHERE nickname = ?',
        [nickname]
      );
      return NextResponse.json(rows[0] || {});
    }

    // Salvar escolha
    if (action === 'save') {
      if (!field) {
          return NextResponse.json({ error: 'Field is required' }, { status: 400 });
      }

      // Validação de campos permitidos para evitar SQL Injection
      const allowedFields = [
          'slot_1', 'slot_2', 'slot_3', 'slot_4', 'slot_5', 'slot_6', 'slot_7', 'slot_8',
          'semi_1', 'semi_2', 'semi_3', 'semi_4',
          'final_1', 'final_2'
      ];
      
      if (!allowedFields.includes(field)) {
         return NextResponse.json({ error: 'Invalid field' }, { status: 400 });
      }

      // Determinar qual coluna de bloqueio verificar
      let lockColumn = 'locked';
      if (field.startsWith('semi_')) lockColumn = 'semi_locked';
      if (field.startsWith('final_')) lockColumn = 'final_locked';

      // Verificar se está bloqueado
      const [rows]: any = await pool.execute(
        `SELECT ${lockColumn} as is_locked FROM escolhas WHERE nickname = ?`,
        [nickname]
      );
      
      const isLocked = rows.length > 0 && rows[0].is_locked;

      if (isLocked) {
          // Se estiver bloqueado, verificar se é admin para permitir a edição
          let isAdmin = false;
          if (faceit_guid) {
              const [adminRows]: any = await pool.execute(
                  'SELECT Admin FROM players WHERE faceit_guid = ?',
                  [faceit_guid]
              );
              isAdmin = adminRows.length > 0 && (adminRows[0].Admin === 1 || adminRows[0].Admin === 2);
          }

          if (!isAdmin) {
              return NextResponse.json({ error: 'As escolhas estão bloqueadas.' }, { status: 403 });
          }
      }

      const teamJson = team ? JSON.stringify(team) : null;

      const [existing]: any = await pool.execute('SELECT faceit_guid FROM escolhas WHERE nickname = ?', [nickname]);
      
      if (existing.length === 0) {
          await pool.execute(
              `INSERT INTO escolhas (nickname, faceit_guid, ${field}) VALUES (?, ?, ?)`,
              [nickname, faceit_guid || '', teamJson]
          );
      } else {
          await pool.execute(
              `UPDATE escolhas SET ${field} = ? WHERE nickname = ?`,
              [teamJson, nickname]
          );
      }

      return NextResponse.json({ success: true });
    }

    if (action === 'lock') {
      let column = 'locked';
      if (stage === 'semi') column = 'semi_locked';
      if (stage === 'final') column = 'final_locked';

      if (locked === false) {
           let isAdmin = false;
           if (faceit_guid) {
              const [adminRows]: any = await pool.execute(
                  'SELECT Admin FROM players WHERE faceit_guid = ?',
                  [faceit_guid]
              );
              isAdmin = adminRows.length > 0 && (adminRows[0].Admin === 1 || adminRows[0].Admin === 2);
           }

           if (!isAdmin) {
               return NextResponse.json({ error: 'Apenas administradores podem desbloquear.' }, { status: 403 });
           }
      }

      const [existing]: any = await pool.execute('SELECT faceit_guid FROM escolhas WHERE nickname = ?', [nickname]);
      
      if (existing.length === 0) {
           await pool.execute(
              `INSERT INTO escolhas (nickname, faceit_guid, ${column}) VALUES (?, ?, ?)`,
              [nickname, faceit_guid || '', locked ? 1 : 0]
          );
      } else {
          await pool.execute(
              `UPDATE escolhas SET ${column} = ? WHERE nickname = ?`,
              [locked ? 1 : 0, nickname]
          );
      }
      
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Database Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

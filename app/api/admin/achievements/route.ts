import { NextResponse } from 'next/server';
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getPools } from '@/lib/db';
import { randomBytes } from 'crypto';

async function createAchievementsTable(pool: any) {
  const connection = await pool.getConnection();
  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS codigos_sistema (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codigo VARCHAR(255) NOT NULL UNIQUE,
        tipo ENUM('campeonato', 'MVP') NOT NULL,
        nome VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } finally {
    connection.release();
  }
}

export async function POST(req: Request) {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  try {
    const { tipo, nome, codigo } = await req.json();

    if (!tipo || !nome) {
      return NextResponse.json({ message: 'Tipo e nome são obrigatórios.' }, { status: 400 });
    }

    const codeToUse = codigo || randomBytes(8).toString('hex');

    // Ensure table exists before inserting
    await createAchievementsTable(pool);

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'INSERT INTO codigos_sistema (codigo, tipo, nome) VALUES (?, ?, ?)',
        [codeToUse, tipo, nome]
      );
      return NextResponse.json({ codigo: codeToUse, tipo, nome });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Erro na API /api/admin/achievements:', error);
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function GET() {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  try {
    const [rows] = await pool.execute('SELECT * FROM codigos_sistema ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ message: 'Erro ao buscar códigos' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  try {
    const { id, nome, codigo } = await req.json();
    if (!id || !nome || !codigo) {
      return NextResponse.json({ message: 'Dados incompletos.' }, { status: 400 });
    }
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'UPDATE codigos_sistema SET nome = ?, codigo = ? WHERE id = ?',
        [nome, codigo, id]
      );
      return NextResponse.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    return NextResponse.json({ message: 'Erro ao atualizar código' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  let env = {};
  try {
    const ctx = await getCloudflareContext();
    env = ctx.env;
  } catch (e) { }
  const { mainPool: pool } = getPools(env);

  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ message: 'ID é obrigatório.' }, { status: 400 });
    }
    const connection = await pool.getConnection();
    try {
      await connection.execute('DELETE FROM codigos_sistema WHERE id = ?', [id]);
      return NextResponse.json({ success: true });
    } finally {
      connection.release();
    }
  } catch (error) {
    return NextResponse.json({ message: 'Erro ao excluir código' }, { status: 500 });
  }
}

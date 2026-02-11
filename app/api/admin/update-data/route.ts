import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { revalidatePath } from 'next/cache'

async function updateAllData() {
  const pages = [
    { name: 'Classificação', path: '/classificacao' },
    { name: 'Times', path: '/times' },
    { name: 'Players', path: '/players' },
    { name: 'Stats', path: '/stats' },
    { name: 'Redondo', path: '/redondo' },
    { name: 'Rodadas', path: '/rodadas' }
  ];

  const results = await Promise.all(pages.map(async (page) => {
    try {
      revalidatePath(page.path);
      return { name: page.name, status: 'success' as const, message: 'Dados atualizados.' };
    } catch (e) {
      return { name: page.name, status: 'error' as const, message: 'Falha ao atualizar.' };
    }
  }));

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_metadata (
        key_name VARCHAR(50) NOT NULL,
        value TEXT,
        PRIMARY KEY (key_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const now = new Date().toISOString();
    
    await pool.query(`
      INSERT INTO site_metadata (key_name, value) 
      VALUES ('last_update', ?) 
      ON DUPLICATE KEY UPDATE value = ?
    `, [now, now]);

    console.log('Metadata atualizado com sucesso:', now);
  } catch (e) {
    console.error("ERRO CRÍTICO NO BANCO (Metadata):", e);
  }

  return { success: true, results };
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization')
    if (authHeader === `Bearer ${process.env.CRON_SECRET}` || authHeader === 'Bearer local-dev-token') {
      const result = await updateAllData()
      return NextResponse.json(result)
    }
    return NextResponse.json({ message: 'Não autorizado' }, { status: 401 })
  } catch (error) {
    return NextResponse.json({ message: 'Erro interno' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { faceit_guid } = body

    if (!faceit_guid) {
      return NextResponse.json({ message: 'Identificação do usuário ausente.' }, { status: 401 })
    }

    const [rows]: any = await pool.execute(
      'SELECT admin FROM players WHERE faceit_guid = ?',
      [faceit_guid]
    )

    if (rows.length === 0 || (rows[0].admin !== 1 && rows[0].admin !== 2)) {
      return NextResponse.json({ message: 'Dessa vez nao pequeno gafanhoto' }, { status: 403 })
    }

    const result = await updateAllData()
    return NextResponse.json(result)

  } catch (error) {
    console.error('Erro na API:', error)
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 })
  }
}
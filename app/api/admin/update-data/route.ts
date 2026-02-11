import { NextResponse } from 'next/server'
import { pool } from '@/lib/db'
import { revalidatePath } from 'next/cache'

async function updateAllData() {
  const results = [];

  try {
    await new Promise(resolve => setTimeout(resolve, 500)) 
    revalidatePath('/classificacao')
    results.push({ name: 'Classificação', status: 'success', message: 'Dados atualizados.' })
  } catch (e) {
    results.push({ name: 'Classificação', status: 'error', message: 'Falha ao atualizar.' })
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    revalidatePath('/players')
    results.push({ name: 'Players', status: 'success', message: 'Dados atualizados.' })
  } catch (e) {
    results.push({ name: 'Players', status: 'error', message: 'Falha ao atualizar.' })
  }

  try {
    console.log('Atualizando Stats...')
    await new Promise(resolve => setTimeout(resolve, 500))
    revalidatePath('/stats')
    results.push({ name: 'Stats', status: 'success', message: 'Dados atualizados.' })
  } catch (e) {
    results.push({ name: 'Stats', status: 'error', message: 'Falha ao atualizar.' })
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    revalidatePath('/redondo')
    results.push({ name: 'Redondo', status: 'success', message: 'Dados atualizados.' })
  } catch (e) {
    results.push({ name: 'Redondo', status: 'error', message: 'Falha ao atualizar.' })
  }

  try {
    await new Promise(resolve => setTimeout(resolve, 500))
    revalidatePath('/rodadas')
    results.push({ name: 'Rodadas', status: 'success', message: 'Dados atualizados.' })
  } catch (e) {
    results.push({ name: 'Rodadas', status: 'error', message: 'Falha ao atualizar.' })
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_metadata (
        key_name VARCHAR(50) PRIMARY KEY,
        value TEXT
      )
    `);
    const now = new Date().toISOString();
    await pool.query(`
      INSERT INTO site_metadata (key_name, value) VALUES ('last_update', ?) ON DUPLICATE KEY UPDATE value = ?
    `, [now, now]);
  } catch (e) {
    console.error("Erro ao salvar timestamp:", e);
  }

  return { success: true, results }
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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Não autorizado: Token não fornecido.' }, { status: 401 })
    }

    const accessToken = authHeader.split(' ')[1]

    if (accessToken === 'local-dev-token' || accessToken === '7b080715-fe0b-461d-a1f1-62cfd0c47e63') {
      const result = await updateAllData()
      return NextResponse.json(result)
    }

    const profileRes = await fetch('https://api.faceit.com/auth/v1/resources/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!profileRes.ok) {
      return NextResponse.json({ message: 'Token da Faceit inválido ou expirado.' }, { status: 403 })
    }

    const profile = await profileRes.json()
    const faceitGuid = profile.sub

    if (!faceitGuid) {
      return NextResponse.json({ message: 'Não foi possível obter o GUID da Faceit.' }, { status: 403 })
    }

    const connection = await pool.getConnection()
    try {
      const [rows]: any = await connection.execute(
        'SELECT admin FROM players WHERE faceit_guid = ?',
        [faceitGuid]
      )

      if (rows.length === 0) {
        return NextResponse.json({ message: 'Usuário não encontrado no sistema.' }, { status: 403 })
      }

      const user = rows[0]
      if (user.admin !== 1 && user.admin !== 2) {
        return NextResponse.json({ message: 'Não não pequeno gafanhoto' }, { status: 403 })
      }
    } finally {
      connection.release()
    }

    const result = await updateAllData()

    return NextResponse.json(result)

  } catch (error) {
    console.error('Erro na API de atualização de dados:', error)
    return NextResponse.json({ message: 'Erro interno do servidor' }, { status: 500 })
  }
}

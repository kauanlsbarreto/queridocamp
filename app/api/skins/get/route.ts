import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: 'srv1312174.hstgr.cloud',
  user: 'admin',
  password: '#Kauanshay20',
  database: 'skins',
  port: 3306,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const steamid = searchParams.get('steamid')

  if (!steamid) return NextResponse.json({ error: 'Steam ID required' }, { status: 400 })

  let connection: mysql.Connection | null = null

  try {
    connection = await mysql.createConnection(dbConfig)

    // Buscar Skins
    const [skins]: any[] = await connection.execute(
      'SELECT * FROM wp_player_skins WHERE steamid = ?', [steamid]
    )

    // Buscar Facas
    const [knives]: any[] = await connection.execute(
      'SELECT * FROM wp_player_knife WHERE steamid = ?', [steamid]
    )

    // Buscar Luvas
    const [gloves]: any[] = await connection.execute(
      'SELECT * FROM wp_player_gloves WHERE steamid = ?', [steamid]
    )

    // Buscar Agentes
    const [agents]: any[] = await connection.execute(
      'SELECT * FROM wp_player_agents WHERE steamid = ?', [steamid]
    )

    const result = {
      skins: skins,
      knives: knives,
      gloves: gloves,
      agents: agents[0] || {}
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  } finally {
    if (connection) await connection.end()
  }
}

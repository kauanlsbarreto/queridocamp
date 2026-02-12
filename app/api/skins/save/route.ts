import { NextResponse } from 'next/server'
import mysql from 'mysql2/promise'

const dbConfig = {
  host: 'srv1312174.hstgr.cloud',
  user: 'admin',
  password: '#Kauanshay20',
  database: 'skins',
  port: 3306,
}

export async function POST(request: Request) {
  let connection: mysql.Connection | null = null

  try {
    const body = await request.json()
    const { steam_id_64, selections } = body

    if (!steam_id_64 || !selections) {
      return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
    }

    connection = await mysql.createConnection(dbConfig)
    await connection.beginTransaction()

    // 1. Processar Agentes (wp_player_agents)
    // Agrupa agentes CT e T em uma única query
    const agentCT = selections['agent_ct']?.model
    const agentT = selections['agent_t']?.model
    
    if (agentCT || agentT) {
      // Busca se já existe registro para preservar o outro time se não for enviado
      const [existing]: any[] = await connection.execute(
        'SELECT agent_ct, agent_t FROM wp_player_agents WHERE steamid = ?',
        [steam_id_64]
      )
      
      const newAgentCT = agentCT || (existing[0]?.agent_ct ?? null)
      const newAgentT = agentT || (existing[0]?.agent_t ?? null)

      await connection.execute(
        `INSERT INTO wp_player_agents (steamid, agent_ct, agent_t) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE agent_ct = VALUES(agent_ct), agent_t = VALUES(agent_t)`,
        [steam_id_64, newAgentCT, newAgentT]
      )
    }

    // Iterar sobre as outras seleções
    for (const [key, item] of Object.entries(selections)) {
      if (key === 'agent_ct' || key === 'agent_t') continue // Já processado
      if (!item || typeof item !== 'object') continue

      const selection = item as any
      const team = selection.team || 0 // 0 = Ambos, 2 = T, 3 = CT
      const teamsToUpdate = team === 0 ? [2, 3] : [team]

      // 2. Processar Luvas (wp_player_gloves)
      if (key.startsWith('glove_')) {
        const defindex = selection.weapon_defindex
        if (defindex) {
          for (const t of teamsToUpdate) {
            await connection.execute(
              `INSERT INTO wp_player_gloves (steamid, weapon_team, weapon_defindex) 
               VALUES (?, ?, ?) 
               ON DUPLICATE KEY UPDATE weapon_defindex = VALUES(weapon_defindex)`,
              [steam_id_64, t, defindex]
            )
            // A skin da luva (paint, wear) é salva em wp_player_skins usando o defindex da luva
            await saveSkin(connection, steam_id_64, t, defindex, selection)
          }
        }
        continue
      }

      // 3. Processar Facas (wp_player_knife)
      if (key.startsWith('knife_') || (selection.weapon_name && selection.weapon_name.includes('knife'))) {
        const knifeName = selection.weapon_name // Ex: weapon_knife_karambit
        const defindex = selection.weapon_defindex
        
        if (knifeName) {
          for (const t of teamsToUpdate) {
            await connection.execute(
              `INSERT INTO wp_player_knife (steamid, weapon_team, knife) 
               VALUES (?, ?, ?) 
               ON DUPLICATE KEY UPDATE knife = VALUES(knife)`,
              [steam_id_64, t, knifeName]
            )
            // A skin da faca é salva em wp_player_skins usando o defindex da faca
            if (defindex) {
              await saveSkin(connection, steam_id_64, t, defindex, selection)
            }
          }
        }
        continue
      }

      // 4. Processar Armas Padrão (wp_player_skins)
      // Se chegou aqui, é uma arma normal (AK, M4, etc)
      const defindex = selection.weapon_defindex
      if (defindex) {
        for (const t of teamsToUpdate) {
          await saveSkin(connection, steam_id_64, t, defindex, selection)
        }
      }
    }

    await connection.commit()
    return NextResponse.json({ success: true })

  } catch (error: any) {
    if (connection) await connection.rollback()
    console.error('Erro ao salvar:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  } finally {
    if (connection) await connection.end()
  }
}

// Função auxiliar para salvar na tabela wp_player_skins
async function saveSkin(conn: mysql.Connection, steamid: string, team: number, defindex: number, data: any) {
  const paint = data.paint ?? 0
  const wear = data.wear ?? 0.000001
  const seed = data.seed ?? 0
  const nametag = data.nametag ?? null
  const stattrak = data.stattrak ?? 0
  const stattrak_count = data.stattrak_count ?? 0
  
  await conn.execute(
    `INSERT INTO wp_player_skins 
     (steamid, weapon_team, weapon_defindex, weapon_paint_id, weapon_wear, weapon_seed, weapon_nametag, weapon_stattrak, weapon_stattrak_count)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
     weapon_paint_id = VALUES(weapon_paint_id), 
     weapon_wear = VALUES(weapon_wear), 
     weapon_seed = VALUES(weapon_seed),
     weapon_nametag = VALUES(weapon_nametag),
     weapon_stattrak = VALUES(weapon_stattrak),
     weapon_stattrak_count = VALUES(weapon_stattrak_count)`,
    [steamid, team, defindex, paint, wear, seed, nametag, stattrak, stattrak_count]
  )
}

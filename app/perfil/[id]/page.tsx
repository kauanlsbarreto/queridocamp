import { notFound } from 'next/navigation';
import PerfilClient from './PerfilClient';
import { createMainConnection, type Env } from '@/lib/db';
import { getRuntimeEnv } from '@/lib/runtime-env';

async function getPlayerData(id: string, mainConn: any) {
  const [rows] = await mainConn.query('SELECT * FROM players WHERE id = ?', [id]) as [any[], any];
  let player = rows[0];

  if (!player && id !== '0') return null;

  let updatedPlayer = player || { id: '0' };
  if (id === '0') {
    updatedPlayer.nickname = "Level -Todos -1";
    updatedPlayer.avatar = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSELngQdOTsSQXmSv9j1ltZDiGKXvSB8NJIsQ&s";
    updatedPlayer.faceit_level_image = '/faceitlevel/-1.png';
  }

  if (updatedPlayer.adicionados?.includes('QCS-CADEIRANTE')) {
    updatedPlayer.faceit_level_image = '/faceitlevel/cadeirante.png';
  }

  if (!updatedPlayer.nickname || String(updatedPlayer.nickname).trim() === '') {
    updatedPlayer.nickname = updatedPlayer.apelido || 'Jogador';
  }

  return updatedPlayer;
}

function parseAdicionadosCodes(raw: any): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(/[,;|\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function getConquistas(player: any, mainConn: any) {
  const playerId = player?.id;
  if (String(playerId) === '0') {
    const [rows] = await mainConn.query(
      'SELECT id, codigo, tipo, nome, usado FROM codigos_sistema ORDER BY id DESC'
    ) as [any[], any];
    return rows;
  }

  // 1) Adicionados — independent of codigos_conquistas
  let adicionadosRows: any[] = [];
  try {
    const adicionadosCodes = parseAdicionadosCodes(player?.adicionados);
    if (adicionadosCodes.length > 0) {
      const placeholders = adicionadosCodes.map(() => '?').join(',');
      const [rowsAdicionados] = await mainConn.query(
        `SELECT codigo, imagem, label FROM adicionados WHERE codigo IN (${placeholders})`,
        adicionadosCodes
      ) as [any[], any];

      const byCode = new Map<string, any>(
        rowsAdicionados.map((row: any) => [String(row.codigo).trim(), row])
      );

      adicionadosRows = adicionadosCodes
        .map((code) => byCode.get(code))
        .filter(Boolean)
        .map((row: any) => ({
          id: `adicionado-${row.codigo}`,
          codigo: row.codigo,
          tipo: 'ADICIONADO',
          nome: row.label || row.codigo,
          imagem: row.imagem
        }));
    }
  } catch (e) {
    // adicionados table unavailable — silently ignore
  }

  // 2) Redeemed achievement codes — independent of adicionados
  let baseRows: any[] = [];
  try {
    const [rows] = await mainConn.query(
      'SELECT id, codigo, tipo, nome, resgatado_por, resgatado_em, created_at FROM codigos_conquistas WHERE resgatado_por = ? ORDER BY id DESC',
      [playerId]
    ) as [any[], any];
    if (rows.length === 0) {
      try {
        const [altRows] = await mainConn.query(
          'SELECT id, codigo, tipo, nome, resgatado_por, resgatado_em, created_at FROM codigos_conquistas WHERE player_id = ? ORDER BY id DESC',
          [playerId]
        ) as [any[], any];
        baseRows = altRows;
      } catch {
        // player_id column may not exist — ignore
      }
    } else {
      baseRows = rows;
    }
  } catch (e) {
    // codigos_conquistas unavailable — silently ignore
  }

  // 3) Compras da loja (item personalizado com imagem enviada)
  let lojaRows: any[] = [];
  try {
    const [rowsLoja] = await mainConn.query(
      `SELECT id, item_nome, label_text, image_url, points_cost, created_at
       FROM loja_compras
       WHERE player_id = ?
       ORDER BY id DESC`,
      [playerId]
    ) as [any[], any];

    lojaRows = rowsLoja.map((row: any) => ({
      id: `loja-${row.id}`,
      codigo: `LOJA-${row.id}`,
      tipo: 'LOJA',
      nome: row.label_text || row.item_nome || 'Compra da loja',
      imagem: row.image_url,
      points_cost: row.points_cost,
      created_at: row.created_at,
    }));
  } catch (e) {
    // tabela de compras pode não existir ainda
  }

  return [...lojaRows, ...adicionadosRows, ...baseRows];
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let mainConnection: any;

  try {
    const env = await getRuntimeEnv() as Env;

    mainConnection = await createMainConnection(env);
    (mainConnection as any).setPage(`/perfil/${id}`);

    const player = await getPlayerData(id, mainConnection);
    if (!player) notFound();

    const conquistas = await getConquistas(player, mainConnection);

    return (
      <div className="min-h-screen bg-black">
        <PerfilClient 
          player={player} 
          initialConquistas={conquistas}
        />
      </div>
    );

  } catch (error) {
    console.error("Erro na PerfilPage:", error);
    throw error; 
  } finally {
    if (mainConnection) await mainConnection.end?.();
  }
}
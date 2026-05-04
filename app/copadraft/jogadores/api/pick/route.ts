import { NextResponse } from 'next/server';
import { createJogadoresConnection } from '@/lib/db';

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1500933263995306195/TyXXHvvC0S7Y7I4f2DYdRPTiC2a5tdJWLrUQQg8Mym-M1IadaYmvF5GFrf4I7uxqvxjF';

async function sendDiscordWebhook(capitaoNick: string, jogadorNick: string, jogadorGuid: string, gasto: number) {
  try {
    const gastoFormatado = gasto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    
    const embed = {
      title: 'Novo Pick no Draft',
      color: 0xECA149,
      fields: [
        {
          name: 'Time',
          value: `**${capitaoNick}**`,
          inline: false,
        },
        {
          name: 'Jogador Escolhido',
          value: `**${jogadorNick}**`,
          inline: false,
        },
        {
          name: 'Faceit GUID',
          value: `\`${jogadorGuid}\``,
          inline: false,
        },
        {
          name: 'Valor Gasto',
          value: `**R$ ${gastoFormatado}**`,
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });
  } catch (error) {
    console.error('Erro ao enviar webhook do Discord:', error);
  }
}

export async function PUT(req: Request) {
  let conn: any;

  try {
    const body = await req.json();
    const capitaoId = Number(body?.capitaoId);
    const jogadorId = Number(body?.jogadorId);
    const gasto = Number(body?.gasto);

    if (!Number.isInteger(capitaoId) || capitaoId <= 0) {
      return NextResponse.json({ error: 'capitaoId invalido.' }, { status: 400 });
    }

    if (!Number.isInteger(jogadorId) || jogadorId <= 0) {
      return NextResponse.json({ error: 'jogadorId invalido.' }, { status: 400 });
    }

    if (!Number.isInteger(gasto) || gasto < 0) {
      return NextResponse.json({ error: 'gasto invalido.' }, { status: 400 });
    }

    conn = await createJogadoresConnection({});
    await conn.beginTransaction();

    const [capRows]: any = await conn.query('SELECT id, faceit_guid, pote, dinheiro FROM jogadores WHERE id = ? LIMIT 1 FOR UPDATE', [capitaoId]);
    const [jogRows]: any = await conn.query('SELECT id, faceit_guid, pote, timeid FROM jogadores WHERE id = ? LIMIT 1 FOR UPDATE', [jogadorId]);

    const capitao = Array.isArray(capRows) ? capRows[0] : null;
    const jogador = Array.isArray(jogRows) ? jogRows[0] : null;

    if (!capitao || !jogador) {
      await conn.rollback();
      return NextResponse.json({ error: 'Capitao ou jogador nao encontrado.' }, { status: 404 });
    }

    // Buscar nomes corretos da tabela players
    const [capitaoPlayersRows]: any = await conn.query('SELECT nickname FROM players WHERE faceit_guid = ? LIMIT 1', [capitao.faceit_guid]);
    const [jogadorPlayersRows]: any = await conn.query('SELECT nickname FROM players WHERE faceit_guid = ? LIMIT 1', [jogador.faceit_guid]);

    const capitaoNick = Array.isArray(capitaoPlayersRows) && capitaoPlayersRows[0] ? capitaoPlayersRows[0].nickname : 'Desconhecido';
    const jogadorNick = Array.isArray(jogadorPlayersRows) && jogadorPlayersRows[0] ? jogadorPlayersRows[0].nickname : 'Desconhecido';

    if (Number(capitao.pote) !== 1) {
      await conn.rollback();
      return NextResponse.json({ error: 'Somente jogador do pote 1 pode escolher.' }, { status: 400 });
    }

    if (![2, 3, 4, 5].includes(Number(jogador.pote))) {
      await conn.rollback();
      return NextResponse.json({ error: 'Somente jogadores dos potes 2 a 5 podem ser escolhidos aqui.' }, { status: 400 });
    }

    if (jogador.timeid && Number(jogador.timeid) !== capitaoId) {
      await conn.rollback();
      return NextResponse.json({ error: 'Jogador ja esta em outro time.' }, { status: 400 });
    }

    const dinheiroAtual = Number(capitao.dinheiro || 0);
    if (dinheiroAtual < gasto) {
      await conn.rollback();
      return NextResponse.json({ error: 'Dinheiro insuficiente para essa compra.' }, { status: 400 });
    }

    const novoDinheiro = dinheiroAtual - gasto;

    await conn.query('UPDATE jogadores SET timeid = ? WHERE id = ? LIMIT 1', [capitaoId, jogadorId]);
    await conn.query('UPDATE jogadores SET dinheiro = ? WHERE id = ? LIMIT 1', [novoDinheiro, capitaoId]);

    await conn.commit();

    // Enviar webhook do Discord (sem await para não bloquear)
    Promise.resolve().then(() => {
      sendDiscordWebhook(capitaoNick, jogadorNick, jogador.faceit_guid || 'N/A', gasto);
    }).catch(err => {
      console.error('Erro ao enviar webhook:', err);
    });

    return NextResponse.json({
      ok: true,
      capitaoId,
      jogadorId,
      gasto,
      novoDinheiro,
    });
  } catch (error) {
    console.error('Erro na rota pick:', error);
    if (conn) {
      await conn.rollback().catch(() => {});
    }
    return NextResponse.json({ error: 'Erro ao realizar escolha do time.' }, { status: 500 });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
}

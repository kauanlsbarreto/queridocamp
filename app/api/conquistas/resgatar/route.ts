import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
export const runtime = 'edge';

const dbPool = mysql.createPool("mysql://root:YMQZnBJRGFhRYSfjSZjFMGTegALnUfoS@nozomi.proxy.rlwy.net:36657/railway");

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { codigo, playerId } = body;

        if (!codigo || !playerId) {
            return NextResponse.json({ message: 'Código e ID do jogador são obrigatórios' }, { status: 400 });
        }

        // 1. Verificar se o código existe no sistema
        const [codes]: any = await dbPool.execute('SELECT * FROM codigos_sistema WHERE codigo = ?', [codigo]);
        
        if (codes.length === 0) {
            return NextResponse.json({ message: 'Código inválido ou não encontrado' }, { status: 404 });
        }
        
        const conquista = codes[0];

        // 2. Tentar inserir usando 'resgatado_por' (novo padrão)
        try {
            // Verificar duplicidade
            const [existing]: any = await dbPool.execute(
                'SELECT id FROM codigos_conquistas WHERE codigo = ? AND resgatado_por = ?',
                [codigo, playerId]
            );
            if (existing.length > 0) {
                return NextResponse.json({ message: 'Você já resgatou este código' }, { status: 400 });
            }

            // Inserir
            await dbPool.execute(
                'INSERT INTO codigos_conquistas (resgatado_por, codigo, tipo, nome) VALUES (?, ?, ?, ?)',
                [playerId, conquista.codigo, conquista.tipo, conquista.nome]
            );

        } catch (err: any) {
            // Se der erro de coluna desconhecida, tenta com 'player_id' (padrão antigo)
            if (err.code === 'ER_BAD_FIELD_ERROR') {
                 const [existingOld]: any = await dbPool.execute(
                    'SELECT id FROM codigos_conquistas WHERE codigo = ? AND player_id = ?',
                    [codigo, playerId]
                );
                if (existingOld.length > 0) {
                    return NextResponse.json({ message: 'Você já resgatou este código' }, { status: 400 });
                }

                await dbPool.execute(
                    'INSERT INTO codigos_conquistas (player_id, codigo, tipo, nome) VALUES (?, ?, ?, ?)',
                    [playerId, conquista.codigo, conquista.tipo, conquista.nome]
                );
            } else {
                throw err; // Se for outro erro, lança para o catch externo
            }
        }

        return NextResponse.json({ 
            success: true, 
            novaConquista: { 
                codigo: conquista.codigo, 
                tipo: conquista.tipo, 
                nome: conquista.nome 
            } 
        });

    } catch (error) {
        console.error("Erro API Resgatar:", error);
        return NextResponse.json({ message: 'Erro interno ao processar resgate' }, { status: 500 });
    }
}

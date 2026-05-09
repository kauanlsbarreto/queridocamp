import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { createMainConnection } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

export const dynamic = "force-dynamic";

type Env = {
  DB_PRINCIPAL: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
  DB_JOGADORES: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
};

type CodigoSistemaRow = RowDataPacket & {
  codigo: string;
  tipo: string;
  nome: string;
};

export async function POST(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const { codigo, playerId } = await req.json();

    if (!codigo || playerId === undefined || playerId === null) {
      await connection.end();
      return NextResponse.json(
        { message: "Código e ID do jogador são obrigatórios" },
        { status: 400 }
      );
    }

    const [codes] = await connection.query<CodigoSistemaRow[]>(
      "SELECT * FROM codigos_sistema WHERE codigo = ?",
      [codigo]
    );

    if (codes.length === 0) {
      await connection.end();
      return NextResponse.json(
        { message: "Código inválido ou não encontrado" },
        { status: 404 }
      );
    }

    const conquista = codes[0];

    try {
      const [existing] = await connection.query<RowDataPacket[]>(
        "SELECT id FROM codigos_conquistas WHERE codigo = ? AND resgatado_por = ?",
        [codigo, playerId]
      );

      if (existing.length > 0) {
        await connection.end();
        return NextResponse.json(
          { message: "Você já resgatou este código" },
          { status: 400 }
        );
      }

      if (playerId === 0 || playerId === '0') {
        await connection.end();
        return NextResponse.json(
          { message: "ID inválido para resgate" },
          { status: 400 }
        );
      }

      // insert with explicit timestamp columns so resgatado_em and created_at are recorded
      await connection.query<ResultSetHeader>(
        "INSERT INTO codigos_conquistas (resgatado_por, codigo, tipo, nome, resgatado_em, created_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
        [playerId, conquista.codigo, conquista.tipo, conquista.nome]
      );
      // NÃO marcar como usado globalmente, para permitir múltiplos resgates
    } catch (err: any) {
      if (err?.code === "ER_BAD_FIELD_ERROR") {
        const [existingOld] = await connection.query<RowDataPacket[]>(
          "SELECT id FROM codigos_conquistas WHERE codigo = ? AND player_id = ?",
          [codigo, playerId]
        );

        if (existingOld.length > 0) {
          await connection.end();
          return NextResponse.json(
            { message: "Você já resgatou este código" },
            { status: 400 }
          );
        }

        if (playerId === 0 || playerId === '0') {
          await connection.end();
          return NextResponse.json(
            { message: "ID inválido para resgate" },
            { status: 400 }
          );
        }

        await connection.query<ResultSetHeader>(
          "INSERT INTO codigos_conquistas (player_id, codigo, tipo, nome, resgatado_em, created_at) VALUES (?, ?, ?, ?, NOW(), NOW())",
          [playerId, conquista.codigo, conquista.tipo, conquista.nome]
        );
        // Não atualizar codigos_sistema.usado
      } else {
        await connection.end();
        throw err;
      }
    }

    // Buscar todos os IDs que já resgataram este código (compatível com ambas as colunas)
    let allResgates: RowDataPacket[] = [];
    try {
      [allResgates] = await connection.query<RowDataPacket[]>(
        "SELECT resgatado_por FROM codigos_conquistas WHERE codigo = ?",
        [conquista.codigo]
      );
    } catch {
      // fallback para player_id
      [allResgates] = await connection.query<RowDataPacket[]>(
        "SELECT player_id FROM codigos_conquistas WHERE codigo = ?",
        [conquista.codigo]
      );
    }

    await connection.end();

    return NextResponse.json({
      success: true,
      novaConquista: {
        codigo: conquista.codigo,
        tipo: conquista.tipo,
        nome: conquista.nome,
      },
      resgatadoPorIds: allResgates.map((r: any) => r.resgatado_por ?? r.player_id)
    });
  } catch (err: any) {
    console.error("[API RESGATAR ERRO]", err);
    return NextResponse.json(
      { message: "Erro interno ao processar resgate", error: err?.message || String(err) },
      { status: 500 }
    );
  }
}

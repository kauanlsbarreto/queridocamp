import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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

    if (!codigo || !playerId) {
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

      await connection.query<ResultSetHeader>(
        "INSERT INTO codigos_conquistas (resgatado_por, codigo, tipo, nome) VALUES (?, ?, ?, ?)",
        [playerId, conquista.codigo, conquista.tipo, conquista.nome]
      );
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

        await connection.query<ResultSetHeader>(
          "INSERT INTO codigos_conquistas (player_id, codigo, tipo, nome) VALUES (?, ?, ?, ?)",
          [playerId, conquista.codigo, conquista.tipo, conquista.nome]
        );
      } else {
        await connection.end();
        throw err;
      }
    }

    await connection.end();

    return NextResponse.json({
      success: true,
      novaConquista: {
        codigo: conquista.codigo,
        tipo: conquista.tipo,
        nome: conquista.nome,
      },
    });
  } catch {
    return NextResponse.json(
      { message: "Erro interno ao processar resgate" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { randomBytes } from "crypto";

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

type CodigoRow = RowDataPacket & {
  id: number;
  codigo: string;
  tipo: "campeonato" | "MVP";
  nome: string;
  created_at: string;
};

async function createAchievementsTable(connection: any) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS codigos_sistema (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(255) NOT NULL UNIQUE,
      tipo ENUM('campeonato', 'MVP') NOT NULL,
      nome VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function POST(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const { tipo, nome, codigo } = await req.json();

    if (!tipo || !nome) {
      await connection.end();
      return NextResponse.json(
        { message: "Tipo e nome são obrigatórios." },
        { status: 400 }
      );
    }

    const codeToUse = codigo || randomBytes(8).toString("hex");

    await createAchievementsTable(connection);

    await connection.query<ResultSetHeader>(
      "INSERT INTO codigos_sistema (codigo, tipo, nome) VALUES (?, ?, ?)",
      [codeToUse, tipo, nome]
    );

    await connection.end();

    return NextResponse.json({ codigo: codeToUse, tipo, nome });
  } catch {
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const [rows] = await connection.query<CodigoRow[]>(
      "SELECT * FROM codigos_sistema ORDER BY created_at DESC"
    );

    await connection.end();

    return NextResponse.json(rows);
  } catch {
    return NextResponse.json(
      { message: "Erro ao buscar códigos" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const { id, nome, codigo } = await req.json();

    if (!id || !nome || !codigo) {
      await connection.end();
      return NextResponse.json(
        { message: "Dados incompletos." },
        { status: 400 }
      );
    }

    await connection.query<ResultSetHeader>(
      "UPDATE codigos_sistema SET nome = ?, codigo = ? WHERE id = ?",
      [nome, codigo, id]
    );

    await connection.end();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: "Erro ao atualizar código" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const { id } = await req.json();

    if (!id) {
      await connection.end();
      return NextResponse.json(
        { message: "ID é obrigatório." },
        { status: 400 }
      );
    }

    await connection.query<ResultSetHeader>(
      "DELETE FROM codigos_sistema WHERE id = ?",
      [id]
    );

    await connection.end();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { message: "Erro ao excluir código" },
      { status: 500 }
    );
  }
}

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

type CodigoRow = RowDataPacket & {
  id: number;
  tipo: string;
  nome: string;
  codigo: string;
  usado: number;
};

export async function GET() {
  try {
    const env = await getRuntimeEnv();
    const connection = await createMainConnection(env);

    const [rows] = await connection.query<CodigoRow[]>(
      "SELECT * FROM codigos_sistema ORDER BY id DESC"
    );

    await connection.end();

    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Erro ao buscar códigos" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const env = await getRuntimeEnv();
    const connection = await createMainConnection(env);

    const { tipo, nome, codigo } = await req.json();

    if (!tipo || !nome || !codigo) {
      await connection.end();
      return NextResponse.json(
        { message: "Campos obrigatórios faltando" },
        { status: 400 }
      );
    }

    const [existing] = await connection.query<CodigoRow[]>(
      "SELECT id FROM codigos_sistema WHERE codigo = ?",
      [codigo]
    );

    if (existing.length > 0) {
      await connection.end();
      return NextResponse.json(
        { message: "Este código já existe." },
        { status: 400 }
      );
    }

    await connection.query<ResultSetHeader>(
      "INSERT INTO codigos_sistema (tipo, nome, codigo, usado) VALUES (?, ?, ?, 0)",
      [tipo, nome, codigo]
    );

    await connection.end();

    return NextResponse.json({ success: true, codigo });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Erro ao criar código" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const env = await getRuntimeEnv();
    const connection = await createMainConnection(env);

    const { id, nome, codigo } = await req.json();

    if (!id || !nome || !codigo) {
      await connection.end();
      return NextResponse.json(
        { message: "Campos obrigatórios faltando" },
        { status: 400 }
      );
    }

    await connection.query<ResultSetHeader>(
      "UPDATE codigos_sistema SET nome = ?, codigo = ? WHERE id = ?",
      [nome, codigo, id]
    );

    await connection.end();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Erro ao atualizar código" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const env = await getRuntimeEnv();
    const connection = await createMainConnection(env);

    const { id } = await req.json();

    if (!id) {
      await connection.end();
      return NextResponse.json(
        { message: "ID é obrigatório" },
        { status: 400 }
      );
    }

    await connection.query<ResultSetHeader>(
      "DELETE FROM codigos_sistema WHERE id = ?",
      [id]
    );

    await connection.end();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Erro ao deletar código" },
      { status: 500 }
    );
  }
}

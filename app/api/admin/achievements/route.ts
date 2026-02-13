import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

type Env = {
  DB_PRINCIPAL?: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: number;
  };
  DB_JOGADORES?: {
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

// Fallback para desenvolvimento local sem Hyperdrive
function getLocalEnv(): Env {
  if (process.env.NODE_ENV === "development") {
    return {
      DB_PRINCIPAL: {
        host: "127.0.0.1",
        user: "root",
        password: "senha",
        database: "meu_db",
        port: 3306,
      },
      DB_JOGADORES: {
        host: "127.0.0.1",
        user: "root",
        password: "senha",
        database: "meu_db",
        port: 3306,
      },
    };
  }
  return {};
}

async function getEnv(): Promise<Env> {
  try {
    const ctx = await getCloudflareContext({ async: true });
    return ctx.env as unknown as Env;
  } catch {
    // fallback para desenvolvimento local
    return getLocalEnv();
  }
}

async function ensureAchievementsTable(connection: any) {
  await connection.query(
    `CREATE TABLE IF NOT EXISTS codigos_sistema (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(255) NOT NULL UNIQUE,
      tipo ENUM('campeonato', 'MVP') NOT NULL,
      nome VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );
}

export async function POST(req: Request) {
  let connection: any;
  try {
    const env = await getEnv();
    if (!env.DB_PRINCIPAL) throw new Error("DB_PRINCIPAL não configurado");

    connection = await createMainConnection(env);

    const { tipo, nome, codigo } = await req.json();
    if (!tipo || !nome) {
      return NextResponse.json({ message: "Tipo e nome são obrigatórios." }, { status: 400 });
    }

    const codeToUse = codigo || randomBytes(8).toString("hex");

    await ensureAchievementsTable(connection);

    // Removendo type argument para evitar TS2347
    const insertResultRaw = await connection.query(
      "INSERT INTO codigos_sistema (codigo, tipo, nome) VALUES (?, ?, ?)",
      [codeToUse, tipo, nome]
    );

    return NextResponse.json({ codigo: codeToUse, tipo, nome });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Erro interno do servidor" }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function GET() {
  let connection: any;
  try {
    const env = await getEnv();
    if (!env.DB_PRINCIPAL) throw new Error("DB_PRINCIPAL não configurado");

    connection = await createMainConnection(env);

    const [rowsRaw] = await connection.query("SELECT * FROM codigos_sistema ORDER BY created_at DESC");
    const rows: CodigoRow[] = rowsRaw as CodigoRow[];

    return NextResponse.json(rows);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Erro ao buscar códigos" }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function PUT(req: Request) {
  let connection: any;
  try {
    const env = await getEnv();
    if (!env.DB_PRINCIPAL) throw new Error("DB_PRINCIPAL não configurado");

    connection = await createMainConnection(env);

    const { id, nome, codigo } = await req.json();
    if (!id || !nome || !codigo) {
      return NextResponse.json({ message: "Dados incompletos." }, { status: 400 });
    }

    await connection.query(
      "UPDATE codigos_sistema SET nome = ?, codigo = ? WHERE id = ?",
      [nome, codigo, id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Erro ao atualizar código" }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function DELETE(req: Request) {
  let connection: any;
  try {
    const env = await getEnv();
    if (!env.DB_PRINCIPAL) throw new Error("DB_PRINCIPAL não configurado");

    connection = await createMainConnection(env);

    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ message: "ID é obrigatório." }, { status: 400 });
    }

    await connection.query(
      "DELETE FROM codigos_sistema WHERE id = ?",
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Erro ao excluir código" }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import { revalidatePath } from "next/cache";
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

type AdminRow = RowDataPacket & {
  admin: number;
};

async function updateAllData(connection: any) {
  const pages = [
    { name: "Classificação", path: "/classificacao" },
    { name: "Times", path: "/times" },
    { name: "Players", path: "/players" },
    { name: "Stats", path: "/stats" },
    { name: "Redondo", path: "/redondo" },
    { name: "Rodadas", path: "/rodadas" },
  ];

  const results = await Promise.all(
    pages.map(async (page) => {
      try {
        revalidatePath(page.path);
        return { name: page.name, status: "success" as const, message: "Dados atualizados." };
      } catch {
        return { name: page.name, status: "error" as const, message: "Falha ao atualizar." };
      }
    })
  );

  try {
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS site_metadata (
        key_name VARCHAR(50) NOT NULL,
        value TEXT,
        PRIMARY KEY (key_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const now = new Date().toISOString();

    await connection.execute(
      `
      INSERT INTO site_metadata (key_name, value) 
      VALUES ('last_update', ?) 
      ON DUPLICATE KEY UPDATE value = ?
    `,
      [now, now]
    );
  } catch {}

  return { success: true, results };
}

export async function GET(req: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const authHeader = req.headers.get("Authorization");

    if (
      authHeader === `Bearer ${process.env.CRON_SECRET}` ||
      authHeader === "Bearer local-dev-token"
    ) {
      const result = await updateAllData(connection);
      return NextResponse.json(result);
    }

    return NextResponse.json({ message: "Não autorizado" }, { status: 401 });
  } catch {
    return NextResponse.json({ message: "Erro interno" }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function POST(req: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    connection = await createMainConnection(env);

    const body = await req.json().catch(() => ({}));
    const { faceit_guid } = body;

    if (!faceit_guid) {
      return NextResponse.json(
        { message: "Identificação do usuário ausente." },
        { status: 401 }
      );
    }

    const [rows] = await connection.execute(
      "SELECT admin FROM players WHERE faceit_guid = ?",
      [faceit_guid]
    ) as [AdminRow[], any];

    if (rows.length === 0 || (rows[0].admin !== 1 && rows[0].admin !== 2)) {
      return NextResponse.json(
        { message: "Dessa vez nao pequeno gafanhoto" },
        { status: 403 }
      );
    }

    const result = await updateAllData(connection);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { message: "Erro interno do servidor" },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}

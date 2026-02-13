import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import { revalidatePath } from "next/cache";
import type { Env } from "@/lib/db";

export const dynamic = "force-dynamic";

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
      } catch (err) {
        return { name: page.name, status: "error" as const, message: "Falha na revalidação." };
      }
    })
  );

  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS site_metadata (
        key_name VARCHAR(50) NOT NULL,
        value TEXT,
        PRIMARY KEY (key_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const now = new Date().toISOString();
    await connection.query(`
      INSERT INTO site_metadata (key_name, value) 
      VALUES ('last_update', ?) 
      ON DUPLICATE KEY UPDATE value = ?
    `, [now, now]);
  } catch (error) {
    console.error("Erro ao atualizar metadata:", error);
  }

  return { results };
}

export async function POST(req: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as Env;

    connection = await createMainConnection(env);

    const body = await req.json().catch(() => ({}));
    const { faceit_guid } = body;

    if (!faceit_guid) {
      return NextResponse.json({ message: "Identificação ausente." }, { status: 401 });
    }

    const [rows]: any = await connection.query(
      "SELECT admin FROM players WHERE faceit_guid = ?",
      [faceit_guid]
    );

    if (rows.length === 0 || (rows[0].admin !== 1 && rows[0].admin !== 2)) {
      return NextResponse.json({ message: "Acesso negado." }, { status: 403 });
    }

    const result = await updateAllData(connection);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Erro na API de Revalidate:", error.message);
    return NextResponse.json({ 
      message: "Erro ao processar atualização", 
      details: error.message 
    }, { status: 500 });
  } finally {
    if (connection) await connection.end?.();
  }
}
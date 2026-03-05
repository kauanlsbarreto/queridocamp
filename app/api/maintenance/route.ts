import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let connection: any;
  try {
    const { status } = await request.json();
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    const value = status ? 'true' : 'false';
    
    // Verifica se a chave já existe
    const [rows] = await connection.query(
      "SELECT * FROM site_metadata WHERE key_name = 'ranking_maintenance'"
    ) as [any[], any];

    if (rows.length > 0) {
      await connection.query(
        "UPDATE site_metadata SET value = ? WHERE key_name = 'ranking_maintenance'",
        [value]
      );
    } else {
      await connection.query(
        "INSERT INTO site_metadata (key_name, value) VALUES ('ranking_maintenance', ?)",
        [value]
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao atualizar manutenção:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}
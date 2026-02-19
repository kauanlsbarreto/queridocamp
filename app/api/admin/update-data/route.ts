import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  let connection;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;

    const body = await request.json().catch(() => ({}));
    const { faceit_guid, path: specificPath, name: specificName } = body;

    const authHeader = request.headers.get('Authorization');
    const isDevOrCron = authHeader === `Bearer ${process.env.CRON_SECRET}` || authHeader === "Bearer local-dev-token";

    connection = await createMainConnection(env);

    if (!isDevOrCron) {
        if (!faceit_guid) {
            return NextResponse.json({ message: "Identificação do usuário ausente." }, { status: 401 });
        }
        
        const [rows]: any = await connection.query("SELECT admin FROM players WHERE faceit_guid = ?", [faceit_guid]);
        
        if (!rows.length || (rows[0].admin !== 1 && rows[0].admin !== 2)) {
            return NextResponse.json({ message: "Dessa vez nao pequeno gafanhoto" }, { status: 403 });
        }
    }


    await connection.execute(`
      CREATE TABLE IF NOT EXISTS site_metadata (
        key_name VARCHAR(50) NOT NULL,
        value TEXT,
        PRIMARY KEY (key_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const now = new Date().toISOString();
    await connection.query(
      "INSERT INTO site_metadata (key_name, value) VALUES ('last_update', ?) ON DUPLICATE KEY UPDATE value = ?",
      [now, now]
    );

    const allPaths = [
      {name:"Classificação",path:"/classificacao"},
      {name:"Times",path:"/times"},
      {name:"Players",path:"/players"},
      {name:"Stats",path:"/stats"},
      {name:"Redondo",path:"/redondo"},
      {name:"Rodadas",path:"/rodadas"}
    ];

    const pathsToUpdate = specificPath 
        ? [{ name: specificName || specificPath, path: specificPath }] 
        : allPaths;

    const results: { name: string; status: 'success' | 'error'; message: string }[] = [];

    for (const p of pathsToUpdate) {
        try {
            revalidatePath(p.path);
            results.push({ name: p.name, status: 'success', message: 'Página atualizada.' });
        } catch (e) {
            console.error(`Erro ao revalidar ${p.path}:`, e);
            results.push({ name: p.name, status: 'error', message: 'Falha ao atualizar página.' });
        }
    }

    if (!specificPath) {
      const tagsToRevalidate = ['teams-data']; 
      for (const tag of tagsToRevalidate) {
        try {
          revalidateTag(tag);
          results.push({ name: `Cache de Dados (${tag})`, status: 'success', message: 'Cache atualizado.' });
        } catch (e) {
          console.error(`Erro ao revalidar a tag ${tag}:`, e);
          results.push({ name: `Cache de Dados (${tag})`, status: 'error', message: 'Falha ao atualizar cache.' });
        }
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    console.error("Erro API update-data:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ message: "Erro interno do servidor.", error: errorMessage }, { status: 500 });
  } finally {
    if (connection) await connection.end().catch(console.error);
  }
}

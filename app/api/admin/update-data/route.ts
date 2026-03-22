import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { createMainConnection } from '@/lib/db';
import { ensurePermissionsSchema, hasPermission, PERMISSION_KEYS } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// key reused in various client pages; keep in sync if changed
const faceitApiKey = '7b080715-fe0b-461d-a1f1-62cfd0c47e63';

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

        await ensurePermissionsSchema(connection);
        const allowed = await hasPermission(connection, faceit_guid, PERMISSION_KEYS.UPDATE_DATA);
        if (!allowed) {
            return NextResponse.json({ message: "Dessa vez nao pequeno gafanhoto" }, { status: 403 });
        }
    }


    await connection.query(`
      CREATE TABLE IF NOT EXISTS site_metadata (
        key_name VARCHAR(50) NOT NULL,
        value TEXT,
        PRIMARY KEY (key_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const allPaths = [
      {name:"Classificação",path:"/classificacao"},
      {name:"Times",path:"/times"},
      {name:"Players",path:"/players"},
      {name:"Stats",path:"/stats"},
      {name:"Rodadas",path:"/rodadas"}
    ];

    const pathsToUpdate = specificPath 
        ? [{ name: specificName || specificPath, path: specificPath }] 
        : allPaths;

    const results: { name: string; status: 'success' | 'error'; message: string }[] = [];
  let hasSuccessfulTableUpdate = false;

    for (const p of pathsToUpdate) {
        try {
            const type = (p as any).type as "layout" | "page" | undefined;
            revalidatePath(p.path, type);
            results.push({ name: p.name, status: 'success', message: 'Página atualizada.' });
      hasSuccessfulTableUpdate = true;
        } catch (e) {
            console.error(`Erro ao revalidar ${p.path}:`, e);
            results.push({ name: p.name, status: 'error', message: 'Falha ao atualizar página.' });
        }
    }


    try {
      // wipe out all existing avatars before refetching
      await connection.query('UPDATE players SET avatar = ""');

      const [allPlayers]: any = await connection.query(
        "SELECT id, faceit_guid FROM players WHERE faceit_guid IS NOT NULL"
      );
      for (const row of allPlayers) {
        if (!row.faceit_guid) continue;
        try {
          const faceitRes = await fetch(
            `https://open.faceit.com/data/v4/players/${row.faceit_guid}`,
            { headers: { Authorization: `Bearer ${faceitApiKey}` } }
          );
          if (faceitRes.ok) {
            const faceitData = await faceitRes.json();
            if (faceitData.avatar) {
              await connection.query(
                'UPDATE players SET avatar = ? WHERE id = ?',
                [faceitData.avatar, row.id]
              );
            }
          }
        } catch (e) {
          console.error('Erro ao atualizar avatar em lote:', e);
        }
      }
      results.push({ name: 'Atualizar avatares', status: 'success', message: 'Repopulação concluída.' });
    } catch (e) {
      console.error('Falha ao processar avatares:', e);
      results.push({ name: 'Atualizar avatares', status: 'error', message: 'Falha ao consultar jogadores.' });
    }

    if (hasSuccessfulTableUpdate) {
      const now = new Date().toISOString();
      await connection.query(
        "INSERT INTO site_metadata (key_name, value) VALUES ('last_update', ?) ON DUPLICATE KEY UPDATE value = ?",
        [now, now]
      );
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

import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const dynamic = "force-dynamic";

type NotificacaoRow = RowDataPacket & {
  id: number;
  titulo: string;
  descricao: string;
  data: string;
  pagina: string | null;
};

type PlayerRow = RowDataPacket & {
  id: number;
  admin: number;
};

export async function GET() {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    const [rows] = await connection.query(
      "SELECT id, titulo, descricao, data, pagina FROM notificacoes ORDER BY data DESC"
    ) as [NotificacaoRow[], any];

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Erro ao buscar notificações:", error);
    return NextResponse.json([], { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

export async function POST(req: Request) {
  let connection: any;
  try {
    const body = await req.json();
    const titulo = String(body?.titulo || "").trim();
    const descricao = String(body?.descricao || "").trim();
    const requesterGuid = String(body?.requesterGuid || "").trim();
    const paginaRaw = String(body?.pagina || "").trim();
    const pagina = paginaRaw ? (paginaRaw.startsWith("/") ? paginaRaw : `/${paginaRaw}`) : null;

    if (!titulo || !descricao || !requesterGuid) {
      return NextResponse.json({ message: "Titulo, descricao e identificacao do admin sao obrigatorios." }, { status: 400 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    const [players] = await connection.query(
      "SELECT id, admin FROM players WHERE faceit_guid = ? LIMIT 1",
      [requesterGuid]
    ) as [PlayerRow[], any];

    const adminLevel = players?.[0]?.admin;
    if (typeof adminLevel !== "number" || adminLevel < 1 || adminLevel > 5) {
      return NextResponse.json({ message: "Voce nao tem permissao para adicionar notificacoes." }, { status: 403 });
    }

    const [result] = await connection.query(
      "INSERT INTO notificacoes (titulo, descricao, pagina) VALUES (?, ?, ?)",
      [titulo, descricao, pagina]
    ) as [ResultSetHeader, any];

    const [rows] = await connection.query(
      "SELECT id, titulo, descricao, data, pagina FROM notificacoes WHERE id = ? LIMIT 1",
      [result.insertId]
    ) as [NotificacaoRow[], any];

    return NextResponse.json(rows[0] || null, { status: 201 });
  } catch (error) {
    console.error("Erro ao criar notificacao:", error);
    return NextResponse.json({ message: "Erro interno do servidor." }, { status: 500 });
  } finally {
    if (connection) await connection.end();
  }
}

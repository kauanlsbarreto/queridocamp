import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMainConnection } from "@/lib/db";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { ensurePermissionsSchema, hasPermission, PERMISSION_KEYS } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type NotificacaoRow = RowDataPacket & {
  id: number;
  titulo: string;
  descricao: string;
  data: string;
  pagina: string | null;
  target_user_id: number | null;
};

type PlayerRow = RowDataPacket & {
  id: number;
  admin: number;
};

async function ensureNotificacoesSchema(connection: any) {
  try {
    await connection.query("ALTER TABLE notificacoes ADD COLUMN target_user_id INT NULL AFTER pagina");
  } catch {}

  try {
    await connection.query("ALTER TABLE notificacoes ADD COLUMN created_by_user_id INT NULL AFTER target_user_id");
  } catch {}

  try {
    await connection.query("ALTER TABLE notificacoes ADD INDEX idx_notificacoes_target_user_id (target_user_id)");
  } catch {}
}

export async function GET(req: Request) {
  let connection: any;
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensureNotificacoesSchema(connection);

    const { searchParams } = new URL(req.url);
    const userId = Number(searchParams.get("userId") || 0);

    const [rows] = await connection.query(
      `
      SELECT id, titulo, descricao, data, pagina, target_user_id
      FROM notificacoes
      WHERE target_user_id IS NULL OR target_user_id = ?
      ORDER BY data DESC
      `,
      [Number.isFinite(userId) ? userId : 0]
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
    const targetUserIdRaw = Number(body?.targetUserId || 0);
    const createdByUserIdRaw = Number(body?.createdByUserId || 0);
    const paginaRaw = String(body?.pagina || "").trim();
    const pagina = paginaRaw ? (paginaRaw.startsWith("/") ? paginaRaw : `/${paginaRaw}`) : null;
    const targetUserId = Number.isInteger(targetUserIdRaw) && targetUserIdRaw > 0 ? targetUserIdRaw : null;
    const createdByUserId = Number.isInteger(createdByUserIdRaw) && createdByUserIdRaw > 0 ? createdByUserIdRaw : null;

    if (!titulo || !descricao || !requesterGuid) {
      return NextResponse.json({ message: "Titulo, descricao e identificacao do admin sao obrigatorios." }, { status: 400 });
    }

    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as any;
    connection = await createMainConnection(env);

    await ensureNotificacoesSchema(connection);

    const [players] = await connection.query(
      "SELECT id, admin FROM players WHERE faceit_guid = ? LIMIT 1",
      [requesterGuid]
    ) as [PlayerRow[], any];

    await ensurePermissionsSchema(connection);
    const allowed = await hasPermission(connection, requesterGuid, PERMISSION_KEYS.SEND_NOTIFICATIONS);
    if (!allowed) {
      return NextResponse.json({ message: "Voce nao tem permissao para adicionar notificacoes." }, { status: 403 });
    }

    const [result] = await connection.query(
      "INSERT INTO notificacoes (titulo, descricao, pagina, target_user_id, created_by_user_id) VALUES (?, ?, ?, ?, ?)",
      [titulo, descricao, pagina, targetUserId, createdByUserId]
    ) as [ResultSetHeader, any];

    const [rows] = await connection.query(
      "SELECT id, titulo, descricao, data, pagina, target_user_id FROM notificacoes WHERE id = ? LIMIT 1",
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

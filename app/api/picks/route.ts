import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
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

export async function POST(request: Request) {
  try {
    const ctx = await getCloudflareContext({ async: true });
    const env = ctx.env as unknown as Env;
    const connection = await createMainConnection(env);

    const body = await request.json();
    const {
      action,
      nickname,
      slotIndex,
      team,
      phase,
      faceit_guid,
      targetStatus,
      adminLevel,
    } = body;

    if (!nickname) {
      await connection.end();
      return NextResponse.json({ error: "Nickname required" }, { status: 400 });
    }

    if (action === "load") {
      const [rows] = await connection.query<RowDataPacket[]>(
        "SELECT * FROM escolhas WHERE nickname = ?",
        [nickname]
      );
      await connection.end();
      return NextResponse.json(rows[0] || {});
    }

    if (action === "save") {
      const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;

      const [rows] = await connection.query<RowDataPacket[]>(
        `SELECT ${lockCol} FROM escolhas WHERE nickname = ?`,
        [nickname]
      );

      if (rows.length > 0 && rows[0][lockCol]) {
        await connection.end();
        return NextResponse.json({ error: "Fase bloqueada" }, { status: 403 });
      }

      const idx = typeof slotIndex === "string" ? parseInt(slotIndex) : slotIndex;
      const col = `${phase}_${idx + 1}`;
      const teamJson = team ? JSON.stringify(team) : null;

      await connection.query<ResultSetHeader>(
        `INSERT INTO escolhas (nickname, faceit_guid, ${col})
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE ${col} = ?, faceit_guid = ?`,
        [nickname, faceit_guid || null, teamJson, teamJson, faceit_guid || null]
      );

      await connection.end();
      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    if (action === "lock") {
      const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;

      await connection.query<ResultSetHeader>(
        `UPDATE escolhas SET ${lockCol} = 1 WHERE nickname = ?`,
        [nickname]
      );

      await connection.end();
      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    if (action === "admin_toggle_global") {
      const level = typeof adminLevel === "string" ? parseInt(adminLevel) : adminLevel;

      if (!level || level > 2) {
        await connection.end();
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }

      const lockCol = phase === "slot" ? "locked" : `${phase}_locked`;

      await connection.query<ResultSetHeader>(
        `UPDATE escolhas SET ${lockCol} = ?`,
        [targetStatus]
      );

      await connection.end();
      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    if (action === "admin_manage_user") {
      const level = typeof adminLevel === "string" ? parseInt(adminLevel) : adminLevel;

      if (!level || level > 2) {
        await connection.end();
        return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
      }

      const { targetNickname, type, phase: targetPhase } = body;

      if (!targetNickname) {
        await connection.end();
        return NextResponse.json(
          { error: "Nickname alvo não informado" },
          { status: 400 }
        );
      }

      if (type === "unlock") {
        const lockCol =
          targetPhase === "slot" ? "locked" : `${targetPhase}_locked`;

        await connection.query<ResultSetHeader>(
          `UPDATE escolhas SET ${lockCol} = 0 WHERE nickname = ?`,
          [targetNickname]
        );
      } else if (type === "clear") {
        let updateQuery = "";

        if (targetPhase === "slot")
          updateQuery =
            "slot_1 = NULL, slot_2 = NULL, slot_3 = NULL, slot_4 = NULL, slot_5 = NULL, slot_6 = NULL, slot_7 = NULL, slot_8 = NULL, locked = 0";
        else if (targetPhase === "semi")
          updateQuery =
            "semi_1 = NULL, semi_2 = NULL, semi_3 = NULL, semi_4 = NULL, semi_locked = 0";
        else if (targetPhase === "final")
          updateQuery =
            "final_1 = NULL, final_2 = NULL, final_locked = 0";

        if (updateQuery) {
          await connection.query<ResultSetHeader>(
            `UPDATE escolhas SET ${updateQuery} WHERE nickname = ?`,
            [targetNickname]
          );
        }
      }

      await connection.end();
      revalidatePath("/redondo");
      return NextResponse.json({ success: true });
    }

    await connection.end();
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
